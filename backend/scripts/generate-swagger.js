const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'production';
process.chdir(path.join(__dirname, '..'));

const swaggerModule = require('../config/swagger');

const specs =
  typeof swaggerModule.getRuntimeSpecs === 'function'
    ? swaggerModule.getRuntimeSpecs()
    : swaggerModule;
const outputPath = path.join(__dirname, '../docs/swagger.json');
const apiDocsOutputPath = path.join(__dirname, '../docs/api-documentation.json');
const mdOutputPath = path.join(__dirname, '../docs/api-documentation.md');

function escapeMarkdown(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getComponentSchema(ref) {
  if (!ref || !ref.startsWith('#/components/schemas/')) {
    return null;
  }

  const schemaName = ref.replace('#/components/schemas/', '');
  return specs.components?.schemas?.[schemaName] || null;
}

function mergeSchemaList(schemaList, stack) {
  const merged = {
    type: 'object',
    properties: {},
    required: [],
    description: '',
  };

  for (const schema of schemaList) {
    const resolved = resolveSchema(schema, stack);
    if (!resolved || typeof resolved !== 'object') {
      continue;
    }

    if (resolved.description && !merged.description) {
      merged.description = resolved.description;
    }

    if (resolved.properties) {
      Object.assign(merged.properties, resolved.properties);
    }

    if (Array.isArray(resolved.required)) {
      merged.required.push(...resolved.required);
    }
  }

  merged.required = Array.from(new Set(merged.required));
  return merged;
}

function resolveSchema(schema, stack = []) {
  if (!schema || typeof schema !== 'object') {
    return null;
  }

  if (schema.$ref) {
    if (stack.includes(schema.$ref)) {
      return {
        type: 'object',
        description: `Circular reference: ${schema.$ref}`,
      };
    }

    const referencedSchema = getComponentSchema(schema.$ref);
    if (!referencedSchema) {
      return {
        type: 'object',
        description: `Missing reference: ${schema.$ref}`,
      };
    }

    return resolveSchema(referencedSchema, [...stack, schema.$ref]);
  }

  if (Array.isArray(schema.allOf)) {
    return mergeSchemaList(schema.allOf, stack);
  }

  if (Array.isArray(schema.oneOf)) {
    return {
      ...schema,
      _variant: 'oneOf',
    };
  }

  if (Array.isArray(schema.anyOf)) {
    return {
      ...schema,
      _variant: 'anyOf',
    };
  }

  return schema;
}

function getSchemaType(schema) {
  const resolved = resolveSchema(schema);
  if (!resolved) {
    return 'unknown';
  }

  if (resolved._variant && Array.isArray(resolved[resolved._variant])) {
    const variants = resolved[resolved._variant]
      .map(item => getSchemaType(item))
      .filter(Boolean)
      .join(' | ');
    return `${resolved._variant}(${variants})`;
  }

  if (resolved.enum) {
    return `enum(${resolved.enum.join(', ')})`;
  }

  if (resolved.type === 'array') {
    return `array<${getSchemaType(resolved.items)}>`;
  }

  if (resolved.type) {
    return resolved.type;
  }

  if (resolved.properties) {
    return 'object';
  }

  return 'object';
}

function flattenSchema(schema, prefix = '', stack = [], requiredSet = new Set()) {
  const resolved = resolveSchema(schema, stack);
  if (!resolved) {
    return [];
  }

  if (resolved._variant && Array.isArray(resolved[resolved._variant])) {
    const rows = [];
    resolved[resolved._variant].forEach((variantSchema, index) => {
      const variantPath = prefix || 'payload';
      rows.push({
        name: `${variantPath}#${index + 1}`,
        type: getSchemaType(variantSchema),
        required: requiredSet.has(variantPath) ? 'yes' : 'no',
        description: `${resolved._variant} variant ${index + 1}`,
      });
      rows.push(
        ...flattenSchema(
          variantSchema,
          variantPath,
          stack,
          requiredSet,
        ),
      );
    });
    return rows;
  }

  if (resolved.type === 'array') {
    const arrayPath = prefix || 'items';
    const rows = [
      {
        name: arrayPath,
        type: getSchemaType(resolved),
        required: requiredSet.has(arrayPath) ? 'yes' : 'no',
        description: resolved.description || '',
      },
    ];

    return rows.concat(
      flattenSchema(
        resolved.items,
        `${arrayPath}[]`,
        stack,
        new Set(),
      ),
    );
  }

  if (resolved.properties && typeof resolved.properties === 'object') {
    const localRequired = new Set(resolved.required || []);
    const rows = [];

    for (const [propName, propSchema] of Object.entries(resolved.properties)) {
      const fieldPath = prefix ? `${prefix}.${propName}` : propName;
      rows.push({
        name: fieldPath,
        type: getSchemaType(propSchema),
        required: localRequired.has(propName) ? 'yes' : 'no',
        description: resolveSchema(propSchema)?.description || '',
      });

      rows.push(
        ...flattenSchema(
          propSchema,
          fieldPath,
          stack,
          localRequired,
        ),
      );
    }

    return rows;
  }

  if (!prefix) {
    return [];
  }

  return [
    {
      name: prefix,
      type: getSchemaType(resolved),
      required: requiredSet.has(prefix) ? 'yes' : 'no',
      description: resolved.description || '',
    },
  ];
}

function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const key = `${row.name}|${row.type}|${row.required}|${row.description}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function renderTable(title, rows) {
  if (!rows.length) {
    return [`### ${title}\n`, '无\n'];
  }

  const lines = [`### ${title}\n`, '| 字段 | 类型 | 必填 | 说明 |\n', '| --- | --- | --- | --- |\n'];
  for (const row of rows) {
    lines.push(
      `| ${escapeMarkdown(row.name)} | ${escapeMarkdown(row.type)} | ${escapeMarkdown(row.required)} | ${escapeMarkdown(row.description)} |\n`,
    );
  }
  lines.push('\n');
  return lines;
}

