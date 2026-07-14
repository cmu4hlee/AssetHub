-- ============================================================
-- 迁移脚本：为缺失 tenant_id 的业务表添加租户隔离字段
-- 创建日期：2026-05-03
-- 说明：为多租户隔离改造中遗漏的业务数据表补充 tenant_id 字段和索引
-- 执行方式：逐条执行，已存在 tenant_id 的表会跳过
-- ============================================================

-- ============================================================
-- 报废管理子表
-- ============================================================

-- 报废审批表
SET @dbname = DATABASE();
SET @tablename = 'asset_scrapping_approvals';
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE asset_scrapping_approvals ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 报废评估表
SET @tablename = 'asset_scrapping_appraisals';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE asset_scrapping_appraisals ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 报废处置表
SET @tablename = 'asset_scrapping_disposals';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE asset_scrapping_disposals ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 报废附件表
SET @tablename = 'asset_scrapping_files';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE asset_scrapping_files ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================================
-- 位置告警相关表
-- ============================================================

-- 位置告警规则
SET @tablename = 'location_alert_rules';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE location_alert_rules ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 位置告警记录
SET @tablename = 'location_alerts';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE location_alerts ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================================
-- 不良反应相关表
-- ============================================================

-- 不良反应记录
SET @tablename = 'adverse_reaction_records';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE adverse_reaction_records ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 不良反应工作流
SET @tablename = 'adverse_reaction_workflow';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE adverse_reaction_workflow ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================================
-- 库存管理核心表
-- ============================================================

-- 盘点差异表
SET @tablename = 'inventory_discrepancies';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE inventory_discrepancies ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 盘点计划明细
SET @tablename = 'inventory_plan_details';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE inventory_plan_details ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 物料表
SET @tablename = 'materials';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE materials ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 库存表
SET @tablename = 'inventory';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE inventory ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 库存事务表
SET @tablename = 'inventory_transactions';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE inventory_transactions ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================================
-- 维修相关表
-- ============================================================

-- 工单物料消耗
SET @tablename = 'maintenance_workorder_materials';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE maintenance_workorder_materials ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 维修日志附件
SET @tablename = 'maintenance_log_attachments';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE maintenance_log_attachments ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 资产使用记录
SET @tablename = 'asset_usage_records';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE asset_usage_records ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 使用触发维护
SET @tablename = 'usage_triggered_maintenance';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE usage_triggered_maintenance ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 维修提醒
SET @tablename = 'maintenance_reminders';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE maintenance_reminders ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 维修提醒配置
SET @tablename = 'maintenance_reminder_configs';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE maintenance_reminder_configs ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 维修提醒历史
SET @tablename = 'maintenance_reminder_history';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE maintenance_reminder_history ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 维修成本汇总
SET @tablename = 'maintenance_cost_summary';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE maintenance_cost_summary ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 科室维修成本
SET @tablename = 'department_maintenance_costs';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE department_maintenance_costs ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================================
-- 其他业务表
-- ============================================================

