-- 简化的 system_modules 表（用于演示）
-- 移除外键依赖

CREATE TABLE IF NOT EXISTS `system_modules` (
  `id` VARCHAR(50) PRIMARY KEY COMMENT '模块ID',
  `name` VARCHAR(100) NOT NULL COMMENT '模块名称',
  `version` VARCHAR(20) NOT NULL COMMENT '模块版本',
  `description` TEXT COMMENT '模块描述',
  `category` VARCHAR(50) NOT NULL COMMENT '模块分类',
  `type` VARCHAR(20) NOT NULL COMMENT '模块类型',
  `status` VARCHAR(20) NOT NULL DEFAULT 'stable' COMMENT '模块状态',
  `author` VARCHAR(100) COMMENT '作者',
  `dependencies` TEXT COMMENT '依赖关系',
  `compatibility` TEXT COMMENT '兼容性规则',
  `frontend_config` TEXT COMMENT '前端配置',
  `backend_config` TEXT COMMENT '后端配置',
  `config_schema` TEXT COMMENT '配置项定义',
  `default_config` TEXT COMMENT '默认配置',
  `interfaces` TEXT COMMENT '接口定义',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  INDEX `idx_category` (`category`),
  INDEX `idx_status` (`status`),
  INDEX `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统模块元数据表';

CREATE TABLE IF NOT EXISTS `tenant_module_configs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  `module_id` VARCHAR(50) NOT NULL COMMENT '模块ID',
  `enabled` TINYINT(1) DEFAULT 0 COMMENT '是否启用',
  `config` TEXT COMMENT '模块配置',
  `version` VARCHAR(20) COMMENT '配置版本',
  `enabled_at` TIMESTAMP NULL COMMENT '启用时间',
  `disabled_at` TIMESTAMP NULL COMMENT '禁用时间',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY `uk_tenant_module` (`tenant_id`, `module_id`),
  INDEX `idx_tenant_id` (`tenant_id`),
  INDEX `idx_module_id` (`module_id`),
  INDEX `idx_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户模块配置表';
