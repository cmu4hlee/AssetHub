package main

// Tool definition helpers for Transfer, Idle, and Scrap management

func transferToolDefinition(name string) Tool {
	switch name {
	case "transfer_asset":
		return Tool{
			Name:        "transfer_asset",
			Description: "申请资产调配",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code":        map[string]interface{}{"type": "string", "description": "资产编号"},
					"target_department": map[string]interface{}{"type": "string", "description": "调入部门"},
					"reason":            map[string]interface{}{"type": "string", "description": "调配原因"},
					"transfer_date":     map[string]interface{}{"type": "string", "description": "调配日期 (YYYY-MM-DD，可选兼容字段)"},
				},
				"required": []string{"asset_code", "target_department", "reason"},
			},
		}
	case "list_transfers":
		return Tool{
			Name:        "list_transfers",
			Description: "获取资产调配记录列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"status":     map[string]interface{}{"type": "string", "description": "状态：pending/approved/rejected"},
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
				},
			},
		}
	case "approve_transfer":
		return Tool{
			Name:        "approve_transfer",
			Description: "审批资产调配申请",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":      map[string]interface{}{"type": "integer", "description": "调配ID"},
					"action":  map[string]interface{}{"type": "string", "description": "操作：approve/reject"},
					"comment": map[string]interface{}{"type": "string", "description": "审批意见"},
				},
				"required": []string{"id", "action"},
			},
		}
	case "execute_transfer":
		return Tool{
			Name:        "execute_transfer",
			Description: "完成资产调配",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "调配ID"},
				},
				"required": []string{"id"},
			},
		}
	}
	return Tool{}
}

func scrapToolDefinition(name string) Tool {
	switch name {
	case "list_scrappings":
		return Tool{
			Name:        "list_scrappings",
			Description: "获取报废申请列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"status":     map[string]interface{}{"type": "string", "description": "状态"},
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
				},
			},
		}
	case "create_scrapping":
		return Tool{
			Name:        "create_scrapping",
			Description: "创建报废申请",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code":      map[string]interface{}{"type": "string", "description": "资产编号"},
					"reason":          map[string]interface{}{"type": "string", "description": "报废原因"},
					"description":     map[string]interface{}{"type": "string", "description": "详细说明"},
					"estimated_value": map[string]interface{}{"type": "number", "description": "预估残值"},
					"apply_date":      map[string]interface{}{"type": "string", "description": "申请日期"},
				},
				"required": []string{"asset_code", "reason"},
			},
		}
	case "approve_scrapping":
		return Tool{
			Name:        "approve_scrapping",
			Description: "审批报废申请",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":      map[string]interface{}{"type": "integer", "description": "报废ID"},
					"action":  map[string]interface{}{"type": "string", "description": "操作：approve/reject"},
					"comment": map[string]interface{}{"type": "string", "description": "审批意见"},
				},
				"required": []string{"id", "action"},
			},
		}
	}
	return Tool{}
}
