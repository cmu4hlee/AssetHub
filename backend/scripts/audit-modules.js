const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { discoverModuleConfigs } = require('../services/module-config-discovery.service');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatTimestamp(date) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
    '-',
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds()),
  ].join('');
}

function parseArgs(argv) {
  const options = {
    outputDir: path.resolve(__dirname, '..', 'reports'),
    prefix: 'modules-audit',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--output-dir=')) {
      options.outputDir = path.resolve(arg.slice('--output-dir='.length));
      continue;
    }
    if (arg === '--output-dir' && argv[index + 1]) {
      options.outputDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--prefix=')) {
      options.prefix = arg.slice('--prefix='.length).trim() || options.prefix;
      continue;
    }
    if (arg === '--prefix' && argv[index + 1]) {
      options.prefix = argv[index + 1].trim() || options.prefix;
      index += 1;
      continue;
    }
  }

  return options;
}

async function fetchDbModules() {
  const [rows] = await db.execute(
    `SELECT id, name, version, category, type, status, updated_at
     FROM system_modules
     ORDER BY id ASC`,
  );
  return rows || [];
}

async function fetchBrokenDependencyRows() {
  const [rows] = await db.execute(
    `SELECT md.module_id, md.dependency_module_id, md.dependency_type
     FROM module_dependencies md
     LEFT JOIN system_modules sm ON sm.id = md.dependency_module_id
     WHERE sm.id IS NULL`,
  );
  return rows || [];
}

function collectDependencyIssues(diskModules) {
  const moduleIdSet = new Set(diskModules.map(item => item.config.id));
  const issues = [];

  for (const moduleMeta of diskModules) {
    const moduleId = moduleMeta.config.id;
    const dependencies = moduleMeta.config.dependencies || [];
    for (const dependency of dependencies) {
      const dependencyModuleId = String(dependency.module_id || '').trim();
      if (!dependencyModuleId) continue;
      if (!moduleIdSet.has(dependencyModuleId)) {
        issues.push({
          module_id: moduleId,
          dependency_module_id: dependencyModuleId,
          dependency_type: dependency.dependency_type || 'required',
          issue: 'dependency_not_found_in_disk_configs',
        });
      }
    }
  }

  return issues;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const generatedAt = new Date();
  const stamp = formatTimestamp(generatedAt);
  const outputPath = path.join(options.outputDir, `${options.prefix}-${stamp}.json`);

  const discovery = discoverModuleConfigs();
  const dbModules = await fetchDbModules();
  const brokenDependencyRows = await fetchBrokenDependencyRows();

  const diskModuleIds = new Set(discovery.modules.map(item => item.config.id));
  const dbModuleIds = new Set(dbModules.map(item => item.id));

  const missingInDb = discovery.modules
    .map(item => item.config.id)
    .filter(moduleId => !dbModuleIds.has(moduleId))
    .sort((a, b) => a.localeCompare(b));

  const orphanInDb = dbModules
    .map(item => item.id)
    .filter(moduleId => !diskModuleIds.has(moduleId))
    .sort((a, b) => a.localeCompare(b));

  const dependencyIssues = collectDependencyIssues(discovery.modules);

  const report = {
    generated_at: generatedAt.toISOString(),
    summary: {
      disk_module_config_count: discovery.modules.length,
      db_module_count: dbModules.length,
      discovery_warning_count: discovery.warnings.length,
      discovery_error_count: discovery.errors.length,
      missing_in_db_count: missingInDb.length,
      orphan_in_db_count: orphanInDb.length,
      disk_dependency_issue_count: dependencyIssues.length,
      db_broken_dependency_row_count: brokenDependencyRows.length,
    },
    discovery: {
      warnings: discovery.warnings,
      errors: discovery.errors,
    },
    missing_in_db: missingInDb,
    orphan_in_db: orphanInDb,
    disk_dependency_issues: dependencyIssues,
    db_broken_dependency_rows: brokenDependencyRows,
    disk_modules: discovery.modules.map(item => ({
      id: item.config.id,
      name: item.config.name,
      version: item.config.version,
      directory: item.moduleDirName,
      config_path: item.configPath,
      dependency_count: (item.config.dependencies || []).length,
    })),
  };

  fs.mkdirSync(options.outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`模块体检报告已生成: ${outputPath}`);
  console.log(`磁盘模块配置: ${report.summary.disk_module_config_count}`);
  console.log(`数据库模块: ${report.summary.db_module_count}`);
  console.log(`磁盘有但库中缺失: ${report.summary.missing_in_db_count}`);
  console.log(`库中有但磁盘缺失: ${report.summary.orphan_in_db_count}`);
  console.log(`磁盘依赖异常: ${report.summary.disk_dependency_issue_count}`);
  console.log(`数据库依赖坏链: ${report.summary.db_broken_dependency_row_count}`);
}

async function main() {
  try {
    await run();
  } catch (error) {
    console.error('模块体检失败:', error.message);
    process.exitCode = 1;
  } finally {
    try {
      await db.end();
    } catch (error) {
      console.warn('数据库连接池关闭告警:', error.message);
    }
  }
}

main();
