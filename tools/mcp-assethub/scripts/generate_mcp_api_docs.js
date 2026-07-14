const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../..');
const MCP_DIR = path.resolve(__dirname, '..');
const BACKEND_SWAGGER_PATH = path.join(ROOT_DIR, 'backend/docs/swagger.json');
const SERVER_SOURCE_PATH = path.join(MCP_DIR, 'server.go');
const TOOLS_SOURCE_PATH = path.join(MCP_DIR, 'tools.go');
const HANDLERS_SOURCE_PATH = path.join(MCP_DIR, 'tool_handlers.go');
const OUTPUT_DIR = path.join(MCP_DIR, 'docs');
const JSON_OUTPUT_PATH = path.join(OUTPUT_DIR, 'mcp-api-update-map.json');
const MD_OUTPUT_PATH = path.join(OUTPUT_DIR, 'mcp-api-update-guide.md');

function escapeMarkdown(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getComponentSchema(specs, ref) {
  if (!ref || !ref.startsWith('#/components/schemas/')) {
    return null;
  }

  const schemaName = ref.replace('#/components/schemas/', '');
  return specs.components?.schemas?.[schemaName] || null;
}

function mergeSchemaList(specs, schemaList, stack) {
  const merged = {
    type: 'object',
    properties: {},
    required: [],
    description: '',
  };

  for (const schema of schemaList) {
    const resolved = resolveSchema(specs, schema, stack);
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

function resolveSchema(specs, schema, stack = []) {
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

    const resolved = getComponentSchema(specs, schema.$ref);
    if (!resolved) {
      return {
        type: 'object',
        description: `Missing reference: ${schema.$ref}`,
      };
    }

    return resolveSchema(specs, resolved, [...stack, schema.$ref]);
  }

  if (Array.isArray(schema.allOf)) {
    return mergeSchemaList(specs, schema.allOf, stack);
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

function getSchemaType(specs, schema) {
  const resolved = resolveSchema(specs, schema);
  if (!resolved) {
    return 'unknown';
  }

  if (resolved._variant && Array.isArray(resolved[resolved._variant])) {
    const types = resolved[resolved._variant]
      .map(item => getSchemaType(specs, item))
      .filter(Boolean)
      .join(' | ');
    return `${resolved._variant}(${types})`;
  }

  if (resolved.enum) {
    return `enum(${resolved.enum.join(', ')})`;
  }

  if (resolved.type === 'array') {
    return `array<${getSchemaType(specs, resolved.items)}>`;
  }

  if (resolved.type) {
    return resolved.type;
  }

  if (resolved.properties) {
    return 'object';
  }

  return 'object';
}

function flattenSchema(specs, schema, prefix = '', stack = [], requiredSet = new Set()) {
  const resolved = resolveSchema(specs, schema, stack);
  if (!resolved) {
    return [];
  }

  if (resolved._variant && Array.isArray(resolved[resolved._variant])) {
    const rows = [];
    resolved[resolved._variant].forEach((variantSchema, index) => {
      const basePath = prefix || 'payload';
      rows.push({
        name: `${basePath}#${index + 1}`,
        type: getSchemaType(specs, variantSchema),
        required: requiredSet.has(basePath) ? 'yes' : 'no',
        description: `${resolved._variant} variant ${index + 1}`,
      });
      rows.push(...flattenSchema(specs, variantSchema, basePath, stack, requiredSet));
    });
    return rows;
  }

  if (resolved.type === 'array') {
    const arrayPath = prefix || 'items';
    const rows = [
      {
        name: arrayPath,
        type: getSchemaType(specs, resolved),
        required: requiredSet.has(arrayPath) ? 'yes' : 'no',
        description: resolved.description || '',
      },
    ];
    return rows.concat(flattenSchema(specs, resolved.items, `${arrayPath}[]`, stack, new Set()));
  }

  if (resolved.properties && typeof resolved.properties === 'object') {
    const localRequired = new Set(resolved.required || []);
    const rows = [];

    for (const [propName, propSchema] of Object.entries(resolved.properties)) {
      const fieldPath = prefix ? `${prefix}.${propName}` : propName;
      rows.push({
        name: fieldPath,
        type: getSchemaType(specs, propSchema),
        required: localRequired.has(propName) ? 'yes' : 'no',
        description: resolveSchema(specs, propSchema)?.description || '',
      });
      rows.push(...flattenSchema(specs, propSchema, fieldPath, stack, localRequired));
    }

    return rows;
  }

  if (!prefix) {
    return [];
  }

  return [
    {
      name: prefix,
      type: getSchemaType(specs, resolved),
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

function renderParameterTable(specs, parameters = [], location) {
  const rows = parameters
    .filter(parameter => parameter.in === location)
    .map(parameter => ({
      name: parameter.name,
      type: getSchemaType(specs, parameter.schema),
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

function renderRequestBody(specs, requestBody) {
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

  for (const [contentType, media] of Object.entries(requestBody.content || {})) {
    lines.push(`#### ${contentType}\n`);
    lines.push(...renderTable(`Schema (${contentType})`, dedupeRows(flattenSchema(specs, media.schema))));
  }

  if (!Object.keys(requestBody.content || {}).length) {
    lines.push('无结构化内容\n');
  }

  return lines;
}

function renderResponses(specs, responses = {}) {
  const lines = ['### Responses\n'];
  const statuses = Object.keys(responses).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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
      lines.push(...renderTable(`Response Schema (${status} ${contentType})`, dedupeRows(flattenSchema(specs, media.schema))));
    }
  }

  return lines;
}

function renderSecurity(specs, endpoint) {
  const security = endpoint.security || specs.security || [];
  if (!security.length) {
    return ['### Authentication\n', '无\n'];
  }

  const names = security.map(entry => Object.keys(entry || {})).flat();
  return ['### Authentication\n', `${names.length ? names.join(', ') : 'configured'}\n`];
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function parseToolRegistrations(serverSource) {
	const regex = /RegisterHandler\("([^"]+)",\s*([A-Za-z0-9_]+)\)/g;
	const registrations = [];
	let match;
	while ((match = regex.exec(serverSource)) !== null) {
		registrations.push({
			toolName: match[1],
			handlerName: match[2],
		});
	}
	return registrations;
}

function parseToolDefinitions(toolsSource) {
  const cases = {};
  
  // Find all tool definition functions
  const toolDefinitionFiles = [
    'tools_definitions.go',
    'tools_transfer.go',
    'tools_maintenance.go',
    'tools_common.go',
    'tools_system.go',
    'tools_iot.go',
    'tools_business.go',
    'tools_analytics.go',
  ];
  
  // Let's parse the current file first
  parseToolDefsFromSource(toolsSource, cases);
  
  // Also try to read and parse other tool definition files
  const rootDir = path.resolve(__dirname, '../..');
  const mcpDir = path.resolve(__dirname, '..');
  
  for (const file of toolDefinitionFiles) {
    const filePath = path.join(mcpDir, file);
    if (fs.existsSync(filePath)) {
      try {
        const source = fs.readFileSync(filePath, 'utf8');
        parseToolDefsFromSource(source, cases);
      } catch (e) {
        console.warn(`Failed to read ${file}:`, e.message);
      }
    }
  }
  
  return cases;
}

function parseToolDefsFromSource(source, cases) {
  // Find all switch cases that define tools
  const switchRegex = /case\s+"([^"]+)":\s*return\s*Tool\{([\s\S]*?)\}(?=\s*case\s+|$)/g;
  let match;
  
  while ((match = switchRegex.exec(source)) !== null) {
    const toolName = match[1];
    const toolBody = match[2];
    
    // Parse Description
    const descMatch = toolBody.match(/Description:\s*"((?:\\"|[^"])*)"/);
    const description = descMatch ? descMatch[1].replace(/\\"/g, '"') : '';
    
    // Parse InputSchema properties
    const properties = [];
    const requiredNames = [];
    
    // Find all properties
    const propRegex = /"([A-Za-z0-9_]+)":\s*map\[string\]interface{}\{"type":\s*"([^"]+)"(?:,\s*"description":\s*"([^"]*)")?/g;
    let propMatch;
    
    while ((propMatch = propRegex.exec(toolBody)) !== null) {
      properties.push({
        name: propMatch[1],
        type: propMatch[2],
        required: 'no',
        description: propMatch[3] || '',
      });
    }
    
    // Find required fields
    const requiredMatch = toolBody.match(/"required":\s*\[\]string\{([^}]*)\}/);
    if (requiredMatch) {
      const reqFields = requiredMatch[1]
        .split(',')
        .map(item => item.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
      
      for (const reqField of reqFields) {
        requiredNames.push(reqField);
        const prop = properties.find(p => p.name === reqField);
        if (prop) {
          prop.required = 'yes';
        }
      }
    }
    
    cases[toolName] = {
      description,
      inputSchema: {
        properties,
        required: requiredNames,
      },
    };
  }
}

// Keep original function for backward compatibility
function oldParseToolDefinitions(toolsSource) {
  const cases = {};
  const lines = toolsSource.split('\n');
  let currentToolName = null;
  let currentBlockLines = [];

  const flush = () => {
    if (!currentToolName) {
      return;
    }

    const block = currentBlockLines.join('\n');
    const descriptionMatch = block.match(/Description:\s*"((?:\\"|[^"])*)"/);
    const requiredMatch = block.match(/"required": \[\]string\{([^}]*)\}/);
    const properties = [];
    const propertyRegex = /"([A-Za-z0-9_]+)":\s*map\[string\]interface\{}\{"type": "([^"]+)"(?:,\s*"description": "([^"]*)")?/g;
    let propertyMatch;

    while ((propertyMatch = propertyRegex.exec(block)) !== null) {
      properties.push({
        name: propertyMatch[1],
        type: propertyMatch[2],
        required: 'no',
        description: propertyMatch[3] || '',
      });
    }

    const requiredNames = (requiredMatch?.[1] || '')
      .split(',')
      .map(item => item.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);

    for (const property of properties) {
      if (requiredNames.includes(property.name)) {
        property.required = 'yes';
      }
    }

    cases[currentToolName] = {
      description: descriptionMatch ? descriptionMatch[1].replace(/\\"/g, '"') : '',
      inputSchema: {
        properties,
        required: requiredNames,
      },
    };
  };

  for (const line of lines) {
    const caseMatch = line.match(/^\s*case "([^"]+)":/);
    if (caseMatch) {
      flush();
      currentToolName = caseMatch[1];
      currentBlockLines = [];
      continue;
    }

    if (currentToolName && /^\s*default:/.test(line)) {
      flush();
      currentToolName = null;
      currentBlockLines = [];
      continue;
    }

    if (currentToolName) {
      currentBlockLines.push(line);
    }
  }

  flush();
  return cases;
}

function extractFunctionBody(source, funcName) {
  const lines = source.split('\n');
  const startLineIndex = lines.findIndex(line => line.includes(`func ${funcName}(`));
  if (startLineIndex === -1) {
    return '';
  }

  let depth = 0;
  let started = false;
  const bodyLines = [];

  for (let index = startLineIndex; index < lines.length; index += 1) {
    const line = lines[index];
    const openCount = (line.match(/\{/g) || []).length;
    const closeCount = (line.match(/\}/g) || []).length;

    if (!started) {
      const braceIndex = line.indexOf('{');
      if (braceIndex === -1) {
        continue;
      }

      started = true;
      depth += openCount - closeCount;
      const remainder = line.slice(braceIndex + 1);
      if (remainder.trim()) {
        bodyLines.push(remainder);
      }
      if (depth === 0) {
        break;
      }
      continue;
    }

    if (depth + openCount - closeCount <= 0) {
      const trimmed = line.replace(/\}.*/, '').trimEnd();
      if (trimmed.trim()) {
        bodyLines.push(trimmed);
      }
      break;
    }

    bodyLines.push(line);
    depth += openCount - closeCount;
  }

  return bodyLines.join('\n');
}

function splitTopLevelArgs(value) {
  const result = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringQuote = '';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      current += char;
      if (stringQuote !== '`' && char === '\\') {
        current += value[index + 1] || '';
        index += 1;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if (char === '"' || char === '\'' || char === '`') {
      inString = true;
      stringQuote = char;
      current += char;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ')' || char === ']' || char === '}') {
      depth -= 1;
      current += char;
      continue;
    }

    if (char === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

function inferArgName(expression, index) {
  const trimmed = expression.trim();
  if (!trimmed || trimmed === 'params') {
    return null;
  }

  const identifierMatch = trimmed.match(/([A-Za-z_][A-Za-z0-9_]*)\s*\)?$/);
  if (identifierMatch) {
    return identifierMatch[1];
  }

  return `param${index + 1}`;
}

function normalizePathExpression(expression) {
  const expr = expression.trim();

  if (expr.startsWith('fmt.Sprintf(')) {
    const formatMatch = expr.match(/fmt\.Sprintf\("([^"]+)"/);
    if (!formatMatch) {
      return expr;
    }

    let formatString = formatMatch[1];
    const argsSection = expr.slice(expr.indexOf(formatMatch[0]) + formatMatch[0].length).replace(/^\s*,\s*/, '').replace(/\)\s*$/, '');
    const args = splitTopLevelArgs(argsSection);
    const argNames = args.map(inferArgName);

    if (formatString.endsWith('%s') && args.at(-1) === 'params') {
      formatString = formatString.slice(0, -2);
      argNames.pop();
    }

    let placeholderIndex = 0;
    return formatString.replace(/%[-+#0-9.]*[a-zA-Z]/g, () => {
      const argName = argNames[placeholderIndex];
      placeholderIndex += 1;
      return argName ? `{${argName}}` : '';
    });
  }

  const stringLiterals = [...expr.matchAll(/"([^"]*)"/g)].map(match => match[1]);
  if (!stringLiterals.length) {
    return expr;
  }

  return stringLiterals[0];
}

function sanitizePathTemplate(pathTemplate) {
  return pathTemplate
    .replace(/\?[^#]*$/, '')
    .replace(/\{params\}/g, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '') || '/';
}

function extractRequestsFromHandlerBody(body) {
  const requests = [];
  const directRequestRegex = /client\.doRequest\("([A-Z]+)",\s*"([^"]+)"\s*,/g;
  let match;

  while ((match = directRequestRegex.exec(body)) !== null) {
    requests.push({
      method: match[1],
      pathTemplate: sanitizePathTemplate(match[2]),
      source: 'direct',
    });
  }

  const pathAssignmentMatch = body.match(/\bpath\s*:=\s*([^\n]+)/);
  const variableCallRegex = /client\.doRequest\("([A-Z]+)",\s*path\s*,/g;
  if (pathAssignmentMatch) {
    let variableCallMatch;
    while ((variableCallMatch = variableCallRegex.exec(body)) !== null) {
      requests.push({
        method: variableCallMatch[1],
        pathTemplate: sanitizePathTemplate(normalizePathExpression(pathAssignmentMatch[1])),
        source: 'path-variable',
      });
    }
  }

  const unique = new Map();
  for (const request of requests) {
    const key = `${request.method} ${request.pathTemplate}`;
    if (!unique.has(key)) {
      unique.set(key, request);
    }
  }

  return Array.from(unique.values());
}

function normalizePathForMatch(value) {
  return (value || '/')
    .replace(/\{[^}]+\}/g, '{}')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '') || '/';
}

function getStaticSegments(pathTemplate) {
  return normalizePathForMatch(pathTemplate)
    .split('/')
    .filter(Boolean)
    .filter(segment => segment !== '{}');
}

function matchEndpoint(specs, method, pathTemplate) {
  const normalizedMCPPath = normalizePathForMatch(pathTemplate);
  const candidates = [];

  for (const [specPath, pathItem] of Object.entries(specs.paths || {})) {
    const endpoint = pathItem?.[method.toLowerCase()];
    if (!endpoint) {
      continue;
    }

    const normalizedSpecPath = normalizePathForMatch(specPath);
    if (normalizedSpecPath === normalizedMCPPath) {
      return {
        status: 'exact',
        path: specPath,
        method: method.toUpperCase(),
        endpoint,
      };
    }

    const mcpStatic = getStaticSegments(normalizedMCPPath);
    const specStatic = getStaticSegments(normalizedSpecPath);
    const suffixMatch =
      mcpStatic.length > 0 &&
      specStatic.length >= mcpStatic.length &&
      specStatic.slice(-mcpStatic.length).join('/') === mcpStatic.join('/');

    const overlap = mcpStatic.filter(segment => specStatic.includes(segment)).length;
    if (suffixMatch || overlap > 0) {
      candidates.push({
        path: specPath,
        method: method.toUpperCase(),
        endpoint,
        suffixMatch,
        overlap,
        score: (suffixMatch ? 1000 : 0) + overlap * 10 - Math.abs(specStatic.length - mcpStatic.length),
      });
    }
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return {
    status: 'fuzzy',
    path: best.path,
    method: best.method,
    endpoint: best.endpoint,
  };
}

function buildToolEntries(specs, registrations, toolDefinitions, handlersSource) {
  return registrations.map(registration => {
    const definition = toolDefinitions[registration.toolName] || {
      description: '',
      inputSchema: { properties: [], required: [] },
    };
    const body = extractFunctionBody(handlersSource, registration.handlerName);
    const requests = extractRequestsFromHandlerBody(body).map(request => {
      const matched = matchEndpoint(specs, request.method, request.pathTemplate);
      return {
        ...request,
        matchedEndpoint: matched
          ? {
              matchStatus: matched.status,
              path: matched.path,
              method: matched.method,
              summary: matched.endpoint.summary || '',
              description: matched.endpoint.description || '',
              tags: matched.endpoint.tags || [],
              parameters: matched.endpoint.parameters || [],
              requestBody: matched.endpoint.requestBody || null,
              responses: matched.endpoint.responses || {},
              security: matched.endpoint.security || [],
            }
          : null,
      };
    });

    return {
      toolName: registration.toolName,
      handlerName: registration.handlerName,
      description: definition.description,
      inputSchema: definition.inputSchema,
      requests,
    };
  });
}

function renderInputSchema(tool) {
  return renderTable('MCP Input Schema', tool.inputSchema.properties || []);
}

function renderRequestMappingTable(tool) {
  const rows = tool.requests.map(request => ({
    name: `${request.method} ${request.pathTemplate}`,
    type: request.matchedEndpoint?.matchStatus || 'unmatched',
    required: request.matchedEndpoint?.path ? `${request.matchedEndpoint.method} ${request.matchedEndpoint.path}` : 'no',
    description: request.matchedEndpoint?.summary || '',
  }));

  if (!rows.length) {
    return ['### MCP Backend Requests\n', '未识别到 client.doRequest 调用\n'];
  }

  return renderTable('MCP Backend Requests', rows);
}

function renderEndpointDetails(specs, request) {
  if (!request.matchedEndpoint) {
    return [
      '### Matched Backend Endpoint\n',
      '未在 backend/docs/swagger.json 中匹配到当前 MCP 请求路径，请优先检查路径是否已过时。\n',
    ];
  }

  const endpoint = request.matchedEndpoint;
  const lines = [
    '### Matched Backend Endpoint\n',
    `- Match: ${endpoint.matchStatus}\n`,
    `- Endpoint: ${endpoint.method} ${endpoint.path}\n`,
  ];

  if (endpoint.summary) {
    lines.push(`- Summary: ${escapeMarkdown(endpoint.summary)}\n`);
  }
  if (endpoint.description && endpoint.description !== endpoint.summary) {
    lines.push(`- Description: ${escapeMarkdown(endpoint.description)}\n`);
  }
  if (endpoint.tags?.length) {
    lines.push(`- Tags: ${endpoint.tags.map(escapeMarkdown).join(', ')}\n`);
  }

  lines.push('');
  lines.push(...renderSecurity(specs, endpoint));
  lines.push(...renderParameterTable(specs, endpoint.parameters, 'path'));
  lines.push(...renderParameterTable(specs, endpoint.parameters, 'query'));
  lines.push(...renderParameterTable(specs, endpoint.parameters, 'header'));
  lines.push(...renderParameterTable(specs, endpoint.parameters, 'cookie'));
  lines.push(...renderRequestBody(specs, endpoint.requestBody));
  lines.push(...renderResponses(specs, endpoint.responses));
  return lines;
}

function main() {
  const specs = JSON.parse(readFile(BACKEND_SWAGGER_PATH));
  const serverSource = readFile(SERVER_SOURCE_PATH);
  const toolsSource = readFile(TOOLS_SOURCE_PATH);
  const handlersSource = readFile(HANDLERS_SOURCE_PATH);

  const registrations = parseToolRegistrations(serverSource);
  const toolDefinitions = parseToolDefinitions(toolsSource);
  const tools = buildToolEntries(specs, registrations, toolDefinitions, handlersSource);

  const exactCount = tools.flatMap(tool => tool.requests).filter(item => item.matchedEndpoint?.matchStatus === 'exact').length;
  const fuzzyCount = tools.flatMap(tool => tool.requests).filter(item => item.matchedEndpoint?.matchStatus === 'fuzzy').length;
  const unmatchedRequests = tools.flatMap(tool => tool.requests.map(request => ({ toolName: tool.toolName, handlerName: tool.handlerName, request }))).filter(item => !item.request.matchedEndpoint);

  const jsonOutput = {
    generatedAt: new Date().toISOString(),
    backendSpec: {
      openapi: specs.openapi,
      pathCount: Object.keys(specs.paths || {}).length,
      servers: specs.servers || [],
    },
    summary: {
      toolCount: tools.length,
      requestCount: tools.flatMap(tool => tool.requests).length,
      exactMatches: exactCount,
      fuzzyMatches: fuzzyCount,
      unmatchedRequests: unmatchedRequests.length,
    },
    tools,
    unmatchedRequests: unmatchedRequests.map(item => ({
      toolName: item.toolName,
      handlerName: item.handlerName,
      method: item.request.method,
      pathTemplate: item.request.pathTemplate,
    })),
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(JSON_OUTPUT_PATH, JSON.stringify(jsonOutput, null, 2), 'utf8');

  const mdLines = [
    '# AssetHub MCP API Update Guide\n',
    `> Generated at: ${jsonOutput.generatedAt}\n`,
    `> Backend OpenAPI: ${escapeMarkdown(specs.openapi || '')}\n`,
    `> MCP tools: ${tools.length}\n`,
    `> MCP backend requests: ${jsonOutput.summary.requestCount}\n`,
    `> Exact matches: ${exactCount}\n`,
    `> Fuzzy matches: ${fuzzyCount}\n`,
    `> Unmatched requests: ${unmatchedRequests.length}\n`,
    '\n',
    '## Summary\n',
    '| 指标 | 数值 |',
    '| --- | --- |',
    `| MCP 工具数 | ${tools.length} |`,
    `| MCP 后端调用数 | ${jsonOutput.summary.requestCount} |`,
    `| 精确匹配 | ${exactCount} |`,
    `| 模糊匹配 | ${fuzzyCount} |`,
    `| 未匹配 | ${unmatchedRequests.length} |`,
    '',
  ];

  mdLines.push('## Requests Requiring MCP Update\n');
  if (unmatchedRequests.length) {
    mdLines.push('| Tool | Handler | MCP Request |');
    mdLines.push('| --- | --- | --- |');
    for (const item of unmatchedRequests) {
      mdLines.push(
        `| ${escapeMarkdown(item.toolName)} | ${escapeMarkdown(item.handlerName)} | ${escapeMarkdown(`${item.request.method} ${item.request.pathTemplate}`)} |`,
      );
    }
    mdLines.push('');
  } else {
    mdLines.push('当前未发现未匹配的 MCP 请求。\n');
  }

  for (const tool of tools) {
    mdLines.push(`## ${tool.toolName}\n`);
    mdLines.push(`- Handler: ${escapeMarkdown(tool.handlerName)}\n`);
    if (tool.description) {
      mdLines.push(`- Description: ${escapeMarkdown(tool.description)}\n`);
    }
    mdLines.push('');
    mdLines.push(...renderInputSchema(tool));
    mdLines.push(...renderRequestMappingTable(tool));

    if (!tool.requests.length) {
      mdLines.push('### Matched Backend Endpoint\n');
      mdLines.push('未识别到 MCP 请求实现，请检查 tool_handlers.go。\n');
      continue;
    }

    tool.requests.forEach((request, index) => {
      if (tool.requests.length > 1) {
        mdLines.push(`### Request Detail ${index + 1}\n`);
        mdLines.push(`- MCP Request: ${escapeMarkdown(`${request.method} ${request.pathTemplate}`)}\n`);
        mdLines.push('');
      }
      mdLines.push(...renderEndpointDetails(specs, request));
    });
  }

  const normalizedMarkdown = mdLines.map(line => (line.endsWith('\n') ? line : `${line}\n`)).join('');
  fs.writeFileSync(MD_OUTPUT_PATH, normalizedMarkdown, 'utf8');

  console.log(`✅ MCP API update JSON written to ${JSON_OUTPUT_PATH}`);
  console.log(`✅ MCP API update guide written to ${MD_OUTPUT_PATH}`);
}

main();
