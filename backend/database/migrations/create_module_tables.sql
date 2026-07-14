-- 创建系统模块元数据表
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
  `updated_at` TIMESTAMP NOT NULL DEFAULT '0000-00-00 00:00:00',
  INDEX `idx_category` (`category`),
  INDEX `idx_status` (`status`),
  INDEX `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统模块元数据表';

-- 创建租户模块配置表
CREATE TABLE IF NOT EXISTS `tenant_module_configs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT NOT NULL COMMENT '租户ID',
  `module_id` VARCHAR(50) NOT NULL COMMENT '模块ID',
  `enabled` TINYINT(1) DEFAULT 0 COMMENT '是否启用',
  `config` TEXT COMMENT '模块配置',
  `version` VARCHAR(20) COMMENT '配置版本',
  `enabled_at` TIMESTAMP NULL COMMENT '启用时间',
  `disabled_at` TIMESTAMP NULL COMMENT '禁用时间',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT '0000-00-00 00:00:00',
  UNIQUE KEY `uk_tenant_module` (`tenant_id`, `module_id`),
  INDEX `idx_tenant_id` (`tenant_id`),
  INDEX `idx_module_id` (`module_id`),
  INDEX `idx_enabled` (`enabled`),
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`module_id`) REFERENCES `system_modules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户模块配置表';

-- 创建租户模块配置变更日志表
CREATE TABLE IF NOT EXISTS `tenant_module_config_logs` (
  `id` VARCHAR(64) PRIMARY KEY COMMENT '日志ID',
  `tenant_id` INT NOT NULL COMMENT '租户ID',
  `tenant_name` VARCHAR(255) COMMENT '租户名称快照',
  `module_id` VARCHAR(50) NOT NULL COMMENT '模块ID',
  `module_name` VARCHAR(255) COMMENT '模块名称快照',
  `action` VARCHAR(20) NOT NULL COMMENT '操作类型',
  `old_value` LONGTEXT COMMENT '旧值(JSON)',
  `new_value` LONGTEXT COMMENT '新值(JSON)',
  `operator_id` VARCHAR(64) COMMENT '操作人ID',
  `operator_name` VARCHAR(100) COMMENT '操作人名称',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_tmcl_tenant_id` (`tenant_id`),
  INDEX `idx_tmcl_module_id` (`module_id`),
  INDEX `idx_tmcl_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户模块配置变更日志表';

-- 创建配置版本表
CREATE TABLE IF NOT EXISTS `module_config_versions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT NOT NULL COMMENT '租户ID',
  `module_id` VARCHAR(50) NOT NULL COMMENT '模块ID',
  `version` VARCHAR(20) NOT NULL COMMENT '版本号',
  `config` TEXT NOT NULL COMMENT '配置内容',
  `change_log` TEXT COMMENT '变更日志',
  `created_by` VARCHAR(100) COMMENT '创建人',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_current` TINYINT(1) DEFAULT 0 COMMENT '是否当前版本',
  INDEX `idx_tenant_module` (`tenant_id`, `module_id`),
  INDEX `idx_version` (`version`),
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`module_id`) REFERENCES `system_modules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模块配置版本表';

-- 创建模块依赖关系表
CREATE TABLE IF NOT EXISTS `module_dependencies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `module_id` VARCHAR(50) NOT NULL COMMENT '模块ID',
  `dependency_module_id` VARCHAR(50) NOT NULL COMMENT '依赖模块ID',
  `dependency_type` VARCHAR(20) NOT NULL COMMENT '依赖类型',
  `min_version` VARCHAR(20) COMMENT '最低版本',
  `max_version` VARCHAR(20) COMMENT '最高版本',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_module_dependency` (`module_id`, `dependency_module_id`),
  INDEX `idx_module_id` (`module_id`),
  INDEX `idx_dependency_module_id` (`dependency_module_id`),
  FOREIGN KEY (`module_id`) REFERENCES `system_modules`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`dependency_module_id`) REFERENCES `system_modules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模块依赖关系表';

-- 创建系统模块菜单映射表
CREATE TABLE IF NOT EXISTS `system_module_menus` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `module_id` VARCHAR(50) NOT NULL COMMENT '模块ID',
  `menu_key` VARCHAR(100) NOT NULL COMMENT '菜单键',
  `is_enabled` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT NULL,
  UNIQUE KEY `uk_module_menu` (`module_id`, `menu_key`),
  INDEX `idx_module_id` (`module_id`),
  INDEX `idx_menu_key` (`menu_key`),
  FOREIGN KEY (`module_id`) REFERENCES `system_modules`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`menu_key`) REFERENCES `menu_definitions`(`menu_key`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统模块菜单映射表';

-- 创建模块运行状态表
CREATE TABLE IF NOT EXISTS `module_runtime_status` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `module_id` VARCHAR(50) NOT NULL COMMENT '模块ID',
  `tenant_id` INT COMMENT '租户ID',
  `status` VARCHAR(20) NOT NULL COMMENT '运行状态',
  `health_status` VARCHAR(20) COMMENT '健康状态',
  `last_heartbeat` TIMESTAMP NULL COMMENT '最后心跳时间',
  `error_message` TEXT COMMENT '错误信息',
  `metrics` TEXT COMMENT '运行指标',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT '0000-00-00 00:00:00',
  UNIQUE KEY `uk_module_tenant` (`module_id`, `tenant_id`),
  INDEX `idx_module_id` (`module_id`),
  INDEX `idx_tenant_id` (`tenant_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_health_status` (`health_status`),
  FOREIGN KEY (`module_id`) REFERENCES `system_modules`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模块运行状态表';

-- 创建模块操作日志表
CREATE TABLE IF NOT EXISTS `module_operation_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `module_id` VARCHAR(50) NOT NULL COMMENT '模块ID',
  `tenant_id` INT COMMENT '租户ID',
  `operation` VARCHAR(50) NOT NULL COMMENT '操作类型',
  `operator` VARCHAR(100) COMMENT '操作人',
  `operation_data` TEXT COMMENT '操作数据',
  `result` VARCHAR(20) COMMENT '操作结果',
  `error_message` TEXT COMMENT '错误信息',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_module_id` (`module_id`),
  INDEX `idx_tenant_id` (`tenant_id`),
  INDEX `idx_operation` (`operation`),
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`module_id`) REFERENCES `system_modules`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模块操作日志表';
