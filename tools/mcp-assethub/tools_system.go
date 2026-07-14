package main

// Tool definition helpers for System Management tools (User, Role, Permission, Module)

func userManagementToolDefinition(name string) Tool {
	switch name {
	case "create_user":
		return Tool{
			Name:        "create_user",
			Description: "创建用户账号",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"username":        map[string]interface{}{"type": "string", "description": "用户名"},
					"real_name":       map[string]interface{}{"type": "string", "description": "真实姓名"},
					"password":        map[string]interface{}{"type": "string", "description": "密码"},
					"role":            map[string]interface{}{"type": "string", "description": "角色"},
					"email":           map[string]interface{}{"type": "string", "description": "邮箱"},
					"phone":           map[string]interface{}{"type": "string", "description": "电话"},
					"department_code": map[string]interface{}{"type": "string", "description": "部门代码"},
					"status":          map[string]interface{}{"type": "string", "description": "状态"},
				},
				"required": []string{"username", "real_name", "password", "role"},
			},
		}
	case "update_user":
		return Tool{
			Name:        "update_user",
			Description: "更新用户信息",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":              map[string]interface{}{"type": "integer", "description": "用户ID"},
					"real_name":       map[string]interface{}{"type": "string", "description": "真实姓名"},
					"email":           map[string]interface{}{"type": "string", "description": "邮箱"},
					"phone":           map[string]interface{}{"type": "string", "description": "电话"},
					"department_code": map[string]interface{}{"type": "string", "description": "部门代码"},
					"status":          map[string]interface{}{"type": "string", "description": "状态"},
				},
				"required": []string{"id"},
			},
		}
	case "reset_user_password":
		return Tool{
			Name:        "reset_user_password",
			Description: "重置用户密码",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":           map[string]interface{}{"type": "integer", "description": "用户ID"},
					"old_password": map[string]interface{}{"type": "string", "description": "旧密码。管理员重置时可不传。"},
					"new_password": map[string]interface{}{"type": "string", "description": "新密码"},
				},
				"required": []string{"id", "new_password"},
			},
		}
	case "assign_user_role":
		return Tool{
			Name:        "assign_user_role",
			Description: "分配用户角色",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"user_id":    map[string]interface{}{"type": "integer", "description": "用户ID"},
					"tenant_id":  map[string]interface{}{"type": "integer", "description": "租户ID，不传时默认使用当前 MCP 客户端租户"},
					"role":       map[string]interface{}{"type": "string", "description": "角色名称"},
					"is_default": map[string]interface{}{"type": "boolean", "description": "是否设为默认角色"},
				},
				"required": []string{"user_id", "role"},
			},
		}
	}
	return Tool{}
}

func rolePermissionToolDefinition(name string) Tool {
	switch name {
	case "list_roles":
		return Tool{
			Name:        "list_roles",
			Description: "获取角色列表（roles-permissions 模块）",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"keyword": map[string]interface{}{"type": "string", "description": "搜索关键词"},
				},
			},
		}
	case "get_role_permissions":
		return Tool{
			Name:        "get_role_permissions",
			Description: "获取角色权限详情",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"role": map[string]interface{}{"type": "string", "description": "角色名称"},
				},
				"required": []string{"role"},
			},
		}
	case "create_role":
		return Tool{
			Name:        "create_role",
			Description: "创建角色",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"role_code":   map[string]interface{}{"type": "string", "description": "角色代码"},
					"role_name":   map[string]interface{}{"type": "string", "description": "角色名称"},
					"name":        map[string]interface{}{"type": "string", "description": "兼容旧参数，将作为 role_code/role_name 回退值"},
					"description": map[string]interface{}{"type": "string", "description": "角色描述"},
					"permissions": map[string]interface{}{"type": "array", "description": "创建成功后附加写入的权限列表"},
				},
				"anyOf": []map[string]interface{}{
					map[string]interface{}{"required": []string{"role_code", "role_name"}},
					map[string]interface{}{"required": []string{"role_code"}},
					map[string]interface{}{"required": []string{"name"}},
				},
			},
		}
	case "update_role_permissions":
		return Tool{
			Name:        "update_role_permissions",
			Description: "更新角色权限",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"role":        map[string]interface{}{"type": "string", "description": "角色名称"},
					"permissions": map[string]interface{}{"type": "array", "description": "新的权限列表"},
				},
				"required": []string{"role", "permissions"},
			},
		}
	}
	return Tool{}
}

