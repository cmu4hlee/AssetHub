/**
 * 不良事件管理模块数据库表初始化脚本
 * 在服务器启动时自动创建所需的表
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('../config/app.config');

async function initAdverseReactionTables() {
  console.log('[不良事件管理] 开始初始化数据库表...');

  let connection;
  try {
    // 直接创建连接，不使用连接池（避免连接池初始化问题）
    connection = await mysql.createConnection({
      host: databaseConfig.host,
      port: databaseConfig.port,
      user: databaseConfig.user,
      password: databaseConfig.password,
      database: databaseConfig.database,
      connectTimeout: 10000,
    });

    // 测试数据库连接
    await connection.ping();
    console.log('[不良事件管理] ✓ 数据库连接正常');

    // 创建不良反应记录表
    try {
      console.log('[不良事件管理] 正在创建表: adverse_reaction_records');
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
      console.log('[不良事件管理] ✓ adverse_reaction_records 表创建成功');
    } catch (err) {
      console.error('[不良事件管理] ✗ adverse_reaction_records 表创建失败:', err.message);
      throw err;
    }

    // 创建不良反应附件表
    try {
      console.log('[不良事件管理] 正在创建表: adverse_reaction_attachments');
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
      console.log('[不良事件管理] ✓ adverse_reaction_attachments 表创建成功');
    } catch (err) {
      console.error('[不良事件管理] ✗ adverse_reaction_attachments 表创建失败:', err.message);
      throw err;
    }

    console.log('[不良事件管理] ✅ 所有表初始化完成！');

    // 关闭连接
    await connection.end();
    return true;
  } catch (error) {
    console.error('[不良事件管理] ❌ 表初始化失败:');
    console.error('错误代码:', error.code);
    console.error('错误消息:', error.message);
    console.error('错误堆栈:', error.stack);

    // 确保关闭连接
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

// 如果直接运行此脚本
if (require.main === module) {
  initAdverseReactionTables()
    .then(success => {
      if (success) {
        console.log('[不良事件管理] 初始化脚本执行成功');
        process.exit(0);
      } else {
        console.error('[不良事件管理] 初始化脚本执行失败');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('[不良事件管理] 初始化脚本执行异常:', error);
      process.exit(1);
    });
}

module.exports = initAdverseReactionTables;
