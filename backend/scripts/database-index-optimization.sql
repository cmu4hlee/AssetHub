-- ============================================
-- 数据库索引优化脚本
-- 创建于: 2026-03-06
-- 说明: 根据查询模式添加索引，提升查询性能
-- ============================================

-- ============================================
-- 1. 资产表 (assets) 索引优化
-- ============================================

-- 复合索引：租户+状态（用于资产列表查询）
ALTER TABLE assets ADD INDEX idx_tenant_status (tenant_id, status);

-- 复合索引：租户+部门+状态（用于部门资产查询）
ALTER TABLE assets ADD INDEX idx_tenant_dept_status (tenant_id, department, status);

-- 复合索引：租户+分类+状态（用于分类统计）
ALTER TABLE assets ADD INDEX idx_tenant_category_status (tenant_id, category_id, status);

-- 索引：资产编码（用于精确查询）
ALTER TABLE assets ADD INDEX idx_asset_code (asset_code);

-- 索引：购置日期（用于时间段查询）
ALTER TABLE assets ADD INDEX idx_purchase_date (purchase_date);

-- 索引：责任人（用于我的资产查询）
ALTER TABLE assets ADD INDEX idx_responsible_person (responsible_person);

-- ============================================
-- 2. 维修记录表 (maintenance_logs) 索引优化
-- ============================================

-- 复合索引：资产+日期（用于单资产维修历史）
ALTER TABLE maintenance_logs ADD INDEX idx_asset_date (asset_id, maintenance_date);

-- 复合索引：租户+状态（用于维修列表）
ALTER TABLE maintenance_logs ADD INDEX idx_tenant_status (tenant_id, status);

-- 复合索引：租户+类型+状态（用于维修统计）
ALTER TABLE maintenance_logs ADD INDEX idx_tenant_type_status (tenant_id, maintenance_type, status);

-- 索引：维修日期（用于时间段统计）
ALTER TABLE maintenance_logs ADD INDEX idx_maintenance_date (maintenance_date);

-- ============================================
-- 3. 预防性维护计划表 (preventive_maintenance_plans) 索引优化
-- ============================================

-- 复合索引：资产+状态（用于获取资产的维护计划）
ALTER TABLE preventive_maintenance_plans ADD INDEX idx_asset_status (asset_id, status);

-- 复合索引：下次维护日期+状态（用于到期提醒）
ALTER TABLE preventive_maintenance_plans ADD INDEX idx_next_date_status (next_maintenance_date, status);

-- 索引：资产编码（用于关联查询）
ALTER TABLE preventive_maintenance_plans ADD INDEX idx_asset_code (asset_code);

-- ============================================
-- 4. 资产位置历史表 (asset_location_history) 索引优化
-- ============================================

-- 复合索引：资产+时间（用于位置轨迹查询）
ALTER TABLE asset_location_history ADD INDEX idx_asset_time (asset_id, created_at);

-- 复合索引：位置+时间（用于位置资产查询）
ALTER TABLE asset_location_history ADD INDEX idx_location_time (location_id, created_at);

-- 索引：信标ID（用于信标关联）
ALTER TABLE asset_location_history ADD INDEX idx_beacon_id (beacon_id);

-- ============================================
-- 5. 审计日志表 (audit_logs) 索引优化
-- ============================================

-- 复合索引：租户+用户+时间（用于用户操作历史）
ALTER TABLE audit_logs ADD INDEX idx_tenant_user_time (tenant_id, user_id, created_at);

-- 复合索引：租户+模块+操作（用于操作统计）
ALTER TABLE audit_logs ADD INDEX idx_tenant_module_action (tenant_id, module, action);

-- 复合索引：资源类型+资源ID（用于资源操作历史）
ALTER TABLE audit_logs ADD INDEX idx_resource (resource_type, resource_id);

-- 索引：创建时间（用于日志清理和查询）
ALTER TABLE audit_logs ADD INDEX idx_created_at (created_at);

-- ============================================
-- 6. 物联网设备表 (iot_devices) 索引优化
-- ============================================

-- 复合索引：租户+状态（用于设备列表）
ALTER TABLE iot_devices ADD INDEX idx_tenant_status (tenant_id, status);

-- 复合索引：资产+状态（用于资产设备查询）
ALTER TABLE iot_devices ADD INDEX idx_asset_status (asset_id, status);

-- 索引：设备类型（用于类型统计）
ALTER TABLE iot_devices ADD INDEX idx_device_type (device_type);

-- ============================================
-- 7. 用户表 (users) 索引优化
-- ============================================

-- 复合索引：租户+状态（用于用户列表）
ALTER TABLE users ADD INDEX idx_tenant_status (tenant_id, status);