func systemConfigToolDefinition(name string) Tool {
	switch name {
	case "get_system_config":
		return Tool{
			Name:        "get_system_config",
			Description: "获取数据库系统配置",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "update_system_config":
		return Tool{
			Name:        "update_system_config",
			Description: "更新数据库连接配置",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"host":            map[string]interface{}{"type": "string", "description": "数据库主机"},
					"port":            map[string]interface{}{"type": "integer", "description": "数据库端口"},
					"user":            map[string]interface{}{"type": "string", "description": "数据库用户名"},
					"password":        map[string]interface{}{"type": "string", "description": "数据库密码，不传则沿用当前配置"},
					"database":        map[string]interface{}{"type": "string", "description": "数据库名称"},
					"connectionLimit": map[string]interface{}{"type": "integer", "description": "连接池大小"},
					"connectTimeout":  map[string]interface{}{"type": "integer", "description": "连接超时（毫秒）"},
					"idleTimeout":     map[string]interface{}{"type": "integer", "description": "空闲超时（毫秒）"},
					"maxIdle":         map[string]interface{}{"type": "integer", "description": "最大空闲连接数"},
				},
				"required": []string{"host", "port", "user", "database"},
			},
		}
	}
	return Tool{}
}

func moduleToolDefinition(name string) Tool {
	switch name {
	case "list_modules":
		return Tool{
			Name:        "list_modules",
			Description: "获取当前租户模块配置列表，支持按分类、类型、状态筛选",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"category": map[string]interface{}{"type": "string", "description": "模块分类"},
					"type":     map[string]interface{}{"type": "string", "description": "模块类型"},
					"status":   map[string]interface{}{"type": "string", "description": "状态筛选"},
				},
			},
		}
	case "get_module_config":
		return Tool{
			Name:        "get_module_config",
			Description: "获取模块配置",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
				},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id"}},
					{"required": []string{"module_code"}},
				},
			},
		}
	case "update_module_config":
		return Tool{
			Name:        "update_module_config",
			Description: "更新模块配置",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
					"config":      map[string]interface{}{"type": "object", "description": "配置JSON"},
				},
				"required": []string{"config"},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id", "config"}},
					{"required": []string{"module_code", "config"}},
				},
			},
		}
	case "validate_module_config":
		return Tool{
			Name:        "validate_module_config",
			Description: "验证模块配置是否符合模块 schema",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
					"config":      map[string]interface{}{"type": "object", "description": "待验证的配置 JSON"},
				},
				"required": []string{"config"},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id", "config"}},
					{"required": []string{"module_code", "config"}},
				},
			},
		}
	case "enable_module":
		return Tool{
			Name:        "enable_module",
			Description: "启用指定模块，可选同时写入配置",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
					"config":      map[string]interface{}{"type": "object", "description": "启用时写入的模块配置"},
				},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id"}},
					{"required": []string{"module_code"}},
				},
			},
		}
	case "disable_module":
		return Tool{
			Name:        "disable_module",
			Description: "禁用指定模块",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
				},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id"}},
					{"required": []string{"module_code"}},
				},
			},
		}
	case "list_module_versions":
		return Tool{
			Name:        "list_module_versions",
			Description: "获取模块配置版本历史",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
				},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id"}},
					{"required": []string{"module_code"}},
				},
			},
		}
	case "create_module_version":
		return Tool{
			Name:        "create_module_version",
			Description: "创建模块配置版本",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
					"config":      map[string]interface{}{"type": "object", "description": "配置 JSON"},
					"change_log":  map[string]interface{}{"type": "string", "description": "变更说明"},
				},
				"required": []string{"config"},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id", "config"}},
					{"required": []string{"module_code", "config"}},
				},
			},
		}
	case "rollback_module_version":
		return Tool{
			Name:        "rollback_module_version",
			Description: "回滚模块配置到指定版本",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
					"version_id":  map[string]interface{}{"type": "integer", "description": "版本ID"},
				},
				"required": []string{"version_id"},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id", "version_id"}},
					{"required": []string{"module_code", "version_id"}},
				},
			},
		}
	case "compare_module_version":
		return Tool{
			Name:        "compare_module_version",
			Description: "对比指定模块版本与当前版本的差异",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
					"version_id":  map[string]interface{}{"type": "integer", "description": "版本ID"},
				},
				"required": []string{"version_id"},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id", "version_id"}},
					{"required": []string{"module_code", "version_id"}},
				},
			},
		}
	case "delete_module_version":
		return Tool{
			Name:        "delete_module_version",
			Description: "删除模块历史配置版本，不能删除当前版本",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
					"version_id":  map[string]interface{}{"type": "integer", "description": "版本ID"},
				},
				"required": []string{"version_id"},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id", "version_id"}},
					{"required": []string{"module_code", "version_id"}},
				},
			},
		}
	case "backup_module_config":
		return Tool{
			Name:        "backup_module_config",
			Description: "备份模块当前配置",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
				},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id"}},
					{"required": []string{"module_code"}},
				},
			},
		}
	case "restore_module_config":
		return Tool{
			Name:        "restore_module_config",
			Description: "使用备份数据恢复模块配置",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
					"backup_data": map[string]interface{}{"type": "object", "description": "备份数据对象"},
				},
				"required": []string{"backup_data"},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id", "backup_data"}},
					{"required": []string{"module_code", "backup_data"}},
				},
			},
		}
	case "list_module_menus":
		return Tool{
			Name:        "list_module_menus",
			Description: "获取模块菜单权限列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
				},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id"}},
					{"required": []string{"module_code"}},
				},
			},
		}
	case "update_module_menus":
		return Tool{
			Name:        "update_module_menus",
			Description: "更新模块菜单权限",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"module_id":   map[string]interface{}{"type": "string", "description": "模块ID"},
					"module_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 module_id"},
					"menus": map[string]interface{}{
						"type":        "array",
						"description": "菜单权限列表，每项包含 menu_key 和 is_visible",
						"items": map[string]interface{}{
							"type": "object",
						},
					},
				},
				"required": []string{"menus"},
				"anyOf": []map[string]interface{}{
					{"required": []string{"module_id", "menus"}},
					{"required": []string{"module_code", "menus"}},
				},
			},
		}
	}
	return Tool{}
}

