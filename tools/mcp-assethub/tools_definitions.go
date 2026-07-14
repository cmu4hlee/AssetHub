package main

import (
	"fmt"
	"strings"
)

// Tool definition helpers for Asset management

func assetToolDefinition(name string) Tool {
	switch name {
	case "list_assets":
		return Tool{
			Name:        "list_assets",
			Description: "获取资产列表，支持分页、搜索和多种筛选条件，支持科室关键字模糊搜索",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":            map[string]interface{}{"type": "integer", "description": "页码，默认1"},
					"limit":           map[string]interface{}{"type": "integer", "description": "每页数量，默认20"},
					"keyword":         map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"asset_code":      map[string]interface{}{"type": "string", "description": "资产编号"},
					"status":          map[string]interface{}{"type": "string", "description": "资产状态：在用/维修/闲置/报废"},
					"department":      map[string]interface{}{"type": "string", "description": "科室关键字，支持模糊搜索"},
					"department_code": map[string]interface{}{"type": "string", "description": "部门代码"},
					"category_id":     map[string]interface{}{"type": "integer", "description": "资产类别ID"},
				},
			},
		}
	case "list_all_assets":
		return Tool{
			Name:        "list_all_assets",
			Description: "获取所有资产（全量查询，不分页），支持科室关键字模糊搜索",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"search":        map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"status":        map[string]interface{}{"type": "string", "description": "资产状态"},
					"department":    map[string]interface{}{"type": "string", "description": "科室关键字，支持模糊搜索"},
					"department_id": map[string]interface{}{"type": "integer", "description": "部门ID"},
					"category_id":   map[string]interface{}{"type": "integer", "description": "资产类别ID"},
					"location":      map[string]interface{}{"type": "string", "description": "存放位置"},
					"sortField":     map[string]interface{}{"type": "string", "description": "排序字段"},
					"sortOrder":     map[string]interface{}{"type": "string", "description": "排序方向：asc/desc"},
				},
			},
		}
	case "get_asset":
		return Tool{
			Name:        "get_asset",
			Description: "获取单个资产的详细信息",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":         map[string]interface{}{"type": "integer", "description": "资产ID"},
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号（与id二选一）"},
				},
				"anyOf": []map[string]interface{}{
					{"required": []string{"id"}},
					{"required": []string{"asset_code"}},
				},
			},
		}
	case "create_asset":
		return Tool{
			Name:        "create_asset",
			Description: "创建新资产",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code":         map[string]interface{}{"type": "string", "description": "资产编号（可自动生成）"},
					"asset_name":         map[string]interface{}{"type": "string", "description": "资产名称"},
					"category_id":        map[string]interface{}{"type": "integer", "description": "资产类别ID"},
					"brand":              map[string]interface{}{"type": "string", "description": "品牌"},
					"model":              map[string]interface{}{"type": "string", "description": "型号"},
					"specification":      map[string]interface{}{"type": "string", "description": "规格"},
					"purchase_date":      map[string]interface{}{"type": "string", "description": "购买日期 (YYYY-MM-DD)"},
					"purchase_price":     map[string]interface{}{"type": "number", "description": "购买价格"},
					"department_new":     map[string]interface{}{"type": "string", "description": "部门代码"},
					"location":           map[string]interface{}{"type": "string", "description": "存放位置"},
					"responsible_person": map[string]interface{}{"type": "string", "description": "责任人"},
					"status":             map[string]interface{}{"type": "string", "description": "状态"},
					"remark":             map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"asset_name", "category_id"},
			},
		}
	case "update_asset":
		return Tool{
			Name:        "update_asset",
			Description: "更新资产信息",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":                 map[string]interface{}{"type": "integer", "description": "资产ID"},
					"asset_name":         map[string]interface{}{"type": "string", "description": "资产名称"},
					"specification":      map[string]interface{}{"type": "string", "description": "规格"},
					"purchase_price":     map[string]interface{}{"type": "number", "description": "购买价格"},
					"status":             map[string]interface{}{"type": "string", "description": "状态"},
					"department_new":     map[string]interface{}{"type": "string", "description": "部门代码"},
					"location":           map[string]interface{}{"type": "string", "description": "存放位置"},
					"responsible_person": map[string]interface{}{"type": "string", "description": "责任人"},
					"remark":             map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"id"},
			},
		}
	case "delete_asset":
		return Tool{
			Name:        "delete_asset",
			Description: "删除资产",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "资产ID"},
				},
				"required": []string{"id"},
			},
		}
	case "get_asset_categories":
		return Tool{
			Name:        "get_asset_categories",
			Description: "获取资产类别列表，支持树形结构",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"tree":      map[string]interface{}{"type": "boolean", "description": "是否返回树形结构"},
					"parent_id": map[string]interface{}{"type": "integer", "description": "父类别ID"},
				},
			},
		}
	case "get_asset_statistics":
		return Tool{
			Name:        "get_asset_statistics",
			Description: "获取资产总览统计信息，包括总数、总价值、按状态/类别分布",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "get_department_statistics":
		return Tool{
			Name:        "get_department_statistics",
			Description: "获取部门资产统计信息",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "get_value_statistics":
		return Tool{
			Name:        "get_value_statistics",
			Description: "获取资产价值统计信息，包括原值、现值、均值等；不等于折旧统计",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	}
	return Tool{}
}

func depreciationToolDefinition(name string) Tool {
	switch name {
	case "list_depreciation":
		return Tool{
			Name:        "list_depreciation",
			Description: "获取资产折旧列表与折旧汇总，支持筛选、分页和计算参数",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": depreciationFilterProperties(true),
			},
		}
	case "get_depreciation_detail":
		return Tool{
			Name:        "get_depreciation_detail",
			Description: "获取单个资产的折旧详情",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":            map[string]interface{}{"type": "integer", "description": "资产ID"},
					"method":        map[string]interface{}{"type": "string", "description": "折旧方法"},
					"as_of_date":    map[string]interface{}{"type": "string", "description": "截止日期 (YYYY-MM-DD)"},
					"residual_rate": map[string]interface{}{"type": "number", "description": "残值率"},
				},
				"required": []string{"id"},
			},
		}
	case "get_depreciation_summary_by_department":
		return Tool{
			Name:        "get_depreciation_summary_by_department",
			Description: "按部门汇总折旧数据",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": depreciationFilterProperties(false),
			},
		}
	case "get_depreciation_summary_by_type":
		return Tool{
			Name:        "get_depreciation_summary_by_type",
			Description: "按类型汇总折旧数据",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": depreciationFilterProperties(false),
			},
		}
	case "get_depreciation_summary_by_month":
		return Tool{
			Name:        "get_depreciation_summary_by_month",
			Description: "按月份查看折旧趋势",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"months":           map[string]interface{}{"type": "integer", "description": "最近月份数，默认12"},
					"keyword":          map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"status":           map[string]interface{}{"type": "string", "description": "资产状态"},
					"department":       map[string]interface{}{"type": "string", "description": "科室关键字"},
					"department_id":    map[string]interface{}{"type": "integer", "description": "部门ID"},
					"category_id":      map[string]interface{}{"type": "integer", "description": "资产类别ID"},
					"asset_type":       map[string]interface{}{"type": "string", "description": "资产类型"},
					"method":           map[string]interface{}{"type": "string", "description": "折旧方法"},
					"as_of_date":       map[string]interface{}{"type": "string", "description": "截止日期 (YYYY-MM-DD)"},
					"residual_rate":    map[string]interface{}{"type": "number", "description": "残值率"},
					"include_disposed": map[string]interface{}{"type": "boolean", "description": "是否包含报废/删除资产"},
					"exclude_statuses": map[string]interface{}{"type": "string", "description": "排除状态，逗号分隔"},
				},
			},
		}
	}
	return Tool{}
}

