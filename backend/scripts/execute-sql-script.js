// 执行SQL脚本文件的Node.js工具
// 该工具利用现有的数据库连接池来执行SQL脚本，无需直接使用mysql命令
const fs = require('fs');
const path = require('path');
const db = require('../config/database'); // 引入现有的数据库连接池

/**
 * 执行SQL脚本文件
 * @param {string} scriptPath - SQL脚本文件路径
 */
async function executeSqlScript(scriptPath) {
  try {
    console.log(`🔍 正在读取SQL脚本: ${scriptPath}`);

    // 读取SQL脚本文件内容
    const sqlContent = fs.readFileSync(scriptPath, 'utf8');

    // 将SQL脚本分割为多个语句
    const sqlStatements = splitSqlStatements(sqlContent);

    console.log(`📋 共发现 ${sqlStatements.length} 条SQL语句`);

    // 从连接池获取连接
    const connection = await db.getConnection();

    try {
      // 开始事务
      await connection.beginTransaction();

      // 逐条执行SQL语句
      for (let i = 0; i < sqlStatements.length; i++) {
        const sql = sqlStatements[i].trim();

        if (!sql) continue;

        console.log(
          `📝 正在执行第 ${i + 1} 条语句: ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`,
        );

        await connection.execute(sql);

        console.log(`✅ 第 ${i + 1} 条语句执行成功`);
      }

      // 提交事务
      await connection.commit();

      console.log('🎉 所有SQL语句执行完成！');

      return { success: true, message: 'SQL脚本执行成功' };
    } catch (error) {
      // 回滚事务
      await connection.rollback();
      throw error;
    } finally {
      // 释放连接
      connection.release();
    }
  } catch (error) {
    console.error(`❌ SQL脚本执行失败: ${error.message}`);
    return { success: false, message: `SQL脚本执行失败: ${error.message}` };
  }
}

/**
 * 将SQL脚本分割为多个语句
 * @param {string} sqlContent - SQL脚本内容
 * @returns {string[]} - SQL语句数组
 */
function splitSqlStatements(sqlContent) {
  // 移除注释
  let cleanedSql = sqlContent;

  // 移除单行注释
  cleanedSql = cleanedSql.replace(/--.*$/gm, '');

  // 移除多行注释
  cleanedSql = cleanedSql.replace(/\/\*[\s\S]*?\*\//g, '');

  // 按分号分割语句
  const statements = cleanedSql.split(';');

  // 过滤掉空语句
  return statements.map(statement => statement.trim()).filter(statement => statement.length > 0);
}

/**
 * 主函数
 */
async function main() {
  // 获取命令行参数
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ 请指定要执行的SQL脚本文件路径');
    console.log('用法: node execute-sql-script.js <script-path>');
    process.exit(1);
  }

  const scriptPath = args[0];

  // 检查文件是否存在
  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ SQL脚本文件不存在: ${scriptPath}`);
    process.exit(1);
  }

  // 执行SQL脚本
  const result = await executeSqlScript(scriptPath);

  process.exit(result.success ? 0 : 1);
}

// 执行主函数
if (require.main === module) {
  main();
}

// 导出函数
module.exports = { executeSqlScript };
