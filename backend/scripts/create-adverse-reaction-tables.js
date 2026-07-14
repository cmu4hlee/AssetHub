/**
 * 创建不良事件管理模块数据库表
 * 包括：不良反应记录表、附件表
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('../config/app.config');

async function createAdverseReactionTables() {
  let connection;
  try {
    console.log('开始创建不良事件管理模块数据库表...\n');

    // 创建数据库连接
    connection = await mysql.createConnection({
      host: databaseConfig.host,
      port: databaseConfig.port,
      user: databaseConfig.user,
      password: databaseConfig.password,
      database: databaseConfig.database,
      connectTimeout: 10000,
    });

    console.log('✓ 数据库连接成功\n');

    // 1. 创建不良反应记录表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS adverse_reaction_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        report_no VARCHAR(100) NOT NULL COMMENT '报告编号',
        asset_id INT COMMENT '资产ID',
        asset_code VARCHAR(100) COMMENT '资产编号',
        asset_name VARCHAR(200) COMMENT '资产名称',
        report_type ENUM('设备故障', '安全事故', '质量事故', '使用异常', '其他') NOT NULL COMMENT '报告类型',
        severity ENUM('轻微', '一般', '严重', '重大') DEFAULT '一般' COMMENT '严重程度',
        occurrence_date DATETIME NOT NULL COMMENT '发生时间',
        discovery_date DATETIME COMMENT '发现时间',
        location VARCHAR(200) COMMENT '发生地点',
        department VARCHAR(100) COMMENT '发生科室',
        reporter VARCHAR(50) NOT NULL COMMENT '上报人',
        reporter_phone VARCHAR(50) COMMENT '上报人电话',
        description TEXT NOT NULL COMMENT '事件描述',
        cause_analysis TEXT COMMENT '原因分析',
        impact_assessment TEXT COMMENT '影响评估',
        handling_measures TEXT COMMENT '处理措施',
        prevention_measures TEXT COMMENT '预防措施',
        status ENUM('待处理', '处理中', '已处理', '已关闭', '已归档') DEFAULT '待处理' COMMENT '处理状态',
        handler VARCHAR(50) COMMENT '处理人',
        handle_date DATETIME COMMENT '处理时间',
        handle_result TEXT COMMENT '处理结果',
        reviewer VARCHAR(50) COMMENT '审核人',
        review_date DATETIME COMMENT '审核时间',
        review_comment TEXT COMMENT '审核意见',
        is_serious TINYINT(1) DEFAULT 0 COMMENT '是否严重事件',
        related_assets TEXT COMMENT '相关资产（JSON格式，支持多个）',
        remark TEXT COMMENT '备注',
        created_by VARCHAR(50) COMMENT '创建人',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL,
        UNIQUE KEY uk_tenant_report_no (tenant_id, report_no),
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_report_no (report_no),
        INDEX idx_asset_id (asset_id),
        INDEX idx_report_type (report_type),
        INDEX idx_severity (severity),
        INDEX idx_status (status),
        INDEX idx_occurrence_date (occurrence_date),
        INDEX idx_reporter (reporter)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='不良反应记录表'
    `);
    console.log('✓ adverse_reaction_records 表创建成功\n');

    // 2. 创建不良反应附件表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS adverse_reaction_attachments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        record_id INT NOT NULL COMMENT '记录ID',
        file_name VARCHAR(255) NOT NULL COMMENT '文件名',
        file_path VARCHAR(500) NOT NULL COMMENT '文件路径',
        file_size INT COMMENT '文件大小（字节）',
        file_type VARCHAR(50) COMMENT '文件类型',
        upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_record_id (record_id),
        FOREIGN KEY (record_id) REFERENCES adverse_reaction_records(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='不良反应附件表'
    `);
    console.log('✓ adverse_reaction_attachments 表创建成功\n');

    // 显示表结构
    const tables = ['adverse_reaction_records', 'adverse_reaction_attachments'];
    for (const tableName of tables) {
      const [tableInfo] = await connection.execute(
        `
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `,
        [databaseConfig.database, tableName],
      );

      console.log(`${tableName} 表结构:`);
      console.log('─────────────────────────────────────');
      tableInfo.forEach(col => {
        console.log(`  ${col.COLUMN_NAME} (${col.DATA_TYPE}) - ${col.COLUMN_COMMENT || ''}`);
      });
      console.log('─────────────────────────────────────\n');
    }

    await connection.end();
    console.log('✅ 不良事件管理模块数据库表创建完成！');
    return true;
  } catch (error) {
    console.error('\n❌ 创建失败:');
    console.error('错误代码:', error.code);
    console.error('错误消息:', error.message);
    console.error('错误堆栈:', error.stack);
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        // 忽略关闭错误
      }
    }
    return false;
  }
}

// 运行创建
createAdverseReactionTables()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
  });