func auditToolDefinition(name string) Tool {
	switch name {
	case "list_audit_logs":
		return Tool{
			Name:        "list_audit_logs",
			Description: "获取审计日志列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"user_id":    map[string]interface{}{"type": "integer", "description": "用户ID"},
					"action":     map[string]interface{}{"type": "string", "description": "操作类型"},
					"resource":   map[string]interface{}{"type": "string", "description": "资源类型"},
					"start_date": map[string]interface{}{"type": "string", "description": "开始日期"},
					"end_date":   map[string]interface{}{"type": "string", "description": "结束日期"},
				},
			},
		}
	case "get_audit_log_detail":
		return Tool{
			Name:        "get_audit_log_detail",
			Description: "获取审计日志详情",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "日志ID"},
				},
				"required": []string{"id"},
			},
		}
	}
	return Tool{}
}

func tenantToolDefinition(name string) Tool {
	switch name {
	case "list_tenants":
		return Tool{
			Name:        "list_tenants",
			Description: "获取租户列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":    map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":   map[string]interface{}{"type": "integer", "description": "每页数量"},
					"keyword": map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"status":  map[string]interface{}{"type": "string", "description": "状态"},
				},
			},
		}
	case "get_tenant_config":
		return Tool{
			Name:        "get_tenant_config",
			Description: "获取租户配置",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"tenant_id": map[string]interface{}{"type": "integer", "description": "租户ID"},
				},
				"required": []string{"tenant_id"},
			},
		}
	case "update_tenant_modules":
		return Tool{
			Name:        "update_tenant_modules",
			Description: "更新租户模块配置",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"tenant_id":    map[string]interface{}{"type": "integer", "description": "租户ID"},
					"module_codes": map[string]interface{}{"type": "array", "description": "模块代码列表"},
					"action":       map[string]interface{}{"type": "string", "description": "操作：enable/disable"},
				},
				"required": []string{"tenant_id", "module_codes", "action"},
			},
		}
	}
	return Tool{}
}