func assetLifecycleToolDefinition(name string) Tool {
	switch name {
	case "get_asset_change_logs":
		return Tool{
			Name:        "get_asset_change_logs",
			Description: "获取资产修改日志",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "资产ID"},
				},
				"required": []string{"id"},
			},
		}
	case "list_idle_assets":
		return Tool{
			Name:        "list_idle_assets",
			Description: "获取闲置资产列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":        map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":       map[string]interface{}{"type": "integer", "description": "每页数量"},
					"keyword":     map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"category_id": map[string]interface{}{"type": "integer", "description": "资产类别ID"},
				},
			},
		}
	case "publish_idle_asset":
		return Tool{
			Name:        "publish_idle_asset",
			Description: "发布闲置资产",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code":     map[string]interface{}{"type": "string", "description": "资产编号"},
					"publish_person": map[string]interface{}{"type": "string", "description": "发布人"},
					"publish_date":   map[string]interface{}{"type": "string", "description": "发布日期"},
					"remark":         map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"asset_code"},
			},
		}
	case "allocate_idle_asset":
		return Tool{
			Name:        "allocate_idle_asset",
			Description: "调配闲置资产",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":                map[string]interface{}{"type": "integer", "description": "闲置资产ID"},
					"target_department": map[string]interface{}{"type": "string", "description": "目标部门"},
					"allocate_date":     map[string]interface{}{"type": "string", "description": "调配日期"},
					"comment":           map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"id"},
			},
		}
	case "cancel_idle_asset":
		return Tool{
			Name:        "cancel_idle_asset",
			Description: "取消闲置资产发布",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "闲置资产ID"},
				},
				"required": []string{"id"},
			},
		}
	}
	return Tool{}
}

