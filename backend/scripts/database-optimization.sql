-- =====================================================
-- 数据库性能优化脚本
-- 包含索引优化、分区表、性能调优
-- =====================================================

-- -----------------------------------------------------
-- 1. 合规性管理模块索引优化
-- -----------------------------------------------------

-- 分级保养计划表索引
ALTER TABLE maintenance_level_plans 
ADD INDEX idx_status_due_date (status, due_date),
ADD INDEX idx_asset_status (asset_id, status),
ADD INDEX idx_plan_date (plan_date),
ADD INDEX idx_maintenance_level (maintenance_level);

-- 分级保养模板表索引
ALTER TABLE maintenance_level_templates
ADD INDEX idx_level_status (maintenance_level, status),
ADD INDEX idx_category (asset_category),
ADD INDEX idx_risk_level (risk_level);

-- 设备风险等级表索引
ALTER TABLE asset_risk_levels
ADD INDEX idx_asset_current (asset_id, risk_level),
ADD INDEX idx_assessment_date (assessment_date),
ADD INDEX idx_next_assessment (next_assessment_date);

-- 特种设备表索引
ALTER TABLE special_equipment
ADD INDEX idx_type_status (equipment_type, use_status),
ADD INDEX idx_next_inspection (next_inspection_date),
ADD INDEX idx_registration (registration_no);

-- 特种设备检验记录表索引
ALTER TABLE special_equipment_inspections
ADD INDEX idx_equipment_date (equipment_id, inspection_date),
ADD INDEX idx_next_inspection (next_inspection_date),
ADD INDEX idx_certificate (certificate_no);

-- 安全检测表索引
ALTER TABLE safety_inspections
ADD INDEX idx_type_result (inspection_type, inspection_result),
ADD INDEX idx_asset_date (asset_id, inspection_date),
ADD INDEX idx_next_date (next_inspection_date),
ADD INDEX idx_risk_level (risk_level);

-- -----------------------------------------------------
-- 2. 开机率管理模块索引优化
-- -----------------------------------------------------

-- 设备运行记录表索引
ALTER TABLE asset_operation_logs
ADD INDEX idx_asset_date (asset_id, operation_date),
ADD INDEX idx_tenant_date (tenant_id, operation_date),
ADD INDEX idx_downtime_type (downtime_type);

-- 开机率统计表索引
ALTER TABLE asset_uptime_statistics
ADD INDEX idx_asset_year_month (asset_id, stat_year, stat_month),
ADD INDEX idx_uptime_rate (uptime_rate),
ADD INDEX idx_year_month (stat_year, stat_month);

-- -----------------------------------------------------
-- 3. 人员资质模块索引优化
-- -----------------------------------------------------

-- 人员资质表索引
ALTER TABLE staff_qualifications
ADD INDEX idx_user_type (user_id, qualification_type),
ADD INDEX idx_expiry_date (expiry_date),
ADD INDEX idx_status (status);

-- -----------------------------------------------------
-- 3.1 人员资质表新增字段 (支持前端 qualification_code 和 scope)
-- -----------------------------------------------------

-- 添加 qualification_code 列 (资质编号)
ALTER TABLE staff_qualifications
ADD COLUMN IF NOT EXISTS qualification_code VARCHAR(50) COMMENT '资质编号' AFTER qualification_type;

-- 添加 scope 列 (资质范围)
ALTER TABLE staff_qualifications
ADD COLUMN IF NOT EXISTS scope TEXT COMMENT '资质适用范围' AFTER expiry_date;

-- 为 qualification_code 添加唯一索引 (同一租户内不重复)
ALTER TABLE staff_qualifications
ADD UNIQUE INDEX idx_tenant_qualification_code (tenant_id, qualification_code);

-- 培训记录表索引
ALTER TABLE staff_training_records
ADD INDEX idx_user_date (user_id, training_date),
ADD INDEX idx_training_type (training_type),
ADD INDEX idx_assessment_result (assessment_result);

