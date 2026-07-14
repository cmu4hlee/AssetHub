const db = require('../config/database');

async function migrate() {
  console.log('开始迁移物联网表结构...');

  try {
    console.log('检查并更新 asset_locations 表...');

    const [columns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_locations'
    `);
    const columnNames = columns.map(c => c.COLUMN_NAME);

    if (!columnNames.includes('tenant_id')) {
      await db.execute(`
        ALTER TABLE asset_locations 
        ADD COLUMN tenant_id INT NULL COMMENT '租户ID' AFTER id,
        ADD INDEX idx_tenant (tenant_id)
      `);
      console.log('✅ 添加 tenant_id 字段到 asset_locations');
    }

    if (!columnNames.includes('asset_code')) {
      await db.execute(`
        ALTER TABLE asset_locations 
        ADD COLUMN asset_code VARCHAR(100) NULL COMMENT '资产编号' AFTER tenant_id,
        ADD INDEX idx_asset_code (asset_code)
      `);
      console.log('✅ 添加 asset_code 字段到 asset_locations');
    }

    console.log('检查并更新 asset_location_history 表...');
    const [historyColumns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_location_history'
    `);
    const historyColumnNames = historyColumns.map(c => c.COLUMN_NAME);

    if (!historyColumnNames.includes('tenant_id')) {
      await db.execute(`
        ALTER TABLE asset_location_history 
        ADD COLUMN tenant_id INT NULL COMMENT '租户ID' AFTER id,
        ADD INDEX idx_tenant (tenant_id)
      `);
      console.log('✅ 添加 tenant_id 字段到 asset_location_history');
    }

    if (!historyColumnNames.includes('asset_code')) {
      await db.execute(`
        ALTER TABLE asset_location_history 
        ADD COLUMN asset_code VARCHAR(100) NULL COMMENT '资产编号' AFTER tenant_id,
        ADD INDEX idx_asset_code (asset_code)
      `);
      console.log('✅ 添加 asset_code 字段到 asset_location_history');
    }

    console.log('检查并更新 iot_devices 表...');
    const [deviceColumns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'iot_devices'
    `);
    const deviceColumnNames = deviceColumns.map(c => c.COLUMN_NAME);

    if (!deviceColumnNames.includes('tenant_id')) {
      await db.execute(`
        ALTER TABLE iot_devices 
        ADD COLUMN tenant_id INT NULL COMMENT '租户ID' AFTER id,
        ADD INDEX idx_tenant (tenant_id)
      `);
      console.log('✅ 添加 tenant_id 字段到 iot_devices');
    }

    console.log('检查并更新 asset_device_mapping 表...');
    const [mappingColumns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_device_mapping'
    `);
    const mappingColumnNames = mappingColumns.map(c => c.COLUMN_NAME);

    if (!mappingColumnNames.includes('tenant_id')) {
      await db.execute(`
        ALTER TABLE asset_device_mapping 
        ADD COLUMN tenant_id INT NULL COMMENT '租户ID' AFTER id,
        ADD INDEX idx_tenant (tenant_id)
      `);
      console.log('✅ 添加 tenant_id 字段到 asset_device_mapping');
    }

    if (!mappingColumnNames.includes('asset_code')) {
      await db.execute(`
        ALTER TABLE asset_device_mapping 
        ADD COLUMN asset_code VARCHAR(100) NULL COMMENT '资产编号' AFTER tenant_id,
        ADD INDEX idx_asset_code (asset_code)
      `);
      console.log('✅ 添加 asset_code 字段到 asset_device_mapping');
    }

    console.log('检查并更新 location_alerts 表...');
    const [alertColumns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'location_alerts'
    `);
    const alertColumnNames = alertColumns.map(c => c.COLUMN_NAME);

    if (!alertColumnNames.includes('tenant_id')) {
      await db.execute(`
        ALTER TABLE location_alerts 
        ADD COLUMN tenant_id INT NULL COMMENT '租户ID' AFTER id,
        ADD INDEX idx_tenant (tenant_id)
      `);
      console.log('✅ 添加 tenant_id 字段到 location_alerts');
    }

    if (!alertColumnNames.includes('asset_code')) {
      await db.execute(`
        ALTER TABLE location_alerts 
        ADD COLUMN asset_code VARCHAR(100) NULL COMMENT '资产编号' AFTER tenant_id,
        ADD INDEX idx_asset_code (asset_code)
      `);
      console.log('✅ 添加 asset_code 字段到 location_alerts');
    }

    console.log('检查并更新 location_alert_rules 表...');
    const [ruleColumns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'location_alert_rules'
    `);
    const ruleColumnNames = ruleColumns.map(c => c.COLUMN_NAME);

    if (!ruleColumnNames.includes('tenant_id')) {
      await db.execute(`
        ALTER TABLE location_alert_rules 
        ADD COLUMN tenant_id INT NULL COMMENT '租户ID' AFTER id,
        ADD INDEX idx_tenant (tenant_id)
      `);
      console.log('✅ 添加 tenant_id 字段到 location_alert_rules');
    }

    if (!ruleColumnNames.includes('asset_code')) {
      await db.execute(`
        ALTER TABLE location_alert_rules 
        ADD COLUMN asset_code VARCHAR(100) NULL COMMENT '资产编号' AFTER tenant_id
      `);
      console.log('✅ 添加 asset_code 字段到 location_alert_rules');
    }

    console.log('✅ 物联网表结构迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  }
}

migrate();