-- 索引：用户名（用于登录查询）
ALTER TABLE users ADD INDEX idx_username (username);

-- 索引：邮箱（用于邮箱登录/找回密码）
ALTER TABLE users ADD INDEX idx_email (email);

-- ============================================
-- 8. 质量控制记录表 (quality_control_records) 索引优化
-- ============================================

-- 复合索引：租户+状态（用于质控列表）
ALTER TABLE quality_control_records ADD INDEX idx_tenant_status (tenant_id, status);

-- 复合索引：下次质控日期+状态（用于到期提醒）
ALTER TABLE quality_control_records ADD INDEX idx_next_date_status (next_qc_date, status);

-- 索引：资产ID（用于资产质控历史）
ALTER TABLE quality_control_records ADD INDEX idx_asset_id (asset_id);

-- ============================================
-- 9. 闲置资产表 (idle_assets) 索引优化
-- ============================================

-- 复合索引：租户+状态（用于闲置资产列表）
ALTER TABLE idle_assets ADD INDEX idx_tenant_status (tenant_id, status);

-- 复合索引：租户+分类（用于分类统计）
ALTER TABLE idle_assets ADD INDEX idx_tenant_category (tenant_id, category_id);

-- 索引：发布时间（用于排序）
ALTER TABLE idle_assets ADD INDEX idx_publish_date (publish_date);

-- ============================================
-- 10. 验收记录表 (acceptance_records) 索引优化
-- ============================================

-- 复合索引：租户+状态（用于验收列表）
ALTER TABLE acceptance_records ADD INDEX idx_tenant_status (tenant_id, status);

-- 索引：验收日期（用于时间段查询）
ALTER TABLE acceptance_records ADD INDEX idx_acceptance_date (acceptance_date);

-- ============================================
-- 11. 不良事件记录表 (adverse_reaction_records) 索引优化
-- ============================================

-- 复合索引：租户+严重程度+状态（用于事件列表）
ALTER TABLE adverse_reaction_records ADD INDEX idx_tenant_severity_status (tenant_id, severity, status);

-- 复合索引：发生日期+状态（用于时间段统计）
ALTER TABLE adverse_reaction_records ADD INDEX idx_date_status (occurrence_date, status);

-- 索引：资产ID（用于资产事件历史）
ALTER TABLE adverse_reaction_records ADD INDEX idx_asset_id (asset_id);

-- ============================================
-- 12. 技术资料表 (technical_documents) 索引优化
-- ============================================

-- 复合索引：租户+分类（用于资料列表）
ALTER TABLE technical_documents ADD INDEX idx_tenant_category (tenant_id, category);

-- 复合索引：租户+资产（用于资产资料查询）
ALTER TABLE technical_documents ADD INDEX idx_tenant_asset (tenant_id, asset_id);

-- 索引：上传时间（用于排序）
ALTER TABLE technical_documents ADD INDEX idx_upload_time (upload_time);

-- ============================================
-- 13. 消息平台集成表 (integration_channels) 索引优化
-- ============================================

-- 复合索引：租户+渠道（用于渠道配置查询）
ALTER TABLE integration_channels ADD INDEX idx_tenant_channel (tenant_id, channel_key);

-- 索引：启用状态（用于获取启用的渠道）
ALTER TABLE integration_channels ADD INDEX idx_enabled (enabled);

-- ============================================
-- 14. 智能预警记录表 (alert_records) 索引优化
-- ============================================

-- 复合索引：租户+状态（用于预警列表）
ALTER TABLE alert_records ADD INDEX idx_tenant_status (tenant_id, status);

-- 复合索引：租户+类型（用于类型统计）
ALTER TABLE alert_records ADD INDEX idx_tenant_type (tenant_id, alert_type);

-- 索引：创建时间（用于排序和清理）
ALTER TABLE alert_records ADD INDEX idx_created_at (created_at);

-- ============================================
-- 15. 设备运行记录表 (asset_operation_logs) 索引优化
-- ============================================

-- 复合索引：资产+日期（用于单资产运行统计）
ALTER TABLE asset_operation_logs ADD INDEX idx_asset_date (asset_id, operation_date);

-- 复合索引：租户+日期（用于租户运行统计）
ALTER TABLE asset_operation_logs ADD INDEX idx_tenant_date (tenant_id, operation_date);

-- 索引：操作日期（用于时间段查询）
ALTER TABLE asset_operation_logs ADD INDEX idx_operation_date (operation_date);

-- ============================================
-- 索引创建完成提示
-- ============================================

SELECT CONCAT('索引优化完成，共创建 ', COUNT(*), ' 个索引') AS message
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
AND INDEX_NAME != 'PRIMARY' 
AND INDEX_SCHEMA = DATABASE();
