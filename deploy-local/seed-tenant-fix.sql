-- ============================================================
-- 修正所有 TEST- 测试数据的 tenant_id = 1
-- ============================================================
SET NAMES utf8mb4;

UPDATE assets SET tenant_id = 1 WHERE asset_code LIKE 'TEST-%' AND tenant_id IS NULL;
UPDATE acceptance_applications SET tenant_id = 1 WHERE application_no LIKE 'TEST-%' AND (tenant_id IS NULL OR tenant_id = 0);
UPDATE acceptance_application_assets SET tenant_id = 1 WHERE asset_code LIKE 'TEST-%' AND (tenant_id IS NULL OR tenant_id = 0);
UPDATE asset_acceptance_records SET tenant_id = 1 WHERE asset_code LIKE 'TEST-%' AND (tenant_id IS NULL OR tenant_id = 0);
UPDATE maintenance_requests SET tenant_id = 1 WHERE asset_code LIKE 'TEST-%' AND (tenant_id IS NULL OR tenant_id = 0);
UPDATE asset_transfers SET tenant_id = 1 WHERE asset_code LIKE 'TEST-%' AND (tenant_id IS NULL OR tenant_id = 0);
UPDATE inventory_plans SET tenant_id = 1 WHERE plan_no LIKE 'TEST-%' AND (tenant_id IS NULL OR tenant_id = 0);
UPDATE inventory_plan_details SET tenant_id = 1 WHERE plan_id IN (SELECT id FROM inventory_plans WHERE plan_no LIKE 'TEST-%') AND (tenant_id IS NULL OR tenant_id = 0);
UPDATE inventory_records SET tenant_id = 1 WHERE inventory_no LIKE 'TEST-%' AND (tenant_id IS NULL OR tenant_id = 0);
UPDATE inventory_tasks SET tenant_id = 1 WHERE created_by = 'admin' AND inventory_id IN (SELECT id FROM inventory_records WHERE inventory_no LIKE 'TEST-%') AND (tenant_id IS NULL OR tenant_id = 0);
UPDATE inventory_details SET tenant_id = 1 WHERE asset_code LIKE 'TEST-%' AND (tenant_id IS NULL OR tenant_id = 0);
UPDATE asset_usage_records SET tenant_id = 1 WHERE asset_code LIKE 'TEST-%' AND (tenant_id IS NULL OR tenant_id = 0);

-- 验证
SELECT 'assets' AS tbl, COUNT(*) AS cnt, COUNT(tenant_id) AS with_tenant FROM assets WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'acceptance_applications', COUNT(*), COUNT(tenant_id) FROM acceptance_applications WHERE application_no LIKE 'TEST-%'
UNION ALL SELECT 'acceptance_application_assets', COUNT(*), COUNT(tenant_id) FROM acceptance_application_assets WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'asset_acceptance_records', COUNT(*), COUNT(tenant_id) FROM asset_acceptance_records WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'maintenance_requests', COUNT(*), COUNT(tenant_id) FROM maintenance_requests WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'asset_transfers', COUNT(*), COUNT(tenant_id) FROM asset_transfers WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'inventory_plans', COUNT(*), COUNT(tenant_id) FROM inventory_plans WHERE plan_no LIKE 'TEST-%'
UNION ALL SELECT 'inventory_records', COUNT(*), COUNT(tenant_id) FROM inventory_records WHERE inventory_no LIKE 'TEST-%'
UNION ALL SELECT 'inventory_details', COUNT(*), COUNT(tenant_id) FROM inventory_details WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'asset_usage_records', COUNT(*), COUNT(tenant_id) FROM asset_usage_records WHERE asset_code LIKE 'TEST-%';
