package main

// Tool definition helpers for Maintenance management

func maintenanceToolDefinition(name string) Tool {
	switch name {
	case "list_maintenance_logs":
		return Tool{
			Name:        "list_maintenance_logs",
			Description: "获取维修日志列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"status":     map[string]interface{}{"type": "string", "description": "状态"},
					"start_date": map[string]interface{}{"type": "string", "description": "开始日期"},
					"end_date":   map[string]interface{}{"type": "string", "description": "结束日期"},
				},
			},
		}
	case "create_maintenance_log":
		return Tool{
			Name:        "create_maintenance_log",
			Description: "创建维修日志",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code":           map[string]interface{}{"type": "string", "description": "资产编号"},
					"maintenance_type":     map[string]interface{}{"type": "string", "description": "维修类型"},
					"maintenance_date":     map[string]interface{}{"type": "string", "description": "维修日期 (YYYY-MM-DD)"},
					"maintenance_person":   map[string]interface{}{"type": "string", "description": "维修人员"},
					"maintenance_content":  map[string]interface{}{"type": "string", "description": "维修内容"},
					"maintenance_cost":     map[string]interface{}{"type": "number", "description": "维修成本"},
					"maintenance_duration": map[string]interface{}{"type": "number", "description": "维修时长(小时)"},
					"parts_replaced":       map[string]interface{}{"type": "string", "description": "更换部件"},
					"status":               map[string]interface{}{"type": "string", "description": "状态"},
					"remark":               map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"asset_code", "maintenance_type", "maintenance_date", "maintenance_person", "maintenance_content"},
			},
		}
	case "get_maintenance_templates":
		return Tool{
			Name:        "get_maintenance_templates",
			Description: "获取维修模板列表",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "get_maintenance_efficiency":
		return Tool{
			Name:        "get_maintenance_efficiency",
			Description: "获取维修效率统计",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "list_maintenance_plans":
		return Tool{
			Name:        "list_maintenance_plans",
			Description: "获取预防性维护计划列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"status":     map[string]interface{}{"type": "string", "description": "计划状态"},
					"keyword":    map[string]interface{}{"type": "string", "description": "关键词，匹配资产编号/资产名称/计划名称"},
				},
			},
		}
	case "get_maintenance_plan":
		return Tool{
			Name:        "get_maintenance_plan",
			Description: "获取单个预防性维护计划详情",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "维护计划ID"},
				},
				"required": []string{"id"},
			},
		}
	case "create_maintenance_plan":
		return Tool{
			Name:        "create_maintenance_plan",
			Description: "创建预防性维护计划",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code":              map[string]interface{}{"type": "string", "description": "资产编号"},
					"plan_name":               map[string]interface{}{"type": "string", "description": "计划名称"},
					"maintenance_type":        map[string]interface{}{"type": "string", "description": "维护类型"},
					"cycle_type":              map[string]interface{}{"type": "string", "description": "周期类型，如按天/按周/按月/按季度/按年"},
					"cycle_value":             map[string]interface{}{"type": "integer", "description": "周期值"},
					"next_maintenance_date":   map[string]interface{}{"type": "string", "description": "下次维护日期 (YYYY-MM-DD)"},
					"maintenance_content":     map[string]interface{}{"type": "string", "description": "维护内容"},
					"responsible_person":      map[string]interface{}{"type": "string", "description": "负责人"},
					"remark":                  map[string]interface{}{"type": "string", "description": "备注"},
					"template_id":             map[string]interface{}{"type": "integer", "description": "模板ID"},
					"trigger_type":            map[string]interface{}{"type": "string", "description": "触发类型，如 time/usage/both"},
					"maintenance_items":       map[string]interface{}{"type": "array", "description": "维护项目列表"},
					"required_materials":      map[string]interface{}{"type": "array", "description": "所需物料列表"},
					"estimated_hours":         map[string]interface{}{"type": "number", "description": "预估工时"},
					"auto_generate_workorder": map[string]interface{}{"type": "boolean", "description": "是否自动生成工单"},
					"current_usage":           map[string]interface{}{"type": "number", "description": "当前累计使用量"},
					"usage_threshold":         map[string]interface{}{"type": "number", "description": "触发阈值"},
				},
				"required": []string{"asset_code", "plan_name", "maintenance_type", "cycle_type", "cycle_value"},
			},
		}
	case "update_maintenance_plan":
		return Tool{
			Name:        "update_maintenance_plan",
			Description: "更新预防性维护计划",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":                      map[string]interface{}{"type": "integer", "description": "维护计划ID"},
					"plan_name":               map[string]interface{}{"type": "string", "description": "计划名称"},
					"maintenance_type":        map[string]interface{}{"type": "string", "description": "维护类型"},
					"cycle_type":              map[string]interface{}{"type": "string", "description": "周期类型"},
					"cycle_value":             map[string]interface{}{"type": "integer", "description": "周期值"},
					"next_maintenance_date":   map[string]interface{}{"type": "string", "description": "下次维护日期 (YYYY-MM-DD)"},
					"maintenance_content":     map[string]interface{}{"type": "string", "description": "维护内容"},
					"responsible_person":      map[string]interface{}{"type": "string", "description": "负责人"},
					"status":                  map[string]interface{}{"type": "string", "description": "计划状态"},
					"remark":                  map[string]interface{}{"type": "string", "description": "备注"},
					"template_id":             map[string]interface{}{"type": "integer", "description": "模板ID"},
					"trigger_type":            map[string]interface{}{"type": "string", "description": "触发类型"},
					"maintenance_items":       map[string]interface{}{"type": "array", "description": "维护项目列表"},
					"required_materials":      map[string]interface{}{"type": "array", "description": "所需物料列表"},
					"estimated_hours":         map[string]interface{}{"type": "number", "description": "预估工时"},
					"auto_generate_workorder": map[string]interface{}{"type": "boolean", "description": "是否自动生成工单"},
					"current_usage":           map[string]interface{}{"type": "number", "description": "当前累计使用量"},
					"usage_threshold":         map[string]interface{}{"type": "number", "description": "触发阈值"},
				},
				"required": []string{"id"},
			},
		}
	case "complete_maintenance_plan":
		return Tool{
			Name:        "complete_maintenance_plan",
			Description: "完成预防性维护计划，并自动写入维护日志",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":                  map[string]interface{}{"type": "integer", "description": "维护计划ID"},
					"maintenance_date":    map[string]interface{}{"type": "string", "description": "维护日期 (YYYY-MM-DD)"},
					"maintenance_person":  map[string]interface{}{"type": "string", "description": "维护人员"},
					"maintenance_content": map[string]interface{}{"type": "string", "description": "维护内容"},
					"maintenance_cost":    map[string]interface{}{"type": "number", "description": "维护成本"},
					"parts_replaced":      map[string]interface{}{"type": "string", "description": "更换部件"},
					"remark":              map[string]interface{}{"type": "string", "description": "备注"},
					"actual_hours":        map[string]interface{}{"type": "number", "description": "实际工时"},
					"maintenance_result":  map[string]interface{}{"type": "string", "description": "维护结果"},
				},
				"required": []string{"id"},
			},
		}
	case "delete_maintenance_plan":
		return Tool{
			Name:        "delete_maintenance_plan",
			Description: "删除预防性维护计划",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "维护计划ID"},
				},
				"required": []string{"id"},
			},
		}
	case "get_maintenance_plan_history":
		return Tool{
			Name:        "get_maintenance_plan_history",
			Description: "获取预防性维护计划历史记录",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "维护计划ID"},
				},
				"required": []string{"id"},
			},
		}
	case "list_reminders":
		return Tool{
			Name:        "list_reminders",
			Description: "获取维护提醒列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"status":     map[string]interface{}{"type": "string", "description": "提醒状态"},
					"start_date": map[string]interface{}{"type": "string", "description": "开始日期 (YYYY-MM-DD)"},
					"end_date":   map[string]interface{}{"type": "string", "description": "结束日期 (YYYY-MM-DD)"},
				},
			},
		}
	case "send_reminder":
		return Tool{
			Name:        "send_reminder",
			Description: "发送维护提醒",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"plan_id":       map[string]interface{}{"type": "integer", "description": "维护计划ID"},
					"reminder_type": map[string]interface{}{"type": "string", "description": "提醒类型"},
					"recipient":     map[string]interface{}{"type": "string", "description": "接收人"},
				},
				"required": []string{"plan_id", "reminder_type"},
			},
		}
	case "config_reminder":
		return Tool{
			Name:        "config_reminder",
			Description: "配置维护提醒规则",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"plan_id":        map[string]interface{}{"type": "integer", "description": "维护计划ID"},
					"reminder_days":  map[string]interface{}{"type": "integer", "description": "提前提醒天数"},
					"reminder_types": map[string]interface{}{"type": "array", "description": "提醒类型列表"},
					"recipient":      map[string]interface{}{"type": "string", "description": "接收人"},
				},
				"required": []string{"plan_id", "reminder_days", "reminder_types"},
			},
		}
	case "check_reminders":
		return Tool{
			Name:        "check_reminders",
			Description: "检查近期即将到期的维护计划提醒",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "list_maintenance_workorders":
		return Tool{
			Name:        "list_maintenance_workorders",
			Description: "获取维修工单列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":        map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":       map[string]interface{}{"type": "integer", "description": "每页数量"},
					"asset_code":  map[string]interface{}{"type": "string", "description": "资产编号"},
					"status":      map[string]interface{}{"type": "string", "description": "状态"},
					"priority":    map[string]interface{}{"type": "string", "description": "优先级"},
					"assigned_to": map[string]interface{}{"type": "string", "description": "负责人"},
					"start_date":  map[string]interface{}{"type": "string", "description": "开始日期 (YYYY-MM-DD)"},
					"end_date":    map[string]interface{}{"type": "string", "description": "结束日期 (YYYY-MM-DD)"},
					"keyword":     map[string]interface{}{"type": "string", "description": "关键词，匹配标题/描述/工单号"},
				},
			},
		}
	case "get_maintenance_workorder":
		return Tool{
			Name:        "get_maintenance_workorder",
			Description: "获取单个维修工单详情",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "工单ID"},
				},
				"required": []string{"id"},
			},
		}
	case "create_maintenance_workorder":
		return Tool{
			Name:        "create_maintenance_workorder",
			Description: "创建维修工单",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code":         map[string]interface{}{"type": "string", "description": "资产编号"},
					"title":              map[string]interface{}{"type": "string", "description": "工单标题"},
					"description":        map[string]interface{}{"type": "string", "description": "工单描述"},
					"priority":           map[string]interface{}{"type": "integer", "description": "优先级"},
					"planned_start_date": map[string]interface{}{"type": "string", "description": "计划开始日期 (YYYY-MM-DD)"},
					"planned_end_date":   map[string]interface{}{"type": "string", "description": "计划结束日期 (YYYY-MM-DD)"},
					"estimated_hours":    map[string]interface{}{"type": "number", "description": "预估工时"},
					"assigned_to":        map[string]interface{}{"type": "string", "description": "负责人"},
					"materials":          map[string]interface{}{"type": "array", "description": "材料清单"},
					"labor_cost":         map[string]interface{}{"type": "number", "description": "人工成本"},
					"outsourcing_cost":   map[string]interface{}{"type": "number", "description": "外包成本"},
					"other_cost":         map[string]interface{}{"type": "number", "description": "其他成本"},
					"remark":             map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"asset_code", "title"},
			},
		}
	case "assign_workorder":
		return Tool{
			Name:        "assign_workorder",
			Description: "分配维修工单负责人",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":          map[string]interface{}{"type": "integer", "description": "工单ID"},
					"assigned_to": map[string]interface{}{"type": "string", "description": "负责人"},
				},
				"required": []string{"id", "assigned_to"},
			},
		}
	case "start_workorder":
		return Tool{
			Name:        "start_workorder",
			Description: "开始维修工单",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "工单ID"},
				},
				"required": []string{"id"},
			},
		}
	case "complete_workorder":
		return Tool{
			Name:        "complete_workorder",
			Description: "完成维修工单",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":               map[string]interface{}{"type": "integer", "description": "工单ID"},
					"work_content":     map[string]interface{}{"type": "string", "description": "维修内容"},
					"actual_hours":     map[string]interface{}{"type": "number", "description": "实际工时"},
					"labor_cost":       map[string]interface{}{"type": "number", "description": "人工成本"},
					"outsourcing_cost": map[string]interface{}{"type": "number", "description": "外包成本"},
					"other_cost":       map[string]interface{}{"type": "number", "description": "其他成本"},
					"materials":        map[string]interface{}{"type": "array", "description": "材料清单"},
				},
				"required": []string{"id"},
			},
		}
	case "close_workorder":
		return Tool{
			Name:        "close_workorder",
			Description: "关闭维修工单",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":     map[string]interface{}{"type": "integer", "description": "工单ID"},
					"remark": map[string]interface{}{"type": "string", "description": "关闭备注"},
				},
				"required": []string{"id"},
			},
		}
	case "cancel_workorder":
		return Tool{
			Name:        "cancel_workorder",
			Description: "取消维修工单",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":            map[string]interface{}{"type": "integer", "description": "工单ID"},
					"cancel_reason": map[string]interface{}{"type": "string", "description": "取消原因"},
				},
				"required": []string{"id"},
			},
		}
	case "add_workorder_materials":
		return Tool{
			Name:        "add_workorder_materials",
			Description: "向维修工单追加材料清单",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":        map[string]interface{}{"type": "integer", "description": "工单ID"},
					"materials": map[string]interface{}{"type": "array", "description": "追加的材料清单"},
				},
				"required": []string{"id", "materials"},
			},
		}
	case "list_maintenance_requests":
		return Tool{
			Name:        "list_maintenance_requests",
			Description: "获取故障维修申请列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":        map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":       map[string]interface{}{"type": "integer", "description": "每页数量"},
					"asset_code":  map[string]interface{}{"type": "string", "description": "资产编号"},
					"status":      map[string]interface{}{"type": "string", "description": "申请状态"},
					"fault_level": map[string]interface{}{"type": "string", "description": "故障等级"},
					"start_date":  map[string]interface{}{"type": "string", "description": "申请开始日期 (YYYY-MM-DD)"},
					"end_date":    map[string]interface{}{"type": "string", "description": "申请结束日期 (YYYY-MM-DD)"},
					"keyword":     map[string]interface{}{"type": "string", "description": "关键词，匹配申请单号/资产编号/资产名称/申请人"},
				},
			},
		}
	case "get_maintenance_request":
		return Tool{
			Name:        "get_maintenance_request",
			Description: "获取单个故障维修申请详情",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "维修申请ID"},
				},
				"required": []string{"id"},
			},
		}
	case "create_maintenance_request":
		return Tool{
			Name:        "create_maintenance_request",
			Description: "创建故障维修申请（通过 AI/skill 安全入口，单据仍进入待审批）",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code":           map[string]interface{}{"type": "string", "description": "资产编号"},
					"fault_description":    map[string]interface{}{"type": "string", "description": "故障描述"},
					"fault_level":          map[string]interface{}{"type": "string", "description": "故障等级"},
					"request_date":         map[string]interface{}{"type": "string", "description": "申请日期 (YYYY-MM-DD)"},
					"request_department":   map[string]interface{}{"type": "string", "description": "报修部门"},
					"contact_phone":        map[string]interface{}{"type": "string", "description": "联系电话"},
					"expected_repair_date": map[string]interface{}{"type": "string", "description": "期望完成日期 (YYYY-MM-DD)"},
					"remark":               map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"asset_code", "fault_description"},
			},
		}
	case "approve_maintenance_request":
		return Tool{
			Name:        "approve_maintenance_request",
			Description: "审批故障维修申请",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":       map[string]interface{}{"type": "integer", "description": "维修申请ID"},
					"approved": map[string]interface{}{"type": "boolean", "description": "是否通过审批"},
					"action":   map[string]interface{}{"type": "string", "description": "兼容参数：approve 或 reject"},
					"comment":  map[string]interface{}{"type": "string", "description": "审批意见"},
				},
				"required": []string{"id"},
				"anyOf": []map[string]interface{}{
					{"required": []string{"approved"}},
					{"required": []string{"action"}},
				},
			},
		}
	case "start_maintenance_request":
		return Tool{
			Name:        "start_maintenance_request",
			Description: "开始执行故障维修申请",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":                map[string]interface{}{"type": "integer", "description": "维修申请ID"},
					"repair_person":     map[string]interface{}{"type": "string", "description": "维修人员"},
					"repair_start_date": map[string]interface{}{"type": "string", "description": "开始维修日期 (YYYY-MM-DD)"},
				},
				"required": []string{"id", "repair_person"},
			},
		}
	case "complete_maintenance_request":
		return Tool{
			Name:        "complete_maintenance_request",
			Description: "完成故障维修申请，并自动沉淀维修日志",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":              map[string]interface{}{"type": "integer", "description": "维修申请ID"},
					"repair_end_date": map[string]interface{}{"type": "string", "description": "完成维修日期 (YYYY-MM-DD)"},
					"repair_cost":     map[string]interface{}{"type": "number", "description": "维修费用"},
					"repair_content":  map[string]interface{}{"type": "string", "description": "维修内容"},
					"parts_replaced":  map[string]interface{}{"type": "string", "description": "更换部件"},
					"remark":          map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"id"},
			},
		}
	case "update_workorder_status":
		return Tool{
			Name:        "update_workorder_status",
			Description: "更新维修工单状态",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":                map[string]interface{}{"type": "integer", "description": "工单ID"},
					"status":            map[string]interface{}{"type": "string", "description": "新状态"},
					"actual_start_time": map[string]interface{}{"type": "string", "description": "实际开始时间"},
					"notes":             map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"id", "status"},
			},
		}
	case "list_usage_records":
		return Tool{
			Name:        "list_usage_records",
			Description: "获取资产使用量记录列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"usage_type": map[string]interface{}{"type": "string", "description": "使用量类型"},
					"start_date": map[string]interface{}{"type": "string", "description": "开始日期 (YYYY-MM-DD)"},
					"end_date":   map[string]interface{}{"type": "string", "description": "结束日期 (YYYY-MM-DD)"},
				},
			},
		}
	case "create_usage_record":
		return Tool{
			Name:        "create_usage_record",
			Description: "创建资产使用量记录",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code":       map[string]interface{}{"type": "string", "description": "资产编号"},
					"usage_date":       map[string]interface{}{"type": "string", "description": "使用日期 (YYYY-MM-DD)"},
					"usage_value":      map[string]interface{}{"type": "number", "description": "本次使用值"},
					"usage_type":       map[string]interface{}{"type": "string", "description": "使用量类型"},
					"cumulative_value": map[string]interface{}{"type": "number", "description": "累计使用值"},
					"operator":         map[string]interface{}{"type": "string", "description": "记录人"},
					"remark":           map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"asset_code", "usage_date", "usage_value", "usage_type", "cumulative_value"},
			},
		}
	case "list_usage_triggered":
		return Tool{
			Name:        "list_usage_triggered",
			Description: "获取使用量触发的维护记录列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"status":     map[string]interface{}{"type": "string", "description": "处理状态"},
				},
			},
		}
	case "process_usage_triggered":
		return Tool{
			Name:        "process_usage_triggered",
			Description: "处理单个使用量触发记录",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":            map[string]interface{}{"type": "integer", "description": "触发记录ID"},
					"work_order_id": map[string]interface{}{"type": "integer", "description": "关联工单ID"},
				},
				"required": []string{"id"},
			},
		}
	}
	return Tool{}
}

