-- =====================================================
-- 租户模块配置表
-- 支持模块级别的启用/禁用和自定义配置
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_module_configs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  module_id VARCHAR(100) NOT NULL COMMENT '模块ID',
  config JSON COMMENT '模块配置JSON',
  enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_module (tenant_id, module_id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_module (module_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户模块配置表';

-- =====================================================
-- 租户模块功能开关表
-- 支持模块内功能的细粒度控制
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_module_features (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  module_id VARCHAR(100) NOT NULL COMMENT '模块ID',
  feature_id VARCHAR(100) NOT NULL COMMENT '功能ID',
  enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  config JSON COMMENT '功能配置JSON',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_module_feature (tenant_id, module_id, feature_id),
  INDEX idx_tenant_module (tenant_id, module_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户模块功能开关表';

SELECT '租户模块配置表创建完成' AS message;
