package main

// Tool definition helpers for AI, Procurement, Quality, Inventory, Dashboard tools

func aiToolDefinition(name string) Tool {
	switch name {
	case "init_ai_conversation":
		return Tool{
			Name:        "init_ai_conversation",
			Description: "初始化AI对话",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "send_ai_message":
		return Tool{
			Name:        "send_ai_message",
			Description: "发送消息到AI对话",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"conversation_id": map[string]interface{}{"type": "string", "description": "对话ID"},
					"message":         map[string]interface{}{"type": "string", "description": "消息内容"},
					"context":         map[string]interface{}{"type": "object", "description": "上下文"},
					"history":         map[string]interface{}{"type": "array", "description": "历史消息"},
				},
				"required": []string{"conversation_id", "message"},
			},
		}
	case "get_ai_pending":
		return Tool{
			Name:        "get_ai_pending",
			Description: "获取AI待处理请求",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "get_ai_analysis":
		return Tool{
			Name:        "get_ai_analysis",
			Description: "获取AI维修分析",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"type":       map[string]interface{}{"type": "string", "description": "分析类型"},
					"start_date": map[string]interface{}{"type": "string", "description": "开始日期"},
					"end_date":   map[string]interface{}{"type": "string", "description": "结束日期"},
					"department": map[string]interface{}{"type": "string", "description": "部门"},
				},
			},
		}
	}
	return Tool{}
}

func procurementToolDefinition(name string) Tool {
	switch name {
	case "list_procurements":
		return Tool{
			Name:        "list_procurements",
			Description: "获取采购申请列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"keyword":    map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"status":     map[string]interface{}{"type": "string", "description": "状态"},
					"department": map[string]interface{}{"type": "string", "description": "部门"},
					"start_date": map[string]interface{}{"type": "string", "description": "开始日期"},
					"end_date":   map[string]interface{}{"type": "string", "description": "结束日期"},
				},
			},
		}
	case "create_procurement":
		return Tool{
			Name:        "create_procurement",
			Description: "创建采购申请",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_name":     map[string]interface{}{"type": "string", "description": "资产名称"},
					"category_id":    map[string]interface{}{"type": "integer", "description": "类别ID"},
					"quantity":       map[string]interface{}{"type": "integer", "description": "数量"},
					"estimated_cost": map[string]interface{}{"type": "number", "description": "预估费用"},
					"department":     map[string]interface{}{"type": "string", "description": "需求部门"},
					"reason":         map[string]interface{}{"type": "string", "description": "采购原因"},
					"expected_date":  map[string]interface{}{"type": "string", "description": "期望日期"},
					"specification":  map[string]interface{}{"type": "string", "description": "规格要求"},
				},
				"required": []string{"asset_name", "department", "reason"},
			},
		}
	case "approve_procurement":
		return Tool{
			Name:        "approve_procurement",
			Description: "审批采购申请",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":      map[string]interface{}{"type": "integer", "description": "采购ID"},
					"action":  map[string]interface{}{"type": "string", "description": "操作：approve/reject"},
					"comment": map[string]interface{}{"type": "string", "description": "审批意见"},
				},
				"required": []string{"id", "action"},
			},
		}
	}
	return Tool{}
}