-- 扫描日志
SET @tablename = 'scan_logs';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE scan_logs ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 资产标签模板
SET @tablename = 'asset_label_templates';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE asset_label_templates ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 资产标签打印队列
SET @tablename = 'asset_label_print_queue';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE asset_label_print_queue ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- AI助手学习上下文
SET @tablename = 'ai_assistant_learned_context';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE ai_assistant_learned_context ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 仪表盘配置
SET @tablename = 'dashboard_configs';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE dashboard_configs ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 云同步源
SET @tablename = 'cloud_sync_sources';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE cloud_sync_sources ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 云同步事件
SET @tablename = 'cloud_sync_events';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE cloud_sync_events ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 工作流表
SET @tablename = 'asset_workflows';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE asset_workflows ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 工作流状态
SET @tablename = 'asset_workflow_states';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE asset_workflow_states ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 工作流转换
SET @tablename = 'asset_workflow_transitions';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE asset_workflow_transitions ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 工作流操作
SET @tablename = 'asset_workflow_actions';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE asset_workflow_actions ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 工作流日志
SET @tablename = 'asset_workflow_logs';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE asset_workflow_logs ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 质量控制报告
SET @tablename = 'quality_control_reports';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE quality_control_reports ADD COLUMN tenant_id INT DEFAULT NULL COMMENT ''租户ID'''
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================================
-- 为所有新增 tenant_id 字段创建索引
-- ============================================================

DELIMITER //

CREATE PROCEDURE create_tenant_id_indexes()
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE tbl_name VARCHAR(128);
  DECLARE idx_name VARCHAR(128);

  DECLARE table_cursor CURSOR FOR
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND COLUMN_NAME = 'tenant_id'
      AND TABLE_NAME IN (
        'asset_scrapping_approvals', 'asset_scrapping_appraisals',
        'asset_scrapping_disposals', 'asset_scrapping_files',
        'location_alert_rules', 'location_alerts',
        'adverse_reaction_records', 'adverse_reaction_workflow',
        'inventory_discrepancies', 'inventory_plan_details',
        'materials', 'inventory', 'inventory_transactions',
        'maintenance_workorder_materials', 'maintenance_log_attachments',
        'asset_usage_records', 'usage_triggered_maintenance',
        'maintenance_reminders', 'maintenance_reminder_configs',
        'maintenance_reminder_history', 'maintenance_cost_summary',
        'department_maintenance_costs', 'scan_logs',
        'asset_label_templates', 'asset_label_print_queue',
        'ai_assistant_learned_context', 'dashboard_configs',
        'cloud_sync_sources', 'cloud_sync_events',
        'asset_workflows', 'asset_workflow_states',
        'asset_workflow_transitions', 'asset_workflow_actions',
        'asset_workflow_logs', 'quality_control_reports'
      );

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  OPEN table_cursor;

  read_loop: LOOP
    FETCH table_cursor INTO tbl_name;
    IF done THEN
      LEAVE read_loop;
    END IF;

    SET idx_name = CONCAT('idx_', tbl_name, '_tenant_id');

    SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl_name AND INDEX_NAME = idx_name);

    IF @index_exists = 0 THEN
      SET @sql = CONCAT('CREATE INDEX ', idx_name, ' ON ', tbl_name, ' (tenant_id)');
      PREPARE stmt FROM @sql;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;
    END IF;
  END LOOP;

  CLOSE table_cursor;
END //

DELIMITER ;

CALL create_tenant_id_indexes();
DROP PROCEDURE IF EXISTS create_tenant_id_indexes;

-- ============================================================
-- 为报废子表回填 tenant_id（从 asset_scrapping_records 继承）
-- ============================================================

UPDATE asset_scrapping_approvals a
  INNER JOIN asset_scrapping_records r ON a.scrapping_id = r.id
  SET a.tenant_id = r.tenant_id
  WHERE a.tenant_id IS NULL;

UPDATE asset_scrapping_appraisals a
  INNER JOIN asset_scrapping_records r ON a.scrapping_id = r.id
  SET a.tenant_id = r.tenant_id
  WHERE a.tenant_id IS NULL;

UPDATE asset_scrapping_disposals a
  INNER JOIN asset_scrapping_records r ON a.scrapping_id = r.id
  SET a.tenant_id = r.tenant_id
  WHERE a.tenant_id IS NULL;

UPDATE asset_scrapping_files a
  INNER JOIN asset_scrapping_records r ON a.scrapping_id = r.id
  SET a.tenant_id = r.tenant_id
  WHERE a.tenant_id IS NULL;

-- ============================================================
-- 为库存相关表回填 tenant_id（从 inventory_records 继承）
-- ============================================================

UPDATE inventory_discrepancies d
  INNER JOIN inventory_records r ON d.inventory_id = r.id
  SET d.tenant_id = r.tenant_id
  WHERE d.tenant_id IS NULL;

-- ============================================================
-- 为维修工单物料回填 tenant_id（从 maintenance_workorders 继承）
-- ============================================================

UPDATE maintenance_workorder_materials m
  INNER JOIN maintenance_workorders w ON m.workorder_id = w.id
  SET m.tenant_id = w.tenant_id
  WHERE m.tenant_id IS NULL;
