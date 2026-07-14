-- AssetHub 性能优化索引脚本
-- 创建日期: 2026-05-14
-- 说明: 为常见查询添加索引，提升查询性能
-- 注意: MySQL 8.0.29+ 才支持 CREATE INDEX IF NOT EXISTS

-- ============================================
-- 资产表索引优化
-- ============================================

-- 资产列表查询（按租户、状态）
CREATE INDEX idx_assets_tenant_status ON assets(tenant_id, status, is_deleted);

-- 资产列表查询（按租户、部门）
CREATE INDEX idx_assets_tenant_department ON assets(tenant_id, department_new, is_deleted);

-- 资产列表查询（按租户、类别）
CREATE INDEX idx_assets_tenant_category ON assets(tenant_id, category_id, is_deleted);

-- 资产编码精确查询
CREATE INDEX idx_assets_tenant_code ON assets(tenant_id, asset_code);

-- 资产名称模糊查询（只索引前100字符）
CREATE INDEX idx_assets_tenant_name ON assets(tenant_id, asset_name(100));

-- 资产变更历史查询
CREATE INDEX idx_asset_change_logs_code_tenant_time ON asset_change_logs(asset_code, tenant_id, changed_at);

-- 资产图片查询
CREATE INDEX idx_asset_images_code_tenant ON asset_images(asset_code, tenant_id, id);

-- ============================================
-- 用户表索引优化
-- ============================================

-- 用户管理科室查询
CREATE INDEX idx_user_managed_departments_user_tenant ON user_managed_departments(user_id, tenant_id);

-- 用户租户角色查询
CREATE INDEX idx_user_tenant_roles_user_tenant ON user_tenant_roles(user_id, tenant_id);

-- 用户名查询（登录用）
CREATE INDEX idx_users_username ON users(username);

-- ============================================
-- 维保日志表索引优化
-- ============================================

-- 维保日志查询（按资产编码）
CREATE INDEX idx_maintenance_logs_tenant_code ON maintenance_logs(tenant_id, asset_code);

-- 维保日志查询（按日期）
CREATE INDEX idx_maintenance_logs_tenant_date ON maintenance_logs(tenant_id, maintenance_date);

-- 维保日志查询（按类型和状态）
CREATE INDEX idx_maintenance_logs_type_status ON maintenance_logs(tenant_id, maintenance_type, status);

-- ============================================
-- 盘点表索引优化
-- ============================================

-- 盘点任务查询
CREATE INDEX idx_inventory_tasks_tenant_plan ON inventory_tasks(tenant_id, plan_id);

-- 盘点记录查询
CREATE INDEX idx_inventory_scan_logs_tenant_task ON inventory_scan_logs(tenant_id, task_id, scan_time);

-- ============================================
-- 位置管理表索引优化
-- ============================================

-- 资产位置历史
CREATE INDEX idx_asset_location_history_code_tenant_time ON asset_location_history(asset_code, tenant_id, record_time);

-- IoT设备状态查询
CREATE INDEX idx_iot_device_status ON iot_devices(tenant_id, status, last_heartbeat);

-- ============================================
-- AI 相关表索引优化
-- ============================================

-- AI对话历史查询
CREATE INDEX idx_ai_conversations_tenant_user ON ai_conversations(tenant_id, user_id, created_at);

-- AI消息查询
CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);

-- ============================================
-- 审计日志表索引优化
-- ============================================

-- 审计日志查询（按时间和用户）
CREATE INDEX idx_audit_logs_time_user ON audit_logs(tenant_id, created_at, user_id);

-- 审计日志查询（按操作类型）
CREATE INDEX idx_audit_logs_action ON audit_logs(tenant_id, action, created_at);

-- ============================================
-- 索引维护建议
-- ============================================

-- 定期执行 ANALYZE TABLE 以更新统计信息
-- ANALYZE TABLE assets;
-- ANALYZE TABLE maintenance_logs;
-- ANALYZE TABLE audit_logs;

-- 监控慢查询
-- SET GLOBAL slow_query_log = 'ON';
-- SET GLOBAL long_query_time = 2;