func qualityControlToolDefinition(name string) Tool {
	switch name {
	case "list_quality_controls":
		return Tool{
			Name:        "list_quality_controls",
			Description: "获取质检记录列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"keyword":    map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"status":     map[string]interface{}{"type": "string", "description": "状态"},
					"qc_type":    map[string]interface{}{"type": "string", "description": "质检类型"},
					"start_date": map[string]interface{}{"type": "string", "description": "开始日期"},
					"end_date":   map[string]interface{}{"type": "string", "description": "结束日期"},
				},
			},
		}
	case "create_quality_control":
		return Tool{
			Name:        "create_quality_control",
			Description: "创建质检记录",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code":      map[string]interface{}{"type": "string", "description": "资产编号"},
					"qc_type":         map[string]interface{}{"type": "string", "description": "质检类型"},
					"qc_date":         map[string]interface{}{"type": "string", "description": "质检日期"},
					"qc_person":       map[string]interface{}{"type": "string", "description": "质检人员"},
					"result":          map[string]interface{}{"type": "string", "description": "质检结果"},
					"finding":         map[string]interface{}{"type": "string", "description": "发现问题"},
					"action_required": map[string]interface{}{"type": "string", "description": "需处理事项"},
					"remark":          map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"asset_code", "qc_type", "qc_date", "qc_person", "result"},
			},
		}
	case "get_quality_statistics":
		return Tool{
			Name:        "get_quality_statistics",
			Description: "获取质检统计信息",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"start_date": map[string]interface{}{"type": "string", "description": "开始日期"},
					"end_date":   map[string]interface{}{"type": "string", "description": "结束日期"},
					"department": map[string]interface{}{"type": "string", "description": "部门"},
				},
			},
		}
	}
	return Tool{}
}

