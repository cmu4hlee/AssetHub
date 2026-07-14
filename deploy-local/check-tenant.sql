SELECT 
  t.id AS tenant_id,
  t.tenant_code,
  t.tenant_name,
  (SELECT COUNT(*) FROM assets WHERE tenant_id=t.id AND asset_code LIKE 'TEST-%') AS assets,
  (SELECT COUNT(*) FROM acceptance_applications WHERE tenant_id=t.id AND application_no LIKE 'TEST-%') AS acc_apps,
  (SELECT COUNT(*) FROM maintenance_requests WHERE tenant_id=t.id AND asset_code LIKE 'TEST-%') AS mnt,
  (SELECT COUNT(*) FROM asset_transfers WHERE tenant_id=t.id AND asset_code LIKE 'TEST-%') AS trf,
  (SELECT COUNT(*) FROM inventory_plans WHERE tenant_id=t.id AND plan_no LIKE 'TEST-%') AS inv_plans,
  (SELECT COUNT(*) FROM inventory_records WHERE tenant_id=t.id AND inventory_no LIKE 'TEST-%') AS inv_records,
  (SELECT COUNT(*) FROM asset_usage_records WHERE tenant_id=t.id AND asset_code LIKE 'TEST-%') AS usage_records
FROM tenants t
WHERE t.id = 1;
