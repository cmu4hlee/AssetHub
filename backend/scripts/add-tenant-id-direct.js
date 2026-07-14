// 直接连接数据库并添加tenant_id字段的脚本
// 无需依赖现有的数据库配置文件
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置（直接硬编码）
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'zcgl',
};

/**
 * 主函数
 */
async function main() {
  console.log('🔍 开始为表添加tenant_id字段...');

  let connection;

  try {
    // 直接连接数据库
    console.log('📡 正在连接到数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // SQL语句数组（为4个表添加tenant_id字段）
    const sqlStatements = [
      // 1. 验收申请签字表
      `ALTER TABLE IF EXISTS acceptance_application_signatures 
       ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
       ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);`,

      // 2. 不良事件附件表
      `ALTER TABLE IF EXISTS adverse_reaction_attachments 
       ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
       ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);`,

      // 3. 资产验收文件表
      `ALTER TABLE IF EXISTS asset_acceptance_files 
       ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
       ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);`,

      // 4. 资产图片表
      `ALTER TABLE IF EXISTS asset_images 
       ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
       ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);`,
    ];

    // 逐条执行SQL语句
    for (let i = 0; i < sqlStatements.length; i++) {
      const sql = sqlStatements[i];
      const tableName = sql.match(/ALTER TABLE IF EXISTS (\w+)/)[1];

      console.log(`\n📝 正在处理表: ${tableName}`);

      try {
        await connection.execute(sql);
        console.log(`✅ 表 ${tableName} 已成功添加tenant_id字段和索引`);
      } catch (error) {
        console.error(`❌ 处理表 ${tableName} 失败: ${error.message}`);
        console.log('🔄 继续处理下一个表...');
      }
    }

    console.log('\n🎉 所有表处理完成！');
  } catch (error) {
    console.error(`❌ 数据库操作失败: ${error.message}`);
    console.log('\n⚠️  请确保：');
    console.log('   1. MySQL数据库服务正在运行');
    console.log('   2. 数据库配置（用户名、密码、数据库名）正确');
    console.log('   3. 数据库用户有权限修改表结构');
  } finally {
    // 关闭数据库连接
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行主函数
main();