-- -----------------------------------------------------
-- 4. 现有表索引优化
-- -----------------------------------------------------

-- 资产表索引优化
ALTER TABLE assets
ADD INDEX idx_status_department (status, department),
ADD INDEX idx_type_category (asset_type, category_id),
ADD INDEX idx_purchase_date (purchase_date),
ADD INDEX idx_warranty_end (warranty_end_date);

-- 维修工单表索引优化
ALTER TABLE maintenance_workorders
ADD INDEX idx_status_priority (status, priority),
ADD INDEX idx_asset_status (asset_id, status),
ADD INDEX idx_created_date (created_at);

-- 计量记录表索引优化
ALTER TABLE metrology_records
ADD INDEX idx_next_date (next_date),
ADD INDEX idx_status (status);

-- -----------------------------------------------------
-- 5. 分区表创建（大数据量时使用）
-- -----------------------------------------------------

-- 设备运行记录按月分区
DROP TABLE IF EXISTS asset_operation_logs_partitioned;

CREATE TABLE asset_operation_logs_partitioned (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  asset_id INT NOT NULL,
  operation_date DATE NOT NULL,
  planned_operating_hours DECIMAL(5,2) DEFAULT 24.00,
  actual_operating_hours DECIMAL(5,2) DEFAULT 0,
  downtime_hours DECIMAL(5,2) DEFAULT 0,
  status_changes JSON,
  downtime_reason VARCHAR(200),
  downtime_type ENUM('maintenance', 'repair', 'fault', 'inspection', 'other'),
  data_source ENUM('iot', 'manual', 'system') DEFAULT 'manual',
  recorded_by INT,
  recorded_by_name VARCHAR(100),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id, operation_date),
  INDEX idx_asset_date (asset_id, operation_date),
  INDEX idx_tenant_date (tenant_id, operation_date)
) PARTITION BY RANGE (YEAR(operation_date) * 100 + MONTH(operation_date)) (
  PARTITION p202401 VALUES LESS THAN (202402),
  PARTITION p202402 VALUES LESS THAN (202403),
  PARTITION p202403 VALUES LESS THAN (202404),
  PARTITION p202404 VALUES LESS THAN (202405),
  PARTITION p202405 VALUES LESS THAN (202406),
  PARTITION p202406 VALUES LESS THAN (202407),
  PARTITION p202407 VALUES LESS THAN (202408),
  PARTITION p202408 VALUES LESS THAN (202409),
  PARTITION p202409 VALUES LESS THAN (202410),
  PARTITION p202410 VALUES LESS THAN (202411),
  PARTITION p202411 VALUES LESS THAN (202412),
  PARTITION p202412 VALUES LESS THAN (202413),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- -----------------------------------------------------
-- 6. 视图创建（方便查询）
-- -----------------------------------------------------

-- 设备综合信息视图
CREATE OR REPLACE VIEW v_asset_overview AS
SELECT 
  a.*,
  arl.risk_level,
  arl.risk_score,
  aus.uptime_rate,
  aus.total_downtime_hours,
  m.next_date as next_metrology_date,
  se.equipment_type as special_equipment_type,
  se.next_inspection_date as special_next_inspection
FROM assets a
LEFT JOIN asset_risk_levels arl ON a.id = arl.asset_id 
  AND arl.id = (SELECT MAX(id) FROM asset_risk_levels WHERE asset_id = a.id)
LEFT JOIN asset_uptime_statistics aus ON a.id = aus.asset_id 
  AND aus.stat_year = YEAR(CURDATE()) AND aus.stat_month = MONTH(CURDATE())
LEFT JOIN metrology_records m ON a.id = m.asset_id 
  AND m.id = (SELECT MAX(id) FROM metrology_records WHERE asset_id = a.id)
LEFT JOIN special_equipment se ON a.id = se.asset_id;

-- 即将到期的保养计划视图
CREATE OR REPLACE VIEW v_upcoming_maintenance AS
SELECT 
  mlp.*,
  a.asset_code,
  a.asset_name,
  a.department,
  mlt.template_name,
  mlt.maintenance_level,
  DATEDIFF(mlp.due_date, CURDATE()) as days_remaining
FROM maintenance_level_plans mlp
JOIN assets a ON mlp.asset_id = a.id
JOIN maintenance_level_templates mlt ON mlp.template_id = mlt.id
WHERE mlp.status = 'pending' 
  AND mlp.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY);