func inventoryToolDefinition(name string) Tool {
	switch name {
	case "list_inventory":
		return Tool{
			Name:        "list_inventory",
			Description: "获取库存列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":        map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":       map[string]interface{}{"type": "integer", "description": "每页数量"},
					"keyword":     map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"category_id": map[string]interface{}{"type": "integer", "description": "类别ID"},
					"warehouse":   map[string]interface{}{"type": "string", "description": "仓库"},
					"status":      map[string]interface{}{"type": "string", "description": "状态"},
				},
			},
		}
	case "create_inventory_record":
		return Tool{
			Name:        "create_inventory_record",
			Description: "创建库存记录",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"item_name":   map[string]interface{}{"type": "string", "description": "物品名称"},
					"category_id": map[string]interface{}{"type": "integer", "description": "类别ID"},
					"quantity":    map[string]interface{}{"type": "integer", "description": "数量"},
					"unit":        map[string]interface{}{"type": "string", "description": "单位"},
					"warehouse":   map[string]interface{}{"type": "string", "description": "仓库"},
					"location":    map[string]interface{}{"type": "string", "description": "存放位置"},
					"remark":      map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"item_name", "quantity"},
			},
		}
	case "adjust_inventory":
		return Tool{
			Name:        "adjust_inventory",
			Description: "调整库存数量",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":          map[string]interface{}{"type": "integer", "description": "库存ID"},
					"adjust_type": map[string]interface{}{"type": "string", "description": "调整类型：in/out/adj"},
					"quantity":    map[string]interface{}{"type": "integer", "description": "调整数量"},
					"reason":      map[string]interface{}{"type": "string", "description": "调整原因"},
					"remark":      map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"id", "adjust_type", "quantity", "reason"},
			},
		}
	case "list_inventory_plans":
		return Tool{
			Name:        "list_inventory_plans",
			Description: "获取盘点计划列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":   map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":  map[string]interface{}{"type": "integer", "description": "每页数量"},
					"status": map[string]interface{}{"type": "string", "description": "计划状态"},
				},
			},
		}
	case "get_inventory_plan":
		return Tool{
			Name:        "get_inventory_plan",
			Description: "获取单个盘点计划详情",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "盘点计划ID"},
				},
				"required": []string{"id"},
			},
		}
	case "create_inventory_plan":
		return Tool{
			Name:        "create_inventory_plan",
			Description: "创建盘点计划",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"plan_no":    map[string]interface{}{"type": "string", "description": "计划编号"},
					"plan_name":  map[string]interface{}{"type": "string", "description": "计划名称"},
					"start_date": map[string]interface{}{"type": "string", "description": "开始日期 (YYYY-MM-DD)"},
					"end_date":   map[string]interface{}{"type": "string", "description": "结束日期 (YYYY-MM-DD)"},
					"status":     map[string]interface{}{"type": "string", "description": "计划状态，默认 draft"},
					"remark":     map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"plan_no", "plan_name"},
			},
		}
	case "update_inventory_plan":
		return Tool{
			Name:        "update_inventory_plan",
			Description: "更新盘点计划",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":         map[string]interface{}{"type": "integer", "description": "盘点计划ID"},
					"plan_no":    map[string]interface{}{"type": "string", "description": "计划编号"},
					"plan_name":  map[string]interface{}{"type": "string", "description": "计划名称"},
					"start_date": map[string]interface{}{"type": "string", "description": "开始日期 (YYYY-MM-DD)"},
					"end_date":   map[string]interface{}{"type": "string", "description": "结束日期 (YYYY-MM-DD)"},
					"status":     map[string]interface{}{"type": "string", "description": "计划状态"},
					"remark":     map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"id", "plan_no", "plan_name"},
			},
		}
	case "activate_inventory_plan":
		return Tool{
			Name:        "activate_inventory_plan",
			Description: "激活盘点计划",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "盘点计划ID"},
				},
				"required": []string{"id"},
			},
		}
	case "complete_inventory_plan":
		return Tool{
			Name:        "complete_inventory_plan",
			Description: "完成盘点计划",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "盘点计划ID"},
				},
				"required": []string{"id"},
			},
		}
	case "cancel_inventory_plan":
		return Tool{
			Name:        "cancel_inventory_plan",
			Description: "取消盘点计划",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "盘点计划ID"},
				},
				"required": []string{"id"},
			},
		}
	case "list_inventory_tasks":
		return Tool{
			Name:        "list_inventory_tasks",
			Description: "获取盘点任务列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":         map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":        map[string]interface{}{"type": "integer", "description": "每页数量"},
					"inventory_id": map[string]interface{}{"type": "integer", "description": "盘点记录ID"},
					"assignee":     map[string]interface{}{"type": "string", "description": "负责人用户名"},
					"status":       map[string]interface{}{"type": "string", "description": "任务状态"},
				},
			},
		}
	case "get_inventory_task":
		return Tool{
			Name:        "get_inventory_task",
			Description: "获取单个盘点任务详情",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "盘点任务ID"},
				},
				"required": []string{"id"},
			},
		}
	case "create_inventory_task":
		return Tool{
			Name:        "create_inventory_task",
			Description: "创建盘点任务",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"inventory_id":    map[string]interface{}{"type": "integer", "description": "盘点记录ID"},
					"task_name":       map[string]interface{}{"type": "string", "description": "任务名称"},
					"assignee":        map[string]interface{}{"type": "string", "description": "负责人用户名"},
					"assignee_name":   map[string]interface{}{"type": "string", "description": "负责人姓名"},
					"department_code": map[string]interface{}{"type": "string", "description": "部门编码"},
					"location":        map[string]interface{}{"type": "string", "description": "盘点位置"},
					"estimated_count": map[string]interface{}{"type": "integer", "description": "预估盘点数量"},
				},
				"required": []string{"inventory_id", "task_name", "assignee", "assignee_name"},
			},
		}
	case "assign_inventory_task":
		return Tool{
			Name:        "assign_inventory_task",
			Description: "分配盘点任务",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "盘点任务ID"},
				},
				"required": []string{"id"},
			},
		}
	case "start_inventory_task":
		return Tool{
			Name:        "start_inventory_task",
			Description: "开始盘点任务",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "盘点任务ID"},
				},
				"required": []string{"id"},
			},
		}
	case "complete_inventory_task":
		return Tool{
			Name:        "complete_inventory_task",
			Description: "完成盘点任务",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":           map[string]interface{}{"type": "integer", "description": "盘点任务ID"},
					"actual_count": map[string]interface{}{"type": "integer", "description": "实际盘点数量"},
				},
				"required": []string{"id"},
			},
		}
	case "update_inventory_task":
		return Tool{
			Name:        "update_inventory_task",
			Description: "更新盘点任务",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":              map[string]interface{}{"type": "integer", "description": "盘点任务ID"},
					"task_name":       map[string]interface{}{"type": "string", "description": "任务名称"},
					"assignee":        map[string]interface{}{"type": "string", "description": "负责人用户名"},
					"assignee_name":   map[string]interface{}{"type": "string", "description": "负责人姓名"},
					"department_code": map[string]interface{}{"type": "string", "description": "部门编码"},
					"location":        map[string]interface{}{"type": "string", "description": "盘点位置"},
					"estimated_count": map[string]interface{}{"type": "integer", "description": "预估盘点数量"},
				},
				"required": []string{"id", "task_name", "assignee", "assignee_name"},
			},
		}
	case "cancel_inventory_task":
		return Tool{
			Name:        "cancel_inventory_task",
			Description: "取消盘点任务",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "盘点任务ID"},
				},
				"required": []string{"id"},
			},
		}
	case "list_inventory_discrepancies":
		return Tool{
			Name:        "list_inventory_discrepancies",
			Description: "获取盘点差异列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":            map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":           map[string]interface{}{"type": "integer", "description": "每页数量"},
					"inventory_id":    map[string]interface{}{"type": "integer", "description": "盘点记录ID"},
					"asset_code":      map[string]interface{}{"type": "string", "description": "资产编号"},
					"handling_status": map[string]interface{}{"type": "string", "description": "处理状态"},
				},
			},
		}
	case "get_inventory_discrepancy":
		return Tool{
			Name:        "get_inventory_discrepancy",
			Description: "获取单个盘点差异详情",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "盘点差异ID"},
				},
				"required": []string{"id"},
			},
		}
	case "handle_inventory_discrepancy":
		return Tool{
			Name:        "handle_inventory_discrepancy",
			Description: "处理单个盘点差异",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":              map[string]interface{}{"type": "integer", "description": "盘点差异ID"},
					"handling_status": map[string]interface{}{"type": "string", "description": "处理状态"},
					"handling_method": map[string]interface{}{"type": "string", "description": "处理方式"},
					"handling_notes":  map[string]interface{}{"type": "string", "description": "处理备注"},
				},
				"required": []string{"id", "handling_status", "handling_method"},
			},
		}
	case "batch_handle_inventory_discrepancies":
		return Tool{
			Name:        "batch_handle_inventory_discrepancies",
			Description: "批量处理盘点差异",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"ids":             map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "integer"}, "description": "盘点差异ID列表"},
					"handling_status": map[string]interface{}{"type": "string", "description": "处理状态"},
					"handling_method": map[string]interface{}{"type": "string", "description": "处理方式"},
					"handling_notes":  map[string]interface{}{"type": "string", "description": "处理备注"},
				},
				"required": []string{"ids", "handling_status", "handling_method"},
			},
		}
	case "get_inventory_discrepancy_statistics":
		return Tool{
			Name:        "get_inventory_discrepancy_statistics",
			Description: "获取指定盘点记录的差异统计",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"inventory_id": map[string]interface{}{"type": "integer", "description": "盘点记录ID"},
				},
				"required": []string{"inventory_id"},
			},
		}
	case "generate_inventory_discrepancies":
		return Tool{
			Name:        "generate_inventory_discrepancies",
			Description: "根据盘点明细自动生成差异记录",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"inventory_id": map[string]interface{}{"type": "integer", "description": "盘点记录ID"},
				},
				"required": []string{"inventory_id"},
			},
		}
	}
	return Tool{}
}

func dashboardToolDefinition(name string) Tool {
	switch name {
	case "get_dashboard_overview":
		return Tool{
			Name:        "get_dashboard_overview",
			Description: "获取仪表盘概览数据。当前由资产、调配、闲置统计接口聚合生成。",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "get_asset_age_distribution":
		return Tool{
			Name:        "get_asset_age_distribution",
			Description: "获取资产使用年限分布",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"department": map[string]interface{}{"type": "string", "description": "部门"},
				},
			},
		}
	case "get_maintenance_cost_analysis":
		return Tool{
			Name:        "get_maintenance_cost_analysis",
			Description: "获取维修费用分析",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"start_date": map[string]interface{}{"type": "string", "description": "开始日期"},
					"end_date":   map[string]interface{}{"type": "string", "description": "结束日期"},
					"department": map[string]interface{}{"type": "string", "description": "部门"},
				},
			},
		}
	}
	return Tool{}
}
