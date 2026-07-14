const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..', '..');
const serverEntry = path.join(backendRoot, 'server.js');
const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head']);

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (_) {
    return false;
  }
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function toBackendRelative(filePath) {
  return toPosixPath(path.relative(backendRoot, filePath));
}

function resolveRequireTarget(sourceFile, requestPath) {
  if (!requestPath || !requestPath.startsWith('.')) {
    return null;
  }

  const basePath = path.resolve(path.dirname(sourceFile), requestPath);
  const candidates = [
    basePath,
    `${basePath}.js`,
    path.join(basePath, 'index.js'),
  ];

  return candidates.find(fileExists) || null;
}

function collectRequireBindings(sourceFile, content) {
  const bindings = new Map();
  const requirePattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*(['"])(\.[^'"]+)\2\s*\)/g;

  for (const match of content.matchAll(requirePattern)) {
    const resolved = resolveRequireTarget(sourceFile, match[3]);
    if (resolved) {
      bindings.set(match[1], resolved);
    }
  }

  return bindings;
}

function findUseCalls(content) {
  const calls = [];
  const usePattern = /\b(?:app|router)\.use\s*\(\s*(['"])([^'"]*)\1([\s\S]*?)\);/g;

  for (const match of content.matchAll(usePattern)) {
    calls.push({
      mountPath: match[2],
      args: match[3] || '',
    });
  }

  return calls;
}

function collectMountedRouters(sourceFile, content) {
  const requireBindings = collectRequireBindings(sourceFile, content);
  const mountedRouters = [];

  for (const call of findUseCalls(content)) {
    const targets = new Set();
    const directRequirePattern = /require\(\s*(['"])(\.[^'"]+)\1\s*\)/g;

    for (const match of call.args.matchAll(directRequirePattern)) {
      const resolved = resolveRequireTarget(sourceFile, match[2]);
      if (resolved) {
        targets.add(resolved);
      }
    }

    for (const [bindingName, resolved] of requireBindings.entries()) {
      const bindingPattern = new RegExp(`\\b${bindingName}\\b`);
      if (bindingPattern.test(call.args)) {
        targets.add(resolved);
      }
    }

    for (const target of targets) {
      mountedRouters.push({
        mountPath: call.mountPath,
        target,
      });
    }
  }

  return mountedRouters;
}

function collectRouteDefinitions(content) {
  const routes = [];
  const routePattern = /\b(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*(['"])([^'"]+)\2/g;
  const arrayRoutePattern = /\b(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*\[([\s\S]*?)\]/g;

  for (const match of content.matchAll(routePattern)) {
    const method = match[1].toUpperCase();
    const routePath = match[3];

    if (!routePath || routePath === '*') {
      continue;
    }

    routes.push({
      method,
      routePath,
    });
  }

  for (const match of content.matchAll(arrayRoutePattern)) {
    const method = match[1].toUpperCase();
    const routePathPattern = /(['"])([^'"]+)\1/g;

    for (const routePathMatch of match[2].matchAll(routePathPattern)) {
      const routePath = routePathMatch[2];

      if (!routePath || routePath === '*') {
        continue;
      }

      routes.push({
        method,
        routePath,
      });
    }
  }

  return routes;
}

function normalizeExpressPath(routePath) {
  if (!routePath || routePath === '/') {
    return '/';
  }

  const withoutTrailingSlash = routePath.length > 1
    ? routePath.replace(/\/+$/, '')
    : routePath;

  return withoutTrailingSlash.startsWith('/')
    ? withoutTrailingSlash
    : `/${withoutTrailingSlash}`;
}

function joinPaths(...parts) {
  const normalized = parts
    .filter(part => part !== undefined && part !== null && String(part).trim() !== '')
    .map(part => normalizeExpressPath(String(part)))
    .join('/');

  const collapsed = normalized
    .replace(/\/+/g, '/')
    .replace(/\/+$/, '');

  return collapsed || '/';
}

function toOpenApiPath(expressPath) {
  return normalizeExpressPath(expressPath)
    .replace(/:([A-Za-z_$][\w$]*)/g, '{$1}')
    .replace(/\*/g, '{wildcard}');
}

function normalizeSwaggerPath(swaggerPath) {
  return normalizeExpressPath(swaggerPath)
    .replace(/:([A-Za-z_$][\w$]*)/g, '{$1}');
}

function operationKey(method, openApiPath) {
  return `${method.toUpperCase()} ${normalizeSwaggerPath(openApiPath)}`;
}

function collectRouteCatalog(options = {}) {
  const entryFile = options.entryFile || serverEntry;
  const queue = [
    {
      filePath: entryFile,
      basePath: '',
      collectRoutes: false,
    },
  ];
  const visitedMounts = new Set();
  const operations = [];

  while (queue.length > 0) {
    const current = queue.shift();
    const mountKey = `${current.filePath}|${current.basePath}|${current.collectRoutes}`;

    if (visitedMounts.has(mountKey) || !fileExists(current.filePath)) {
      continue;
    }

    visitedMounts.add(mountKey);
    const content = fs.readFileSync(current.filePath, 'utf8');
    const source = toBackendRelative(current.filePath);

    if (current.collectRoutes) {
      for (const route of collectRouteDefinitions(content)) {
        const expressPath = joinPaths(current.basePath, route.routePath);
        const openApiPath = toOpenApiPath(expressPath);

        operations.push({
          method: route.method,
          path: openApiPath,
          expressPath,
          localPath: normalizeExpressPath(route.routePath),
          source,
        });
      }
    }

    for (const mounted of collectMountedRouters(current.filePath, content)) {
      queue.push({
        filePath: mounted.target,
        basePath: joinPaths(current.basePath, mounted.mountPath),
        collectRoutes: true,
      });
    }
  }

  return operations;
}

function extractPathParameters(openApiPath) {
  const params = [];
  const seen = new Set();
  const paramPattern = /\{([^}]+)\}/g;

  for (const match of openApiPath.matchAll(paramPattern)) {
    if (seen.has(match[1])) {
      continue;
    }

    seen.add(match[1]);
    params.push({
      in: 'path',
      name: match[1],
      required: true,
      schema: {
        type: 'string',
      },
    });
  }

  return params;
}

function inferTag(openApiPath, source) {
  const segments = openApiPath.split('/').filter(Boolean);
  const firstApiSegment = segments[0] === 'api' ? segments[1] : segments[0];

  if (firstApiSegment) {
    return `自动发现: ${firstApiSegment}`;
  }

  return `自动发现: ${path.basename(source, '.js')}`;
}

function inferSummary(operation) {
  const actionByMethod = {
    GET: '查询',
    POST: '创建/提交',
    PUT: '更新',
    PATCH: '局部更新',
    DELETE: '删除',
    OPTIONS: '预检',
    HEAD: '元数据',
  };

  return `${actionByMethod[operation.method] || operation.method} ${operation.path}`;
}

function createAutoOperation(operation) {
  const autoOperation = {
    tags: [inferTag(operation.path, operation.source)],
    summary: inferSummary(operation),
    description: `自动从 ${operation.source} 的 Express 路由声明生成的基础接口文档。`,
    'x-source': 'auto-route-catalog',
    'x-route-source': operation.source,
    responses: {
      200: {
        description: '请求成功',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: {
                  type: 'boolean',
                },
                data: {
                  type: 'object',
                },
                message: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
      401: {
        description: '未认证或令牌无效',
      },
      500: {
        description: '服务器内部错误',
      },
    },
  };

  const parameters = extractPathParameters(operation.path);
  if (parameters.length > 0) {
    autoOperation.parameters = parameters;
  }

  if (['POST', 'PUT', 'PATCH'].includes(operation.method)) {
    autoOperation.requestBody = {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    };
  }

  return autoOperation;
}

function buildAutoSwaggerPaths(operations = collectRouteCatalog()) {
  const paths = {};

  for (const operation of operations) {
    if (!paths[operation.path]) {
      paths[operation.path] = {};
    }

    const method = operation.method.toLowerCase();
    if (!HTTP_METHODS.has(method)) {
      continue;
    }

    if (!paths[operation.path][method]) {
      paths[operation.path][method] = createAutoOperation(operation);
      continue;
    }

    const existing = paths[operation.path][method];
    const existingSources = existing['x-route-source']
      ? [existing['x-route-source']]
      : existing['x-route-sources'] || [];

    paths[operation.path][method] = {
      ...existing,
      'x-route-sources': Array.from(new Set([...existingSources, operation.source])),
    };
  }

  return paths;
}

module.exports = {
  buildAutoSwaggerPaths,
  collectRouteCatalog,
  normalizeSwaggerPath,
  operationKey,
};
