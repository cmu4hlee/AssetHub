#!/usr/bin/env node

/**
 * 模块检查工具 - 使用 Glob 直接查找文件
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const rootDir = process.cwd();

console.log('🔍 AssetHub 模块分析工具');
console.log('='.repeat(80));
console.log('');

console.log('📊 1. 模块统计:');
console.log('-'.repeat(60));

// 统计服务文件
const serviceFiles = glob.sync('services/**/*-service.js', { cwd: rootDir });
const maintenanceServiceFiles = glob.sync('services/maintenance/*.service.js', { cwd: rootDir });

console.log(`  核心服务文件: ${serviceFiles.length} 个`);
console.log(`  维护服务文件: ${maintenanceServiceFiles.length} 个`);

// 统计路由文件
const routeFiles = glob.sync('routes/[!assets[!**/compliance/**/*.js', { cwd: rootDir });
const assetsRoutes = glob.sync('routes/assets/*.js', { cwd: rootDir });
const maintenanceRoutes = glob.sync('routes/maintenance/*.js', { cwd: rootDir });
const complianceRoutes = glob.sync('routes/compliance/*.js', { cwd: rootDir });

console.log(`  核心路由文件: ${routeFiles.length} 个`);
console.log(`  资产路由文件: ${assetsRoutes.length} 个`);
console.log(`  维护路由文件: ${maintenanceRoutes.length} 个`);
console.log(`  合规模块路由: ${complianceRoutes.length} 个`);

console.log('\n📊 2. 关键服务文件:');
console.log('-'.repeat(60));

const keyServices = [
  'services/metrology-service.js',
  'services/quality-control-service.js',
  'services/transfer-approval-service.js',
  'services/maintenance/workorders.service.js',
  'services/maintenance/requests.service.js',
];

for (const service of keyServices) {
  const exists = fs.existsSync(path.join(rootDir, service));
  console.log(`  ${exists ? '✅' : '❌'} ${service}`);
}

console.log('\n📊 3. 现有测试文件:');
console.log('-'.repeat(60));

const testFiles = glob.sync('tests/**/*.test.js', { cwd: rootDir });
console.log(`  总测试文件: ${testFiles.length} 个`);

const unitTests = glob.sync('tests/unit/*.test.js', { cwd: rootDir });
const apiTests = glob.sync('tests/api/*.test.js', { cwd: rootDir });

console.log(`  单元测试: ${unitTests.length} 个`);
console.log(`  集成测试: ${apiTests.length} 个`);

console.log('\n📊 4. 关键模块测试覆盖:');
console.log('-'.repeat(60));

const testModuleMap = {
  'metrology-service': 'metrology-service.test.js',
  'quality-control-service': 'quality-control-service.test.js',
  'transfer-approval': 'transfer-*.test.js',
  'maintenance-workorders': 'workorders.service.test.js',
  'maintenance-requests': 'requests.service.test.js',
  'asset-health': 'asset-health-index.service.test.js',
  'predictive-maintenance': 'predictive-maintenance.service.test.js',
  'ai-analysis': 'asset-ai-analysis.test.js',
};

for (const [module, pattern] of Object.entries(testModuleMap)) {
  const matches = testFiles.filter(f => f.includes(pattern.replace('*', '')));
  console.log(`  ${module}: ${matches.length > 0 ? '✅' : '❌'}`);
}

console.log('\n📊 5. 测试框架配置:');
console.log('-'.repeat(60));

const pkgPath = path.join(rootDir, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  console.log(`  测试框架: ${pkg.devDependencies?.jest ? 'Jest' : '未知'}`);
  console.log(`  测试脚本: ${pkg.scripts?.test || '未配置'}`);
}

console.log(`\n${  '='.repeat(80)}`);
console.log('✅ 分析完成');
console.log('='.repeat(80));
