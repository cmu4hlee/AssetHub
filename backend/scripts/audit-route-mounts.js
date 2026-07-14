const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const serverEntry = path.join(backendRoot, 'server.js');
const INTENTIONALLY_UNMOUNTED = new Set([
  'modules/compliance-management/routes/index.js',
  'modules/compliance-management/routes/maintenance-level.js',
  'modules/safety-inspection-management/routes/index.js',
  'modules/safety-inspection-management/routes/safety-inspection.js',
  'modules/special-equipment-management/routes/index.js',
  'modules/special-equipment-management/routes/special-equipment.js',
  'modules/staff-qualification/routes/qualification.routes.js',
  'modules/staff-qualification/routes/staff-qualification.js',
  'modules/uptime-management/routes/uptime-statistics.js',
  'modules/uptime-management/routes/uptime-statistics.routes.js',
]);

function walk(dir, matcher, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath, matcher, results);
      continue;
    }

    if (matcher(absolutePath)) {
      results.push(absolutePath);
    }
  }

  return results;
}

function isRouteFile(filePath) {
  return (
    filePath.endsWith('.js') &&
    (filePath.includes(`${path.sep}routes${path.sep}`) ||
      filePath.includes(`${path.sep}modules${path.sep}`))
  );
}

function toBackendRelative(filePath) {
  return path.relative(backendRoot, filePath).replace(/\\/g, '/');
}

function resolveRequireTarget(sourceFile, requestPath) {
  if (!requestPath.startsWith('.')) {
    return null;
  }

  const basePath = path.resolve(path.dirname(sourceFile), requestPath);
  const candidates = [
    basePath,
    `${basePath}.js`,
    path.join(basePath, 'index.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function collectRelativeRequires(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const requirePattern = /require\((['"])(\.[^'"]+)\1\)/g;
  const targets = new Set();

  for (const match of content.matchAll(requirePattern)) {
    const resolved = resolveRequireTarget(filePath, match[2]);
    if (resolved && isRouteFile(resolved)) {
      targets.add(resolved);
    }
  }

  return [...targets];
}

function collectRouteFiles() {
  const backendRoutes = walk(
    path.join(backendRoot, 'routes'),
    filePath => filePath.endsWith('.js'),
  );
  const moduleRoutes = walk(
    path.join(backendRoot, 'modules'),
    filePath => filePath.endsWith('.js') && filePath.includes(`${path.sep}routes${path.sep}`),
  );

  return [...new Set([...backendRoutes, ...moduleRoutes])].sort();
}

function buildReachableRouteSet(routeFiles) {
  const reachable = new Set();
  const queue = [serverEntry];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current) || !fs.existsSync(current)) {
      continue;
    }

    visited.add(current);
    const targets = collectRelativeRequires(current);
    for (const target of targets) {
      if (target.includes(`${path.sep}routes${path.sep}`)) {
        reachable.add(target);
      }
      if (!visited.has(target)) {
        queue.push(target);
      }
    }
  }

  const knownRoutes = new Set(routeFiles);
  return new Set([...reachable].filter(filePath => knownRoutes.has(filePath)));
}

function main() {
  const routeFiles = collectRouteFiles();
  const reachable = buildReachableRouteSet(routeFiles);
  const unresolved = [];
  const intentionallyUnmounted = [];

  for (const filePath of routeFiles) {
    if (reachable.has(filePath)) {
      continue;
    }

    const relativePath = toBackendRelative(filePath);
    if (INTENTIONALLY_UNMOUNTED.has(relativePath)) {
      intentionallyUnmounted.push(relativePath);
      continue;
    }

    unresolved.push(relativePath);
  }

  const summary = {
    total_route_files: routeFiles.length,
    reachable_route_files: reachable.size,
    intentionally_unmounted_route_files: intentionallyUnmounted.length,
    intentionally_unmounted: intentionallyUnmounted,
    unresolved_unreachable_route_files: unresolved.length,
    unresolved_unreachable: unresolved,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (unresolved.length > 0) {
    process.exitCode = 1;
  }
}

main();
