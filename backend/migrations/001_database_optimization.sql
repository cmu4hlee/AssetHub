-- ============================================================
-- AssetHub 数据库性能优化脚本
-- 创建时间: 2026-03-01
-- 版本: 1.0.0
-- ============================================================

-- ============================================================
-- 1. 资产表 (assets) 索引优化
-- ============================================================

-- 复合索引：租户+状态+创建时间（常用列表查询）
CREATE INDEX IF NOT EXISTS idx_assets_tenant_status_created 
ON assets(tenant_id, status, created_at) 
COMMENT '租户资产列表查询优化';

-- 复合索引：租户+分类+位置（筛选查询）
CREATE INDEX IF NOT EXISTS idx_assets_tenant_category_location 
ON assets(tenant_id, category_id, location) 
COMMENT '资产分类位置筛选';

-- 复合索引：租户+部门+状态（部门资产统计）
CREATE INDEX IF NOT EXISTS idx_assets_tenant_dept_status 
ON assets(tenant_id, department_new, status) 
COMMENT '部门资产统计';

-- 资产编码搜索索引
CREATE INDEX IF NOT EXISTS idx_assets_code_search 
ON assets(asset_code, asset_name) 
COMMENT '资产编码名称搜索';

-- 责任人索引
CREATE INDEX IF NOT EXISTS idx_assets_responsible 
ON assets(tenant_id, responsible_person, status) 
COMMENT '责任人资产查询';

-- 购置日期索引（折旧计算用）
CREATE INDEX IF NOT EXISTS idx_assets_purchase_date 
ON assets(tenant_id, purchase_date) 
COMMENT '购置日期范围查询';

-- ============================================================
-- 2. 维修记录表 (maintenance_logs) 索引优化
-- ============================================================

-- 复合索引：资产+状态（查询资产维修记录）
CREATE INDEX IF NOT EXISTS idx_maintenance_asset_status 
ON maintenance_logs(tenant_id, asset_id, status, created_at) 
COMMENT '资产维修记录查询';

-- 维修人员索引
CREATE INDEX IF NOT EXISTS idx_maintenance_person 
ON maintenance_logs(tenant_id, maintenance_person, created_at) 
COMMENT '维修人员工作量统计';

-- 计划日期索引（预防性维护提醒）
CREATE INDEX IF NOT EXISTS idx_maintenance_planned_date 
ON maintenance_logs(tenant_id, planned_date, status) 
COMMENT '维修计划提醒';

-- ============================================================
-- 3. 审计日志表 (audit_logs) 分区优化
-- ============================================================

-- 创建分区表（如果表存在则迁移数据）
CREATE TABLE IF NOT EXISTS audit_logs_partitioned (
    id BIGINT AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100),
    details JSON,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, created_at),
    INDEX idx_audit_tenant_time (tenant_id, created_at),
    INDEX idx_audit_action (tenant_id, action, created_at),
    INDEX idx_audit_user (tenant_id, user_id, created_at)
) PARTITION BY RANGE (UNIX_TIMESTAMP(created_at)) (
    PARTITION p202601 VALUES LESS THAN (UNIX_TIMESTAMP('2026-02-01')),
    PARTITION p202602 VALUES LESS THAN (UNIX_TIMESTAMP('2026-03-01')),
    PARTITION p202603 VALUES LESS THAN (UNIX_TIMESTAMP('2026-04-01')),
    PARTITION p202604 VALUES LESS THAN (UNIX_TIMESTAMP('2026-05-01')),
    PARTITION p202605 VALUES LESS THAN (UNIX_TIMESTAMP('2026-06-01')),
    PARTITION p202606 VALUES LESS THAN (UNIX_TIMESTAMP('2026-07-01')),
    PARTITION p202607 VALUES LESS THAN (UNIX_TIMESTAMP('2026-08-01')),
    PARTITION p202608 VALUES LESS THAN (UNIX_TIMESTAMP('2026-09-01')),
    PARTITION p202609 VALUES LESS THAN (UNIX_TIMESTAMP('2026-10-01')),
    PARTITION p202610 VALUES LESS THAN (UNIX_TIMESTAMP('2026-11-01')),
    PARTITION p202611 VALUES LESS THAN (UNIX_TIMESTAMP('2026-12-01')),
    PARTITION p202612 VALUES LESS THAN (UNIX_TIMESTAMP('2027-01-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
) COMMENT='审计日志分区表';

-- 创建自动化分区维护事件（每月自动创建新分区）
DELIMITER //
CREATE EVENT IF NOT EXISTS evt_create_audit_partition
ON SCHEDULE EVERY 1 MONTH
STARTS '2026-04-01 00:00:00'
DO
BEGIN
    DECLARE next_month VARCHAR(7);
    DECLARE partition_name VARCHAR(20);
    DECLARE less_than_ts BIGINT;
    
    SET next_month = DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 2 MONTH), '%Y%m');
    SET partition_name = CONCAT('p', next_month);
    SET less_than_ts = UNIX_TIMESTAMP(DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 2 MONTH), '%Y-%m-01'));
    
    SET @sql = CONCAT('ALTER TABLE audit_logs_partitioned ADD PARTITION (PARTITION ', partition_name, 
                      ' VALUES LESS THAN (', less_than_ts, '))');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END //
