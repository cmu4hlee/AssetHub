const db = require('../config/database');

async function migrate() {
  console.log('开始创建 iot_environment_monitor_ts 时序表...\n');

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS iot_environment_monitor_ts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL COMMENT '租户ID',
      device_id VARCHAR(100) NOT NULL COMMENT '设备ID',
      asset_code VARCHAR(100) NULL COMMENT '资产编码',
      temperature DECIMAL(10, 2) NULL COMMENT '温度',
      humidity DECIMAL(10, 2) NULL COMMENT '湿度',
      pressure DECIMAL(12, 2) NULL COMMENT '气压',
      co2 DECIMAL(10, 2) NULL COMMENT '二氧化碳浓度',
      pm25 DECIMAL(10, 2) NULL COMMENT 'PM2.5',
      voc DECIMAL(10, 2) NULL COMMENT '挥发性有机物',
      battery_level INT NULL COMMENT '电量',
      event_time DATETIME NOT NULL COMMENT '事件时间',
      ingest_source VARCHAR(50) NOT NULL DEFAULT 'http' COMMENT '接入来源',
      payload_json LONGTEXT NULL COMMENT '原始数据',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      INDEX idx_env_ts_tenant_device_time (tenant_id, device_id, event_time),
      INDEX idx_env_ts_asset_time (asset_code, event_time),
      INDEX idx_env_ts_event_time (event_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='环境监测时序数据表';
  `;

  try {
    await db.execute(createTableSQL);
    console.log('✅ iot_environment_monitor_ts 表创建成功');
  } catch (error) {
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('ℹ️  iot_environment_monitor_ts 表已存在');
    } else {
      console.error('❌ 创建 iot_environment_monitor_ts 表失败:', error.message);
      throw error;
    }
  }

  console.log('\n✅ 迁移完成');
}

migrate().catch(error => {
  console.error('迁移失败:', error);
  process.exit(1);
});
