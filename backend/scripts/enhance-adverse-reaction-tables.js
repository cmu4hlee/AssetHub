/**
 * 增强不良事件管理模块数据库表
 * 添加更多字段和功能表
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('../config/app.config');

async function hasColumn(connection, tableName, columnName) {
  const [rows] = await connection.execute(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function hasIndex(connection, tableName, indexName) {
  const [rows] = await connection.execute(`SHOW INDEX FROM \`${tableName}\` WHERE Key_name = ?`, [
    indexName,
  ]);
  return rows.length > 0;
}

async function enhanceAdverseReactionTables() {
  let connection;
  try {
    console.log('开始增强不良事件管理模块数据库表...\n');

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

    if (!(await hasColumn(connection, 'adverse_reaction_records', 'tenant_id'))) {
      await connection.execute(
        `ALTER TABLE adverse_reaction_records
         ADD COLUMN tenant_id INT NULL COMMENT '租户ID' AFTER id`,
      );
      console.log('✓ adverse_reaction_records 已添加 tenant_id 字段');
    }

    if (!(await hasIndex(connection, 'adverse_reaction_records', 'idx_tenant_id'))) {
      await connection.execute(
        'CREATE INDEX idx_tenant_id ON adverse_reaction_records(tenant_id)',
      );
      console.log('✓ adverse_reaction_records 已添加 tenant_id 索引');
    }

    const [uniqueReportIndexes] = await connection.execute(
      `SHOW INDEX FROM adverse_reaction_records
       WHERE Column_name = 'report_no' AND Non_unique = 0`,
    );
    for (const index of uniqueReportIndexes) {
      if (index.Key_name !== 'uk_tenant_report_no') {
        await connection.execute(
          `ALTER TABLE adverse_reaction_records DROP INDEX \`${index.Key_name}\``,
        );
        console.log(`✓ adverse_reaction_records 已移除旧唯一索引: ${index.Key_name}`);
      }
    }

    if (!(await hasIndex(connection, 'adverse_reaction_records', 'uk_tenant_report_no'))) {
      await connection.execute(
        'ALTER TABLE adverse_reaction_records ADD UNIQUE INDEX uk_tenant_report_no (tenant_id, report_no)',
      );
      console.log('✓ adverse_reaction_records 已添加租户级唯一索引 uk_tenant_report_no');
    }

    // 1. 增强主表字段
    console.log('正在增强 adverse_reaction_records 表...');
    const alterQueries = [
      // 添加事件等级（I级、II级、III级、IV级）
      `ALTER TABLE adverse_reaction_records 
       ADD COLUMN IF NOT EXISTS event_level ENUM('I级', 'II级', 'III级', 'IV级') COMMENT '事件等级' AFTER severity`,

      // 添加事件分类（更细化）
      `ALTER TABLE adverse_reaction_records 
       ADD COLUMN IF NOT EXISTS event_category VARCHAR(100) COMMENT '事件分类' AFTER report_type`,

      // 添加涉及人员信息
      `ALTER TABLE adverse_reaction_records 
       ADD COLUMN IF NOT EXISTS involved_persons TEXT COMMENT '涉及人员（JSON格式）' AFTER department`,

      // 添加事件后果
      `ALTER TABLE adverse_reaction_records 
       ADD COLUMN IF NOT EXISTS event_consequence ENUM('无伤害', '轻微伤害', '中度伤害', '重度伤害', '死亡', '设备损坏', '其他') COMMENT '事件后果' AFTER severity`,

      // 添加处理时限（小时）
      `ALTER TABLE adverse_reaction_records 
       ADD COLUMN IF NOT EXISTS handle_deadline INT COMMENT '处理时限（小时）' AFTER status`,

      // 添加是否超时
      `ALTER TABLE adverse_reaction_records 
       ADD COLUMN IF NOT EXISTS is_overdue TINYINT(1) DEFAULT 0 COMMENT '是否超时' AFTER handle_deadline`,

      // 添加上报来源
      `ALTER TABLE adverse_reaction_records 
       ADD COLUMN IF NOT EXISTS report_source ENUM('系统上报', '电话上报', '邮件上报', '现场上报', '其他') DEFAULT '系统上报' COMMENT '上报来源' AFTER reporter`,

      // 添加事件发生原因分类
      `ALTER TABLE adverse_reaction_records 
       ADD COLUMN IF NOT EXISTS cause_category ENUM('设备故障', '操作失误', '管理缺陷', '环境因素', '其他') COMMENT '原因分类' AFTER cause_analysis`,

      // 添加改进建议
      `ALTER TABLE adverse_reaction_records 
       ADD COLUMN IF NOT EXISTS improvement_suggestions TEXT COMMENT '改进建议' AFTER prevention_measures`,

      // 添加是否已上报监管部门
      `ALTER TABLE adverse_reaction_records 
       ADD COLUMN IF NOT EXISTS reported_to_authority TINYINT(1) DEFAULT 0 COMMENT '是否已上报监管部门' AFTER is_serious`,

      // 添加上报监管部门时间
      `ALTER TABLE adverse_reaction_records 
       ADD COLUMN IF NOT EXISTS authority_report_date DATETIME COMMENT '上报监管部门时间' AFTER reported_to_authority`,

      // 添加关闭原因
      `ALTER TABLE adverse_reaction_records 
       ADD COLUMN IF NOT EXISTS close_reason TEXT COMMENT '关闭原因' AFTER review_comment`,
    ];

    for (const query of alterQueries) {
      try {
        // MySQL 5.5 不支持 IF NOT EXISTS，需要先检查
        await connection.execute(query.replace('IF NOT EXISTS', ''));
        console.log(`  ✓ ${query.match(/ADD COLUMN[^A]+/)?.[0]?.trim() || '字段添加成功'}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log('  - 字段已存在，跳过');
        } else {
          console.warn(`  ⚠️ 添加字段失败: ${error.message}`);
        }
      }
    }

    if (!(await hasColumn(connection, 'adverse_reaction_attachments', 'tenant_id'))) {
      await connection.execute(
        `ALTER TABLE adverse_reaction_attachments
         ADD COLUMN tenant_id INT NULL COMMENT '租户ID' AFTER id`,
      );
      console.log('✓ adverse_reaction_attachments 已添加 tenant_id 字段');
    }

    await connection.execute(`
      UPDATE adverse_reaction_attachments aa
      INNER JOIN adverse_reaction_records ar ON ar.id = aa.record_id
      SET aa.tenant_id = ar.tenant_id
      WHERE aa.tenant_id IS NULL
    `);

    if (!(await hasIndex(connection, 'adverse_reaction_attachments', 'idx_tenant_id'))) {
      await connection.execute(
        'CREATE INDEX idx_tenant_id ON adverse_reaction_attachments(tenant_id)',
      );
      console.log('✓ adverse_reaction_attachments 已添加 tenant_id 索引');
    }

    // 2. 创建事件处理流程记录表
    console.log('\n正在创建 adverse_reaction_workflow 表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS adverse_reaction_workflow (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        record_id INT NOT NULL COMMENT '记录ID',
        step_name VARCHAR(100) NOT NULL COMMENT '步骤名称',
        step_type ENUM('上报', '处理', '审核', '关闭', '归档') NOT NULL COMMENT '步骤类型',
        operator VARCHAR(50) NOT NULL COMMENT '操作人',
        operation_time DATETIME NOT NULL COMMENT '操作时间',
        operation_result ENUM('通过', '退回', '拒绝', '完成') COMMENT '操作结果',
        comment TEXT COMMENT '操作意见',
        next_handler VARCHAR(50) COMMENT '下一步处理人',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_record_id (record_id),
        INDEX idx_operation_time (operation_time),
        FOREIGN KEY (record_id) REFERENCES adverse_reaction_records(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='不良事件处理流程记录表'
    `);
    console.log('✓ adverse_reaction_workflow 表创建成功\n');

    if (!(await hasColumn(connection, 'adverse_reaction_workflow', 'tenant_id'))) {
      await connection.execute(
        `ALTER TABLE adverse_reaction_workflow
         ADD COLUMN tenant_id INT NULL COMMENT '租户ID' AFTER id`,
      );
      console.log('✓ adverse_reaction_workflow 已添加 tenant_id 字段');
    }

    await connection.execute(`
      UPDATE adverse_reaction_workflow aw
      INNER JOIN adverse_reaction_records ar ON ar.id = aw.record_id
      SET aw.tenant_id = ar.tenant_id
      WHERE aw.tenant_id IS NULL
    `);

    if (!(await hasIndex(connection, 'adverse_reaction_workflow', 'idx_tenant_id'))) {
      await connection.execute('CREATE INDEX idx_tenant_id ON adverse_reaction_workflow(tenant_id)');
      console.log('✓ adverse_reaction_workflow 已添加 tenant_id 索引');
    }

    // 3. 创建统计分析视图（可选）
    console.log('正在创建统计分析视图...');
    try {
      await connection.execute(`
        CREATE OR REPLACE VIEW v_adverse_reaction_statistics AS
        SELECT 
          tenant_id,
          DATE_FORMAT(occurrence_date, '%Y-%m') as month,
          report_type,
          severity,
          event_level,
          event_consequence,
          status,
          COUNT(*) as count,
          SUM(CASE WHEN is_serious = 1 THEN 1 ELSE 0 END) as serious_count,
          SUM(CASE WHEN is_overdue = 1 THEN 1 ELSE 0 END) as overdue_count
        FROM adverse_reaction_records
        GROUP BY tenant_id, month, report_type, severity, event_level, event_consequence, status
      `);
      console.log('✓ 统计分析视图创建成功\n');
    } catch (error) {
      console.warn('⚠️ 创建视图失败（可能已存在）:', error.message);
    }

    await connection.end();
    console.log('✅ 不良事件管理模块数据库表增强完成！');
    return true;
  } catch (error) {
    console.error('\n❌ 增强失败:');
    console.error('错误代码:', error.code);
    console.error('错误消息:', error.message);
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

// 运行增强
enhanceAdverseReactionTables()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
  });
