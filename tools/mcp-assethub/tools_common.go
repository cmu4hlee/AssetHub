package main

// Tool definition helpers for Auxiliary/Common tools

func auxiliaryToolDefinition(name string) Tool {
	switch name {
	case "list_departments":
		return Tool{
			Name:        "list_departments",
			Description: "获取部门列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"tree":             map[string]interface{}{"type": "boolean", "description": "是否返回树形结构"},
					"parent_id":        map[string]interface{}{"type": "integer", "description": "父部门ID"},
					"include_children": map[string]interface{}{"type": "boolean", "description": "是否包含子部门"},
				},
			},
		}
	case "list_users":
		return Tool{
			Name:        "list_users",
			Description: "获取用户列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":            map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":           map[string]interface{}{"type": "integer", "description": "每页数量"},
					"keyword":         map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"role":            map[string]interface{}{"type": "string", "description": "角色筛选"},
					"department_code": map[string]interface{}{"type": "string", "description": "部门代码"},
					"status":          map[string]interface{}{"type": "string", "description": "状态：active/inactive/locked"},
				},
			},
		}
	case "get_current_auth_context":
		return Tool{
			Name:        "get_current_auth_context",
			Description: "根据当前调用凭证解析当前用户、角色、租户、菜单权限、角色权限和租户模块，用于让上层 AI 先确认权限边界后再执行查询或管理",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"include_menu_definitions": map[string]interface{}{"type": "boolean", "description": "是否同时返回可见菜单的定义明细，默认 false"},
					"include_module_details":   map[string]interface{}{"type": "boolean", "description": "是否返回当前租户的模块明细，默认 true"},
					"include_role_permissions": map[string]interface{}{"type": "boolean", "description": "是否返回当前角色的权限列表，默认 true"},
				},
			},
		}
	case "query_department_asset_profile":
		return Tool{
			Name:        "query_department_asset_profile",
			Description: "组合查询科室/部门资产画像，返回资产规模、价值、状态结构、分类结构、位置结构、数据缺口、维护负荷及工单摘要，适合用于配置分析和部门画像",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"department":          map[string]interface{}{"type": "string", "description": "部门/科室名称或关键字"},
					"keyword":             map[string]interface{}{"type": "string", "description": "资产关键字，可选"},
					"sample_limit":        map[string]interface{}{"type": "integer", "description": "样本资产返回数量，默认 10，最大 20"},
					"include_maintenance": map[string]interface{}{"type": "boolean", "description": "是否附带维护负荷摘要，默认 true"},
					"include_workorders":  map[string]interface{}{"type": "boolean", "description": "是否附带维护工单摘要，默认 true"},
				},
				"required": []string{"department"},
			},
		}
	case "query_asset_operation_overview":
		return Tool{
			Name:        "query_asset_operation_overview",
			Description: "组合查询资产或资产集合在维修、工单、调配、闲置、报废流程中的综合态势，适合用于异常链路和运营状态分析",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code":    map[string]interface{}{"type": "string", "description": "资产编号，可选"},
					"keyword":       map[string]interface{}{"type": "string", "description": "资产关键词，可选"},
					"department":    map[string]interface{}{"type": "string", "description": "部门/科室名称或关键字，可选"},
					"sample_limit":  map[string]interface{}{"type": "integer", "description": "样本与事件返回数量，默认 10，最大 20"},
					"include_idle":  map[string]interface{}{"type": "boolean", "description": "是否包含闲置发布记录，默认 true"},
					"include_scrap": map[string]interface{}{"type": "boolean", "description": "是否包含报废记录，默认 true"},
				},
				"anyOf": []map[string]interface{}{
					{"required": []string{"asset_code"}},
					{"required": []string{"keyword"}},
					{"required": []string{"department"}},
				},
			},
		}
	case "query_workflow_pending_summary":
		return Tool{
			Name:        "query_workflow_pending_summary",
			Description: "组合查询当前租户待处理流程，汇总维护工单、调配、闲置发布、报废、盘点等模块的待办和堵塞点，适合流程健康分析",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"department":   map[string]interface{}{"type": "string", "description": "部门/科室名称或关键字，可选"},
					"keyword":      map[string]interface{}{"type": "string", "description": "关键词，可选"},
					"sample_limit": map[string]interface{}{"type": "integer", "description": "各模块返回的样本条数，默认 10，最大 20"},
				},
			},
		}
	}
	return Tool{}
}

func acceptanceToolDefinition(name string) Tool {
	switch name {
	case "list_acceptances":
		return Tool{
			Name:        "list_acceptances",
			Description: "获取验收记录列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"keyword":    map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"status":     map[string]interface{}{"type": "string", "description": "状态"},
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
				},
			},
		}
	case "create_acceptance":
		return Tool{
			Name:        "create_acceptance",
			Description: "创建验收记录",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code":      map[string]interface{}{"type": "string", "description": "资产编号"},
					"acceptance_date": map[string]interface{}{"type": "string", "description": "验收日期"},
					"acceptor":        map[string]interface{}{"type": "string", "description": "验收人"},
					"result":          map[string]interface{}{"type": "string", "description": "验收结果"},
					"finding":         map[string]interface{}{"type": "string", "description": "发现问题"},
					"remark":          map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"asset_code", "acceptance_date", "result"},
			},
		}
	}
	return Tool{}
}
