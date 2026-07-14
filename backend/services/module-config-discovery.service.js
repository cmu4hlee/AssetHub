const fs = require('fs');
const path = require('path');

const MODULES_ROOT = path.resolve(__dirname, '../modules');

function toSafeObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeDependency(dependency) {
  if (typeof dependency === 'string') {
    const moduleId = dependency.trim();
    if (!moduleId) return null;
    return {
      module_id: moduleId,
      dependency_type: 'required',
      min_version: null,
      max_version: null,
    };
  }

  if (!dependency || typeof dependency !== 'object') {
    return null;
  }

  const moduleId = String(dependency.module_id || dependency.dependency_module_id || '').trim();
  if (!moduleId) return null;

  return {
    module_id: moduleId,
    dependency_type: dependency.dependency_type || 'required',
    min_version: dependency.min_version || null,
    max_version: dependency.max_version || null,
  };
}

function normalizeModuleConfig(rawConfig, moduleDirName) {
  const moduleConfig = toSafeObject(rawConfig, {});
  const normalized = {
    ...moduleConfig,
    id: String(moduleConfig.id || '').trim(),
    name: String(moduleConfig.name || '').trim(),
    version: String(moduleConfig.version || '').trim(),
    description: moduleConfig.description || '',
    category: moduleConfig.category || 'business',
    type: moduleConfig.type || 'plugin',
    status: moduleConfig.status || 'stable',
    author: moduleConfig.author || 'system',
    dependencies: toSafeArray(moduleConfig.dependencies).map(normalizeDependency).filter(Boolean),
    compatibility: toSafeObject(moduleConfig.compatibility, {}),
    frontend_config: toSafeObject(moduleConfig.frontend_config, {}),
    backend_config: toSafeObject(moduleConfig.backend_config, {}),
    config_schema: toSafeObject(moduleConfig.config_schema, {}),
    default_config: toSafeObject(moduleConfig.default_config, {}),
    interfaces: toSafeArray(moduleConfig.interfaces),
  };

  const errors = [];
  if (!normalized.id) errors.push('missing required field: id');
  if (!normalized.name) errors.push('missing required field: name');
  if (!normalized.version) errors.push('missing required field: version');

  const warnings = [];
  if (normalized.id && normalized.id !== moduleDirName) {
    warnings.push(`module id "${normalized.id}" does not match folder "${moduleDirName}"`);
  }

  return { normalized, errors, warnings };
}

function discoverModuleConfigs(options = {}) {
  const modulesRoot = options.modulesRoot || MODULES_ROOT;
  const onlyModuleIds = new Set(
    (options.onlyModuleIds || []).map(item => String(item || '').trim()).filter(Boolean),
  );

  const modules = [];
  const warnings = [];
  const errors = [];

  if (!fs.existsSync(modulesRoot)) {
    errors.push(`modules root not found: ${modulesRoot}`);
    return { modules, warnings, errors };
  }

  const moduleDirs = fs
    .readdirSync(modulesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const seenIds = new Set();

  for (const moduleDirName of moduleDirs) {
    const configPath = path.join(modulesRoot, moduleDirName, 'config', 'module.config.js');

    if (!fs.existsSync(configPath)) {
      warnings.push(`skip module "${moduleDirName}": config file not found`);
      continue;
    }

    let rawConfig = null;
    try {
      delete require.cache[require.resolve(configPath)];
      rawConfig = require(configPath);
    } catch (error) {
      errors.push(`load failed "${moduleDirName}": ${error.message}`);
      continue;
    }

    const { normalized, errors: configErrors, warnings: configWarnings } = normalizeModuleConfig(
      rawConfig,
      moduleDirName,
    );

    for (const message of configWarnings) {
      warnings.push(`${moduleDirName}: ${message}`);
    }

    if (configErrors.length > 0) {
      for (const message of configErrors) {
        errors.push(`${moduleDirName}: ${message}`);
      }
      continue;
    }

    if (onlyModuleIds.size > 0 && !onlyModuleIds.has(normalized.id) && !onlyModuleIds.has(moduleDirName)) {
      continue;
    }

    if (seenIds.has(normalized.id)) {
      errors.push(`duplicate module id: ${normalized.id}`);
      continue;
    }
    seenIds.add(normalized.id);

    modules.push({
      moduleDirName,
      configPath,
      config: normalized,
    });
  }

  return { modules, warnings, errors };
}

module.exports = {
  discoverModuleConfigs,
  normalizeModuleConfig,
  normalizeDependency,
  MODULES_ROOT,
};