function renderParameters(parameters = [], location) {
  const rows = parameters
    .filter(parameter => parameter.in === location)
    .map(parameter => ({
      name: parameter.name,
      type: getSchemaType(parameter.schema),
      required: parameter.required ? 'yes' : 'no',
      description: parameter.description || '',
    }));

  const titleMap = {
    path: 'Path Parameters',
    query: 'Query Parameters',
    header: 'Header Parameters',
    cookie: 'Cookie Parameters',
  };

  return renderTable(titleMap[location] || `${location} Parameters`, rows);
}

function renderRequestBody(requestBody) {
  if (!requestBody) {
    return ['### Request Body\n', '无\n'];
  }

  const lines = ['### Request Body\n'];
  if (requestBody.description) {
    lines.push(`${escapeMarkdown(requestBody.description)}\n`);
  }

  if (requestBody.required) {
    lines.push('必填请求体: yes\n');
  }

  const contentEntries = Object.entries(requestBody.content || {});
  if (!contentEntries.length) {
    lines.push('无结构化内容\n');
    return lines;
  }

  for (const [contentType, media] of contentEntries) {
    lines.push(`#### ${contentType}\n`);
    const rows = dedupeRows(flattenSchema(media.schema));
    lines.push(...renderTable(`Schema (${contentType})`, rows));
  }

  return lines;
}

function renderResponses(responses = {}) {
  const lines = ['### Responses\n'];
  const statuses = Object.keys(responses).sort((a, b) => {
    const aNum = Number(a);
    const bNum = Number(b);
    if (Number.isNaN(aNum) || Number.isNaN(bNum)) {
      return a.localeCompare(b);
    }
    return aNum - bNum;
  });

  if (!statuses.length) {
    lines.push('无\n');
    return lines;
  }

  for (const status of statuses) {
    const response = responses[status] || {};
    lines.push(`#### ${status}\n`);
    lines.push(`${escapeMarkdown(response.description || 'No description')}\n`);

    for (const [contentType, media] of Object.entries(response.content || {})) {
      lines.push(`##### ${contentType}\n`);
      const rows = dedupeRows(flattenSchema(media.schema));
      lines.push(...renderTable(`Response Schema (${status} ${contentType})`, rows));
    }
  }

  return lines;
}

function renderSecurity(details) {
  const security = details.security || specs.security || [];
  if (!security.length) {
    return ['### Authentication\n', '无\n'];
  }

  const names = security
    .map(item => Object.keys(item || {}))
    .flat()
    .filter(Boolean);

  return ['### Authentication\n', `${names.length ? names.join(', ') : 'configured'}\n`];
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(specs, null, 2), 'utf8');
console.log(`✅ Swagger JSON written to ${outputPath} (${Object.keys(specs.paths || {}).length} paths)`);

fs.writeFileSync(apiDocsOutputPath, JSON.stringify(specs, null, 2), 'utf8');
console.log(`✅ API documentation JSON written to ${apiDocsOutputPath}`);

const mdLines = [
  '# AssetHub API Documentation\n',
  `> Generated at: ${new Date().toISOString()}\n`,
  `> OpenAPI version: ${escapeMarkdown(specs.openapi || '')}\n`,
  `> Total endpoints: ${Object.keys(specs.paths || {}).length}\n`,
];

const serverUrls = (specs.servers || []).map(server => server.url).filter(Boolean);
if (serverUrls.length) {
  mdLines.push(`> Servers: ${serverUrls.map(escapeMarkdown).join(', ')}\n`);
}

mdLines.push('');

for (const [pathKey, pathValue] of Object.entries(specs.paths || {}).sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const [method, details] of Object.entries(pathValue).sort((a, b) => a[0].localeCompare(b[0]))) {
    const summary = details.summary || '';
    const description = details.description || '';
    const tags = (details.tags || []).join(', ');

    mdLines.push(`## ${method.toUpperCase()} ${pathKey}\n`);
    if (summary) {
      mdLines.push(`> ${escapeMarkdown(summary)}\n`);
    }
    if (description && description !== summary) {
      mdLines.push(`${escapeMarkdown(description)}\n`);
    }
    if (tags) {
      mdLines.push(`**Tags:** ${escapeMarkdown(tags)}\n`);
    }
    mdLines.push('');

    mdLines.push(...renderSecurity(details));
    mdLines.push(...renderParameters(details.parameters, 'path'));
    mdLines.push(...renderParameters(details.parameters, 'query'));
    mdLines.push(...renderParameters(details.parameters, 'header'));
    mdLines.push(...renderParameters(details.parameters, 'cookie'));
    mdLines.push(...renderRequestBody(details.requestBody));
    mdLines.push(...renderResponses(details.responses));
  }
}

const normalizedMarkdown = mdLines.map(line => (line.endsWith('\n') ? line : `${line}\n`)).join('');
fs.writeFileSync(mdOutputPath, normalizedMarkdown, 'utf8');
console.log(`✅ Detailed API documentation MD written to ${mdOutputPath}`);
