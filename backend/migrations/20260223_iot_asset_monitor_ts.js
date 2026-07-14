const db = require('../config/database');

async function migrate() {
  console.log('开始创建 iot_asset_monitor_ts 时序表...\\n');

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS iot_asset_monitor_ts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL COMMENT '租户ID',
      device_id VARCHAR(100) NOT NULL COMMENT '设备ID',
      asset_code VARCHAR(100) NULL COMMENT '资产编码',
      runtime_state VARCHAR(64) NULL COMMENT '运行状态',
      signal_strength INT NULL COMMENT '信号强度',
      battery_level INT NULL COMMENT '电量',
      cpu_usage DECIMAL(10, 2) NULL COMMENT 'CPU占用',
      memory_usage DECIMAL(10, 2) NULL COMMENT '内存占用',
      error_code VARCHAR(100) NULL COMMENT '错误码',
      event_time DATETIME NOT NULL COMMENT '事件时间',
      ingest_source VARCHAR(50) NOT NULL DEFAULT 'http' COMMENT '接入来源',
      payload_json LONGTEXT NULL COMMENT '原始数据',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      INDEX idx_asset_mon_tenant_device_time (tenant_id, device_id, event_time),
      INDEX idx_asset_mon_asset_time (asset_code, event_time),
      INDEX idx_asset_mon_event_time (event_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资产监测时序数据表';
  `;

  await db.execute(createTableSQL);
  console.log('✅ iot_asset_monitor_ts 表创建成功');
  console.log('\\n✅ 迁移完成');
}

migrate().catch(error => {
  console.error('迁移失败:', error);
  process.exit(1);
});
