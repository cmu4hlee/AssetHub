const db = require('../config/database');

async function migrate() {
  console.log('开始创建 iot_zone_location_ts 时序表...\n');

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS iot_zone_location_ts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL COMMENT '租户ID',
      device_id VARCHAR(100) NOT NULL COMMENT '设备ID',
      asset_code VARCHAR(100) NULL COMMENT '资产编码',
      location_code VARCHAR(100) NULL COMMENT '区域编码',
      area_name VARCHAR(200) NULL COMMENT '区域名称',
      building_name VARCHAR(200) NULL COMMENT '建筑名称',
      floor_number INT NULL COMMENT '楼层',
      rssi INT NULL COMMENT '信号强度',
      accuracy DECIMAL(10, 2) NULL COMMENT '定位精度',
      battery_level INT NULL COMMENT '电量',
      event_time DATETIME NOT NULL COMMENT '事件时间',
      ingest_source VARCHAR(50) NOT NULL DEFAULT 'http' COMMENT '接入来源',
      payload_json LONGTEXT NULL COMMENT '原始数据',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      INDEX idx_zone_ts_tenant_device_time (tenant_id, device_id, event_time),
      INDEX idx_zone_ts_asset_time (asset_code, event_time),
      INDEX idx_zone_ts_location_code_time (location_code, event_time),
      INDEX idx_zone_ts_event_time (event_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='区域定位时序数据表';
  `;

  try {
    await db.execute(createTableSQL);
    console.log('✅ iot_zone_location_ts 表创建成功');
  } catch (error) {
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('ℹ️  iot_zone_location_ts 表已存在');
    } else {
      console.error('❌ 创建 iot_zone_location_ts 表失败:', error.message);
      throw error;
    }
  }

  console.log('\n✅ 迁移完成');
}

migrate().catch(error => {
  console.error('迁移失败:', error);
  process.exit(1);
});
