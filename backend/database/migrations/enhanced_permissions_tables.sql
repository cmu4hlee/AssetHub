-- 增强权限管理系统数据库表
-- 创建时间: 2026-07-13

-- 角色数据权限范围表
CREATE TABLE IF NOT EXISTS role_data_scopes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role VARCHAR(50) NOT NULL COMMENT '角色代码',
  tenant_id INT NOT NULL COMMENT '租户ID',
  data_scope VARCHAR(20) NOT NULL DEFAULT 'department' COMMENT '数据权限范围: all-全部, department-本部门, custom-自定义, own-仅本人',
  custom_departments JSON COMMENT '自定义部门列表',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_tenant (role, tenant_id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色数据权限范围表';

-- 用户数据权限范围表（可覆盖角色权限）
CREATE TABLE IF NOT EXISTS user_data_scopes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  tenant_id INT NOT NULL COMMENT '租户ID',
  data_scope VARCHAR(20) NOT NULL DEFAULT 'department' COMMENT '数据权限范围',
  custom_departments JSON COMMENT '自定义部门列表',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_tenant (user_id, tenant_id),
  INDEX idx_user (user_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户数据权限范围表';

-- 用户个人权限表（可额外添加或拒绝权限）
CREATE TABLE IF NOT EXISTS user_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  tenant_id INT NOT NULL COMMENT '租户ID',
  permission VARCHAR(100) NOT NULL COMMENT '权限代码',
  is_allowed TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否允许: 1-允许, 0-拒绝',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_permission (user_id, tenant_id, permission),
  INDEX idx_user (user_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户个人权限表';

-- 用户菜单权限表（可覆盖角色菜单权限）
CREATE TABLE IF NOT EXISTS user_menu_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  tenant_id INT NOT NULL COMMENT '租户ID',
  menu_key VARCHAR(50) NOT NULL COMMENT '菜单键',
  is_visible TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否可见: 1-可见, 0-不可见',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_menu (user_id, tenant_id, menu_key),
  INDEX idx_user (user_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户菜单权限表';

-- 权限审计日志表
CREATE TABLE IF NOT EXISTS permission_audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  user_id INT NOT NULL COMMENT '操作用户ID',
  username VARCHAR(50) COMMENT '操作用户名',
  action VARCHAR(50) NOT NULL COMMENT '操作类型: permission_added, permission_removed, permission_denied, data_scope_changed, menu_changed',
  target_type VARCHAR(20) NOT NULL COMMENT '目标类型: role, user',
  target_name VARCHAR(100) COMMENT '目标名称',
  permission VARCHAR(100) COMMENT '权限代码',
  old_value TEXT COMMENT '旧值',
  new_value TEXT COMMENT '新值',
  ip_address VARCHAR(45) COMMENT 'IP地址',
  user_agent VARCHAR(255) COMMENT '用户代理',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限审计日志表';

-- 角色菜单权限表（扩展）
CREATE TABLE IF NOT EXISTS role_menu_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role VARCHAR(50) NOT NULL COMMENT '角色代码',
  tenant_id INT NOT NULL COMMENT '租户ID',
  menu_permissions JSON COMMENT '菜单权限JSON',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_tenant (role, tenant_id),
  INDEX idx_role (role),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单权限表';

-- 用户租户角色多对多关系表（增强版）
ALTER TABLE user_tenant_roles
  ADD COLUMN IF NOT EXISTS is_default TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否为默认角色',
  ADD COLUMN IF NOT EXISTS managed_departments JSON COMMENT '管理的科室列表',
  ADD COLUMN IF NOT EXISTS position VARCHAR(50) COMMENT '职位';

-- 为现有管理员角色添加默认数据范围
INSERT INTO role_data_scopes (role, tenant_id, data_scope, created_at)
SELECT DISTINCT role, tenant_id, 'department', NOW()
FROM user_tenant_roles utr
WHERE status = 'active'
AND NOT EXISTS (
  SELECT 1 FROM role_data_scopes rds
  WHERE rds.role = utr.role AND rds.tenant_id = utr.tenant_id
)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 为超级管理员和系统管理员设置全部数据范围
INSERT INTO role_data_scopes (role, tenant_id, data_scope, created_at)
SELECT DISTINCT role, tenant_id, 'all', NOW()
FROM user_tenant_roles utr
WHERE status = 'active'
AND role IN ('super_admin', 'system_admin')
AND NOT EXISTS (
  SELECT 1 FROM role_data_scopes rds
  WHERE rds.role = utr.role AND rds.tenant_id = utr.tenant_id
)
ON DUPLICATE KEY UPDATE updated_at = NOW();
