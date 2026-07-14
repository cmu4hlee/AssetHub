package main

// Tool definition helpers for Intelligent Analytics and Document Management

func analyticsToolDefinition(name string) Tool {
	switch name {
	case "get_ai_maintenance_prediction":
		return Tool{
			Name:        "get_ai_maintenance_prediction",
			Description: "获取AI维修预测",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"days_ahead": map[string]interface{}{"type": "integer", "description": "预测天数"},
				},
			},
		}
	case "get_ai_failure_analysis":
		return Tool{
			Name:        "get_ai_failure_analysis",
			Description: "获取AI故障分析",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"start_date": map[string]interface{}{"type": "string", "description": "开始日期"},
					"end_date":   map[string]interface{}{"type": "string", "description": "结束日期"},
				},
			},
		}
	case "get_asset_risk_assessment":
		return Tool{
			Name:        "get_asset_risk_assessment",
			Description: "获取资产风险评估列表，可按资产编号、部门、风险等级筛选",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"department": map[string]interface{}{"type": "string", "description": "部门"},
					"keyword":    map[string]interface{}{"type": "string", "description": "关键词，匹配资产编号或资产名称"},
					"risk_level": map[string]interface{}{"type": "string", "description": "风险等级"},
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
				},
			},
		}
	case "get_high_risk_assets":
		return Tool{
			Name:        "get_high_risk_assets",
			Description: "获取高风险资产列表；未指定 risk_level 时默认返回 high 和 critical",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"risk_level": map[string]interface{}{"type": "string", "description": "风险等级"},
					"department": map[string]interface{}{"type": "string", "description": "部门"},
					"keyword":    map[string]interface{}{"type": "string", "description": "关键词，匹配资产编号或资产名称"},
				},
			},
		}
	case "get_risk_dashboard":
		return Tool{
			Name:        "get_risk_dashboard",
			Description: "获取风险管理仪表盘统计",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "list_risk_controls":
		return Tool{
			Name:        "list_risk_controls",
			Description: "获取风险控制措施列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":   map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":  map[string]interface{}{"type": "integer", "description": "每页数量"},
					"status": map[string]interface{}{"type": "string", "description": "状态筛选"},
				},
			},
		}
	case "update_risk_control":
		return Tool{
			Name:        "update_risk_control",
			Description: "更新风险控制措施",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":                  map[string]interface{}{"type": "integer", "description": "风险控制ID"},
					"assessment_id":       map[string]interface{}{"type": "integer", "description": "关联风险评估ID"},
					"control_code":        map[string]interface{}{"type": "string", "description": "控制编号"},
					"control_name":        map[string]interface{}{"type": "string", "description": "控制名称"},
					"control_type":        map[string]interface{}{"type": "string", "description": "控制类型"},
					"risk_level":          map[string]interface{}{"type": "string", "description": "风险等级"},
					"control_description": map[string]interface{}{"type": "string", "description": "控制说明"},
					"planned_end_date":    map[string]interface{}{"type": "string", "description": "计划完成日期 (YYYY-MM-DD)"},
					"actual_end_date":     map[string]interface{}{"type": "string", "description": "实际完成日期 (YYYY-MM-DD)"},
					"responsible_person":  map[string]interface{}{"type": "string", "description": "责任人"},
					"status":              map[string]interface{}{"type": "string", "description": "状态"},
					"progress":            map[string]interface{}{"type": "integer", "description": "进度百分比"},
					"remarks":             map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"id"},
			},
		}
	case "get_predictive_maintenance":
		return Tool{
			Name:        "get_predictive_maintenance",
			Description: "获取预测性维护计划",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"department":  map[string]interface{}{"type": "string", "description": "部门"},
					"category_id": map[string]interface{}{"type": "integer", "description": "资产类别ID"},
					"days_ahead":  map[string]interface{}{"type": "integer", "description": "计划天数"},
				},
			},
		}
	case "get_asset_health_index":
		return Tool{
			Name:        "get_asset_health_index",
			Description: "获取资产健康指数",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
				},
			},
		}
	case "get_department_health_overview":
		return Tool{
			Name:        "get_department_health_overview",
			Description: "获取部门健康概览",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"department": map[string]interface{}{"type": "string", "description": "部门"},
				},
			},
		}
	}
	return Tool{}
}