DELIMITER ;

-- ============================================================
-- 4. 资产位置历史表 (asset_location_history) 分区优化
-- ============================================================

CREATE TABLE IF NOT EXISTS asset_location_history_partitioned (
    id BIGINT AUTO_INCREMENT,
    asset_id INT NOT NULL,
    location VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    accuracy FLOAT,
    recorded_by INT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, asset_id),
    INDEX idx_location_asset_time (asset_id, recorded_at),
    INDEX idx_location_time (recorded_at)
) PARTITION BY HASH(asset_id) PARTITIONS 16 
COMMENT='资产位置历史分区表';

-- ============================================================
-- 5. IoT 设备数据表 (iot_telemetry) 时序优化
-- ============================================================

CREATE TABLE IF NOT EXISTS iot_telemetry (
    id BIGINT AUTO_INCREMENT,
    device_id VARCHAR(100) NOT NULL,
    asset_id INT,
    tenant_id INT NOT NULL,
    metric_name VARCHAR(50) NOT NULL,
    metric_value DECIMAL(18, 6),
    unit VARCHAR(20),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, recorded_at),
    INDEX idx_iot_device_time (device_id, recorded_at),
    INDEX idx_iot_asset_metric (asset_id, metric_name, recorded_at),
    INDEX idx_iot_tenant_time (tenant_id, recorded_at)
) PARTITION BY RANGE (UNIX_TIMESTAMP(recorded_at)) (
    PARTITION p_iot_202603 VALUES LESS THAN (UNIX_TIMESTAMP('2026-04-01')),
    PARTITION p_iot_202604 VALUES LESS THAN (UNIX_TIMESTAMP('2026-05-01')),
    PARTITION p_iot_future VALUES LESS THAN MAXVALUE
) COMMENT='IoT设备遥测数据';

-- ============================================================
-- 6. 质量控制记录表索引优化
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_quality_asset_date 
ON quality_control_records(tenant_id, asset_id, inspection_date) 
COMMENT '资产质检记录查询';

CREATE INDEX IF NOT EXISTS idx_quality_expiry 
ON quality_control_records(tenant_id, next_inspection_date, status) 
COMMENT '即将到期质检提醒';

-- ============================================================
-- 7. 用户角色表索引优化
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_lookup 
ON user_tenant_roles(tenant_id, user_id, role_id) 
COMMENT '用户角色快速查询';

CREATE INDEX IF NOT EXISTS idx_user_tenant_status 
ON users(tenant_id, status, created_at) 
COMMENT '租户用户列表';

-- ============================================================
-- 8. 闲置资产表索引优化
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_idle_assets_status 
ON idle_assets(tenant_id, status, created_at) 
COMMENT '闲置资产列表';

-- ============================================================
-- 9. 盘点记录表索引优化
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_inventory_status 
ON inventory_records(tenant_id, status, created_at) 
COMMENT '盘点记录查询';

-- ============================================================
-- 10. 优化统计信息更新
-- ============================================================

ANALYZE TABLE assets;
ANALYZE TABLE maintenance_logs;
ANALYZE TABLE audit_logs;
ANALYZE TABLE asset_location_history;
ANALYZE TABLE quality_control_records;
ANALYZE TABLE users;
ANALYZE TABLE user_tenant_roles;

-- ============================================================
-- 优化完成
-- ============================================================
