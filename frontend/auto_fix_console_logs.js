#!/usr/bin/env node

/**
 * 自动修复脚本
 * 将 console.log/error/warn 替换为 logger
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

class ConsoleFixer {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.srcDir = path.join(rootDir, 'src');
    this.stats = {
      filesModified: 0,
      replacements: {
        consoleLog: 0,
        consoleError: 0,
        consoleWarn: 0,
      },
    };
  }

  /**
   * 修复所有文件
   */
  async fixAll() {
    console.log('🔧 开始自动修复 console 调用...\n');

    // 查找所有需要修复的文件
    const files = [
      ...glob.sync('**/pages/**/*.jsx', { cwd: this.srcDir }),
      ...glob.sync('**/components/**/*.jsx', { cwd: this.srcDir }),
    ];

    console.log(`找到 ${files.length} 个需要检查的文件\n`);

    for (const file of files) {
      await this.fixFile(path.join(this.srcDir, file));
    }

    // 生成报告
    this.generateReport();
  }

  /**
   * 修复单个文件
   */
  async fixFile(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      const originalContent = content;

      // 1. 添加导入（如果没有）
      if (!content.includes("import { logger } from") && 
          !content.includes("import logger from")) {
        // 查找其他 import 语句的位置
        const lastImport = content.match(/^import .+ from .+;$/gm);
        if (lastImport) {
          const lastImportLine = lastImport[lastImport.length - 1];
          const lastImportIndex = content.lastIndexOf(lastImportLine);
          const insertPosition = content.indexOf('\n', lastImportIndex) + 1;
          
          content = content.slice(0, insertPosition) + 
                    "import { logger } from '../utils/productionLogger';\n" + 
                    content.slice(insertPosition);
        }
      }

      // 2. 替换 console.log
      let logMatches = content.match(/console\.log\(([^)]+)\)/g) || [];
      if (logMatches.length > 0) {
        console.log(`  📝 ${path.relative(this.rootDir, filePath)}: 发现 ${logMatches.length} 个 console.log`);
        
        content = content.replace(
          /console\.log\(([^)]+)\)/g,
          (match, args) => {
            this.stats.replacements.consoleLog++;
            return `logger.log(${args})`;
          }
        );
      }

      // 3. 替换 console.error
      let errorMatches = content.match(/console\.error\(([^)]+)\)/g) || [];
      if (errorMatches.length > 0) {
        console.log(`  📝 ${path.relative(this.rootDir, filePath)}: 发现 ${errorMatches.length} 个 console.error`);
        
        content = content.replace(
          /console\.error\(([^)]+)\)/g,
          (match, args) => {
            this.stats.replacements.consoleError++;
            return `logger.error(${args})`;
          }
        );
      }

      // 4. 替换 console.warn
      let warnMatches = content.match(/console\.warn\(([^)]+)\)/g) || [];
      if (warnMatches.length > 0) {
        console.log(`  📝 ${path.relative(this.rootDir, filePath)}: 发现 ${warnMatches.length} 个 console.warn`);
        
        content = content.replace(
          /console\.warn\(([^)]+)\)/g,
          (match, args) => {
            this.stats.replacements.consoleWarn++;
            return `logger.warn(${args})`;
          }
        );
      }

      // 如果有修改，保存文件
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        this.stats.filesModified++;
        console.log(`  ✅ 已修复 ${path.relative(this.rootDir, filePath)}`);
      }

    } catch (error) {
      console.error(`❌ 修复文件失败: ${filePath}`, error);
    }
  }

  /**
   * 生成报告
   */
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🔧 自动修复报告');
    console.log('='.repeat(80) + '\n');

    console.log(`修复统计:`);
    console.log(`  - 修改文件数: ${this.stats.filesModified}`);
    console.log(`  - console.log 替换: ${this.stats.replacements.consoleLog}`);
    console.log(`  - console.error 替换: ${this.stats.replacements.consoleError}`);
    console.log(`  - console.warn 替换: ${this.stats.replacements.consoleWarn}`);
    console.log('\n');

    if (this.stats.filesModified > 0) {
      console.log('✅ 自动修复完成！');
      console.log('\n注意:');
      console.log('1. 请检查修改后的文件，确保导入路径正确');
      console.log('2. 某些复杂的 console.log 调用可能需要手动调整');
      console.log('3. 建议运行代码检查工具确认修复效果');
      console.log('4. 运行 npm test 确保没有引入新的错误');
    } else {
      console.log('ℹ️  没有需要修复的文件');
    }

    console.log('\n' + '='.repeat(80));

    // 保存报告
    const reportPath = path.join(this.rootDir, 'frontend', 'console-fix-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 报告已保存到: ${reportPath}`);
  }
}

// 运行修复
const rootDir = path.join(__dirname);
const fixer = new ConsoleFixer(rootDir);
fixer.fixAll().catch(console.error);