-- 低开机率设备视图
CREATE OR REPLACE VIEW v_low_uptime_assets AS
SELECT 
  aus.*,
  a.asset_code,
  a.asset_name,
  a.department,
  a.asset_type,
  CASE 
    WHEN a.asset_type IN ('生命支持类', '急救类') THEN 99
    ELSE 95
  END as target_uptime
FROM asset_uptime_statistics aus
JOIN assets a ON aus.asset_id = a.id
WHERE aus.stat_year = YEAR(CURDATE()) 
  AND aus.stat_month = MONTH(CURDATE())
  AND aus.uptime_rate < 95;

-- -----------------------------------------------------
-- 7. 存储过程（常用操作）
-- -----------------------------------------------------

-- 存储过程：计算月度开机率
DELIMITER //
CREATE PROCEDURE CalculateMonthlyUptime(
  IN p_tenant_id INT,
  IN p_year INT,
  IN p_month INT
)
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE v_asset_id INT;
  DECLARE cur CURSOR FOR 
    SELECT id FROM assets WHERE tenant_id = p_tenant_id AND status != '报废';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
  
  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO v_asset_id;
    IF done THEN
      LEAVE read_loop;
    END IF;
    
    -- 插入或更新开机率统计
    INSERT INTO asset_uptime_statistics (
      tenant_id, asset_id, stat_year, stat_month,
      planned_operating_days, actual_operating_days,
      total_planned_hours, total_actual_hours, total_downtime_hours,
      uptime_rate
    )
    SELECT 
      p_tenant_id, v_asset_id, p_year, p_month,
      COUNT(*), SUM(CASE WHEN actual_operating_hours > 0 THEN 1 ELSE 0 END),
      SUM(planned_operating_hours), SUM(actual_operating_hours),
      SUM(downtime_hours),
      ROUND(SUM(actual_operating_hours) / SUM(planned_operating_hours) * 100, 2)
    FROM asset_operation_logs
    WHERE tenant_id = p_tenant_id 
      AND asset_id = v_asset_id
      AND YEAR(operation_date) = p_year 
      AND MONTH(operation_date) = p_month
    ON DUPLICATE KEY UPDATE
      planned_operating_days = VALUES(planned_operating_days),
      actual_operating_days = VALUES(actual_operating_days),
      total_planned_hours = VALUES(total_planned_hours),
      total_actual_hours = VALUES(total_actual_hours),
      total_downtime_hours = VALUES(total_downtime_hours),
      uptime_rate = VALUES(uptime_rate),
      updated_at = CURRENT_TIMESTAMP;
  END LOOP;
  CLOSE cur;
END //
DELIMITER ;

-- -----------------------------------------------------
-- 8. 触发器（自动维护）
-- -----------------------------------------------------

-- 触发器：更新设备状态变更时记录日志
DELIMITER //
CREATE TRIGGER tr_asset_status_change
AFTER UPDATE ON assets
FOR EACH ROW
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO asset_operation_logs (
      tenant_id, asset_id, operation_date,
      status_changes, data_source, remarks
    ) VALUES (
      NEW.tenant_id, NEW.id, CURDATE(),
      JSON_OBJECT('old_status', OLD.status, 'new_status', NEW.status),
      'system',
      CONCAT('状态从 ', OLD.status, ' 变更为 ', NEW.status)
    );
  END IF;
END //
DELIMITER ;

SELECT '数据库优化完成' AS message;
