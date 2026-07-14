const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'zcgl',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

async function checkAndCreateTables() {
  let connection;

  try {
    // 创建数据库连接
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 检查并创建资产标签模板表
    const checkTemplateTableSql = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'asset_label_templates'
    `;

    const [templateTableRows] = await connection.execute(checkTemplateTableSql, [
      dbConfig.database,
    ]);

    if (templateTableRows.length === 0) {
      // 创建资产标签模板表
      const createTemplateTableSql = `
        CREATE TABLE asset_label_templates (
          id INT(11) NOT NULL AUTO_INCREMENT,
          tenant_id INT(11) NOT NULL,
          name VARCHAR(100) NOT NULL,
          description TEXT NULL,
          width DECIMAL(10,2) NOT NULL,
          height DECIMAL(10,2) NOT NULL,
          dpi INT(11) NOT NULL DEFAULT 300,
          elements TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT NULL,
          created_by VARCHAR(50) NULL,
          updated_by VARCHAR(50) NULL,
          PRIMARY KEY (id),
          INDEX idx_tenant_id (tenant_id),
          CONSTRAINT fk_asset_label_templates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
      `;

      await connection.execute(createTemplateTableSql);
      console.log('✅ asset_label_templates表创建成功');
    } else {
      console.log('✅ asset_label_templates表已存在');
    }

    // 检查并创建资产标签打印队列表
    const checkPrintQueueTableSql = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'asset_label_print_queue'
    `;

    const [printQueueTableRows] = await connection.execute(checkPrintQueueTableSql, [
      dbConfig.database,
    ]);

    if (printQueueTableRows.length === 0) {
      // 创建资产标签打印队列表
      const createPrintQueueTableSql = `
        CREATE TABLE asset_label_print_queue (
          id INT(11) NOT NULL AUTO_INCREMENT,
          tenant_id INT(11) NOT NULL,
          template_id INT(11) NOT NULL,
          asset_id INT(11) NOT NULL,
          zpl_content TEXT NOT NULL,
          print_status ENUM('pending', 'printing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
          printer_name VARCHAR(100) NULL,
          error_message TEXT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          printed_at TIMESTAMP NULL DEFAULT NULL,
          created_by VARCHAR(50) NULL,
          PRIMARY KEY (id),
          INDEX idx_tenant_id (tenant_id),
          INDEX idx_template_id (template_id),
          INDEX idx_asset_id (asset_id),
          INDEX idx_print_status (print_status),
          CONSTRAINT fk_asset_label_print_queue_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_asset_label_print_queue_template FOREIGN KEY (template_id) REFERENCES asset_label_templates(id) ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_asset_label_print_queue_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
      `;

      await connection.execute(createPrintQueueTableSql);
      console.log('✅ asset_label_print_queue表创建成功');
    } else {
      console.log('✅ asset_label_print_queue表已存在');
    }

    console.log('\n🎉 所有资产标签相关表检查创建完成！');
  } catch (error) {
    console.error('❌ 数据库操作失败:', error.message);
  } finally {
    // 关闭数据库连接
    if (connection) {
      await connection.end();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

// 执行函数
checkAndCreateTables();
