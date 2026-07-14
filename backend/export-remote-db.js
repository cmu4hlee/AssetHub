const mysql = require('mysql2/promise');
const fs = require('fs');
const { database: dbConfig } = require('./config/app.config');

async function exportDatabase() {
  try {
    console.log('=== 导出远程数据库 ===\n');

    // 连接远程数据库
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ 连接远程数据库成功');

    // 获取所有表
    const [tables] = await connection.execute('SHOW TABLES');
    const tableNames = tables.map(table => Object.values(table)[0]);

    console.log(`\n找到 ${tableNames.length} 个表`);

    let sqlContent = `-- 数据库导出: ${dbConfig.host}/${dbConfig.database}\n-- 导出时间: ${new Date().toISOString()}\n-- 导出工具: 自定义脚本\n\n`;

    // 导出每个表
    for (const tableName of tableNames) {
      console.log(`\n处理表: ${tableName}`);

      // 获取表结构
      const [createTable] = await connection.execute(`SHOW CREATE TABLE ${tableName}`);
      sqlContent += `-- 表结构: ${tableName}\n${createTable[0]['Create Table']};\n\n`;

      // 获取表数据
      const [data] = await connection.execute(`SELECT * FROM ${tableName}`);
      if (data.length > 0) {
        sqlContent += `-- 表数据: ${tableName} (${data.length} 行)\n`;
        sqlContent += `INSERT INTO ${tableName} VALUES `;

        const values = data.map(row => {
          const rowValues = Object.values(row).map(value => {
            if (value === null) return 'NULL';
            if (typeof value === 'string') {
              // 转义字符串
              return `'${value.replace(/'/g, "''")}'`;
            }
            return value;
          });
          return `(${rowValues.join(', ')})`;
        });

        sqlContent += `${values.join(', ')};\n\n`;
        console.log(`✅ 导出 ${data.length} 行数据`);
      } else {
        console.log('✅ 表为空');
      }
    }

    // 写入导出文件
    fs.writeFileSync('../../zcgl_export.sql', sqlContent);
    console.log('\n🎉 数据库导出成功！');
    console.log('   导出文件: ../../zcgl_export.sql');
    console.log(`   文件大小: ${(sqlContent.length / 1024).toFixed(2)} KB`);

    await connection.end();
  } catch (error) {
    console.error('❌ 导出失败:', error.message);
  }
}

exportDatabase();
