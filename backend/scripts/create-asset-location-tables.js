const db = require('../config/database');

async function createAssetLocationTables() {
  try {
    console.log('开始创建资产定位相关表...');

    // 1. 资产位置表（当前实时位置）
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_locations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT NOT NULL COMMENT '资产ID',
        device_id VARCHAR(100) COMMENT '物联网设备ID（如RFID标签、GPS设备等）',
        device_type ENUM('RFID', 'GPS', '蓝牙', 'WiFi', 'UWB', '其他') COMMENT '设备类型',
        latitude DECIMAL(10, 7) COMMENT '纬度',
        longitude DECIMAL(10, 7) COMMENT '经度',
        altitude DECIMAL(10, 2) COMMENT '海拔高度（米）',
        floor_number INT COMMENT '楼层号',
        building_name VARCHAR(200) COMMENT '建筑物名称',
        room_number VARCHAR(100) COMMENT '房间号',
        area_name VARCHAR(200) COMMENT '区域名称',
        address VARCHAR(500) COMMENT '详细地址',
        location_accuracy DECIMAL(10, 2) COMMENT '定位精度（米）',
        signal_strength INT COMMENT '信号强度',
        battery_level INT COMMENT '设备电量（百分比）',
        last_update_time DATETIME NOT NULL COMMENT '最后更新时间',
        update_source ENUM('设备自动上报', '手动更新', '系统同步') DEFAULT '设备自动上报' COMMENT '更新来源',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否激活（1=激活，0=停用）',
        remark TEXT COMMENT '备注',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL DEFAULT NULL,
        INDEX idx_asset (asset_id),
        INDEX idx_device (device_id),
        INDEX idx_location (latitude, longitude),
        INDEX idx_building (building_name, floor_number),
        INDEX idx_last_update (last_update_time),
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产位置表';
    `);
    console.log('✅ 资产位置表创建成功');

    // 2. 资产位置历史记录表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_location_history (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT NOT NULL COMMENT '资产ID',
        device_id VARCHAR(100) COMMENT '物联网设备ID',
        device_type ENUM('RFID', 'GPS', '蓝牙', 'WiFi', 'UWB', '其他') COMMENT '设备类型',
        latitude DECIMAL(10, 7) COMMENT '纬度',
        longitude DECIMAL(10, 7) COMMENT '经度',
        altitude DECIMAL(10, 2) COMMENT '海拔高度（米）',
        floor_number INT COMMENT '楼层号',
        building_name VARCHAR(200) COMMENT '建筑物名称',
        room_number VARCHAR(100) COMMENT '房间号',
        area_name VARCHAR(200) COMMENT '区域名称',
        address VARCHAR(500) COMMENT '详细地址',
        location_accuracy DECIMAL(10, 2) COMMENT '定位精度（米）',
        signal_strength INT COMMENT '信号强度',
        battery_level INT COMMENT '设备电量（百分比）',
        record_time DATETIME NOT NULL COMMENT '记录时间',
        update_source ENUM('设备自动上报', '手动更新', '系统同步') DEFAULT '设备自动上报' COMMENT '更新来源',
        change_type ENUM('位置移动', '设备上报', '手动更新', '系统同步') DEFAULT '设备上报' COMMENT '变更类型',
        movement_distance DECIMAL(10, 2) COMMENT '移动距离（米，相对于上次位置）',
        movement_speed DECIMAL(10, 2) COMMENT '移动速度（米/秒）',
        remark TEXT COMMENT '备注',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_asset (asset_id),
        INDEX idx_device (device_id),
        INDEX idx_record_time (record_time),
        INDEX idx_location (latitude, longitude),
        INDEX idx_building (building_name, floor_number),
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产位置历史记录表';
    `);
    console.log('✅ 资产位置历史记录表创建成功');

    // 3. 物联网设备表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS iot_devices (
        id INT PRIMARY KEY AUTO_INCREMENT,
        device_id VARCHAR(100) UNIQUE NOT NULL COMMENT '设备唯一标识',
        device_name VARCHAR(200) COMMENT '设备名称',
        device_type ENUM('RFID', 'GPS', '蓝牙', 'WiFi', 'UWB', '其他') NOT NULL COMMENT '设备类型',
        manufacturer VARCHAR(100) COMMENT '制造商',
        model VARCHAR(100) COMMENT '型号',
        serial_number VARCHAR(100) COMMENT '序列号',
        mac_address VARCHAR(50) COMMENT 'MAC地址',
        firmware_version VARCHAR(50) COMMENT '固件版本',
        install_date DATE COMMENT '安装日期',
        install_location VARCHAR(200) COMMENT '安装位置',
        battery_type VARCHAR(50) COMMENT '电池类型',
        battery_capacity INT COMMENT '电池容量（mAh）',
        update_interval INT COMMENT '上报间隔（秒）',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否激活',
        last_online_time DATETIME COMMENT '最后在线时间',
        status ENUM('在线', '离线', '故障', '维护中') DEFAULT '离线' COMMENT '设备状态',
        remark TEXT COMMENT '备注',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL DEFAULT NULL,
        INDEX idx_device_id (device_id),
        INDEX idx_type (device_type),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物联网设备表';
    `);
    console.log('✅ 物联网设备表创建成功');

    // 4. 资产设备关联表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_device_mapping (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT NOT NULL COMMENT '资产ID',
        device_id VARCHAR(100) NOT NULL COMMENT '设备ID',
        bind_date DATETIME NOT NULL COMMENT '绑定日期',
        unbind_date DATETIME COMMENT '解绑日期',
        bind_person VARCHAR(50) COMMENT '绑定操作人',
        unbind_person VARCHAR(50) COMMENT '解绑操作人',
        bind_reason TEXT COMMENT '绑定原因',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否激活',
        remark TEXT COMMENT '备注',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL DEFAULT NULL,
        INDEX idx_asset (asset_id),
        INDEX idx_device (device_id),
        INDEX idx_active (is_active),
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产设备关联表';
    `);
    console.log('✅ 资产设备关联表创建成功');

    // 5. 位置告警规则表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS location_alert_rules (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT COMMENT '资产ID（NULL表示全局规则）',
        rule_name VARCHAR(200) NOT NULL COMMENT '规则名称',
        rule_type ENUM('越界告警', '静止告警', '移动告警', '离线告警', '低电量告警') NOT NULL COMMENT '规则类型',
        geofence_type ENUM('圆形', '多边形', '建筑物') COMMENT '地理围栏类型',
        geofence_data TEXT COMMENT '地理围栏数据（JSON格式）',
        alert_condition TEXT COMMENT '告警条件（JSON格式）',
        alert_level ENUM('低', '中', '高', '紧急') DEFAULT '中' COMMENT '告警级别',
        is_enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        notify_users TEXT COMMENT '通知用户列表（JSON数组）',
        notify_channels TEXT COMMENT '通知渠道（JSON数组：短信、邮件、系统消息等）',
        remark TEXT COMMENT '备注',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL DEFAULT NULL,
        INDEX idx_asset (asset_id),
        INDEX idx_type (rule_type),
        INDEX idx_enabled (is_enabled),
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='位置告警规则表';
    `);
    console.log('✅ 位置告警规则表创建成功');

    // 6. 位置告警记录表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS location_alerts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT NOT NULL COMMENT '资产ID',
        rule_id INT COMMENT '告警规则ID',
        alert_type ENUM('越界告警', '静止告警', '移动告警', '离线告警', '低电量告警') NOT NULL COMMENT '告警类型',
        alert_level ENUM('低', '中', '高', '紧急') DEFAULT '中' COMMENT '告警级别',
        alert_content TEXT COMMENT '告警内容',
        current_location TEXT COMMENT '当前位置信息（JSON格式）',
        trigger_time DATETIME NOT NULL COMMENT '触发时间',
        is_handled TINYINT(1) DEFAULT 0 COMMENT '是否已处理',
        handle_time DATETIME COMMENT '处理时间',
        handle_person VARCHAR(50) COMMENT '处理人',
        handle_result TEXT COMMENT '处理结果',
        remark TEXT COMMENT '备注',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_asset (asset_id),
        INDEX idx_rule (rule_id),
        INDEX idx_type (alert_type),
        INDEX idx_handled (is_handled),
        INDEX idx_trigger_time (trigger_time),
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
        FOREIGN KEY (rule_id) REFERENCES location_alert_rules(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='位置告警记录表';
    `);
    console.log('✅ 位置告警记录表创建成功');

    console.log('✅ 所有资产定位相关表创建完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 创建表失败:', error);
    process.exit(1);
  }
}

createAssetLocationTables();
