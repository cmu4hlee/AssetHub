#!/usr/bin/env node

/**
 * 模块全面检查工具
 * 分析所有模块的功能实现、接口调用、代码质量
 */

const fs = require('fs');
const path = require('path');

class ModuleAnalyzer {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.modules = [];
    this.issues = {
      missingErrorHandling: [],
      potentialBugs: [],
      codeQuality: [],
      missingTests: [],
    };
  }

  analyze() {
    console.log('🔍 开始全面模块分析...\n');

    this.analyzeServices();
    this.analyzeRoutes();
    this.checkInterModuleCalls();
    this.checkCodeQuality();
    this.checkExistingTests();
    this.generateReport();
  }

  analyzeServices() {
    console.log('📂 分析服务层...');
    const services = path.join(this.rootDir, 'services');
    const maintenanceDir = path.join(services, 'maintenance');

    const serviceFiles = this.getFiles(services, '.js');
    const maintenanceServiceFiles = this.getFiles(maintenanceDir, '.js');

    this.modules = {
      services: serviceFiles.map(f => path.basename(f, '.js')),
      maintenance: maintenanceServiceFiles.map(f => path.basename(f, '.js')),
    };

    console.log(`  - 核心服务: ${serviceFiles.length} 个`);
    console.log(`  - 维护服务: ${maintenanceServiceFiles.length} 个`);
  }

  analyzeRoutes() {
    console.log('📂 分析路由层...');
    const routesDir = path.join(this.rootDir, 'routes');
    const assetRoutesDir = path.join(routesDir, 'assets');
    const maintenanceRoutesDir = path.join(routesDir, 'maintenance');
    const complianceRoutesDir = path.join(routesDir, 'compliance');

    const routeFiles = this.getFiles(routesDir, '.js');
    const assetRouteFiles = this.getFiles(assetRoutesDir, '.js') || [];
    const maintenanceRouteFiles = this.getFiles(maintenanceRoutesDir, '.js') || [];
    const complianceRouteFiles = this.getFiles(complianceRoutesDir, '.js') || [];

    this.modules.routes = routeFiles.map(f => path.basename(f, '.js'));
    this.modules.assetRoutes = assetRouteFiles.map(f => path.basename(f, '.js'));
    this.modules.maintenanceRoutes = maintenanceRouteFiles.map(f => path.basename(f, '.js'));
    this.modules.complianceRoutes = complianceRouteFiles.map(f => path.basename(f, '.js'));

    console.log(`  - 核心路由: ${routeFiles.length} 个`);
    console.log(`  - 资产路由: ${assetRouteFiles.length} 个`);
    console.log(`  - 维护路由: ${maintenanceRouteFiles.length} 个`);
    console.log(`  - 合规模块: ${complianceRouteFiles.length} 个`);
  }

  checkInterModuleCalls() {
    console.log('📂 检查模块间调用...\n');

    const criticalCalls = [
      { from: 'metrology-service.js', to: 'assets', check: 'asset_code' },
      { from: 'quality-control-service.js', to: 'assets', check: 'asset_code' },
      { from: 'transfer-approval-service.js', to: 'assets', check: 'asset_code' },
      { from: 'inventory.js', to: 'assets', check: 'asset_code' },
      { from: 'maintenance/requests.service.js', to: 'assets', check: 'asset_code' },
    ];

    console.log('关键模块调用链:');
    console.log('-'.repeat(60));

    const servicesDir = path.join(this.rootDir, 'services');
    const routesDir = path.join(this.rootDir, 'routes');

    for (const call of criticalCalls) {
      let sourceFile;
      if (call.from.includes('/')) {
        sourceFile = path.join(servicesDir, call.from);
      } else {
        sourceFile = path.join(servicesDir, call.from);
      }

      if (fs.existsSync(sourceFile)) {
        const content = fs.readFileSync(sourceFile, 'utf-8');
        const hasJoin = content.includes('JOIN assets') || content.includes(`JOIN ${call.to}`);
        const hasField = content.includes(call.check);

        console.log(`  ${call.from} -> ${call.to}.${call.check}: ${hasJoin && hasField ? '✅' : '⚠️'}`);

        if (!hasJoin || !hasField) {
          this.issues.potentialBugs.push({
            file: call.from,
            issue: '可能缺少正确的 JOIN 或字段引用',
          });
        }
      }
    }
  }

  checkCodeQuality() {
    console.log('\n📂 检查代码质量...');

    const servicesDir = path.join(this.rootDir, 'services');
    const keyServices = [
      'metrology-service.js',
      'quality-control-service.js',
      'transfer-approval-service.js',
      'maintenance/workorders.service.js',
    ];

    for (const service of keyServices) {
      const filePath = path.join(servicesDir, service);

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');

        // 检查错误处理
        const hasTryCatch = content.includes('try') && content.includes('catch');
        const hasErrorLogging = content.includes('console.error') || content.includes('logger.error');
        const hasProperErrorReturn = content.includes('res.status') || content.includes('throw new');

        // 检查注释
        const hasJsdoc = content.includes('/**') || content.includes('* @');
        const commentRatio = (content.match(/\/\//g) || []).length / (content.match(/\n/g) || []).length * 100;

        console.log(`  ${service}:`);
        console.log(`    错误处理: ${hasTryCatch ? '✅' : '❌'} | ${hasErrorLogging ? '✅' : '⚠️'} | ${hasProperErrorReturn ? '✅' : '⚡'}`);
        console.log(`    注释: ${hasJsdoc ? '✅' : '⚠️'} (注释率: ${commentRatio.toFixed(1)}%)`);

        if (!hasTryCatch) {
          this.issues.missingErrorHandling.push({ file: service, issue: '缺少 try-catch' });
        }
        if (commentRatio < 5) {
          this.issues.codeQuality.push({ file: service, issue: `注释率较低: ${commentRatio.toFixed(1)}%` });
        }
      }
    }
  }

  checkExistingTests() {
    console.log('\n📂 检查现有测试...');

    const testDirs = [
      'tests/unit',
      'tests/api',
      'test',
    ];

    let totalTests = 0;
    const testFilesByModule = {};

    for (const testDir of testDirs) {
      const dirPath = path.join(this.rootDir, testDir);
      if (!fs.existsSync(dirPath)) continue;

      const files = this.getFiles(dirPath, '.test.js');
      totalTests += files.length;

      for (const file of files) {
        const baseName = path.basename(file, '.test.js');
        const serviceName = this.extractServiceName(baseName);

        if (!testFilesByModule[serviceName]) {
          testFilesByModule[serviceName] = 0;
        }
        testFilesByModule[serviceName]++;
      }
    }

    console.log(`  - 总测试文件: ${totalTests} 个`);
    console.log('\n  测试覆盖的模块:');

    for (const [module, count] of Object.entries(testFilesByModule)) {
      console.log(`    - ${module}: ${count} 个测试`);
    }

    // 检查未覆盖的关键模块
    const requiredModules = [
      'metrology-service',
      'quality-control-service',
      'transfer-approval-service',
      'maintenance/workorders',
      'maintenance/requests',
    ];

    console.log('\n  未覆盖的关键模块:');
    for (const module of requiredModules) {
      if (!testFilesByModule[module]) {
        console.log(`    ⚠️ ${module}`);
        this.issues.missingTests.push({ module, issue: '缺少测试' });
      }
    }
  }

  generateReport() {
    console.log(`\n${  '='.repeat(80)}`);
    console.log('📊 模块分析报告');
    console.log('='.repeat(80));

    console.log('\n1. 模��统计:');
    console.log(`   - 服务: ${this.modules.services?.length || 0} 个`);
    console.log(`   - 维护服务: ${this.modules.maintenance?.length || 0} 个`);
    console.log(`   - 路由: ${this.modules.routes?.length || 0} 个`);

    console.log('\n2. 发现的问题:');
    console.log(`   - 缺少错误处理: ${this.issues.missingErrorHandling.length} 个`);
    console.log(`   - 潜在Bug: ${this.issues.potentialBugs.length} 个`);
    console.log(`   - 代码质量问题: ${this.issues.codeQuality.length} 个`);
    console.log(`   - 缺少测试: ${this.issues.missingTests.length} 个`);
  }

  getFiles(dir, extension) {
    if (!fs.existsSync(dir)) return [];

    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(fullPath);
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subFiles = this.getFiles(fullPath, extension);
        files.push(...subFiles);
      }
    }

    return files;
  }

  extractServiceName(testFileName) {
    // 从测试文件名提取服务名
    const name = testFileName
      .replace('.tenant-isolation', '')
      .replace('.tenant-safety', '')
      .replace('-test', '')
      .replace('.test', '');
    return name;
  }
}

const rootDir = path.join(__dirname);
const analyzer = new ModuleAnalyzer(rootDir);
analyzer.analyze();
