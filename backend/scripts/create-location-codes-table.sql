-- 创建位置编码表
CREATE TABLE IF NOT EXISTS location_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  location_code VARCHAR(100) UNIQUE NOT NULL COMMENT '位置编号',
  location_name VARCHAR(200) NOT NULL COMMENT '位置名称',
  description TEXT COMMENT '位置描述',
  building_name VARCHAR(200) COMMENT '建筑物名称',
  floor_number INT COMMENT '楼层号',
  room_number VARCHAR(100) COMMENT '房间号',
  area_name VARCHAR(200) COMMENT '区域名称',
  latitude DECIMAL(10, 7) COMMENT '纬度',
  longitude DECIMAL(10, 7) COMMENT '经度',
  is_active TINYINT(1) DEFAULT 1 COMMENT '是否激活',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL,
  INDEX idx_location_code (location_code),
  INDEX idx_location_name (location_name),
  INDEX idx_building (building_name, floor_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='位置编码表';