func documentToolDefinition(name string) Tool {
	switch name {
	case "list_documents":
		return Tool{
			Name:        "list_documents",
			Description: "获取技术文档列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":     map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":    map[string]interface{}{"type": "integer", "description": "每页数量"},
					"keyword":  map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"doc_type": map[string]interface{}{"type": "string", "description": "文档类型"},
					"category": map[string]interface{}{"type": "string", "description": "分类"},
					"status":   map[string]interface{}{"type": "string", "description": "状态"},
				},
			},
		}
	case "get_document":
		return Tool{
			Name:        "get_document",
			Description: "获取文档详情",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "文档ID"},
				},
				"required": []string{"id"},
			},
		}
	case "upload_document":
		return Tool{
			Name:        "upload_document",
			Description: "上传技术文档",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"title":       map[string]interface{}{"type": "string", "description": "文档标题"},
					"doc_type":    map[string]interface{}{"type": "string", "description": "文档类型"},
					"category":    map[string]interface{}{"type": "string", "description": "分类"},
					"description": map[string]interface{}{"type": "string", "description": "文档描述"},
					"file_url":    map[string]interface{}{"type": "string", "description": "文件URL"},
					"asset_code":  map[string]interface{}{"type": "string", "description": "关联资产编号"},
				},
				"required": []string{"title"},
			},
		}
	case "review_document":
		return Tool{
			Name:        "review_document",
			Description: "审核文档",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":            map[string]interface{}{"type": "integer", "description": "文档ID"},
					"review_status": map[string]interface{}{"type": "string", "description": "审核状态：approved/rejected"},
					"action":        map[string]interface{}{"type": "string", "description": "兼容旧参数：approve/reject"},
					"comment":       map[string]interface{}{"type": "string", "description": "审核意见"},
				},
				"allOf": []map[string]interface{}{
					map[string]interface{}{"required": []string{"id"}},
				},
				"anyOf": []map[string]interface{}{
					map[string]interface{}{"required": []string{"review_status"}},
					map[string]interface{}{"required": []string{"action"}},
				},
			},
		}
	case "list_document_tags":
		return Tool{
			Name:        "list_document_tags",
			Description: "获取技术文档标签列表",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "create_document_tag":
		return Tool{
			Name:        "create_document_tag",
			Description: "创建技术文档标签",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"tag_name":  map[string]interface{}{"type": "string", "description": "标签名称"},
					"tag_color": map[string]interface{}{"type": "string", "description": "标签颜色"},
				},
				"required": []string{"tag_name"},
			},
		}
	case "delete_document_tag":
		return Tool{
			Name:        "delete_document_tag",
			Description: "删除技术文档标签",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "标签ID"},
				},
				"required": []string{"id"},
			},
		}
	case "update_document_tags":
		return Tool{
			Name:        "update_document_tags",
			Description: "更新文档关联标签",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "文档ID"},
					"tag_ids": map[string]interface{}{
						"type":        "array",
						"description": "标签ID列表",
						"items":       map[string]interface{}{"type": "integer"},
					},
				},
				"required": []string{"id", "tag_ids"},
			},
		}
	case "list_document_versions":
		return Tool{
			Name:        "list_document_versions",
			Description: "获取文档版本列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "文档ID"},
				},
				"required": []string{"id"},
			},
		}
	case "create_document_version":
		return Tool{
			Name:        "create_document_version",
			Description: "创建文档版本记录",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":             map[string]interface{}{"type": "integer", "description": "文档ID"},
					"version_number": map[string]interface{}{"type": "string", "description": "版本号"},
					"change_log":     map[string]interface{}{"type": "string", "description": "变更日志"},
					"file_path":      map[string]interface{}{"type": "string", "description": "文件路径"},
					"file_size":      map[string]interface{}{"type": "integer", "description": "文件大小"},
					"file_hash":      map[string]interface{}{"type": "string", "description": "文件哈希"},
				},
				"required": []string{"id", "version_number"},
			},
		}
	case "favorite_document":
		return Tool{
			Name:        "favorite_document",
			Description: "收藏技术文档",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "文档ID"},
				},
				"required": []string{"id"},
			},
		}
	case "unfavorite_document":
		return Tool{
			Name:        "unfavorite_document",
			Description: "取消收藏技术文档",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "文档ID"},
				},
				"required": []string{"id"},
			},
		}
	case "list_favorite_documents":
		return Tool{
			Name:        "list_favorite_documents",
			Description: "获取当前用户收藏的技术文档列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":  map[string]interface{}{"type": "integer", "description": "页码"},
					"limit": map[string]interface{}{"type": "integer", "description": "每页数量"},
				},
			},
		}
	case "list_document_comments":
		return Tool{
			Name:        "list_document_comments",
			Description: "获取文档评论列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":       map[string]interface{}{"type": "integer", "description": "文档ID"},
					"resolved": map[string]interface{}{"type": "boolean", "description": "是否仅查看已解决评论"},
				},
				"required": []string{"id"},
			},
		}
	case "create_document_comment":
		return Tool{
			Name:        "create_document_comment",
			Description: "创建文档评论",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":        map[string]interface{}{"type": "integer", "description": "文档ID"},
					"content":   map[string]interface{}{"type": "string", "description": "评论内容"},
					"parent_id": map[string]interface{}{"type": "integer", "description": "父评论ID"},
				},
				"required": []string{"id", "content"},
			},
		}
	case "resolve_document_comment":
		return Tool{
			Name:        "resolve_document_comment",
			Description: "将文档评论标记为已解决",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "评论ID"},
				},
				"required": []string{"id"},
			},
		}
	case "list_document_templates":
		return Tool{
			Name:        "list_document_templates",
			Description: "获取技术文档模板列表",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "create_document_template":
		return Tool{
			Name:        "create_document_template",
			Description: "创建技术文档模板",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"template_name":        map[string]interface{}{"type": "string", "description": "模板名称"},
					"template_description": map[string]interface{}{"type": "string", "description": "模板描述"},
					"category_id":          map[string]interface{}{"type": "integer", "description": "分类ID"},
					"template_fields":      map[string]interface{}{"type": "object", "description": "模板字段配置"},
				},
				"required": []string{"template_name"},
			},
		}
	case "delete_document_template":
		return Tool{
			Name:        "delete_document_template",
			Description: "删除技术文档模板",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "模板ID"},
				},
				"required": []string{"id"},
			},
		}
	case "batch_delete_documents":
		return Tool{
			Name:        "batch_delete_documents",
			Description: "批量删除技术文档",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"document_ids": map[string]interface{}{
						"type":        "array",
						"description": "文档ID列表",
						"items":       map[string]interface{}{"type": "integer"},
					},
				},
				"required": []string{"document_ids"},
			},
		}
	case "batch_update_document_category":
		return Tool{
			Name:        "batch_update_document_category",
			Description: "批量更新技术文档分类",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"document_ids": map[string]interface{}{
						"type":        "array",
						"description": "文档ID列表",
						"items":       map[string]interface{}{"type": "integer"},
					},
					"category_id": map[string]interface{}{"type": "integer", "description": "目标分类ID"},
				},
				"required": []string{"document_ids", "category_id"},
			},
		}
	case "create_document_share":
		return Tool{
			Name:        "create_document_share",
			Description: "为技术文档创建外部上传分享链接",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":               map[string]interface{}{"type": "integer", "description": "文档ID"},
					"expires_days":     map[string]interface{}{"type": "integer", "description": "有效天数"},
					"max_uploads":      map[string]interface{}{"type": "integer", "description": "最大上传次数"},
					"remark":           map[string]interface{}{"type": "string", "description": "备注"},
					"supplier_name":    map[string]interface{}{"type": "string", "description": "供应商名称"},
					"supplier_contact": map[string]interface{}{"type": "string", "description": "供应商联系方式"},
				},
				"required": []string{"id"},
			},
		}
	case "list_document_shares":
		return Tool{
			Name:        "list_document_shares",
			Description: "获取文档分享链接列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "文档ID"},
				},
				"required": []string{"id"},
			},
		}
	case "delete_document_share":
		return Tool{
			Name:        "delete_document_share",
			Description: "删除文档分享链接",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"share_id": map[string]interface{}{"type": "integer", "description": "分享链接ID"},
				},
				"required": []string{"share_id"},
			},
		}
	}
	return Tool{}
}

func assetLabelToolDefinition(name string) Tool {
	switch name {
	case "list_asset_labels":
		return Tool{
			Name:        "list_asset_labels",
			Description: "获取资产标签列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":    map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":   map[string]interface{}{"type": "integer", "description": "每页数量"},
					"keyword": map[string]interface{}{"type": "string", "description": "搜索关键词"},
				},
			},
		}
	case "create_asset_label":
		return Tool{
			Name:        "create_asset_label",
			Description: "创建资产标签",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name":        map[string]interface{}{"type": "string", "description": "标签名称"},
					"color":       map[string]interface{}{"type": "string", "description": "颜色"},
					"description": map[string]interface{}{"type": "string", "description": "描述"},
				},
				"required": []string{"name"},
			},
		}
	case "assign_asset_label":
		return Tool{
			Name:        "assign_asset_label",
			Description: "为资产分配标签",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"label_id":   map[string]interface{}{"type": "integer", "description": "标签ID"},
				},
				"required": []string{"asset_code", "label_id"},
			},
		}
	}
	return Tool{}
}