func depreciationFilterProperties(includePagination bool) map[string]interface{} {
	properties := map[string]interface{}{
		"keyword":             map[string]interface{}{"type": "string", "description": "搜索关键词"},
		"status":              map[string]interface{}{"type": "string", "description": "资产状态"},
		"department":          map[string]interface{}{"type": "string", "description": "科室关键字"},
		"department_id":       map[string]interface{}{"type": "integer", "description": "部门ID"},
		"category_id":         map[string]interface{}{"type": "integer", "description": "资产类别ID"},
		"asset_type":          map[string]interface{}{"type": "string", "description": "资产类型"},
		"purchase_date_start": map[string]interface{}{"type": "string", "description": "购置日期开始 (YYYY-MM-DD)"},
		"purchase_date_end":   map[string]interface{}{"type": "string", "description": "购置日期结束 (YYYY-MM-DD)"},
		"method":              map[string]interface{}{"type": "string", "description": "折旧方法"},
		"as_of_date":          map[string]interface{}{"type": "string", "description": "截止日期 (YYYY-MM-DD)"},
		"residual_rate":       map[string]interface{}{"type": "number", "description": "残值率"},
		"include_disposed":    map[string]interface{}{"type": "boolean", "description": "是否包含报废/删除资产"},
		"exclude_statuses":    map[string]interface{}{"type": "string", "description": "排除状态，逗号分隔"},
	}

	if includePagination {
		properties["page"] = map[string]interface{}{"type": "integer", "description": "页码，默认1"}
		properties["pageSize"] = map[string]interface{}{"type": "integer", "description": "每页数量，默认20"}
	}

	return properties
}

// Input validation functions for security

// validateStringLength checks string length limits
func validateStringLength(s string, maxLen int, fieldName string) error {
	if len(s) > maxLen {
		return fmt.Errorf("%s exceeds maximum length of %d characters", fieldName, maxLen)
	}
	return nil
}

// sanitizeInput removes potentially dangerous characters from user input
func sanitizeInput(s string) string {
	// Remove null bytes
	s = strings.ReplaceAll(s, "\x00", "")
	// Trim excessive whitespace
	s = strings.TrimSpace(s)
	// Remove potential SQL injection patterns (defense in depth)
	dangerous := []string{"';--", "\";--", "/*", "*/", "@@", "char(", "nchar(", "varchar(", "nvarchar(", "alter ", "begin ", "cast(", "create ", "cursor ", "declare ", "delete ", "drop ", "end ", "exec(", "execute(", "fetch ", "insert(", "kill(", "open(", "select ", "sys.", "sysobjects", "syscolumns", "table(", "update(", "xp_"}
	for _, pattern := range dangerous {
		if strings.Contains(strings.ToLower(s), pattern) {
			s = strings.ReplaceAll(s, pattern, "[FILTERED]")
		}
	}
	return s
}

// validatePagination checks pagination parameters are within safe limits
func validatePagination(page, limit int) (int, int, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 500 {
		limit = 500 // Cap to prevent excessive data retrieval
	}
	return page, limit, nil
}

// validateAssetCode validates asset code format
func validateAssetCode(code string) error {
	if err := validateStringLength(code, 100, "asset_code"); err != nil {
		return err
	}
	// Asset codes should be alphanumeric with hyphens/underscores
	for _, c := range code {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_') {
			return fmt.Errorf("asset_code contains invalid characters")
		}
	}
	return nil
}

// validateKeyword validates search keyword input
func validateKeyword(keyword string) (string, error) {
	if err := validateStringLength(keyword, 200, "keyword"); err != nil {
		return "", err
	}
	return sanitizeInput(keyword), nil
}

// validateDateFormat validates date string format (YYYY-MM-DD)
func validateDateFormat(dateStr, fieldName string) error {
	if dateStr == "" {
		return nil // Optional field
	}
	if len(dateStr) != 10 {
		return fmt.Errorf("%s must be in YYYY-MM-DD format", fieldName)
	}
	// Basic format check
	if dateStr[4] != '-' || dateStr[7] != '-' {
		return fmt.Errorf("%s must be in YYYY-MM-DD format", fieldName)
	}
	return nil
}