func workflowToolDefinition(name string) Tool {
	switch name {
	case "get_todo_tasks":
		return Tool{
			Name:        "get_todo_tasks",
			Description: "获取当前用户的待处理工作流任务。当前后端未开放该接口，调用时会返回明确错误。",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "complete_task":
		return Tool{
			Name:        "complete_task",
			Description: "完成工作流任务。当前后端未开放该接口，调用时会返回明确错误。",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":        map[string]interface{}{"type": "integer", "description": "任务ID"},
					"variables": map[string]interface{}{"type": "object", "description": "流程变量"},
				},
				"required": []string{"id"},
			},
		}
	case "get_default_workflow":
		return Tool{
			Name:        "get_default_workflow",
			Description: "获取当前租户默认资产流程",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "list_workflow_states":
		return Tool{
			Name:        "list_workflow_states",
			Description: "获取当前租户默认资产流程的状态列表",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "list_workflow_transitions":
		return Tool{
			Name:        "list_workflow_transitions",
			Description: "获取当前租户默认资产流程的迁移规则列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"from_state": map[string]interface{}{"type": "string", "description": "按来源状态筛选"},
				},
			},
		}
	case "apply_asset_transition":
		return Tool{
			Name:        "apply_asset_transition",
			Description: "对指定资产执行状态迁移",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_id":      map[string]interface{}{"type": "integer", "description": "资产ID"},
					"asset_code":    map[string]interface{}{"type": "string", "description": "资产编码；部分环境可替代 asset_id 使用"},
					"transition_id": map[string]interface{}{"type": "integer", "description": "迁移规则ID"},
					"reason":        map[string]interface{}{"type": "string", "description": "迁移原因"},
					"metadata":      map[string]interface{}{"type": "object", "description": "附加元数据"},
				},
				"required": []string{"transition_id"},
				"anyOf": []map[string]interface{}{
					{"required": []string{"asset_id"}},
					{"required": []string{"asset_code"}},
				},
			},
		}
	case "list_asset_workflows":
		return Tool{
			Name:        "list_asset_workflows",
			Description: "获取当前租户资产流程定义列表",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "get_asset_workflow":
		return Tool{
			Name:        "get_asset_workflow",
			Description: "获取单个资产流程定义详情",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "流程ID"},
				},
				"required": []string{"id"},
			},
		}
	case "create_asset_workflow":
		return Tool{
			Name:        "create_asset_workflow",
			Description: "创建资产流程定义",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name":        map[string]interface{}{"type": "string", "description": "流程名称"},
					"description": map[string]interface{}{"type": "string", "description": "流程描述"},
					"status":      map[string]interface{}{"type": "string", "description": "流程状态"},
					"is_default":  map[string]interface{}{"type": "boolean", "description": "是否设为默认流程"},
					"states": map[string]interface{}{
						"type":        "array",
						"description": "流程状态定义列表",
						"items":       map[string]interface{}{"type": "object"},
					},
					"transitions": map[string]interface{}{
						"type":        "array",
						"description": "流程迁移定义列表",
						"items":       map[string]interface{}{"type": "object"},
					},
				},
				"required": []string{"name"},
			},
		}
	case "update_asset_workflow":
		return Tool{
			Name:        "update_asset_workflow",
			Description: "更新资产流程定义",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":          map[string]interface{}{"type": "integer", "description": "流程ID"},
					"name":        map[string]interface{}{"type": "string", "description": "流程名称"},
					"description": map[string]interface{}{"type": "string", "description": "流程描述"},
					"status":      map[string]interface{}{"type": "string", "description": "流程状态"},
					"is_default":  map[string]interface{}{"type": "boolean", "description": "是否设为默认流程"},
					"states": map[string]interface{}{
						"type":        "array",
						"description": "流程状态定义列表",
						"items":       map[string]interface{}{"type": "object"},
					},
					"transitions": map[string]interface{}{
						"type":        "array",
						"description": "流程迁移定义列表",
						"items":       map[string]interface{}{"type": "object"},
					},
				},
				"required": []string{"id"},
			},
		}
	case "delete_asset_workflow":
		return Tool{
			Name:        "delete_asset_workflow",
			Description: "删除资产流程定义",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "流程ID"},
				},
				"required": []string{"id"},
			},
		}
	}
	return Tool{}
}
