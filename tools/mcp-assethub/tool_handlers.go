package main

import (
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
)

func requireSuperAdmin(client *AssetHubClient) error {
	if client.Role != "super_admin" {
		return fmt.Errorf("此操作仅限超级管理员执行，当前角色: %s", client.Role)
	}
	return nil
}

func requireAdmin(client *AssetHubClient) error {
	if client.Role != "super_admin" && client.Role != "system_admin" {
		return fmt.Errorf("此操作仅限管理员执行，当前角色: %s", client.Role)
	}
	return nil
}

func requireTenantContext(client *AssetHubClient) error {
	if client.TenantID <= 0 {
		return fmt.Errorf("此操作需要指定租户上下文(tenant_id)，当前未选择企业空间")
	}
	return nil
}

// listAssets retrieves asset list
func listAssets(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	// Validate and sanitize pagination
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}
	args["page"] = page
	args["limit"] = limit

	// Sanitize keyword input
	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		args["keyword"] = sanitized
	}

	// Sanitize department keyword
	if v, ok := args["department"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		args["department"] = sanitized
	}

	params := buildQueryParams(args)
	path := "/assets" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	// Extract department keyword for client-side filtering
	deptKeyword := ""
	if v, ok := args["department"].(string); ok && v != "" {
		deptKeyword = strings.ToLower(v)
	}

	// Try new format first (data.list structure) using raw maps to tolerate nullable/mixed fields.
	var apiRespList struct {
		Success bool `json:"success"`
		Data    struct {
			List       []map[string]interface{} `json:"list"`
			Pagination Pagination               `json:"pagination"`
		} `json:"data"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(respBody, &apiRespList); err == nil && apiRespList.Success {
		assets := make([]Asset, 0, len(apiRespList.Data.List))
		for _, raw := range apiRespList.Data.List {
			assets = append(assets, parseAsset(raw))
		}
		// Client-side department filtering
		if deptKeyword != "" {
			assets = filterAssetsByDepartment(assets, deptKeyword)
		}
		return map[string]interface{}{
			"data":       assets,
			"pagination": apiRespList.Data.Pagination,
			"message":    apiRespList.Message,
		}, nil
	}

	// Fallback to old format (direct array)
	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var assets []Asset
	if err := json.Unmarshal(apiResp.Data, &assets); err != nil {
		return nil, fmt.Errorf("failed to parse assets: %w", err)
	}

	// Client-side department filtering
	if deptKeyword != "" {
		assets = filterAssetsByDepartment(assets, deptKeyword)
	}

	return map[string]interface{}{
		"data":       assets,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

// filterAssetsByDepartment filters assets by department name (case-insensitive partial match)
func filterAssetsByDepartment(assets []Asset, keyword string) []Asset {
	var filtered []Asset
	for _, asset := range assets {
		// Match department, department_new, department_new_name fields
		if containsIgnoreCase(asset.Department, keyword) ||
			containsIgnoreCase(asset.DepartmentNew, keyword) ||
			containsIgnoreCase(asset.DepartmentNewName, keyword) {
			filtered = append(filtered, asset)
		}
	}
	return filtered
}

// containsIgnoreCase checks if s contains substr (case-insensitive)
func containsIgnoreCase(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}

// listAllAssets retrieves all assets without pagination
func listAllAssets(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := buildQueryParams(args)
	path := "/assets/all" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Parse as array of maps to handle dynamic field types
	var rawAssets []map[string]interface{}
	if err := json.Unmarshal(apiResp.Data, &rawAssets); err != nil {
		return nil, fmt.Errorf("failed to parse assets: %w", err)
	}

	// Convert to Asset structs with type coercion
	assets := make([]Asset, 0, len(rawAssets))
	for _, raw := range rawAssets {
		asset := parseAsset(raw)
		assets = append(assets, asset)
	}

	// Extract department keyword for client-side filtering
	deptKeyword := ""
	if v, ok := args["department"].(string); ok && v != "" {
		deptKeyword = strings.ToLower(v)
	}

	// Client-side department filtering
	if deptKeyword != "" {
		assets = filterAssetsByDepartment(assets, deptKeyword)
	}

	return map[string]interface{}{
		"data":    assets,
		"total":   len(assets),
		"message": apiResp.Message,
	}, nil
}

// parseAsset converts a map to Asset with type coercion
func parseAsset(raw map[string]interface{}) Asset {
	asset := Asset{}

	if v, ok := raw["id"].(float64); ok {
		asset.ID = int(v)
	}
	if v, ok := raw["tenant_id"].(float64); ok {
		asset.TenantID = int(v)
	}
	if v, ok := raw["asset_code"].(string); ok {
		asset.AssetCode = v
	}
	if v, ok := raw["asset_name"].(string); ok {
		asset.AssetName = v
	}
	if v, ok := raw["category_id"].(float64); ok {
		asset.CategoryID = int(v)
	}
	if v, ok := raw["category_secondary_id"].(float64); ok {
		asset.CategorySecondaryID = int(v)
	}
	if v, ok := raw["category_name"].(string); ok {
		asset.CategoryName = v
	}
	if v, ok := raw["category_secondary_name"].(string); ok {
		asset.CategorySecondaryName = v
	}
	if v, ok := raw["brand"].(string); ok {
		asset.Brand = v
	}
	if v, ok := raw["model"].(string); ok {
		asset.Model = v
	}
	if v, ok := raw["specification"].(string); ok {
		asset.Specification = v
	}
	if v, ok := raw["purchase_date"].(string); ok {
		asset.PurchaseDate = v
	}
	// Handle purchase_price as string or number
	switch v := raw["purchase_price"].(type) {
	case string:
		asset.PurchasePrice = v
	case float64:
		asset.PurchasePrice = fmt.Sprintf("%v", v)
	}
	if v, ok := raw["current_value"].(string); ok {
		asset.CurrentValue = v
	}
	if v, ok := raw["location"].(string); ok {
		asset.Location = v
	}
	if v, ok := raw["department"].(string); ok {
		asset.Department = v
	}
	if v, ok := raw["department_new"].(string); ok {
		asset.DepartmentNew = v
	}
	if v, ok := raw["department_new_name"].(string); ok {
		asset.DepartmentNewName = v
	}
	if v, ok := raw["use_department"].(string); ok {
		asset.UseDepartment = v
	}
	if v, ok := raw["unit"].(string); ok {
		asset.Unit = v
	}
	if v, ok := raw["responsible_person"].(string); ok {
		asset.ResponsiblePerson = v
	}
	if v, ok := raw["responsible_person_name"].(string); ok {
		asset.ResponsiblePersonName = v
	}
	if v, ok := raw["status"].(string); ok {
		asset.Status = v
	}
	if v, ok := raw["supplier"].(string); ok {
		asset.Supplier = v
	}
	if v, ok := raw["warranty_period"].(string); ok {
		asset.WarrantyPeriod = v
	}
	if v, ok := raw["warranty_end_date"].(string); ok {
		asset.WarrantyEndDate = v
	}
	if v, ok := raw["remark"].(string); ok {
		asset.Remark = v
	}
	if v, ok := raw["created_at"].(string); ok {
		asset.CreatedAt = v
	}
	if v, ok := raw["updated_at"].(string); ok {
		asset.UpdatedAt = v
	}
	if v, ok := raw["created_by"].(string); ok {
		asset.CreatedBy = v
	}
	if v, ok := raw["updated_by"].(string); ok {
		asset.UpdatedBy = v
	}
	if v, ok := raw["asset_department_code"].(string); ok {
		asset.AssetDepartmentCode = v
	}

	return asset
}

// getAsset retrieves a single asset by ID or asset_code
func getAsset(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	// Support both id and asset_code
	var idOrCode string
	if v, ok := args["id"].(float64); ok {
		idOrCode = strconv.FormatFloat(v, 'f', 0, 64)
	} else if v, ok := args["asset_code"].(string); ok && v != "" {
		idOrCode = v
	} else {
		return nil, fmt.Errorf("id or asset_code is required")
	}

	path := fmt.Sprintf("/assets/%s", idOrCode)
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var asset Asset
	if err := json.Unmarshal(apiResp.Data, &asset); err != nil {
		return nil, fmt.Errorf("failed to parse asset: %w", err)
	}

	return asset, nil
}

// createAsset creates a new asset
func createAsset(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	assetData := make(map[string]interface{})

	// Required fields - validate and sanitize
	if v, ok := args["asset_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "asset_name"); err != nil {
			return nil, err
		}
		assetData["asset_name"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("asset_name is required")
	}
	if v, ok := args["category_id"].(float64); ok {
		assetData["category_id"] = int(v)
	} else {
		return nil, fmt.Errorf("category_id is required")
	}

	// Optional fields - asset_code can be auto-generated if not provided
	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		assetData["asset_code"] = v
	}

	// Optional string fields - validate and sanitize
	stringFields := []string{
		"brand", "model", "specification", "purchase_date",
		"department_new", "location", "responsible_person",
		"status", "remark",
	}
	for _, field := range stringFields {
		if v, ok := args[field].(string); ok && v != "" {
			if err := validateStringLength(v, 500, field); err != nil {
				return nil, err
			}
			assetData[field] = sanitizeInput(v)
		}
	}

	// Validate purchase_date format
	if v, ok := args["purchase_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "purchase_date"); err != nil {
			return nil, err
		}
	}

	// Optional number fields
	if v, ok := args["purchase_price"].(float64); ok {
		// Validate price is positive and within reasonable bounds
		if v < 0 || v > 1e12 {
			return nil, fmt.Errorf("purchase_price out of valid range")
		}
		assetData["purchase_price"] = v
	}

	respBody, err := client.doRequest("POST", "/assets", assetData)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}, nil
}

// updateAsset updates an existing asset
func updateAsset(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	updateData := make(map[string]interface{})
	// Include all provided fields except id
	for k, v := range args {
		if k != "id" {
			updateData[k] = v
		}
	}

	path := fmt.Sprintf("/assets/%d", int(id))
	respBody, err := client.doRequest("PUT", path, updateData)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// deleteAsset deletes an asset
func deleteAsset(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	path := fmt.Sprintf("/assets/%d", int(id))
	respBody, err := client.doRequest("DELETE", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// getAssetCategories retrieves asset categories
func getAssetCategories(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := ""
	if tree, ok := args["tree"].(bool); ok && tree {
		params = "?tree=true"
	} else if parentID, ok := args["parent_id"].(float64); ok {
		params = fmt.Sprintf("?parent_id=%d", int(parentID))
	}

	path := "/assets/categories" + params
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

// getAssetStatistics retrieves asset statistics overview
func getAssetStatistics(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	respBody, err := client.doRequest("GET", "/assets/statistics/overview", nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	stats, err := parseStatisticsResponse(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to parse statistics: %w", err)
	}

	return stats, nil
}

func parseStatisticsResponse(raw json.RawMessage) (Statistics, error) {
	var payload map[string]json.RawMessage
	if err := json.Unmarshal(raw, &payload); err != nil {
		return Statistics{}, err
	}

	if _, hasOverview := payload["overview"]; hasOverview {
		var wrapped StatisticsResponse
		if err := json.Unmarshal(raw, &wrapped); err != nil {
			return Statistics{}, err
		}

		stats := Statistics{
			TotalAssets: wrapped.Overview.TotalAssets,
			TotalValue:  wrapped.Overview.TotalValue,
			ByStatus:    wrapped.ByStatus,
			ByCategory:  wrapped.ByCategory,
		}

		if stats.TotalAssets == 0 && wrapped.TotalAssets > 0 {
			stats.TotalAssets = wrapped.TotalAssets
		}
		if stats.TotalValue == "" {
			stats.TotalValue = wrapped.ValueSummary.TotalPurchaseValue
		}
		if stats.TotalValue == "" {
			stats.TotalValue = wrapped.ValueSummary.TotalCurrentValue
		}

		return stats, nil
	}

	var stats Statistics
	if err := json.Unmarshal(raw, &stats); err != nil {
		return Statistics{}, err
	}

	return stats, nil
}

// getDepartmentStatistics retrieves department asset statistics
func getDepartmentStatistics(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	respBody, err := client.doRequest("GET", "/assets/statistics/by-department", nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var stats []DepartmentStat
	if err := json.Unmarshal(apiResp.Data, &stats); err != nil {
		return nil, fmt.Errorf("failed to parse department statistics: %w", err)
	}

	return stats, nil
}

// getValueStatistics retrieves asset value statistics
func getValueStatistics(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	respBody, err := client.doRequest("GET", "/assets/statistics/overview", nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	stats, err := parseValueStatisticsResponse(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to parse value statistics: %w", err)
	}

	return stats, nil
}

func parseValueStatisticsResponse(raw json.RawMessage) (map[string]interface{}, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}

	if valueSummary, ok := payload["value_summary"].(map[string]interface{}); ok {
		return valueSummary, nil
	}

	return payload, nil
}

func listDepreciation(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["pageSize"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}
	args["page"] = page
	args["pageSize"] = limit

	params := buildQueryParams(args)
	respBody, err := client.doRequest("GET", "/depreciation"+params, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var data map[string]interface{}
	if err := json.Unmarshal(apiResp.Data, &data); err != nil {
		return nil, fmt.Errorf("failed to parse depreciation list: %w", err)
	}

	return data, nil
}

func getDepreciationDetail(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	queryArgs := map[string]interface{}{}
	for _, field := range []string{"method", "as_of_date", "residual_rate"} {
		if value, exists := args[field]; exists {
			queryArgs[field] = value
		}
	}

	params := buildQueryParams(queryArgs)
	path := fmt.Sprintf("/depreciation/%d%s", int(id), params)
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var data map[string]interface{}
	if err := json.Unmarshal(apiResp.Data, &data); err != nil {
		return nil, fmt.Errorf("failed to parse depreciation detail: %w", err)
	}

	return data, nil
}

func getDepreciationSummaryByDepartment(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return getDepreciationSummary(client, args, "/depreciation/summary/by-department", "department depreciation summary")
}

func getDepreciationSummaryByType(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return getDepreciationSummary(client, args, "/depreciation/summary/by-type", "type depreciation summary")
}

func getDepreciationSummaryByMonth(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return getDepreciationSummary(client, args, "/depreciation/summary/by-month", "monthly depreciation summary")
}

func getDepreciationSummary(client *AssetHubClient, args map[string]interface{}, path string, label string) (interface{}, error) {
	params := buildQueryParams(args)
	respBody, err := client.doRequest("GET", path+params, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var data map[string]interface{}
	if err := json.Unmarshal(apiResp.Data, &data); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", label, err)
	}

	return data, nil
}

// getAssetChangeLogs retrieves asset change logs
func getAssetChangeLogs(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	path := fmt.Sprintf("/assets/%d/change-logs", int(id))
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var logs []AssetChangeLog
	if err := json.Unmarshal(apiResp.Data, &logs); err != nil {
		return nil, fmt.Errorf("failed to parse change logs: %w", err)
	}

	return logs, nil
}

// listIdleAssets retrieves idle assets
func listIdleAssets(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := buildQueryParams(args)
	path := "/idle" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var assets []IdleAsset
	if err := json.Unmarshal(apiResp.Data, &assets); err != nil {
		return nil, fmt.Errorf("failed to parse idle assets: %w", err)
	}

	return map[string]interface{}{
		"data":       assets,
		"pagination": apiResp.Pagination,
	}, nil
}

// publishIdleAsset publishes an asset as idle
func publishIdleAsset(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["asset_code"].(string); ok && v != "" {
		req["asset_code"] = v
	} else {
		return nil, fmt.Errorf("asset_code is required")
	}

	if v, ok := args["publish_person"].(string); ok {
		req["publish_person"] = v
	}
	if v, ok := args["publish_date"].(string); ok {
		req["publish_date"] = v
	}
	if v, ok := args["remark"].(string); ok {
		req["remark"] = v
	}

	respBody, err := client.doRequest("POST", "/idle", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// allocateIdleAsset allocates an idle asset to a department
func allocateIdleAsset(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	req := make(map[string]interface{})
	if v, ok := args["target_department"].(string); ok {
		req["target_department"] = v
	}
	if v, ok := args["allocate_date"].(string); ok {
		req["allocate_date"] = v
	}
	if v, ok := args["comment"].(string); ok {
		req["comment"] = v
	}

	path := fmt.Sprintf("/idle/%d/allocate", int(id))
	respBody, err := client.doRequest("PUT", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// cancelIdleAsset cancels idle asset publication
func cancelIdleAsset(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	path := fmt.Sprintf("/idle/%d/cancel", int(id))
	respBody, err := client.doRequest("PUT", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// transferAsset applies for asset transfer
func transferAsset(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})
	var assetCode string

	// Validate and sanitize asset_code
	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		assetCode = v
	} else {
		return nil, fmt.Errorf("asset_code is required")
	}

	// Validate and sanitize target_department
	if v, ok := args["target_department"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "target_department"); err != nil {
			return nil, err
		}
		req["target_department"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("target_department is required")
	}

	// Validate and sanitize reason
	if v, ok := args["reason"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "reason"); err != nil {
			return nil, err
		}
		req["reason"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("reason is required")
	}

	// transfer_date is kept as an optional compatibility field.
	if v, ok := args["transfer_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "transfer_date"); err != nil {
			return nil, err
		}
		req["transfer_date"] = v
	}

	path := fmt.Sprintf("/assets/%s/transfer-apply", url.PathEscape(assetCode))
	respBody, err := client.doRequest("POST", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}, nil
}

// listTransfers retrieves transfer list
func listTransfers(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := buildQueryParams(args)
	path := "/assets/transfer-requests" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var transfers []Transfer
	if err := json.Unmarshal(apiResp.Data, &transfers); err != nil {
		return nil, fmt.Errorf("failed to parse transfers: %w", err)
	}

	return map[string]interface{}{
		"data":       transfers,
		"pagination": apiResp.Pagination,
	}, nil
}

// approveTransfer approves or rejects a transfer
func approveTransfer(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	action, ok := args["action"].(string)
	if !ok || (action != "approve" && action != "reject") {
		return nil, fmt.Errorf("action is required and must be 'approve' or 'reject'")
	}

	req := map[string]interface{}{
		"action": action,
	}
	if v, ok := args["comment"].(string); ok {
		req["comment"] = v
	}
	req["approved"] = action == "approve"

	path := fmt.Sprintf("/assets/transfer-requests/%d/approve", int(id))
	respBody, err := client.doRequest("POST", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// executeTransfer completes a transfer
func executeTransfer(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	path := fmt.Sprintf("/transfer/%d/complete", int(id))
	respBody, err := client.doRequest("PUT", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// listMaintenanceLogs retrieves maintenance logs
func listMaintenanceLogs(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := buildQueryParams(args)
	path := "/maintenance/logs" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var logs []MaintenanceLog
	if err := json.Unmarshal(apiResp.Data, &logs); err != nil {
		return nil, fmt.Errorf("failed to parse maintenance logs: %w", err)
	}

	return map[string]interface{}{
		"data":       logs,
		"pagination": apiResp.Pagination,
	}, nil
}

// createMaintenanceLog creates a maintenance log
func createMaintenanceLog(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	// Required fields - validate and sanitize
	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		req["asset_code"] = v
	} else {
		return nil, fmt.Errorf("asset_code is required")
	}
	if v, ok := args["maintenance_type"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "maintenance_type"); err != nil {
			return nil, err
		}
		req["maintenance_type"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("maintenance_type is required")
	}
	if v, ok := args["maintenance_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "maintenance_date"); err != nil {
			return nil, err
		}
		req["maintenance_date"] = v
	} else {
		return nil, fmt.Errorf("maintenance_date is required")
	}
	if v, ok := args["maintenance_person"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "maintenance_person"); err != nil {
			return nil, err
		}
		req["maintenance_person"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("maintenance_person is required")
	}
	if v, ok := args["maintenance_content"].(string); ok && v != "" {
		if err := validateStringLength(v, 2000, "maintenance_content"); err != nil {
			return nil, err
		}
		req["maintenance_content"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("maintenance_content is required")
	}

	// Optional fields - validate and sanitize
	if v, ok := args["maintenance_cost"].(float64); ok {
		if v < 0 || v > 1e8 {
			return nil, fmt.Errorf("maintenance_cost out of valid range")
		}
		req["maintenance_cost"] = v
	}
	if v, ok := args["maintenance_duration"].(float64); ok {
		if v < 0 || v > 8760 {
			return nil, fmt.Errorf("maintenance_duration out of valid range (max 8760 hours)")
		}
		req["maintenance_duration"] = v
	}
	if v, ok := args["parts_replaced"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "parts_replaced"); err != nil {
			return nil, err
		}
		req["parts_replaced"] = sanitizeInput(v)
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		req["status"] = sanitizeInput(v)
	}
	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}

	respBody, err := client.doRequest("POST", "/maintenance/logs", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// getMaintenanceTemplates retrieves maintenance templates
func getMaintenanceTemplates(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	respBody, err := client.doRequest("GET", "/maintenance/templates", nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var templates []MaintenanceTemplate
	if err := json.Unmarshal(apiResp.Data, &templates); err != nil {
		return nil, fmt.Errorf("failed to parse templates: %w", err)
	}

	return templates, nil
}

// getMaintenanceEfficiency retrieves maintenance efficiency overview
func getMaintenanceEfficiency(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	respBody, err := client.doRequest("GET", "/maintenance/efficiency/overview", nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return apiResp.Data, nil
}

func normalizeDateOnly(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if strings.Contains(trimmed, "T") {
		trimmed = strings.Split(trimmed, "T")[0]
	}
	if strings.Contains(trimmed, " ") {
		trimmed = strings.Fields(trimmed)[0]
	}
	if len(trimmed) > 10 {
		trimmed = trimmed[:10]
	}
	return trimmed
}

func optionalObjectArrayArg(args map[string]interface{}, key string, maxItems int) ([]interface{}, bool, error) {
	raw, exists := args[key]
	if !exists || raw == nil {
		return nil, false, nil
	}

	values, ok := raw.([]interface{})
	if !ok {
		return nil, false, fmt.Errorf("%s must be an array", key)
	}
	if maxItems > 0 && len(values) > maxItems {
		return nil, false, fmt.Errorf("%s cannot exceed %d items", key, maxItems)
	}
	return values, true, nil
}

func optionalStringArrayArg(args map[string]interface{}, key string, maxItems int, maxLen int) ([]string, bool, error) {
	values, exists, err := optionalObjectArrayArg(args, key, maxItems)
	if err != nil || !exists {
		return nil, exists, err
	}

	result := make([]string, 0, len(values))
	for _, raw := range values {
		value, ok := raw.(string)
		if !ok || strings.TrimSpace(value) == "" {
			return nil, true, fmt.Errorf("%s must contain non-empty strings", key)
		}
		if err := validateStringLength(value, maxLen, key); err != nil {
			return nil, true, err
		}
		result = append(result, sanitizeInput(value))
	}
	return result, true, nil
}

func buildMaintenancePlanRequest(args map[string]interface{}, requireCreateFields bool) (map[string]interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		req["asset_code"] = v
	} else if requireCreateFields {
		return nil, fmt.Errorf("asset_code is required")
	}

	if v, ok := args["plan_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "plan_name"); err != nil {
			return nil, err
		}
		req["plan_name"] = sanitizeInput(v)
	} else if requireCreateFields {
		return nil, fmt.Errorf("plan_name is required")
	}

	if v, ok := args["maintenance_type"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "maintenance_type"); err != nil {
			return nil, err
		}
		req["maintenance_type"] = sanitizeInput(v)
	} else if requireCreateFields {
		return nil, fmt.Errorf("maintenance_type is required")
	}

	if v, ok := args["cycle_type"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "cycle_type"); err != nil {
			return nil, err
		}
		req["cycle_type"] = sanitizeInput(v)
	} else if requireCreateFields {
		return nil, fmt.Errorf("cycle_type is required")
	}

	if v, ok := args["cycle_value"].(float64); ok {
		if v <= 0 {
			return nil, fmt.Errorf("cycle_value must be greater than 0")
		}
		req["cycle_value"] = int(v)
	} else if requireCreateFields {
		return nil, fmt.Errorf("cycle_value is required")
	}

	if v, ok := args["next_maintenance_date"].(string); ok && v != "" {
		date := normalizeDateOnly(v)
		if err := validateDateFormat(date, "next_maintenance_date"); err != nil {
			return nil, err
		}
		req["next_maintenance_date"] = date
	}
	if v, ok := args["maintenance_content"].(string); ok && v != "" {
		if err := validateStringLength(v, 2000, "maintenance_content"); err != nil {
			return nil, err
		}
		req["maintenance_content"] = sanitizeInput(v)
	}
	if v, ok := args["responsible_person"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "responsible_person"); err != nil {
			return nil, err
		}
		req["responsible_person"] = sanitizeInput(v)
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		req["status"] = sanitizeInput(v)
	}
	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}
	if v, ok := args["template_id"].(float64); ok {
		if v <= 0 {
			return nil, fmt.Errorf("template_id must be greater than 0")
		}
		req["template_id"] = int(v)
	}
	if v, ok := args["trigger_type"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "trigger_type"); err != nil {
			return nil, err
		}
		req["trigger_type"] = sanitizeInput(v)
	}
	if values, exists, err := optionalObjectArrayArg(args, "maintenance_items", 200); err != nil {
		return nil, err
	} else if exists {
		req["maintenance_items"] = values
	}
	if values, exists, err := optionalObjectArrayArg(args, "required_materials", 200); err != nil {
		return nil, err
	} else if exists {
		req["required_materials"] = values
	}
	if v, ok := args["estimated_hours"].(float64); ok {
		if v < 0 || v > 8760 {
			return nil, fmt.Errorf("estimated_hours out of valid range")
		}
		req["estimated_hours"] = v
	}
	if v, ok := args["auto_generate_workorder"].(bool); ok {
		req["auto_generate_workorder"] = v
	}
	if v, ok := args["current_usage"].(float64); ok {
		if v < 0 {
			return nil, fmt.Errorf("current_usage must be non-negative")
		}
		req["current_usage"] = v
	}
	if v, ok := args["usage_threshold"].(float64); ok {
		if v < 0 {
			return nil, fmt.Errorf("usage_threshold must be non-negative")
		}
		req["usage_threshold"] = v
	}

	return req, nil
}

// listMaintenancePlans retrieves preventive maintenance plan list
func listMaintenancePlans(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	queryArgs := buildPagedQueryArgs(args)

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		queryArgs["asset_code"] = v
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		queryArgs["status"] = sanitizeInput(v)
	}
	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		queryArgs["keyword"] = sanitized
	}

	items, pagination, err := fetchRawArrayData(client, "/maintenance/plans", queryArgs)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
	}, nil
}

func getMaintenancePlan(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/maintenance/plans/%d", id), nil)
}

func createMaintenancePlan(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req, err := buildMaintenancePlanRequest(args, true)
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "POST", "/maintenance/plans", req)
}

func updateMaintenancePlan(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	req, err := buildMaintenancePlanRequest(args, false)
	if err != nil {
		return nil, err
	}
	if len(req) == 0 {
		return nil, fmt.Errorf("at least one field to update is required")
	}

	return callMessageOnly(client, "PUT", fmt.Sprintf("/maintenance/plans/%d", id), req)
}

func completeMaintenancePlan(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	req := make(map[string]interface{})
	if v, ok := args["maintenance_date"].(string); ok && v != "" {
		date := normalizeDateOnly(v)
		if err := validateDateFormat(date, "maintenance_date"); err != nil {
			return nil, err
		}
		req["maintenance_date"] = date
	}
	if v, ok := args["maintenance_person"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "maintenance_person"); err != nil {
			return nil, err
		}
		req["maintenance_person"] = sanitizeInput(v)
	}
	if v, ok := args["maintenance_content"].(string); ok && v != "" {
		if err := validateStringLength(v, 2000, "maintenance_content"); err != nil {
			return nil, err
		}
		req["maintenance_content"] = sanitizeInput(v)
	}
	if v, ok := args["maintenance_cost"].(float64); ok {
		if v < 0 || v > 1e8 {
			return nil, fmt.Errorf("maintenance_cost out of valid range")
		}
		req["maintenance_cost"] = v
	}
	if v, ok := args["parts_replaced"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "parts_replaced"); err != nil {
			return nil, err
		}
		req["parts_replaced"] = sanitizeInput(v)
	}
	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}
	if v, ok := args["actual_hours"].(float64); ok {
		if v < 0 || v > 8760 {
			return nil, fmt.Errorf("actual_hours out of valid range")
		}
		req["actual_hours"] = v
	}
	if v, ok := args["maintenance_result"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "maintenance_result"); err != nil {
			return nil, err
		}
		req["maintenance_result"] = sanitizeInput(v)
	}

	return callMessageOnly(client, "POST", fmt.Sprintf("/maintenance/plans/%d/complete", id), req)
}

func deleteMaintenancePlan(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "DELETE", fmt.Sprintf("/maintenance/plans/%d", id), nil)
}

func getMaintenancePlanHistory(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/maintenance/plans/%d/history", id), nil)
}

func listReminders(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	queryArgs := buildPagedQueryArgs(args)

	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		queryArgs["status"] = sanitizeInput(v)
	}
	if v, ok := args["start_date"].(string); ok && v != "" {
		date := normalizeDateOnly(v)
		if err := validateDateFormat(date, "start_date"); err != nil {
			return nil, err
		}
		queryArgs["start_date"] = date
	}
	if v, ok := args["end_date"].(string); ok && v != "" {
		date := normalizeDateOnly(v)
		if err := validateDateFormat(date, "end_date"); err != nil {
			return nil, err
		}
		queryArgs["end_date"] = date
	}

	items, pagination, err := fetchRawArrayData(client, "/maintenance/reminders", queryArgs)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
	}, nil
}

func sendReminder(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	planID, err := requiredIntArg(args, "plan_id")
	if err != nil {
		return nil, err
	}

	reminderType, ok := args["reminder_type"].(string)
	if !ok || strings.TrimSpace(reminderType) == "" {
		return nil, fmt.Errorf("reminder_type is required")
	}
	if err := validateStringLength(reminderType, 100, "reminder_type"); err != nil {
		return nil, err
	}

	req := map[string]interface{}{
		"plan_id":       planID,
		"reminder_type": sanitizeInput(reminderType),
	}
	if v, ok := args["recipient"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "recipient"); err != nil {
			return nil, err
		}
		req["recipient"] = sanitizeInput(v)
	}

	return callMessageOnly(client, "POST", "/maintenance/reminders/send", req)
}

func configReminder(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	planID, err := requiredIntArg(args, "plan_id")
	if err != nil {
		return nil, err
	}

	reminderDays, ok := args["reminder_days"].(float64)
	if !ok || reminderDays <= 0 {
		return nil, fmt.Errorf("reminder_days is required")
	}

	reminderTypes, exists, err := optionalStringArrayArg(args, "reminder_types", 20, 100)
	if err != nil {
		return nil, err
	}
	if !exists || len(reminderTypes) == 0 {
		return nil, fmt.Errorf("reminder_types is required")
	}

	req := map[string]interface{}{
		"plan_id":        planID,
		"reminder_days":  int(reminderDays),
		"reminder_types": reminderTypes,
	}
	if v, ok := args["recipient"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "recipient"); err != nil {
			return nil, err
		}
		req["recipient"] = sanitizeInput(v)
	}

	return callMessageOnly(client, "POST", "/maintenance/reminders/config", req)
}

func checkReminders(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return callJSONAndParse(client, "GET", "/maintenance/reminders/check", nil)
}

// listMaintenanceWorkorders retrieves maintenance work orders
func listMaintenanceWorkorders(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	queryArgs := buildPagedQueryArgs(args)

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		queryArgs["asset_code"] = v
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		queryArgs["status"] = sanitizeInput(v)
	}
	if v, ok := args["priority"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "priority"); err != nil {
			return nil, err
		}
		queryArgs["priority"] = sanitizeInput(v)
	}
	if v, ok := args["assigned_to"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "assigned_to"); err != nil {
			return nil, err
		}
		queryArgs["assigned_to"] = sanitizeInput(v)
	}
	if v, ok := args["start_date"].(string); ok && v != "" {
		date := normalizeDateOnly(v)
		if err := validateDateFormat(date, "start_date"); err != nil {
			return nil, err
		}
		queryArgs["start_date"] = date
	}
	if v, ok := args["end_date"].(string); ok && v != "" {
		date := normalizeDateOnly(v)
		if err := validateDateFormat(date, "end_date"); err != nil {
			return nil, err
		}
		queryArgs["end_date"] = date
	}
	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		queryArgs["keyword"] = sanitized
	}

	items, pagination, err := fetchRawArrayData(client, "/maintenance/legacy/workorders", queryArgs)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
	}, nil
}

func normalizeMaterialsValue(raw interface{}) ([]interface{}, error) {
	if raw == nil {
		return []interface{}{}, nil
	}
	switch typed := raw.(type) {
	case []interface{}:
		return typed, nil
	case string:
		if strings.TrimSpace(typed) == "" {
			return []interface{}{}, nil
		}
		var values []interface{}
		if err := json.Unmarshal([]byte(typed), &values); err != nil {
			return nil, fmt.Errorf("failed to parse materials: %w", err)
		}
		return values, nil
	default:
		return nil, fmt.Errorf("materials must be an array")
	}
}

func buildLegacyWorkorderRequest(args map[string]interface{}, requireCreateFields bool) (map[string]interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		req["asset_code"] = v
	} else if requireCreateFields {
		return nil, fmt.Errorf("asset_code is required")
	}
	if v, ok := args["title"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "title"); err != nil {
			return nil, err
		}
		req["title"] = sanitizeInput(v)
	} else if requireCreateFields {
		return nil, fmt.Errorf("title is required")
	}
	if v, ok := args["description"].(string); ok && v != "" {
		if err := validateStringLength(v, 2000, "description"); err != nil {
			return nil, err
		}
		req["description"] = sanitizeInput(v)
	}
	if v, ok := args["priority"].(float64); ok {
		if v <= 0 {
			return nil, fmt.Errorf("priority must be greater than 0")
		}
		req["priority"] = int(v)
	}
	if v, ok := args["planned_start_date"].(string); ok && v != "" {
		date := normalizeDateOnly(v)
		if err := validateDateFormat(date, "planned_start_date"); err != nil {
			return nil, err
		}
		req["planned_start_date"] = date
	}
	if v, ok := args["planned_end_date"].(string); ok && v != "" {
		date := normalizeDateOnly(v)
		if err := validateDateFormat(date, "planned_end_date"); err != nil {
			return nil, err
		}
		req["planned_end_date"] = date
	}
	if v, ok := args["estimated_hours"].(float64); ok {
		if v < 0 || v > 8760 {
			return nil, fmt.Errorf("estimated_hours out of valid range")
		}
		req["estimated_hours"] = v
	}
	if v, ok := args["assigned_to"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "assigned_to"); err != nil {
			return nil, err
		}
		req["assigned_to"] = sanitizeInput(v)
	}
	if values, exists, err := optionalObjectArrayArg(args, "materials", 200); err != nil {
		return nil, err
	} else if exists {
		req["materials"] = values
	}
	if v, ok := args["labor_cost"].(float64); ok {
		if v < 0 || v > 1e8 {
			return nil, fmt.Errorf("labor_cost out of valid range")
		}
		req["labor_cost"] = v
	}
	if v, ok := args["outsourcing_cost"].(float64); ok {
		if v < 0 || v > 1e8 {
			return nil, fmt.Errorf("outsourcing_cost out of valid range")
		}
		req["outsourcing_cost"] = v
	}
	if v, ok := args["other_cost"].(float64); ok {
		if v < 0 || v > 1e8 {
			return nil, fmt.Errorf("other_cost out of valid range")
		}
		req["other_cost"] = v
	}
	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}

	return req, nil
}

func getMaintenanceWorkorder(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/maintenance/legacy/workorders/%d", id), nil)
}

func createMaintenanceWorkorder(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req, err := buildLegacyWorkorderRequest(args, true)
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "POST", "/maintenance/legacy/workorders", req)
}

func assignWorkorder(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	assignedTo, ok := args["assigned_to"].(string)
	if !ok || strings.TrimSpace(assignedTo) == "" {
		return nil, fmt.Errorf("assigned_to is required")
	}
	if err := validateStringLength(assignedTo, 100, "assigned_to"); err != nil {
		return nil, err
	}
	return callMessageOnly(client, "POST", fmt.Sprintf("/maintenance/workorders/%d/assign", id), map[string]interface{}{
		"assigned_to": sanitizeInput(assignedTo),
	})
}

func startWorkorder(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "POST", fmt.Sprintf("/maintenance/workorders/%d/start", id), map[string]interface{}{})
}

func completeWorkorder(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	req := make(map[string]interface{})
	if v, ok := args["work_content"].(string); ok && v != "" {
		if err := validateStringLength(v, 4000, "work_content"); err != nil {
			return nil, err
		}
		req["work_content"] = sanitizeInput(v)
	}
	if v, ok := args["actual_hours"].(float64); ok {
		if v < 0 || v > 8760 {
			return nil, fmt.Errorf("actual_hours out of valid range")
		}
		req["actual_hours"] = v
	}
	if v, ok := args["labor_cost"].(float64); ok {
		if v < 0 || v > 1e8 {
			return nil, fmt.Errorf("labor_cost out of valid range")
		}
		req["labor_cost"] = v
	}
	if v, ok := args["outsourcing_cost"].(float64); ok {
		if v < 0 || v > 1e8 {
			return nil, fmt.Errorf("outsourcing_cost out of valid range")
		}
		req["outsourcing_cost"] = v
	}
	if v, ok := args["other_cost"].(float64); ok {
		if v < 0 || v > 1e8 {
			return nil, fmt.Errorf("other_cost out of valid range")
		}
		req["other_cost"] = v
	}
	if values, exists, err := optionalObjectArrayArg(args, "materials", 200); err != nil {
		return nil, err
	} else if exists {
		req["materials"] = values
	}

	return callMessageOnly(client, "POST", fmt.Sprintf("/maintenance/workorders/%d/complete", id), req)
}

func closeWorkorder(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	req := map[string]interface{}{}
	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}
	return callMessageOnly(client, "POST", fmt.Sprintf("/maintenance/workorders/%d/close", id), req)
}

func cancelWorkorder(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	req := map[string]interface{}{}
	if v, ok := args["cancel_reason"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "cancel_reason"); err != nil {
			return nil, err
		}
		req["cancel_reason"] = sanitizeInput(v)
	}
	return callMessageOnly(client, "POST", fmt.Sprintf("/maintenance/workorders/%d/cancel", id), req)
}

func addWorkorderMaterials(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	newMaterials, exists, err := optionalObjectArrayArg(args, "materials", 200)
	if err != nil {
		return nil, err
	}
	if !exists || len(newMaterials) == 0 {
		return nil, fmt.Errorf("materials is required")
	}

	respBody, err := client.doRequest("GET", fmt.Sprintf("/maintenance/legacy/workorders/%d", id), nil)
	if err != nil {
		return nil, err
	}
	workorder, err := parseAPIResponseDataObject(respBody)
	if err != nil {
		return nil, err
	}

	existingMaterials, err := normalizeMaterialsValue(workorder["materials"])
	if err != nil {
		return nil, err
	}
	merged := append(existingMaterials, newMaterials...)

	return callMessageOnly(client, "PUT", fmt.Sprintf("/maintenance/legacy/workorders/%d", id), map[string]interface{}{
		"materials": merged,
	})
}

// updateWorkorderStatus updates work order status
func updateWorkorderStatus(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	status, ok := args["status"].(string)
	if !ok || strings.TrimSpace(status) == "" {
		return nil, fmt.Errorf("status is required")
	}
	if err := validateStringLength(status, 50, "status"); err != nil {
		return nil, err
	}

	req := map[string]interface{}{
		"status": sanitizeInput(status),
	}
	if v, ok := args["actual_start_time"].(string); ok && v != "" {
		date := normalizeDateOnly(v)
		if err := validateDateFormat(date, "actual_start_time"); err != nil {
			return nil, err
		}
		req["actual_start_date"] = date
	}
	if v, ok := args["notes"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "notes"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}

	return callMessageOnly(client, "PUT", fmt.Sprintf("/maintenance/legacy/workorders/%d", id), req)
}

func listUsageRecords(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	queryArgs := buildPagedQueryArgs(args)

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		queryArgs["asset_code"] = v
	}
	if v, ok := args["usage_type"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "usage_type"); err != nil {
			return nil, err
		}
		queryArgs["usage_type"] = sanitizeInput(v)
	}
	if v, ok := args["start_date"].(string); ok && v != "" {
		date := normalizeDateOnly(v)
		if err := validateDateFormat(date, "start_date"); err != nil {
			return nil, err
		}
		queryArgs["start_date"] = date
	}
	if v, ok := args["end_date"].(string); ok && v != "" {
		date := normalizeDateOnly(v)
		if err := validateDateFormat(date, "end_date"); err != nil {
			return nil, err
		}
		queryArgs["end_date"] = date
	}

	items, pagination, err := fetchRawArrayData(client, "/maintenance/usage-records", queryArgs)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
	}, nil
}

func createUsageRecord(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		req["asset_code"] = v
	} else {
		return nil, fmt.Errorf("asset_code is required")
	}

	if v, ok := args["usage_date"].(string); ok && v != "" {
		date := normalizeDateOnly(v)
		if err := validateDateFormat(date, "usage_date"); err != nil {
			return nil, err
		}
		req["usage_date"] = date
	} else {
		return nil, fmt.Errorf("usage_date is required")
	}

	if v, ok := args["usage_value"].(float64); ok {
		if v <= 0 {
			return nil, fmt.Errorf("usage_value must be greater than 0")
		}
		req["usage_value"] = v
	} else {
		return nil, fmt.Errorf("usage_value is required")
	}

	if v, ok := args["usage_type"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "usage_type"); err != nil {
			return nil, err
		}
		req["usage_type"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("usage_type is required")
	}

	if v, ok := args["cumulative_value"].(float64); ok {
		if v < 0 {
			return nil, fmt.Errorf("cumulative_value must be non-negative")
		}
		req["cumulative_value"] = v
	} else {
		return nil, fmt.Errorf("cumulative_value is required")
	}

	if v, ok := args["operator"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "operator"); err != nil {
			return nil, err
		}
		req["operator"] = sanitizeInput(v)
	}
	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}

	return callMessageOnly(client, "POST", "/maintenance/usage-records", req)
}

func listUsageTriggered(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	queryArgs := buildPagedQueryArgs(args)

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		queryArgs["asset_code"] = v
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		queryArgs["status"] = sanitizeInput(v)
	}

	items, pagination, err := fetchRawArrayData(client, "/maintenance/usage-triggered", queryArgs)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
	}, nil
}

func processUsageTriggered(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	req := make(map[string]interface{})
	if v, ok := args["work_order_id"].(float64); ok {
		if v <= 0 {
			return nil, fmt.Errorf("work_order_id must be greater than 0")
		}
		req["work_order_id"] = int(v)
	}
	return callMessageOnly(client, "POST", fmt.Sprintf("/maintenance/usage-triggered/%d/process", id), req)
}

// listMaintenanceRequests retrieves maintenance request list
func listMaintenanceRequests(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}

	queryArgs := map[string]interface{}{
		"page":  page,
		"limit": limit,
	}

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		queryArgs["asset_code"] = v
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		queryArgs["status"] = sanitizeInput(v)
	}
	if v, ok := args["fault_level"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "fault_level"); err != nil {
			return nil, err
		}
		queryArgs["fault_level"] = sanitizeInput(v)
	}
	if v, ok := args["start_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "start_date"); err != nil {
			return nil, err
		}
		queryArgs["start_date"] = v
	}
	if v, ok := args["end_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "end_date"); err != nil {
			return nil, err
		}
		queryArgs["end_date"] = v
	}
	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		queryArgs["keyword"] = sanitized
	}

	items, pagination, err := fetchRawArrayData(client, "/maintenance/requests", queryArgs)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
	}, nil
}

// getMaintenanceRequest retrieves a maintenance request detail
func getMaintenanceRequest(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	path := fmt.Sprintf("/maintenance/requests/%d", int(id))
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	data, err := parseAPIResponseDataObject(respBody)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data": data,
	}, nil
}

// createMaintenanceRequest creates a fault maintenance request
func createMaintenanceRequest(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		req["asset_code"] = v
	} else {
		return nil, fmt.Errorf("asset_code is required")
	}

	if v, ok := args["fault_description"].(string); ok && v != "" {
		if err := validateStringLength(v, 2000, "fault_description"); err != nil {
			return nil, err
		}
		req["fault_description"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("fault_description is required")
	}

	if v, ok := args["fault_level"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "fault_level"); err != nil {
			return nil, err
		}
		req["fault_level"] = sanitizeInput(v)
	}
	if v, ok := args["request_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "request_date"); err != nil {
			return nil, err
		}
		req["request_date"] = v
	}
	if v, ok := args["request_department"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "request_department"); err != nil {
			return nil, err
		}
		req["request_department"] = sanitizeInput(v)
	}
	if v, ok := args["contact_phone"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "contact_phone"); err != nil {
			return nil, err
		}
		req["contact_phone"] = sanitizeInput(v)
	}
	if v, ok := args["expected_repair_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "expected_repair_date"); err != nil {
			return nil, err
		}
		req["expected_repair_date"] = v
	}
	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}
	req["source"] = "assethub_mcp"
	req["intent"] = "repair_request"

	respBody, err := client.doRequest("POST", "/maintenance/ai/submit-request", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	data, err := parseAPIResponseData(respBody)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    data,
	}, nil
}

// approveMaintenanceRequest approves or rejects a maintenance request
func approveMaintenanceRequest(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	approved, hasApproved := args["approved"].(bool)
	if !hasApproved {
		action, ok := args["action"].(string)
		if !ok || action == "" {
			return nil, fmt.Errorf("approved or action is required")
		}
		switch strings.ToLower(strings.TrimSpace(action)) {
		case "approve", "approved":
			approved = true
		case "reject", "rejected":
			approved = false
		default:
			return nil, fmt.Errorf("action must be approve or reject")
		}
	}

	req := map[string]interface{}{
		"approved": approved,
	}
	if v, ok := args["comment"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "comment"); err != nil {
			return nil, err
		}
		req["comment"] = sanitizeInput(v)
	}

	path := fmt.Sprintf("/maintenance/requests/%d/approve", int(id))
	respBody, err := client.doRequest("POST", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// startMaintenanceRequest starts a maintenance request
func startMaintenanceRequest(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	repairPerson, ok := args["repair_person"].(string)
	if !ok || repairPerson == "" {
		return nil, fmt.Errorf("repair_person is required")
	}
	if err := validateStringLength(repairPerson, 100, "repair_person"); err != nil {
		return nil, err
	}

	req := map[string]interface{}{
		"repair_person": sanitizeInput(repairPerson),
	}
	if v, ok := args["repair_start_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "repair_start_date"); err != nil {
			return nil, err
		}
		req["repair_start_date"] = v
	}

	path := fmt.Sprintf("/maintenance/requests/%d/start", int(id))
	respBody, err := client.doRequest("POST", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// completeMaintenanceRequest completes a maintenance request
func completeMaintenanceRequest(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	req := make(map[string]interface{})
	if v, ok := args["repair_end_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "repair_end_date"); err != nil {
			return nil, err
		}
		req["repair_end_date"] = v
	}
	if v, ok := args["repair_cost"].(float64); ok {
		if v < 0 || v > 1e8 {
			return nil, fmt.Errorf("repair_cost out of valid range")
		}
		req["repair_cost"] = v
	}
	if v, ok := args["repair_content"].(string); ok && v != "" {
		if err := validateStringLength(v, 2000, "repair_content"); err != nil {
			return nil, err
		}
		req["repair_content"] = sanitizeInput(v)
	}
	if v, ok := args["parts_replaced"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "parts_replaced"); err != nil {
			return nil, err
		}
		req["parts_replaced"] = sanitizeInput(v)
	}
	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}

	path := fmt.Sprintf("/maintenance/requests/%d/complete", int(id))
	respBody, err := client.doRequest("POST", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// getDefaultWorkflow retrieves the current tenant default workflow
func getDefaultWorkflow(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	respBody, err := client.doRequest("GET", "/workflow/default", nil)
	if err != nil {
		return nil, err
	}

	data, err := parseAPIResponseDataObject(respBody)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data": data,
	}, nil
}

// listWorkflowStates retrieves workflow states
func listWorkflowStates(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	items, pagination, err := fetchRawArrayData(client, "/workflow/states", map[string]interface{}{})
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
	}, nil
}

// listWorkflowTransitions retrieves workflow transitions
func listWorkflowTransitions(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	queryArgs := map[string]interface{}{}
	if v, ok := args["from_state"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "from_state"); err != nil {
			return nil, err
		}
		queryArgs["from_state"] = sanitizeInput(v)
	}

	items, pagination, err := fetchRawArrayData(client, "/workflow/transitions", queryArgs)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
	}, nil
}

// applyAssetTransition applies a workflow transition to an asset
func applyAssetTransition(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	var assetRef string
	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		assetRef = v
	}
	if assetRef == "" {
		switch typed := args["asset_id"].(type) {
		case float64:
			if typed <= 0 {
				return nil, fmt.Errorf("asset_id must be greater than 0")
			}
			assetRef = strconv.Itoa(int(typed))
		case string:
			if typed == "" {
				return nil, fmt.Errorf("asset_id is required")
			}
			if err := validateStringLength(typed, 100, "asset_id"); err != nil {
				return nil, err
			}
			assetRef = sanitizeInput(typed)
		}
	}
	if assetRef == "" {
		return nil, fmt.Errorf("asset_id or asset_code is required")
	}

	transitionID, ok := args["transition_id"].(float64)
	if !ok {
		return nil, fmt.Errorf("transition_id is required")
	}

	req := map[string]interface{}{
		"transition_id": int(transitionID),
	}
	if v, ok := args["reason"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "reason"); err != nil {
			return nil, err
		}
		req["reason"] = sanitizeInput(v)
	}
	if v, ok := args["metadata"].(map[string]interface{}); ok && v != nil {
		req["metadata"] = v
	}

	path := fmt.Sprintf("/workflow/transition/%s", url.PathEscape(assetRef))
	respBody, err := client.doRequest("POST", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	data, err := parseAPIResponseData(respBody)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    data,
	}, nil
}

func normalizeBooleanValue(raw interface{}, defaultValue bool, field string) (bool, error) {
	if raw == nil {
		return defaultValue, nil
	}

	switch typed := raw.(type) {
	case bool:
		return typed, nil
	case float64:
		return typed != 0, nil
	default:
		return false, fmt.Errorf("%s must be a boolean", field)
	}
}

func normalizeOptionalOrderValue(raw interface{}, field string) (int, error) {
	if raw == nil {
		return 0, nil
	}

	switch typed := raw.(type) {
	case float64:
		return int(typed), nil
	case int:
		return typed, nil
	default:
		return 0, fmt.Errorf("%s must be a number", field)
	}
}

func sanitizeAssetWorkflowStates(rawStates []interface{}) ([]map[string]interface{}, error) {
	states := make([]map[string]interface{}, 0, len(rawStates))
	for idx, raw := range rawStates {
		state, ok := raw.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("states[%d] must be an object", idx)
		}

		stateKey, ok := state["state_key"].(string)
		if !ok || strings.TrimSpace(stateKey) == "" {
			return nil, fmt.Errorf("states[%d].state_key is required", idx)
		}
		if err := validateStringLength(stateKey, 100, fmt.Sprintf("states[%d].state_key", idx)); err != nil {
			return nil, err
		}

		normalized := map[string]interface{}{
			"state_key": sanitizeInput(stateKey),
		}
		if v, ok := state["state_label"].(string); ok && strings.TrimSpace(v) != "" {
			if err := validateStringLength(v, 100, fmt.Sprintf("states[%d].state_label", idx)); err != nil {
				return nil, err
			}
			normalized["state_label"] = sanitizeInput(v)
		}
		if v, ok := state["color"].(string); ok && strings.TrimSpace(v) != "" {
			if err := validateStringLength(v, 30, fmt.Sprintf("states[%d].color", idx)); err != nil {
				return nil, err
			}
			normalized["color"] = sanitizeInput(v)
		}
		if sortOrder, err := normalizeOptionalOrderValue(state["sort_order"], fmt.Sprintf("states[%d].sort_order", idx)); err != nil {
			return nil, err
		} else if sortOrder != 0 {
			normalized["sort_order"] = sortOrder
		}
		if isTerminal, err := normalizeBooleanValue(state["is_terminal"], false, fmt.Sprintf("states[%d].is_terminal", idx)); err != nil {
			return nil, err
		} else if isTerminal {
			normalized["is_terminal"] = true
		}

		states = append(states, normalized)
	}
	return states, nil
}

func sanitizeAssetWorkflowActions(rawActions []interface{}, transitionIndex int) ([]map[string]interface{}, error) {
	actions := make([]map[string]interface{}, 0, len(rawActions))
	for actionIndex, raw := range rawActions {
		action, ok := raw.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("transitions[%d].actions[%d] must be an object", transitionIndex, actionIndex)
		}

		actionType, ok := action["action_type"].(string)
		if !ok || strings.TrimSpace(actionType) == "" {
			return nil, fmt.Errorf("transitions[%d].actions[%d].action_type is required", transitionIndex, actionIndex)
		}
		if err := validateStringLength(actionType, 100, fmt.Sprintf("transitions[%d].actions[%d].action_type", transitionIndex, actionIndex)); err != nil {
			return nil, err
		}

		normalized := map[string]interface{}{
			"action_type": sanitizeInput(actionType),
		}
		if config, exists := action["action_config"]; exists && config != nil {
			normalized["action_config"] = config
		}
		if sortOrder, err := normalizeOptionalOrderValue(action["sort_order"], fmt.Sprintf("transitions[%d].actions[%d].sort_order", transitionIndex, actionIndex)); err != nil {
			return nil, err
		} else if sortOrder != 0 {
			normalized["sort_order"] = sortOrder
		}
		if isActive, err := normalizeBooleanValue(action["is_active"], true, fmt.Sprintf("transitions[%d].actions[%d].is_active", transitionIndex, actionIndex)); err != nil {
			return nil, err
		} else if !isActive {
			normalized["is_active"] = false
		}

		actions = append(actions, normalized)
	}
	return actions, nil
}

func sanitizeAssetWorkflowTransitions(rawTransitions []interface{}) ([]map[string]interface{}, error) {
	transitions := make([]map[string]interface{}, 0, len(rawTransitions))
	for idx, raw := range rawTransitions {
		transition, ok := raw.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("transitions[%d] must be an object", idx)
		}

		fromState, ok := transition["from_state"].(string)
		if !ok || strings.TrimSpace(fromState) == "" {
			return nil, fmt.Errorf("transitions[%d].from_state is required", idx)
		}
		toState, ok := transition["to_state"].(string)
		if !ok || strings.TrimSpace(toState) == "" {
			return nil, fmt.Errorf("transitions[%d].to_state is required", idx)
		}
		if err := validateStringLength(fromState, 100, fmt.Sprintf("transitions[%d].from_state", idx)); err != nil {
			return nil, err
		}
		if err := validateStringLength(toState, 100, fmt.Sprintf("transitions[%d].to_state", idx)); err != nil {
			return nil, err
		}

		normalized := map[string]interface{}{
			"from_state": sanitizeInput(fromState),
			"to_state":   sanitizeInput(toState),
		}
		if v, ok := transition["name"].(string); ok && strings.TrimSpace(v) != "" {
			if err := validateStringLength(v, 200, fmt.Sprintf("transitions[%d].name", idx)); err != nil {
				return nil, err
			}
			normalized["name"] = sanitizeInput(v)
		}
		if requireReason, err := normalizeBooleanValue(transition["require_reason"], false, fmt.Sprintf("transitions[%d].require_reason", idx)); err != nil {
			return nil, err
		} else if requireReason {
			normalized["require_reason"] = true
		}
		if isActive, err := normalizeBooleanValue(transition["is_active"], true, fmt.Sprintf("transitions[%d].is_active", idx)); err != nil {
			return nil, err
		} else if !isActive {
			normalized["is_active"] = false
		}
		if sortOrder, err := normalizeOptionalOrderValue(transition["sort_order"], fmt.Sprintf("transitions[%d].sort_order", idx)); err != nil {
			return nil, err
		} else if sortOrder != 0 {
			normalized["sort_order"] = sortOrder
		}
		if rawActions, exists := transition["actions"]; exists && rawActions != nil {
			actionsSlice, ok := rawActions.([]interface{})
			if !ok {
				return nil, fmt.Errorf("transitions[%d].actions must be an array", idx)
			}
			actions, err := sanitizeAssetWorkflowActions(actionsSlice, idx)
			if err != nil {
				return nil, err
			}
			normalized["actions"] = actions
		}

		transitions = append(transitions, normalized)
	}
	return transitions, nil
}

func buildAssetWorkflowRequest(args map[string]interface{}, requireName bool) (map[string]interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["name"].(string); ok && strings.TrimSpace(v) != "" {
		if err := validateStringLength(v, 200, "name"); err != nil {
			return nil, err
		}
		req["name"] = sanitizeInput(v)
	} else if requireName {
		return nil, fmt.Errorf("name is required")
	}

	if v, ok := args["description"].(string); ok && strings.TrimSpace(v) != "" {
		if err := validateStringLength(v, 1000, "description"); err != nil {
			return nil, err
		}
		req["description"] = sanitizeInput(v)
	}

	if v, ok := args["status"].(string); ok && strings.TrimSpace(v) != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		req["status"] = sanitizeInput(v)
	}

	if v, ok := args["is_default"].(bool); ok {
		req["is_default"] = v
	}

	if rawStates, exists, err := optionalObjectArrayArg(args, "states", 100); err != nil {
		return nil, err
	} else if exists {
		states, err := sanitizeAssetWorkflowStates(rawStates)
		if err != nil {
			return nil, err
		}
		req["states"] = states
	}

	if rawTransitions, exists, err := optionalObjectArrayArg(args, "transitions", 200); err != nil {
		return nil, err
	} else if exists {
		transitions, err := sanitizeAssetWorkflowTransitions(rawTransitions)
		if err != nil {
			return nil, err
		}
		req["transitions"] = transitions
	}

	return req, nil
}

func listAssetWorkflows(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return callJSONAndParse(client, "GET", "/asset-workflows", nil)
}

func getAssetWorkflow(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/asset-workflows/%d", id), nil)
}

func createAssetWorkflow(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req, err := buildAssetWorkflowRequest(args, true)
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "POST", "/asset-workflows", req)
}

func updateAssetWorkflow(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	req, err := buildAssetWorkflowRequest(args, false)
	if err != nil {
		return nil, err
	}
	if len(req) == 0 {
		return nil, fmt.Errorf("at least one workflow field is required")
	}

	return callMessageOnly(client, "PUT", fmt.Sprintf("/asset-workflows/%d", id), req)
}

func deleteAssetWorkflow(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "DELETE", fmt.Sprintf("/asset-workflows/%d", id), nil)
}

// getTodoTasks retrieves workflow todo tasks
func getTodoTasks(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return nil, featureUnavailableError("工作流待办任务", "当前后端未暴露 /api/workflow/tasks/todo 接口")
}

// completeTask completes a workflow task
func completeTask(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return nil, featureUnavailableError("工作流任务完成", "当前后端未暴露 /api/workflow/tasks/:id/complete 接口")
}

// listDepartments retrieves department list
func listDepartments(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := ""
	queries := []string{}

	if tree, ok := args["tree"].(bool); ok && tree {
		queries = append(queries, "tree=true")
	}
	if parentID, ok := args["parent_id"].(float64); ok {
		queries = append(queries, fmt.Sprintf("parent_id=%d", int(parentID)))
	}
	if includeChildren, ok := args["include_children"].(bool); ok && includeChildren {
		queries = append(queries, "include_children=true")
	}

	if len(queries) > 0 {
		params = "?" + strings.Join(queries, "&")
	}

	path := "/departments" + params
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

// listUsers retrieves user list
func listUsers(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := buildQueryParams(args)
	path := "/users" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var users []User
	if err := json.Unmarshal(apiResp.Data, &users); err != nil {
		return nil, fmt.Errorf("failed to parse users: %w", err)
	}

	return map[string]interface{}{
		"success":    apiResp.Success,
		"data":       users,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func getCurrentAuthContext(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	includeMenuDefinitions := false
	if value, ok := args["include_menu_definitions"].(bool); ok {
		includeMenuDefinitions = value
	}

	includeModuleDetails := true
	if value, ok := args["include_module_details"].(bool); ok {
		includeModuleDetails = value
	}

	includeRolePermissions := true
	if value, ok := args["include_role_permissions"].(bool); ok {
		includeRolePermissions = value
	}

	profileData, err := getCurrentProfileData(client)
	if err != nil {
		return nil, err
	}

	role := extractStringFromMap(profileData, "role")
	effectiveTenantID := extractIntFromMap(profileData, "tenant_id")
	requestedTenantID, hasRequestedTenantID := extractTenantOverride(args)

	result := map[string]interface{}{
		"success": true,
		"scope": map[string]interface{}{
			"user":                    profileData,
			"effective_tenant_id":     effectiveTenantID,
			"requested_tenant_id":     requestedTenantIDOrNil(requestedTenantID, hasRequestedTenantID),
			"tenant_explicitly_set":   hasRequestedTenantID && requestedTenantID > 0,
			"is_super_admin":          role == "super_admin",
			"tenant_context_required": role == "super_admin" && effectiveTenantID <= 0,
		},
	}

	warnings := make([]string, 0, 2)
	if role == "super_admin" && effectiveTenantID <= 0 {
		warnings = append(warnings, "当前凭证是超级管理员且尚未显式选择租户；租户级查询或管理前请传入 tenant_id。")
	}

	menuKeys, err := getCurrentMenuKeys(client)
	if err != nil {
		warnings = append(warnings, fmt.Sprintf("获取当前用户菜单权限失败：%s", sanitizeErrorMessage(err.Error())))
	} else {
		menuBlock := map[string]interface{}{
			"visible_keys": menuKeys,
		}

		if includeMenuDefinitions {
			menuDefinitions, defErr := getCurrentMenuDefinitions(client, menuKeys)
			if defErr != nil {
				warnings = append(warnings, fmt.Sprintf("获取当前用户菜单定义失败：%s", sanitizeErrorMessage(defErr.Error())))
			} else {
				menuBlock["visible_definitions"] = menuDefinitions
			}
		}

		result["menus"] = menuBlock
	}

	if includeRolePermissions && role != "" {
		rolePermissions, permErr := getRolePermissionsData(client, role)
		if permErr != nil {
			warnings = append(warnings, fmt.Sprintf("获取当前角色权限失败：%s", sanitizeErrorMessage(permErr.Error())))
		} else {
			result["role_permissions"] = rolePermissions
		}
	}

	if includeModuleDetails {
		if effectiveTenantID > 0 {
			modules, moduleErr := getTenantModulesData(client, effectiveTenantID)
			if moduleErr != nil {
				warnings = append(warnings, fmt.Sprintf("获取当前租户模块失败：%s", sanitizeErrorMessage(moduleErr.Error())))
			} else {
				result["tenant_modules"] = modules
			}
		} else {
			warnings = append(warnings, "当前上下文没有有效 tenant_id，已跳过租户模块明细。")
		}
	}

	if len(warnings) > 0 {
		result["warnings"] = warnings
	}

	return result, nil
}

func getCurrentProfileData(client *AssetHubClient) (map[string]interface{}, error) {
	respBody, err := client.doRequest("GET", "/users/profile", nil)
	if err != nil {
		return nil, err
	}

	return parseAPIResponseDataObject(respBody)
}

func getCurrentMenuKeys(client *AssetHubClient) ([]string, error) {
	respBody, err := client.doRequest("GET", "/roles-permissions/user/menus", nil)
	if err != nil {
		return nil, err
	}

	data, err := parseAPIResponseData(respBody)
	if err != nil {
		return nil, err
	}

	items, ok := data.([]interface{})
	if !ok {
		return nil, fmt.Errorf("failed to parse current menu keys")
	}

	keys := make([]string, 0, len(items))
	for _, item := range items {
		if value, ok := item.(string); ok && value != "" {
			keys = append(keys, value)
		}
	}

	return keys, nil
}

func getCurrentMenuDefinitions(client *AssetHubClient, visibleKeys []string) ([]map[string]interface{}, error) {
	respBody, err := client.doRequest("GET", "/roles-permissions/menus/list", nil)
	if err != nil {
		return nil, err
	}

	data, err := parseAPIResponseData(respBody)
	if err != nil {
		return nil, err
	}

	items, ok := data.([]interface{})
	if !ok {
		return nil, fmt.Errorf("failed to parse menu definitions")
	}

	allowedKeys := make(map[string]struct{}, len(visibleKeys))
	for _, key := range visibleKeys {
		if key != "" {
			allowedKeys[key] = struct{}{}
		}
	}

	filtered := make([]map[string]interface{}, 0, len(visibleKeys))
	for _, item := range items {
		definition, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		menuKey := extractStringFromMap(definition, "menu_key")
		if menuKey == "" {
			continue
		}

		if _, exists := allowedKeys[menuKey]; exists {
			filtered = append(filtered, definition)
		}
	}

	return filtered, nil
}

func getRolePermissionsData(client *AssetHubClient, role string) (interface{}, error) {
	path := fmt.Sprintf("/roles-permissions/roles/%s/permissions", url.PathEscape(role))
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	return parseAPIResponseData(respBody)
}

func getTenantModulesData(client *AssetHubClient, tenantID int) (interface{}, error) {
	path := fmt.Sprintf("/tenant-module-config/tenants/%d/modules", tenantID)
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var data interface{}
	if err := json.Unmarshal(respBody, &data); err != nil {
		return nil, fmt.Errorf("failed to parse tenant modules: %w", err)
	}

	return data, nil
}

func parseAPIResponseData(respBody []byte) (interface{}, error) {
	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var data interface{}
	if len(apiResp.Data) == 0 {
		return nil, nil
	}

	if err := json.Unmarshal(apiResp.Data, &data); err != nil {
		return nil, fmt.Errorf("failed to parse response data: %w", err)
	}

	return data, nil
}

func parseAPIResponseDataObject(respBody []byte) (map[string]interface{}, error) {
	data, err := parseAPIResponseData(respBody)
	if err != nil {
		return nil, err
	}

	object, ok := data.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("failed to parse response data object")
	}

	return object, nil
}

func extractStringFromMap(values map[string]interface{}, key string) string {
	if len(values) == 0 {
		return ""
	}

	value, ok := values[key]
	if !ok || value == nil {
		return ""
	}

	switch typed := value.(type) {
	case string:
		return typed
	default:
		return fmt.Sprintf("%v", typed)
	}
}

func extractIntFromMap(values map[string]interface{}, key string) int {
	if len(values) == 0 {
		return 0
	}

	value, ok := values[key]
	if !ok || value == nil {
		return 0
	}

	switch typed := value.(type) {
	case float64:
		return int(typed)
	case int:
		return typed
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(typed))
		if err == nil {
			return parsed
		}
	}

	return 0
}

func extractFloatFromMap(values map[string]interface{}, key string) float64 {
	if len(values) == 0 {
		return 0
	}

	value, ok := values[key]
	if !ok || value == nil {
		return 0
	}

	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int32:
		return float64(typed)
	case int64:
		return float64(typed)
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		if err == nil {
			return parsed
		}
	}

	return 0
}

type rawArrayResponse struct {
	Success    bool            `json:"success"`
	Data       json.RawMessage `json:"data"`
	Pagination Pagination      `json:"pagination"`
	Message    string          `json:"message"`
}

type rawScrappingResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Records    []map[string]interface{} `json:"records"`
		Pagination Pagination               `json:"pagination"`
	} `json:"data"`
	Message string `json:"message"`
}

type countedItem struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

func parseSampleLimit(args map[string]interface{}, defaultValue int) int {
	limit := defaultValue
	if v, ok := args["sample_limit"].(float64); ok {
		limit = int(v)
	}
	if limit <= 0 {
		limit = defaultValue
	}
	if limit > 20 {
		limit = 20
	}
	return limit
}

func fetchRawArrayData(client *AssetHubClient, path string, args map[string]interface{}) ([]map[string]interface{}, Pagination, error) {
	params := buildQueryParams(args)
	respBody, err := client.doRequest("GET", path+params, nil)
	if err != nil {
		return nil, Pagination{}, err
	}

	var apiResp rawArrayResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, Pagination{}, fmt.Errorf("failed to parse response: %w", err)
	}

	var items []map[string]interface{}
	if len(apiResp.Data) > 0 {
		if err := json.Unmarshal(apiResp.Data, &items); err != nil {
			return nil, Pagination{}, fmt.Errorf("failed to parse raw array data: %w", err)
		}
	}

	return items, apiResp.Pagination, nil
}

func fetchAllAssetsRaw(client *AssetHubClient, args map[string]interface{}) ([]map[string]interface{}, error) {
	params := buildQueryParams(args)
	respBody, err := client.doRequest("GET", "/assets/all"+params, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(apiResp.Data, &items); err != nil {
		return nil, fmt.Errorf("failed to parse asset raw data: %w", err)
	}

	return items, nil
}

func fetchRawScrappingData(client *AssetHubClient, args map[string]interface{}) ([]map[string]interface{}, Pagination, error) {
	params := buildQueryParams(args)
	respBody, err := client.doRequest("GET", "/scrapping"+params, nil)
	if err != nil {
		return nil, Pagination{}, err
	}

	var apiResp rawScrappingResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, Pagination{}, fmt.Errorf("failed to parse scrapping response: %w", err)
	}

	return apiResp.Data.Records, apiResp.Data.Pagination, nil
}

func containsKeyword(text string, keyword string) bool {
	if keyword == "" {
		return true
	}
	return strings.Contains(strings.ToLower(text), strings.ToLower(keyword))
}

func mapMatchesAnyKeyword(item map[string]interface{}, keyword string, fields ...string) bool {
	if keyword == "" {
		return true
	}
	for _, field := range fields {
		if containsKeyword(extractStringFromMap(item, field), keyword) {
			return true
		}
	}
	return false
}

func mapMatchesDepartment(item map[string]interface{}, department string, fields ...string) bool {
	if department == "" {
		return true
	}
	for _, field := range fields {
		if containsKeyword(extractStringFromMap(item, field), department) {
			return true
		}
	}
	return false
}

func appendCount(counter map[string]int, key string) {
	key = strings.TrimSpace(key)
	if key == "" {
		key = "未标记"
	}
	counter[key] = counter[key] + 1
}

func topCountItems(counter map[string]int, limit int) []countedItem {
	items := make([]countedItem, 0, len(counter))
	for name, count := range counter {
		items = append(items, countedItem{Name: name, Count: count})
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].Count == items[j].Count {
			return items[i].Name < items[j].Name
		}
		return items[i].Count > items[j].Count
	})

	if limit > 0 && len(items) > limit {
		return items[:limit]
	}
	return items
}

func sumCounter(counter map[string]int) int {
	total := 0
	for _, count := range counter {
		total += count
	}
	return total
}

func sampleAssetMaps(items []map[string]interface{}, limit int) []map[string]interface{} {
	if limit <= 0 {
		limit = 10
	}
	if len(items) < limit {
		limit = len(items)
	}

	samples := make([]map[string]interface{}, 0, limit)
	for i := 0; i < limit; i++ {
		item := items[i]
		samples = append(samples, map[string]interface{}{
			"asset_code":         extractStringFromMap(item, "asset_code"),
			"asset_name":         extractStringFromMap(item, "asset_name"),
			"status":             extractStringFromMap(item, "status"),
			"category_name":      extractStringFromMap(item, "category_name"),
			"department":         firstNonEmpty(extractStringFromMap(item, "department_name"), extractStringFromMap(item, "department"), extractStringFromMap(item, "department_new")),
			"location":           extractStringFromMap(item, "location"),
			"responsible_person": firstNonEmpty(extractStringFromMap(item, "responsible_person_name"), extractStringFromMap(item, "responsible_person")),
		})
	}
	return samples
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func requestedTenantIDOrNil(tenantID int, provided bool) interface{} {
	if !provided || tenantID <= 0 {
		return nil
	}
	return tenantID
}

func queryDepartmentAssetProfile(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	department, ok := args["department"].(string)
	if !ok || strings.TrimSpace(department) == "" {
		return nil, fmt.Errorf("department is required")
	}
	sanitizedDepartment, err := validateKeyword(department)
	if err != nil {
		return nil, err
	}

	keyword := ""
	if v, ok := args["keyword"].(string); ok && strings.TrimSpace(v) != "" {
		sanitizedKeyword, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		keyword = sanitizedKeyword
	}

	includeMaintenance := true
	if v, ok := args["include_maintenance"].(bool); ok {
		includeMaintenance = v
	}
	includeWorkorders := true
	if v, ok := args["include_workorders"].(bool); ok {
		includeWorkorders = v
	}

	sampleLimit := parseSampleLimit(args, 10)
	assetArgs := map[string]interface{}{
		"department": sanitizedDepartment,
	}
	if keyword != "" {
		assetArgs["search"] = keyword
	}

	assets, err := fetchAllAssetsRaw(client, assetArgs)
	if err != nil {
		return nil, err
	}

	statusCounter := map[string]int{}
	categoryCounter := map[string]int{}
	locationCounter := map[string]int{}
	assetCodeSet := make(map[string]bool, len(assets))
	totalPurchaseValue := 0.0
	totalCurrentValue := 0.0
	missingResponsibleCount := 0
	missingLocationCount := 0

	for _, item := range assets {
		appendCount(statusCounter, extractStringFromMap(item, "status"))
		appendCount(categoryCounter, extractStringFromMap(item, "category_name"))
		appendCount(locationCounter, firstNonEmpty(extractStringFromMap(item, "location"), "未标记位置"))
		totalPurchaseValue += extractFloatFromMap(item, "purchase_price")
		totalCurrentValue += extractFloatFromMap(item, "current_value")

		assetCode := extractStringFromMap(item, "asset_code")
		if assetCode != "" {
			assetCodeSet[assetCode] = true
		}
		if firstNonEmpty(extractStringFromMap(item, "responsible_person_name"), extractStringFromMap(item, "responsible_person")) == "" {
			missingResponsibleCount++
		}
		if extractStringFromMap(item, "location") == "" {
			missingLocationCount++
		}
	}

	response := map[string]interface{}{
		"scope": map[string]interface{}{
			"department": sanitizedDepartment,
			"keyword":    keyword,
		},
		"summary": map[string]interface{}{
			"total_assets":              len(assets),
			"total_purchase_value":      totalPurchaseValue,
			"total_current_value":       totalCurrentValue,
			"status_distribution":       topCountItems(statusCounter, 10),
			"top_categories":            topCountItems(categoryCounter, 10),
			"top_locations":             topCountItems(locationCounter, 10),
			"missing_responsible_count": missingResponsibleCount,
			"missing_location_count":    missingLocationCount,
		},
		"sample_assets": sampleAssetMaps(assets, sampleLimit),
		"coverage": map[string]interface{}{
			"asset_source": "assets/all",
		},
	}
	warnings := make([]string, 0)

	if includeMaintenance {
		maintenanceArgs := map[string]interface{}{
			"page":  float64(1),
			"limit": float64(100),
		}
		maintenanceItems, pagination, maintenanceErr := fetchRawArrayData(client, "/maintenance/logs", maintenanceArgs)
		if maintenanceErr != nil {
			warnings = append(warnings, fmt.Sprintf("维护负荷摘要获取失败: %v", maintenanceErr))
		} else {
			filteredMaintenance := make([]map[string]interface{}, 0)
			maintenanceStatusCounter := map[string]int{}
			maintenanceTypeCounter := map[string]int{}
			for _, item := range maintenanceItems {
				matchesScope := mapMatchesDepartment(item, sanitizedDepartment, "department")
				if !matchesScope && len(assetCodeSet) > 0 {
					matchesScope = assetCodeSet[extractStringFromMap(item, "asset_code")]
				}
				if keyword != "" && !mapMatchesAnyKeyword(item, keyword, "asset_code", "asset_name", "maintenance_content", "maintenance_type") {
					matchesScope = false
				}
				if !matchesScope {
					continue
				}

				filteredMaintenance = append(filteredMaintenance, item)
				appendCount(maintenanceStatusCounter, extractStringFromMap(item, "status"))
				appendCount(maintenanceTypeCounter, extractStringFromMap(item, "maintenance_type"))
			}

			response["maintenance_snapshot"] = map[string]interface{}{
				"scanned_records":      len(maintenanceItems),
				"matched_records":      len(filteredMaintenance),
				"status_distribution":  topCountItems(maintenanceStatusCounter, 10),
				"top_maintenance_type": topCountItems(maintenanceTypeCounter, 10),
				"coverage": map[string]interface{}{
					"page":          pagination.Page,
					"page_size":     pagination.Limit,
					"scanned_pages": 1,
				},
			}
		}
	}

	if includeWorkorders {
		workorderItems, pagination, workorderErr := fetchRawArrayData(client, "/maintenance/workorders", map[string]interface{}{
			"page":  float64(1),
			"limit": float64(100),
		})
		if workorderErr != nil {
			warnings = append(warnings, fmt.Sprintf("维护工单摘要获取失败: %v", workorderErr))
		} else {
			filteredWorkorders := make([]map[string]interface{}, 0)
			workorderStatusCounter := map[string]int{}
			workorderPriorityCounter := map[string]int{}
			pendingWorkorders := 0
			for _, item := range workorderItems {
				matchesScope := false
				if len(assetCodeSet) > 0 {
					matchesScope = assetCodeSet[extractStringFromMap(item, "asset_code")]
				}
				if !matchesScope && keyword != "" {
					matchesScope = mapMatchesAnyKeyword(item, keyword, "asset_code", "asset_name", "title", "description")
				}
				if !matchesScope {
					continue
				}

				filteredWorkorders = append(filteredWorkorders, item)
				status := extractStringFromMap(item, "status")
				appendCount(workorderStatusCounter, status)
				appendCount(workorderPriorityCounter, extractStringFromMap(item, "priority"))
				if status == "pending" || status == "assigned" || status == "in_progress" || status == "pending_acceptance" {
					pendingWorkorders++
				}
			}

			response["workorder_snapshot"] = map[string]interface{}{
				"scanned_records":         len(workorderItems),
				"matched_records":         len(filteredWorkorders),
				"pending_workorder_count": pendingWorkorders,
				"status_distribution":     topCountItems(workorderStatusCounter, 10),
				"priority_distribution":   topCountItems(workorderPriorityCounter, 10),
				"coverage": map[string]interface{}{
					"page":          pagination.Page,
					"page_size":     pagination.Limit,
					"scanned_pages": 1,
				},
			}
		}
	}

	if len(warnings) > 0 {
		response["warnings"] = warnings
	}

	return response, nil
}

func queryAssetOperationOverview(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	assetCode := strings.TrimSpace(extractStringOverrideValue(args, "asset_code"))
	keyword := strings.TrimSpace(extractStringOverrideValue(args, "keyword"))
	department := strings.TrimSpace(extractStringOverrideValue(args, "department"))
	if assetCode == "" && keyword == "" && department == "" {
		return nil, fmt.Errorf("one of asset_code, keyword, or department is required")
	}

	if assetCode != "" {
		if err := validateAssetCode(assetCode); err != nil {
			return nil, err
		}
	}
	if keyword != "" {
		sanitizedKeyword, err := validateKeyword(keyword)
		if err != nil {
			return nil, err
		}
		keyword = sanitizedKeyword
	}
	if department != "" {
		sanitizedDepartment, err := validateKeyword(department)
		if err != nil {
			return nil, err
		}
		department = sanitizedDepartment
	}

	includeIdle := true
	if v, ok := args["include_idle"].(bool); ok {
		includeIdle = v
	}
	includeScrap := true
	if v, ok := args["include_scrap"].(bool); ok {
		includeScrap = v
	}

	sampleLimit := parseSampleLimit(args, 10)
	assetArgs := map[string]interface{}{}
	if keyword != "" {
		assetArgs["search"] = keyword
	}
	if department != "" {
		assetArgs["department"] = department
	}
	if assetCode != "" && keyword == "" {
		assetArgs["search"] = assetCode
	}

	assets, err := fetchAllAssetsRaw(client, assetArgs)
	if err != nil {
		return nil, err
	}

	assetCodeSet := make(map[string]bool, len(assets))
	for _, item := range assets {
		code := extractStringFromMap(item, "asset_code")
		if code != "" {
			assetCodeSet[code] = true
		}
	}
	if assetCode != "" && !assetCodeSet[assetCode] {
		assetCodeSet[assetCode] = true
	}

	scopeMatcher := func(item map[string]interface{}, assetFields []string, deptFields []string, extraFields []string) bool {
		if len(assetCodeSet) > 0 {
			for _, field := range assetFields {
				if assetCodeSet[extractStringFromMap(item, field)] {
					return true
				}
			}
		}

		matches := false
		if department != "" {
			matches = mapMatchesDepartment(item, department, deptFields...)
		}
		if keyword != "" {
			fields := append([]string{}, assetFields...)
			fields = append(fields, extraFields...)
			if mapMatchesAnyKeyword(item, keyword, fields...) {
				matches = true
			}
		}
		return matches
	}

	maintenanceItems, _, maintenanceErr := fetchRawArrayData(client, "/maintenance/logs", map[string]interface{}{
		"page":  float64(1),
		"limit": float64(100),
	})
	workorderItems, _, workorderErr := fetchRawArrayData(client, "/maintenance/workorders", map[string]interface{}{
		"page":  float64(1),
		"limit": float64(100),
	})
	transferItems, _, transferErr := fetchRawArrayData(client, "/transfer", map[string]interface{}{
		"page":  float64(1),
		"limit": float64(100),
	})

	warnings := []string{}
	if maintenanceErr != nil {
		warnings = append(warnings, fmt.Sprintf("maintenance logs unavailable: %v", maintenanceErr))
	}
	if workorderErr != nil {
		warnings = append(warnings, fmt.Sprintf("maintenance workorders unavailable: %v", workorderErr))
	}
	if transferErr != nil {
		warnings = append(warnings, fmt.Sprintf("transfer records unavailable: %v", transferErr))
	}

	filteredMaintenance := make([]map[string]interface{}, 0)
	maintenanceStatusCounter := map[string]int{}
	for _, item := range maintenanceItems {
		if !scopeMatcher(item, []string{"asset_code"}, []string{"department"}, []string{"asset_name", "maintenance_type", "maintenance_content"}) {
			continue
		}
		filteredMaintenance = append(filteredMaintenance, item)
		appendCount(maintenanceStatusCounter, extractStringFromMap(item, "status"))
	}

	filteredWorkorders := make([]map[string]interface{}, 0)
	workorderStatusCounter := map[string]int{}
	for _, item := range workorderItems {
		if !scopeMatcher(item, []string{"asset_code"}, []string{}, []string{"asset_name", "title", "description"}) {
			continue
		}
		filteredWorkorders = append(filteredWorkorders, item)
		appendCount(workorderStatusCounter, extractStringFromMap(item, "status"))
	}

	filteredTransfers := make([]map[string]interface{}, 0)
	transferStatusCounter := map[string]int{}
	for _, item := range transferItems {
		if !scopeMatcher(item, []string{"asset_code"}, []string{"from_department", "to_department"}, []string{"asset_name", "transfer_reason", "status"}) {
			continue
		}
		filteredTransfers = append(filteredTransfers, item)
		appendCount(transferStatusCounter, extractStringFromMap(item, "status"))
	}

	filteredIdle := make([]map[string]interface{}, 0)
	idleStatusCounter := map[string]int{}
	idleScannedCount := 0
	if includeIdle {
		idleItems, _, idleErr := fetchRawArrayData(client, "/idle", map[string]interface{}{
			"page":  float64(1),
			"limit": float64(100),
		})
		if idleErr != nil {
			warnings = append(warnings, fmt.Sprintf("idle records unavailable: %v", idleErr))
		} else {
			idleScannedCount = len(idleItems)
			for _, item := range idleItems {
				if !scopeMatcher(item, []string{"asset_code"}, []string{"department"}, []string{"asset_name", "status", "asset_status"}) {
					continue
				}
				filteredIdle = append(filteredIdle, item)
				appendCount(idleStatusCounter, extractStringFromMap(item, "status"))
			}
		}
	}

	filteredScrap := make([]map[string]interface{}, 0)
	scrapStatusCounter := map[string]int{}
	scrapScannedCount := 0
	if includeScrap {
		scrapItems, _, scrapErr := fetchRawScrappingData(client, map[string]interface{}{
			"page":  float64(1),
			"limit": float64(100),
		})
		if scrapErr != nil {
			warnings = append(warnings, fmt.Sprintf("scrapping records unavailable: %v", scrapErr))
		} else {
			scrapScannedCount = len(scrapItems)
			for _, item := range scrapItems {
				if !scopeMatcher(item, []string{"asset_code"}, []string{"department"}, []string{"asset_name", "scrapping_reason", "current_status"}) {
					continue
				}
				filteredScrap = append(filteredScrap, item)
				appendCount(scrapStatusCounter, extractStringFromMap(item, "current_status"))
			}
		}
	}

	recentEvents := make([]map[string]interface{}, 0)
	appendEvent := func(domain string, title string, status string, date string) {
		recentEvents = append(recentEvents, map[string]interface{}{
			"domain": domain,
			"title":  title,
			"status": status,
			"date":   date,
		})
	}

	for _, item := range filteredMaintenance {
		appendEvent("maintenance_log", firstNonEmpty(extractStringFromMap(item, "asset_name"), extractStringFromMap(item, "asset_code")), extractStringFromMap(item, "status"), extractStringFromMap(item, "maintenance_date"))
	}
	for _, item := range filteredWorkorders {
		appendEvent("maintenance_workorder", firstNonEmpty(extractStringFromMap(item, "title"), extractStringFromMap(item, "asset_name"), extractStringFromMap(item, "asset_code")), extractStringFromMap(item, "status"), extractStringFromMap(item, "created_at"))
	}
	for _, item := range filteredTransfers {
		appendEvent("transfer", firstNonEmpty(extractStringFromMap(item, "asset_name"), extractStringFromMap(item, "asset_code")), extractStringFromMap(item, "status"), firstNonEmpty(extractStringFromMap(item, "transfer_date"), extractStringFromMap(item, "created_at")))
	}
	for _, item := range filteredIdle {
		appendEvent("idle", firstNonEmpty(extractStringFromMap(item, "asset_name"), extractStringFromMap(item, "asset_code")), extractStringFromMap(item, "status"), firstNonEmpty(extractStringFromMap(item, "publish_date"), extractStringFromMap(item, "created_at")))
	}
	for _, item := range filteredScrap {
		appendEvent("scrapping", firstNonEmpty(extractStringFromMap(item, "asset_name"), extractStringFromMap(item, "asset_code")), extractStringFromMap(item, "current_status"), firstNonEmpty(extractStringFromMap(item, "apply_date"), extractStringFromMap(item, "updated_at")))
	}

	sort.Slice(recentEvents, func(i, j int) bool {
		return fmt.Sprintf("%v", recentEvents[i]["date"]) > fmt.Sprintf("%v", recentEvents[j]["date"])
	})
	if len(recentEvents) > sampleLimit {
		recentEvents = recentEvents[:sampleLimit]
	}

	response := map[string]interface{}{
		"scope": map[string]interface{}{
			"asset_code": assetCode,
			"keyword":    keyword,
			"department": department,
		},
		"matched_assets": map[string]interface{}{
			"count":         len(assets),
			"sample_assets": sampleAssetMaps(assets, sampleLimit),
		},
		"workflow_summary": map[string]interface{}{
			"maintenance_logs": map[string]interface{}{
				"count":               len(filteredMaintenance),
				"status_distribution": topCountItems(maintenanceStatusCounter, 10),
			},
			"maintenance_workorders": map[string]interface{}{
				"count":               len(filteredWorkorders),
				"status_distribution": topCountItems(workorderStatusCounter, 10),
			},
			"transfer_records": map[string]interface{}{
				"count":               len(filteredTransfers),
				"status_distribution": topCountItems(transferStatusCounter, 10),
			},
			"idle_records": map[string]interface{}{
				"count":               len(filteredIdle),
				"status_distribution": topCountItems(idleStatusCounter, 10),
			},
			"scrapping_records": map[string]interface{}{
				"count":               len(filteredScrap),
				"status_distribution": topCountItems(scrapStatusCounter, 10),
			},
		},
		"recent_events": recentEvents,
		"coverage": map[string]interface{}{
			"maintenance_logs_scanned":  len(maintenanceItems),
			"workorders_scanned":        len(workorderItems),
			"transfers_scanned":         len(transferItems),
			"idle_records_scanned":      idleScannedCount,
			"scrapping_records_scanned": scrapScannedCount,
			"workflow_page_scan_limit":  100,
		},
	}
	if len(warnings) > 0 {
		response["warnings"] = warnings
	}

	return response, nil
}

func queryWorkflowPendingSummary(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	keyword := strings.TrimSpace(extractStringOverrideValue(args, "keyword"))
	department := strings.TrimSpace(extractStringOverrideValue(args, "department"))
	if keyword != "" {
		sanitizedKeyword, err := validateKeyword(keyword)
		if err != nil {
			return nil, err
		}
		keyword = sanitizedKeyword
	}
	if department != "" {
		sanitizedDepartment, err := validateKeyword(department)
		if err != nil {
			return nil, err
		}
		department = sanitizedDepartment
	}

	sampleLimit := parseSampleLimit(args, 10)
	assetArgs := map[string]interface{}{}
	if keyword != "" {
		assetArgs["search"] = keyword
	}
	if department != "" {
		assetArgs["department"] = department
	}

	assetCodeSet := map[string]bool{}
	if keyword != "" || department != "" {
		assets, err := fetchAllAssetsRaw(client, assetArgs)
		if err == nil {
			for _, item := range assets {
				code := extractStringFromMap(item, "asset_code")
				if code != "" {
					assetCodeSet[code] = true
				}
			}
		}
	}

	scopeMatcher := func(item map[string]interface{}, assetFields []string, deptFields []string, extraFields []string) bool {
		if len(assetCodeSet) > 0 {
			for _, field := range assetFields {
				if assetCodeSet[extractStringFromMap(item, field)] {
					return true
				}
			}
		}
		if department != "" && mapMatchesDepartment(item, department, deptFields...) {
			return true
		}
		if keyword != "" && mapMatchesAnyKeyword(item, keyword, append(append([]string{}, assetFields...), extraFields...)...) {
			return true
		}
		return keyword == "" && department == "" && len(assetCodeSet) == 0
	}

	warnings := []string{}

	workorderItems, _, workorderErr := fetchRawArrayData(client, "/maintenance/workorders", map[string]interface{}{
		"page":  float64(1),
		"limit": float64(100),
	})
	if workorderErr != nil {
		warnings = append(warnings, fmt.Sprintf("maintenance workorders unavailable: %v", workorderErr))
	}
	filteredWorkorders := make([]map[string]interface{}, 0)
	for _, item := range workorderItems {
		if scopeMatcher(item, []string{"asset_code"}, []string{}, []string{"asset_name", "title", "description"}) {
			filteredWorkorders = append(filteredWorkorders, item)
		}
	}

	transferItems, _, transferErr := fetchRawArrayData(client, "/transfer", map[string]interface{}{
		"page":  float64(1),
		"limit": float64(100),
	})
	if transferErr != nil {
		warnings = append(warnings, fmt.Sprintf("transfer records unavailable: %v", transferErr))
	}
	filteredTransfers := make([]map[string]interface{}, 0)
	for _, item := range transferItems {
		if scopeMatcher(item, []string{"asset_code"}, []string{"from_department", "to_department"}, []string{"asset_name", "status"}) {
			filteredTransfers = append(filteredTransfers, item)
		}
	}

	idleItems, _, idleErr := fetchRawArrayData(client, "/idle", map[string]interface{}{
		"page":  float64(1),
		"limit": float64(100),
	})
	if idleErr != nil {
		warnings = append(warnings, fmt.Sprintf("idle records unavailable: %v", idleErr))
	}
	filteredIdle := make([]map[string]interface{}, 0)
	for _, item := range idleItems {
		if scopeMatcher(item, []string{"asset_code"}, []string{"department"}, []string{"asset_name", "status", "asset_status"}) {
			filteredIdle = append(filteredIdle, item)
		}
	}

	scrapItems, _, scrapErr := fetchRawScrappingData(client, map[string]interface{}{
		"page":  float64(1),
		"limit": float64(100),
	})
	if scrapErr != nil {
		warnings = append(warnings, fmt.Sprintf("scrapping records unavailable: %v", scrapErr))
	}
	filteredScrap := make([]map[string]interface{}, 0)
	for _, item := range scrapItems {
		if scopeMatcher(item, []string{"asset_code"}, []string{"department"}, []string{"asset_name", "scrapping_reason", "current_status"}) {
			filteredScrap = append(filteredScrap, item)
		}
	}

	inventoryItems, _, inventoryErr := fetchRawArrayData(client, "/inventory", map[string]interface{}{
		"page":  float64(1),
		"limit": float64(100),
	})
	if inventoryErr != nil {
		warnings = append(warnings, fmt.Sprintf("inventory records unavailable: %v", inventoryErr))
	}
	filteredInventory := make([]map[string]interface{}, 0)
	for _, item := range inventoryItems {
		if scopeMatcher(item, []string{"asset_code"}, []string{"department", "department_name"}, []string{"item_name", "warehouse", "location", "status"}) {
			filteredInventory = append(filteredInventory, item)
		}
	}

	workorderPending := map[string]int{}
	for _, item := range filteredWorkorders {
		status := extractStringFromMap(item, "status")
		if status == "pending" || status == "assigned" || status == "in_progress" || status == "pending_acceptance" {
			appendCount(workorderPending, status)
		}
	}

	transferPending := map[string]int{}
	for _, item := range filteredTransfers {
		status := extractStringFromMap(item, "status")
		if status == "待审批" || status == "pending" {
			appendCount(transferPending, status)
		}
	}

	idlePending := map[string]int{}
	for _, item := range filteredIdle {
		status := extractStringFromMap(item, "status")
		if status == "发布中" {
			appendCount(idlePending, status)
		}
	}

	scrapPending := map[string]int{}
	for _, item := range filteredScrap {
		status := extractStringFromMap(item, "current_status")
		if status == "pending" || status == "appraising" || status == "disposing" {
			appendCount(scrapPending, status)
		}
	}

	inventoryPending := map[string]int{}
	for _, item := range filteredInventory {
		status := extractStringFromMap(item, "status")
		if status == "进行中" {
			appendCount(inventoryPending, status)
		}
	}

	type bottleneckItem struct {
		Domain string `json:"domain"`
		Count  int    `json:"count"`
	}
	bottlenecks := []bottleneckItem{
		{Domain: "maintenance_workorders", Count: sumCounter(workorderPending)},
		{Domain: "transfer_records", Count: sumCounter(transferPending)},
		{Domain: "idle_records", Count: sumCounter(idlePending)},
		{Domain: "scrapping_records", Count: sumCounter(scrapPending)},
		{Domain: "inventory_records", Count: sumCounter(inventoryPending)},
	}
	sort.Slice(bottlenecks, func(i, j int) bool {
		return bottlenecks[i].Count > bottlenecks[j].Count
	})

	priorityItems := make([]map[string]interface{}, 0)
	appendPriority := func(domain string, title string, status string, date string) {
		priorityItems = append(priorityItems, map[string]interface{}{
			"domain": domain,
			"title":  title,
			"status": status,
			"date":   date,
		})
	}
	for _, item := range filteredWorkorders {
		status := extractStringFromMap(item, "status")
		if status == "pending" || status == "assigned" || status == "in_progress" || status == "pending_acceptance" {
			appendPriority("maintenance_workorder", firstNonEmpty(extractStringFromMap(item, "title"), extractStringFromMap(item, "asset_name"), extractStringFromMap(item, "asset_code")), status, extractStringFromMap(item, "created_at"))
		}
	}
	for _, item := range filteredTransfers {
		if status := extractStringFromMap(item, "status"); status == "待审批" || status == "pending" {
			appendPriority("transfer", firstNonEmpty(extractStringFromMap(item, "asset_name"), extractStringFromMap(item, "asset_code")), status, firstNonEmpty(extractStringFromMap(item, "transfer_date"), extractStringFromMap(item, "created_at")))
		}
	}
	for _, item := range filteredScrap {
		if status := extractStringFromMap(item, "current_status"); status == "pending" || status == "appraising" || status == "disposing" {
			appendPriority("scrapping", firstNonEmpty(extractStringFromMap(item, "asset_name"), extractStringFromMap(item, "asset_code")), status, extractStringFromMap(item, "apply_date"))
		}
	}
	sort.Slice(priorityItems, func(i, j int) bool {
		return fmt.Sprintf("%v", priorityItems[i]["date"]) > fmt.Sprintf("%v", priorityItems[j]["date"])
	})
	if len(priorityItems) > sampleLimit {
		priorityItems = priorityItems[:sampleLimit]
	}

	response := map[string]interface{}{
		"scope": map[string]interface{}{
			"department": department,
			"keyword":    keyword,
		},
		"pending_summary": map[string]interface{}{
			"maintenance_workorders": topCountItems(workorderPending, 10),
			"transfer_records":       topCountItems(transferPending, 10),
			"idle_records":           topCountItems(idlePending, 10),
			"scrapping_records":      topCountItems(scrapPending, 10),
			"inventory_records":      topCountItems(inventoryPending, 10),
		},
		"bottlenecks":    bottlenecks,
		"priority_items": priorityItems,
		"coverage": map[string]interface{}{
			"workorders_scanned": len(workorderItems),
			"transfers_scanned":  len(transferItems),
			"idle_scanned":       len(idleItems),
			"scrap_scanned":      len(scrapItems),
			"inventory_scanned":  len(inventoryItems),
			"page_scan_limit":    100,
		},
	}
	if len(warnings) > 0 {
		response["warnings"] = warnings
	}

	return response, nil
}

func extractStringOverrideValue(args map[string]interface{}, key string) string {
	if len(args) == 0 {
		return ""
	}
	value, ok := args[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return fmt.Sprintf("%v", typed)
	}
}

// initAIConversation initializes AI conversation
func initAIConversation(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := map[string]interface{}{}
	if v, ok := args["type"].(string); ok && v != "" {
		req["type"] = sanitizeInput(v)
	}
	if v, ok := args["user_id"].(string); ok && v != "" {
		req["userId"] = sanitizeInput(v)
	}
	if len(req) == 0 {
		req = nil
	}

	respBody, err := client.doRequest("POST", "/maintenance/ai/init", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return apiResp, nil
}

// sendAIMessage sends message to AI conversation
func sendAIMessage(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	conversationID, ok := args["conversation_id"].(string)
	if !ok || conversationID == "" {
		return nil, fmt.Errorf("conversation_id is required")
	}

	message, ok := args["message"].(string)
	if !ok || message == "" {
		return nil, fmt.Errorf("message is required")
	}

	req := map[string]interface{}{
		"conversationId": conversationID,
		"message":        message,
	}

	if v, ok := args["context"].(map[string]interface{}); ok {
		req["context"] = v
	}
	if v, ok := args["history"].([]interface{}); ok {
		req["history"] = v
	}

	respBody, err := client.doRequest("POST", "/maintenance/ai/message", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return apiResp, nil
}

// getAIPending retrieves AI pending requests
func getAIPending(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	respBody, err := client.doRequest("GET", "/maintenance/ai/pending", nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return apiResp, nil
}

// getAIAnalysis retrieves AI maintenance analysis
func getAIAnalysis(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := buildQueryParams(args)
	path := "/maintenance/ai/analysis" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return apiResp, nil
}

// getPatientVolumeRecords retrieves patient volume records
func getPatientVolumeRecords(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := buildQueryParams(args)
	path := "/iot/patient-volume/records/all" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var records []PatientVolumeRecord
	if err := json.Unmarshal(apiResp.Data, &records); err != nil {
		return nil, fmt.Errorf("failed to parse records: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    records,
	}, nil
}

// getAssetUsageStats retrieves asset usage statistics
func getAssetUsageStats(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := buildQueryParams(args)
	path := "/iot/patient-volume/assets/usage-stats/all" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var stats []AssetUsageStats
	if err := json.Unmarshal(apiResp.Data, &stats); err != nil {
		return nil, fmt.Errorf("failed to parse stats: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    stats,
	}, nil
}

func featureUnavailableError(feature, detail string) error {
	if detail == "" {
		return fmt.Errorf("%s 当前没有可用的后端接口", feature)
	}
	return fmt.Errorf("%s 当前没有可用的后端接口: %s", feature, detail)
}

func decodeResponseData(respBody []byte) (interface{}, error) {
	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var data interface{}
	if len(apiResp.Data) > 0 {
		if err := json.Unmarshal(apiResp.Data, &data); err != nil {
			return nil, fmt.Errorf("failed to parse response data: %w", err)
		}
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    data,
		"message": apiResp.Message,
	}, nil
}

// buildQueryParams builds query string from args
func buildQueryParams(args map[string]interface{}) string {
	if len(args) == 0 {
		return ""
	}

	// Whitelist allowed query parameter names
	allowedParams := map[string]bool{
		"page": true, "limit": true, "keyword": true, "search": true,
		"pageSize": true, "page_size": true,
		"asset_code": true, "status": true, "department": true,
		"department_code": true, "department_id": true, "category_id": true,
		"location": true, "sortField": true, "sortOrder": true,
		"tree": true, "parent_id": true, "include_children": true,
		"id": true, "type": true, "priority": true, "assigned_to": true,
		"start_date": true, "end_date": true, "start_time": true, "end_time": true,
		"batch_size": true, "patient_id": true,
		"from_state": true, "fault_level": true,
		"usage_type": true,
		// Procurement
		"quantity": true, "estimated_cost": true, "expected_date": true, "specification": true,
		// Quality Control
		"qc_type": true, "qc_date": true, "qc_person": true, "result": true,
		"finding": true, "action_required": true,
		// Inventory
		"warehouse": true, "item_name": true, "unit": true, "adjust_type": true,
		"inventory_id": true, "assignee": true, "handling_status": true,
		// Scrapping
		"description": true, "estimated_value": true, "apply_date": true,
		// Acceptance
		"acceptance_date": true, "acceptor": true,
		// User Management
		"user_id": true, "role": true, "email": true, "phone": true,
		"new_password": true, "username": true, "real_name": true,
		// Module
		"module_code": true, "module_id": true, "config": true,
		// Audit
		"action": true, "resource": true,
		// Tenant
		"module_codes": true,
		// IoT/Device Management
		"device_type": true, "device_name": true, "device_code": true,
		"latitude": true, "longitude": true, "zone_id": true,
		"is_active": true, "is_handled": true, "alert_level": true,
		// Intelligent Alerts
		"alert_type": true, "severity": true, "urgency": true, "unreadOnly": true,
		// Document Management
		"doc_type": true, "title": true, "file_url": true, "category": true,
		"name": true, "color": true, "label_id": true, "url": true,
		"review_status": true, "content": true, "asset_type": true, "brand": true, "resolved": true,
		// Intelligent Analytics
		"days_ahead": true, "risk_level": true,
		// Depreciation
		"method": true, "as_of_date": true, "residual_rate": true,
		"include_disposed": true, "exclude_statuses": true,
		"purchase_date_start": true, "purchase_date_end": true,
		"months": true,
	}

	var queries []string
	for k, v := range args {
		if v == nil {
			continue
		}
		// Validate parameter name is allowed (prevent injection via parameter names)
		if !allowedParams[k] {
			continue
		}
		switch val := v.(type) {
		case string:
			if val != "" {
				if k == "limit" {
					queries = append(queries, fmt.Sprintf("%s=%s", url.QueryEscape("pageSize"), url.QueryEscape(val)))
				}
				queries = append(queries, fmt.Sprintf("%s=%s", url.QueryEscape(k), url.QueryEscape(val)))
			}
		case float64:
			if k == "limit" {
				queries = append(queries, fmt.Sprintf("%s=%s", url.QueryEscape("pageSize"), url.QueryEscape(strconv.FormatFloat(val, 'f', -1, 64))))
			}
			queries = append(queries, fmt.Sprintf("%s=%s", url.QueryEscape(k), url.QueryEscape(strconv.FormatFloat(val, 'f', -1, 64))))
		case int:
			if k == "limit" {
				queries = append(queries, fmt.Sprintf("%s=%s", url.QueryEscape("pageSize"), url.QueryEscape(strconv.Itoa(val))))
			}
			queries = append(queries, fmt.Sprintf("%s=%s", url.QueryEscape(k), url.QueryEscape(strconv.Itoa(val))))
		case int64:
			if k == "limit" {
				queries = append(queries, fmt.Sprintf("%s=%s", url.QueryEscape("pageSize"), url.QueryEscape(strconv.FormatInt(val, 10))))
			}
			queries = append(queries, fmt.Sprintf("%s=%s", url.QueryEscape(k), url.QueryEscape(strconv.FormatInt(val, 10))))
		case bool:
			queries = append(queries, fmt.Sprintf("%s=%t", url.QueryEscape(k), val))
		}
	}

	if len(queries) == 0 {
		return ""
	}
	return "?" + strings.Join(queries, "&")
}

// ============== Procurement Handlers ==============

func listProcurements(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}
	args["page"] = page
	args["limit"] = limit

	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		args["keyword"] = sanitized
	}

	params := buildQueryParams(args)
	path := "/procurement/requests" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func createProcurement(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["asset_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "asset_name"); err != nil {
			return nil, err
		}
		req["asset_name"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("asset_name is required")
	}

	if v, ok := args["category_id"].(float64); ok {
		req["category_id"] = int(v)
	}

	if v, ok := args["quantity"].(float64); ok {
		req["quantity"] = int(v)
	}

	if v, ok := args["estimated_cost"].(float64); ok {
		if v < 0 || v > 1e12 {
			return nil, fmt.Errorf("estimated_cost out of valid range")
		}
		req["estimated_cost"] = v
	}

	if v, ok := args["department"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "department"); err != nil {
			return nil, err
		}
		req["department"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("department is required")
	}

	if v, ok := args["reason"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "reason"); err != nil {
			return nil, err
		}
		req["reason"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("reason is required")
	}

	if v, ok := args["expected_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "expected_date"); err != nil {
			return nil, err
		}
		req["expected_date"] = v
	}

	if v, ok := args["specification"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "specification"); err != nil {
			return nil, err
		}
		req["specification"] = sanitizeInput(v)
	}

	respBody, err := client.doRequest("POST", "/procurement/requests", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}, nil
}

func approveProcurement(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	action, ok := args["action"].(string)
	if !ok || (action != "approve" && action != "reject") {
		return nil, fmt.Errorf("action is required and must be 'approve' or 'reject'")
	}

	req := map[string]interface{}{
		"action": action,
	}
	if v, ok := args["comment"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "comment"); err != nil {
			return nil, err
		}
		req["comment"] = sanitizeInput(v)
	}

	path := fmt.Sprintf("/procurement/requests/%d/approve", int(id))
	respBody, err := client.doRequest("PUT", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// ============== Quality Control Handlers ==============

func listQualityControls(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}
	args["page"] = page
	args["limit"] = limit

	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		args["keyword"] = sanitized
	}

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
	}

	params := buildQueryParams(args)
	path := "/quality-control" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func createQualityControl(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		req["asset_code"] = v
	} else {
		return nil, fmt.Errorf("asset_code is required")
	}

	if v, ok := args["qc_type"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "qc_type"); err != nil {
			return nil, err
		}
		req["qc_type"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("qc_type is required")
	}

	if v, ok := args["qc_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "qc_date"); err != nil {
			return nil, err
		}
		req["qc_date"] = v
	} else {
		return nil, fmt.Errorf("qc_date is required")
	}

	if v, ok := args["qc_person"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "qc_person"); err != nil {
			return nil, err
		}
		req["qc_person"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("qc_person is required")
	}

	if v, ok := args["result"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "result"); err != nil {
			return nil, err
		}
		req["result"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("result is required")
	}

	if v, ok := args["finding"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "finding"); err != nil {
			return nil, err
		}
		req["finding"] = sanitizeInput(v)
	}

	if v, ok := args["action_required"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "action_required"); err != nil {
			return nil, err
		}
		req["action_required"] = sanitizeInput(v)
	}

	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}

	respBody, err := client.doRequest("POST", "/quality-control", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}, nil
}

func getQualityStatistics(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := buildQueryParams(args)
	path := "/quality-control/statistics" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

// ============== Inventory Handlers ==============

func listInventory(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}
	args["page"] = page
	args["limit"] = limit

	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		args["keyword"] = sanitized
	}

	params := buildQueryParams(args)
	path := "/inventory" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func createInventoryRecord(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["item_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "item_name"); err != nil {
			return nil, err
		}
		req["item_name"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("item_name is required")
	}

	if v, ok := args["category_id"].(float64); ok {
		req["category_id"] = int(v)
	}

	if v, ok := args["quantity"].(float64); ok {
		req["quantity"] = int(v)
	} else {
		return nil, fmt.Errorf("quantity is required")
	}

	if v, ok := args["unit"].(string); ok && v != "" {
		if err := validateStringLength(v, 20, "unit"); err != nil {
			return nil, err
		}
		req["unit"] = sanitizeInput(v)
	}

	if v, ok := args["warehouse"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "warehouse"); err != nil {
			return nil, err
		}
		req["warehouse"] = sanitizeInput(v)
	}

	if v, ok := args["location"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "location"); err != nil {
			return nil, err
		}
		req["location"] = sanitizeInput(v)
	}

	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}

	respBody, err := client.doRequest("POST", "/inventory", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}, nil
}

func adjustInventory(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	adjustType, ok := args["adjust_type"].(string)
	if !ok || (adjustType != "in" && adjustType != "out" && adjustType != "adj") {
		return nil, fmt.Errorf("adjust_type is required and must be 'in', 'out', or 'adj'")
	}

	quantity, ok := args["quantity"].(float64)
	if !ok || quantity <= 0 {
		return nil, fmt.Errorf("quantity is required and must be positive")
	}

	reason, ok := args["reason"].(string)
	if !ok || reason == "" {
		return nil, fmt.Errorf("reason is required")
	}

	req := map[string]interface{}{
		"adjust_type": adjustType,
		"quantity":    int(quantity),
		"reason":      sanitizeInput(reason),
	}

	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}

	path := fmt.Sprintf("/inventory/%d/adjust", int(id))
	respBody, err := client.doRequest("PUT", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

func requiredIntArg(args map[string]interface{}, key string) (int, error) {
	raw, exists := args[key]
	if !exists || raw == nil {
		return 0, fmt.Errorf("%s is required", key)
	}

	var value int
	switch typed := raw.(type) {
	case float64:
		if typed != float64(int(typed)) {
			return 0, fmt.Errorf("%s must be an integer", key)
		}
		value = int(typed)
	case int:
		value = typed
	case int64:
		value = int(typed)
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return 0, fmt.Errorf("%s is required", key)
		}
		parsed, err := strconv.Atoi(trimmed)
		if err != nil {
			return 0, fmt.Errorf("%s must be an integer", key)
		}
		value = parsed
	default:
		return 0, fmt.Errorf("%s is required", key)
	}

	if value <= 0 {
		return 0, fmt.Errorf("%s must be greater than 0", key)
	}
	return value, nil
}

func optionalIntArg(args map[string]interface{}, key string) (int, bool, error) {
	raw, exists := args[key]
	if !exists || raw == nil {
		return 0, false, nil
	}

	var value int
	switch typed := raw.(type) {
	case float64:
		if typed != float64(int(typed)) {
			return 0, true, fmt.Errorf("%s must be an integer", key)
		}
		value = int(typed)
	case int:
		value = typed
	case int64:
		value = int(typed)
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return 0, false, nil
		}
		parsed, err := strconv.Atoi(trimmed)
		if err != nil {
			return 0, true, fmt.Errorf("%s must be an integer", key)
		}
		value = parsed
	default:
		return 0, true, fmt.Errorf("%s must be a number", key)
	}

	if value < 0 {
		return 0, true, fmt.Errorf("%s cannot be negative", key)
	}
	return value, true, nil
}

func optionalFloatArg(args map[string]interface{}, key string) (float64, bool, error) {
	raw, exists := args[key]
	if !exists || raw == nil {
		return 0, false, nil
	}

	switch typed := raw.(type) {
	case float64:
		return typed, true, nil
	case int:
		return float64(typed), true, nil
	case int64:
		return float64(typed), true, nil
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return 0, false, nil
		}
		parsed, err := strconv.ParseFloat(trimmed, 64)
		if err != nil {
			return 0, true, fmt.Errorf("%s must be a number", key)
		}
		return parsed, true, nil
	default:
		return 0, true, fmt.Errorf("%s must be a number", key)
	}
}

func optionalSignedIntArg(args map[string]interface{}, key string) (int, bool, error) {
	raw, exists := args[key]
	if !exists || raw == nil {
		return 0, false, nil
	}

	switch typed := raw.(type) {
	case float64:
		if typed != float64(int(typed)) {
			return 0, true, fmt.Errorf("%s must be an integer", key)
		}
		return int(typed), true, nil
	case int:
		return typed, true, nil
	case int64:
		return int(typed), true, nil
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return 0, false, nil
		}
		parsed, err := strconv.Atoi(trimmed)
		if err != nil {
			return 0, true, fmt.Errorf("%s must be an integer", key)
		}
		return parsed, true, nil
	default:
		return 0, true, fmt.Errorf("%s must be a number", key)
	}
}

func optionalBoolArg(args map[string]interface{}, key string) (bool, bool, error) {
	raw, exists := args[key]
	if !exists || raw == nil {
		return false, false, nil
	}

	switch typed := raw.(type) {
	case bool:
		return typed, true, nil
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return false, false, nil
		}
		parsed, err := strconv.ParseBool(trimmed)
		if err != nil {
			return false, true, fmt.Errorf("%s must be a boolean", key)
		}
		return parsed, true, nil
	default:
		return false, true, fmt.Errorf("%s must be a boolean", key)
	}
}

func intSliceArg(args map[string]interface{}, key string) ([]int, error) {
	raw, ok := args[key]
	if !ok || raw == nil {
		return nil, fmt.Errorf("%s is required", key)
	}

	toPositiveInt := func(item interface{}) (int, error) {
		switch typed := item.(type) {
		case float64:
			if typed != float64(int(typed)) || typed <= 0 {
				return 0, fmt.Errorf("%s must contain positive integers", key)
			}
			return int(typed), nil
		case int:
			if typed <= 0 {
				return 0, fmt.Errorf("%s must contain positive integers", key)
			}
			return typed, nil
		case int64:
			if typed <= 0 {
				return 0, fmt.Errorf("%s must contain positive integers", key)
			}
			return int(typed), nil
		default:
			return 0, fmt.Errorf("%s must contain positive integers", key)
		}
	}

	values := []int{}
	switch typed := raw.(type) {
	case []interface{}:
		if len(typed) == 0 {
			return nil, fmt.Errorf("%s is required", key)
		}
		values = make([]int, 0, len(typed))
		for _, item := range typed {
			number, err := toPositiveInt(item)
			if err != nil {
				return nil, err
			}
			values = append(values, number)
		}
	case []int:
		if len(typed) == 0 {
			return nil, fmt.Errorf("%s is required", key)
		}
		values = make([]int, 0, len(typed))
		for _, item := range typed {
			number, err := toPositiveInt(item)
			if err != nil {
				return nil, err
			}
			values = append(values, number)
		}
	default:
		return nil, fmt.Errorf("%s is required", key)
	}
	return values, nil
}

func ensureJSONObject(raw interface{}, key string) (map[string]interface{}, error) {
	switch typed := raw.(type) {
	case map[string]interface{}:
		return typed, nil
	default:
		return nil, fmt.Errorf("%s must be an object", key)
	}
}

func zoneLocationEventsArg(args map[string]interface{}) ([]map[string]interface{}, error) {
	raw, ok := args["events"]
	if !ok || raw == nil {
		return nil, fmt.Errorf("events is required")
	}

	var rawEvents []interface{}
	switch typed := raw.(type) {
	case []interface{}:
		rawEvents = typed
	case []map[string]interface{}:
		rawEvents = make([]interface{}, 0, len(typed))
		for _, item := range typed {
			rawEvents = append(rawEvents, item)
		}
	default:
		return nil, fmt.Errorf("events must be an array")
	}

	if len(rawEvents) == 0 {
		return nil, fmt.Errorf("events is required")
	}

	events := make([]map[string]interface{}, 0, len(rawEvents))
	for idx, rawEvent := range rawEvents {
		event, err := ensureJSONObject(rawEvent, fmt.Sprintf("events[%d]", idx))
		if err != nil {
			return nil, err
		}

		normalized := make(map[string]interface{})

		deviceID, ok := event["device_id"].(string)
		if !ok || strings.TrimSpace(deviceID) == "" {
			return nil, fmt.Errorf("events[%d].device_id is required", idx)
		}
		if err := validateStringLength(deviceID, 100, fmt.Sprintf("events[%d].device_id", idx)); err != nil {
			return nil, err
		}
		normalized["device_id"] = sanitizeInput(deviceID)

		if v, ok := event["asset_code"].(string); ok && strings.TrimSpace(v) != "" {
			if err := validateAssetCode(v); err != nil {
				return nil, fmt.Errorf("events[%d].asset_code: %w", idx, err)
			}
			normalized["asset_code"] = v
		}

		hasLocationRef := false
		stringFields := map[string]int{
			"location_code": 100,
			"area_name":     200,
			"building_name": 200,
			"event_time":    100,
		}
		for field, maxLen := range stringFields {
			if v, ok := event[field].(string); ok && strings.TrimSpace(v) != "" {
				if err := validateStringLength(v, maxLen, fmt.Sprintf("events[%d].%s", idx, field)); err != nil {
					return nil, err
				}
				normalized[field] = sanitizeInput(v)
				if field == "location_code" || field == "area_name" {
					hasLocationRef = true
				}
			}
		}
		if !hasLocationRef {
			return nil, fmt.Errorf("events[%d] requires location_code or area_name", idx)
		}

		if v, ok, err := optionalSignedIntArg(event, "floor_number"); err != nil {
			return nil, fmt.Errorf("events[%d].%s", idx, err.Error())
		} else if ok {
			normalized["floor_number"] = v
		}
		if v, ok, err := optionalSignedIntArg(event, "rssi"); err != nil {
			return nil, fmt.Errorf("events[%d].%s", idx, err.Error())
		} else if ok {
			normalized["rssi"] = v
		}
		if v, ok, err := optionalFloatArg(event, "accuracy"); err != nil {
			return nil, fmt.Errorf("events[%d].%s", idx, err.Error())
		} else if ok {
			normalized["accuracy"] = v
		}
		if v, ok, err := optionalIntArg(event, "battery_level"); err != nil {
			return nil, fmt.Errorf("events[%d].%s", idx, err.Error())
		} else if ok {
			normalized["battery_level"] = v
		}
		if v, exists := event["payload"]; exists && v != nil {
			payload, err := ensureJSONObject(v, fmt.Sprintf("events[%d].payload", idx))
			if err != nil {
				return nil, err
			}
			normalized["payload"] = payload
		}

		events = append(events, normalized)
	}

	return events, nil
}

func callJSONAndParse(client *AssetHubClient, method, path string, req map[string]interface{}) (interface{}, error) {
	respBody, err := client.doRequest(method, path, req)
	if err != nil {
		return nil, err
	}
	return decodeResponseData(respBody)
}

func callJSONWithHeadersAndParse(client *AssetHubClient, method, path string, req map[string]interface{}, headers map[string]string) (interface{}, error) {
	respBody, err := client.doRequestWithHeaders(method, path, req, headers)
	if err != nil {
		return nil, err
	}
	return decodeResponseData(respBody)
}

func callMessageOnly(client *AssetHubClient, method, path string, req map[string]interface{}) (interface{}, error) {
	respBody, err := client.doRequest(method, path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	result := map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}
	if data, err := parseAPIResponseData(respBody); err == nil && data != nil {
		result["data"] = data
	}
	return result, nil
}

func buildPagedQueryArgs(args map[string]interface{}) map[string]interface{} {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}
	return map[string]interface{}{
		"page":  page,
		"limit": limit,
	}
}

func listInventoryPlans(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	queryArgs := buildPagedQueryArgs(args)
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		queryArgs["status"] = sanitizeInput(v)
	}

	items, pagination, err := fetchRawArrayData(client, "/inventory-plans", queryArgs)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
	}, nil
}

func getInventoryPlan(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/inventory-plans/%d", id), nil)
}

func createInventoryPlan(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["plan_no"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "plan_no"); err != nil {
			return nil, err
		}
		req["plan_no"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("plan_no is required")
	}
	if v, ok := args["plan_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "plan_name"); err != nil {
			return nil, err
		}
		req["plan_name"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("plan_name is required")
	}
	if v, ok := args["start_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "start_date"); err != nil {
			return nil, err
		}
		req["start_date"] = v
	}
	if v, ok := args["end_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "end_date"); err != nil {
			return nil, err
		}
		req["end_date"] = v
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		req["status"] = sanitizeInput(v)
	}
	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}

	return callJSONAndParse(client, "POST", "/inventory-plans", req)
}

func updateInventoryPlan(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	req := make(map[string]interface{})
	if v, ok := args["plan_no"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "plan_no"); err != nil {
			return nil, err
		}
		req["plan_no"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("plan_no is required")
	}
	if v, ok := args["plan_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "plan_name"); err != nil {
			return nil, err
		}
		req["plan_name"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("plan_name is required")
	}
	if v, ok := args["start_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "start_date"); err != nil {
			return nil, err
		}
		req["start_date"] = v
	}
	if v, ok := args["end_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "end_date"); err != nil {
			return nil, err
		}
		req["end_date"] = v
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		req["status"] = sanitizeInput(v)
	}
	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}

	return callMessageOnly(client, "PUT", fmt.Sprintf("/inventory-plans/%d", id), req)
}

func activateInventoryPlan(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "PUT", fmt.Sprintf("/inventory-plans/%d/activate", id), nil)
}

func completeInventoryPlan(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "PUT", fmt.Sprintf("/inventory-plans/%d/complete", id), nil)
}

func cancelInventoryPlan(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "PUT", fmt.Sprintf("/inventory-plans/%d/cancel", id), nil)
}

func listInventoryTasks(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	queryArgs := buildPagedQueryArgs(args)
	if v, ok := args["inventory_id"].(float64); ok && v > 0 {
		queryArgs["inventory_id"] = int(v)
	}
	if v, ok := args["assignee"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "assignee"); err != nil {
			return nil, err
		}
		queryArgs["assignee"] = sanitizeInput(v)
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		queryArgs["status"] = sanitizeInput(v)
	}

	items, pagination, err := fetchRawArrayData(client, "/inventory-tasks", queryArgs)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
	}, nil
}

func getInventoryTask(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/inventory-tasks/%d", id), nil)
}

func createInventoryTask(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["inventory_id"].(float64); ok && v > 0 {
		req["inventory_id"] = int(v)
	} else {
		return nil, fmt.Errorf("inventory_id is required")
	}
	if v, ok := args["task_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "task_name"); err != nil {
			return nil, err
		}
		req["task_name"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("task_name is required")
	}
	if v, ok := args["assignee"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "assignee"); err != nil {
			return nil, err
		}
		req["assignee"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("assignee is required")
	}
	if v, ok := args["assignee_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "assignee_name"); err != nil {
			return nil, err
		}
		req["assignee_name"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("assignee_name is required")
	}
	if v, ok := args["department_code"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "department_code"); err != nil {
			return nil, err
		}
		req["department_code"] = sanitizeInput(v)
	}
	if v, ok := args["location"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "location"); err != nil {
			return nil, err
		}
		req["location"] = sanitizeInput(v)
	}
	if v, ok := args["estimated_count"].(float64); ok {
		if v < 0 {
			return nil, fmt.Errorf("estimated_count must be non-negative")
		}
		req["estimated_count"] = int(v)
	}

	return callJSONAndParse(client, "POST", "/inventory-tasks", req)
}

func assignInventoryTask(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "PUT", fmt.Sprintf("/inventory-tasks/%d/assign", id), nil)
}

func startInventoryTask(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "PUT", fmt.Sprintf("/inventory-tasks/%d/start", id), nil)
}

func completeInventoryTask(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	req := map[string]interface{}{}
	if v, ok := args["actual_count"].(float64); ok {
		if v < 0 {
			return nil, fmt.Errorf("actual_count must be non-negative")
		}
		req["actual_count"] = int(v)
	}
	return callMessageOnly(client, "PUT", fmt.Sprintf("/inventory-tasks/%d/complete", id), req)
}

func updateInventoryTask(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	req := make(map[string]interface{})
	if v, ok := args["task_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "task_name"); err != nil {
			return nil, err
		}
		req["task_name"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("task_name is required")
	}
	if v, ok := args["assignee"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "assignee"); err != nil {
			return nil, err
		}
		req["assignee"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("assignee is required")
	}
	if v, ok := args["assignee_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "assignee_name"); err != nil {
			return nil, err
		}
		req["assignee_name"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("assignee_name is required")
	}
	if v, ok := args["department_code"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "department_code"); err != nil {
			return nil, err
		}
		req["department_code"] = sanitizeInput(v)
	}
	if v, ok := args["location"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "location"); err != nil {
			return nil, err
		}
		req["location"] = sanitizeInput(v)
	}
	if v, ok := args["estimated_count"].(float64); ok {
		if v < 0 {
			return nil, fmt.Errorf("estimated_count must be non-negative")
		}
		req["estimated_count"] = int(v)
	}

	return callMessageOnly(client, "PUT", fmt.Sprintf("/inventory-tasks/%d", id), req)
}

func cancelInventoryTask(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "PUT", fmt.Sprintf("/inventory-tasks/%d/cancel", id), nil)
}

func listInventoryDiscrepancies(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	queryArgs := buildPagedQueryArgs(args)
	if v, ok := args["inventory_id"].(float64); ok && v > 0 {
		queryArgs["inventory_id"] = int(v)
	}
	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		queryArgs["asset_code"] = v
	}
	if v, ok := args["handling_status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "handling_status"); err != nil {
			return nil, err
		}
		queryArgs["handling_status"] = sanitizeInput(v)
	}

	items, pagination, err := fetchRawArrayData(client, "/inventory-discrepancies", queryArgs)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
	}, nil
}

func getInventoryDiscrepancy(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/inventory-discrepancies/%d", id), nil)
}

func handleInventoryDiscrepancy(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	req := make(map[string]interface{})
	if v, ok := args["handling_status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "handling_status"); err != nil {
			return nil, err
		}
		req["handling_status"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("handling_status is required")
	}
	if v, ok := args["handling_method"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "handling_method"); err != nil {
			return nil, err
		}
		req["handling_method"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("handling_method is required")
	}
	if v, ok := args["handling_notes"].(string); ok && v != "" {
		if err := validateStringLength(v, 1000, "handling_notes"); err != nil {
			return nil, err
		}
		req["handling_notes"] = sanitizeInput(v)
	}

	return callMessageOnly(client, "PUT", fmt.Sprintf("/inventory-discrepancies/%d/handle", id), req)
}

func batchHandleInventoryDiscrepancies(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	ids, err := intSliceArg(args, "ids")
	if err != nil {
		return nil, err
	}

	req := map[string]interface{}{
		"ids": ids,
	}
	if v, ok := args["handling_status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "handling_status"); err != nil {
			return nil, err
		}
		req["handling_status"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("handling_status is required")
	}
	if v, ok := args["handling_method"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "handling_method"); err != nil {
			return nil, err
		}
		req["handling_method"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("handling_method is required")
	}
	if v, ok := args["handling_notes"].(string); ok && v != "" {
		if err := validateStringLength(v, 1000, "handling_notes"); err != nil {
			return nil, err
		}
		req["handling_notes"] = sanitizeInput(v)
	}

	return callMessageOnly(client, "POST", "/inventory-discrepancies/batch-handle", req)
}

func getInventoryDiscrepancyStatistics(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	inventoryID, err := requiredIntArg(args, "inventory_id")
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/inventory-discrepancies/%d/statistics", inventoryID), nil)
}

func generateInventoryDiscrepancies(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	inventoryID, err := requiredIntArg(args, "inventory_id")
	if err != nil {
		return nil, err
	}
	req := map[string]interface{}{
		"inventory_id": inventoryID,
	}
	return callMessageOnly(client, "POST", "/inventory-discrepancies/generate-from-details", req)
}

// ============== Scrapping Handlers ==============

func listScrappings(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}
	args["page"] = page
	args["limit"] = limit

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
	}

	params := buildQueryParams(args)
	path := "/scrapping" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func createScrapping(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		req["asset_code"] = v
	} else {
		return nil, fmt.Errorf("asset_code is required")
	}

	if v, ok := args["reason"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "reason"); err != nil {
			return nil, err
		}
		req["reason"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("reason is required")
	}

	if v, ok := args["description"].(string); ok && v != "" {
		if err := validateStringLength(v, 1000, "description"); err != nil {
			return nil, err
		}
		req["description"] = sanitizeInput(v)
	}

	if v, ok := args["estimated_value"].(float64); ok {
		if v < 0 || v > 1e12 {
			return nil, fmt.Errorf("estimated_value out of valid range")
		}
		req["estimated_value"] = v
	}

	if v, ok := args["apply_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "apply_date"); err != nil {
			return nil, err
		}
		req["apply_date"] = v
	}

	respBody, err := client.doRequest("POST", "/scrapping", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}, nil
}

func approveScrapping(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	action, ok := args["action"].(string)
	if !ok || (action != "approve" && action != "reject") {
		return nil, fmt.Errorf("action is required and must be 'approve' or 'reject'")
	}

	req := map[string]interface{}{
		"action": action,
	}
	if v, ok := args["comment"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "comment"); err != nil {
			return nil, err
		}
		req["comment"] = sanitizeInput(v)
	}

	path := fmt.Sprintf("/scrapping/%d/approve", int(id))
	respBody, err := client.doRequest("PUT", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// ============== Acceptance Handlers ==============

func listAcceptances(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}
	args["page"] = page
	args["limit"] = limit

	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		args["keyword"] = sanitized
	}

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
	}

	params := buildQueryParams(args)
	path := "/acceptance" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func createAcceptance(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		req["asset_code"] = v
	} else {
		return nil, fmt.Errorf("asset_code is required")
	}

	if v, ok := args["acceptance_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "acceptance_date"); err != nil {
			return nil, err
		}
		req["acceptance_date"] = v
	} else {
		return nil, fmt.Errorf("acceptance_date is required")
	}

	if v, ok := args["acceptor"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "acceptor"); err != nil {
			return nil, err
		}
		req["acceptor"] = sanitizeInput(v)
	}

	if v, ok := args["result"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "result"); err != nil {
			return nil, err
		}
		req["result"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("result is required")
	}

	if v, ok := args["finding"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "finding"); err != nil {
			return nil, err
		}
		req["finding"] = sanitizeInput(v)
	}

	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}

	respBody, err := client.doRequest("POST", "/acceptance", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}, nil
}

// ============== Dashboard & Statistics Handlers ==============

func getDashboardOverview(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	assetsRespBody, err := client.doRequest("GET", "/assets/statistics/overview", nil)
	if err != nil {
		return nil, err
	}

	assetsData, err := decodeResponseData(assetsRespBody)
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"assets": assetsData,
		},
		"message": "仪表盘总览由已挂载的统计接口聚合生成",
	}

	partialErrors := map[string]string{}

	if transferRespBody, transferErr := client.doRequest("GET", "/transfer/statistics", nil); transferErr == nil {
		transferData, decodeErr := decodeResponseData(transferRespBody)
		if decodeErr != nil {
			partialErrors["transfer"] = decodeErr.Error()
		} else {
			result["data"].(map[string]interface{})["transfer"] = transferData
		}
	} else {
		partialErrors["transfer"] = transferErr.Error()
	}

	if idleRespBody, idleErr := client.doRequest("GET", "/idle/statistics", nil); idleErr == nil {
		idleData, decodeErr := decodeResponseData(idleRespBody)
		if decodeErr != nil {
			partialErrors["idle"] = decodeErr.Error()
		} else {
			result["data"].(map[string]interface{})["idle"] = idleData
		}
	} else {
		partialErrors["idle"] = idleErr.Error()
	}

	if len(partialErrors) > 0 {
		result["partial_errors"] = partialErrors
	}

	return result, nil
}

func getAssetAgeDistribution(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := buildQueryParams(args)
	path := "/assets/statistics/age-distribution" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

func getMaintenanceCostAnalysis(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := buildQueryParams(args)
	path := "/maintenance/costs/analysis" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

func createUser(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	if err := requireAdmin(client); err != nil {
		return nil, err
	}
	req := make(map[string]interface{})

	if v, ok := args["username"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "username"); err != nil {
			return nil, err
		}
		req["username"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("username is required")
	}

	if v, ok := args["real_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "real_name"); err != nil {
			return nil, err
		}
		req["real_name"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("real_name is required")
	}

	if v, ok := args["password"].(string); ok && v != "" {
		if len(v) < 6 {
			return nil, fmt.Errorf("password must be at least 6 characters")
		}
		if len(v) > 100 {
			return nil, fmt.Errorf("password exceeds maximum length")
		}
		req["password"] = v
	} else {
		return nil, fmt.Errorf("password is required")
	}

	if v, ok := args["role"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "role"); err != nil {
			return nil, err
		}
		req["role"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("role is required")
	}

	if v, ok := args["email"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "email"); err != nil {
			return nil, err
		}
		req["email"] = sanitizeInput(v)
	}

	if v, ok := args["phone"].(string); ok && v != "" {
		if err := validateStringLength(v, 20, "phone"); err != nil {
			return nil, err
		}
		req["phone"] = sanitizeInput(v)
	}

	if v, ok := args["department_code"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "department_code"); err != nil {
			return nil, err
		}
		req["department_code"] = sanitizeInput(v)
	}

	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 20, "status"); err != nil {
			return nil, err
		}
		req["status"] = sanitizeInput(v)
	}

	respBody, err := client.doRequest("POST", "/users", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}, nil
}

func updateUser(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	req := make(map[string]interface{})

	if v, ok := args["real_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "real_name"); err != nil {
			return nil, err
		}
		req["real_name"] = sanitizeInput(v)
	}

	if v, ok := args["email"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "email"); err != nil {
			return nil, err
		}
		req["email"] = sanitizeInput(v)
	}

	if v, ok := args["phone"].(string); ok && v != "" {
		if err := validateStringLength(v, 20, "phone"); err != nil {
			return nil, err
		}
		req["phone"] = sanitizeInput(v)
	}

	if v, ok := args["department_code"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "department_code"); err != nil {
			return nil, err
		}
		req["department_code"] = sanitizeInput(v)
	}

	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 20, "status"); err != nil {
			return nil, err
		}
		req["status"] = sanitizeInput(v)
	}

	path := fmt.Sprintf("/users/%d", int(id))
	respBody, err := client.doRequest("PUT", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

func resetUserPassword(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	if err := requireAdmin(client); err != nil {
		return nil, err
	}
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	newPassword, ok := args["new_password"].(string)
	if !ok || newPassword == "" {
		return nil, fmt.Errorf("new_password is required")
	}
	if len(newPassword) < 6 {
		return nil, fmt.Errorf("password must be at least 6 characters")
	}
	if len(newPassword) > 100 {
		return nil, fmt.Errorf("password exceeds maximum length")
	}

	oldPassword := "mcp-admin-reset"
	if v, ok := args["old_password"].(string); ok && v != "" {
		oldPassword = v
	}

	req := map[string]interface{}{
		"oldPassword": oldPassword,
		"newPassword": newPassword,
	}

	path := fmt.Sprintf("/users/%d/change-password", int(id))
	respBody, err := client.doRequest("PUT", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

func assignUserRole(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	userID, ok := args["user_id"].(float64)
	if !ok {
		return nil, fmt.Errorf("user_id is required")
	}

	role, ok := args["role"].(string)
	if !ok || role == "" {
		return nil, fmt.Errorf("role is required")
	}
	if err := validateStringLength(role, 50, "role"); err != nil {
		return nil, err
	}

	tenantID := client.TenantID
	if v, ok := args["tenant_id"].(float64); ok {
		tenantID = int(v)
	}
	if tenantID <= 0 {
		return nil, fmt.Errorf("tenant_id is required when MCP client has no default tenant")
	}

	req := map[string]interface{}{
		"tenant_id": tenantID,
		"role":      sanitizeInput(role),
	}
	if v, ok := args["is_default"].(bool); ok {
		req["is_default"] = v
	}

	path := fmt.Sprintf("/users/%d/roles", int(userID))
	respBody, err := client.doRequest("POST", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// ============== Role & Permission Handlers ==============

func listRoles(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	params := buildQueryParams(args)
	path := "/roles-permissions/roles" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

func getRolePermissions(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	role, ok := args["role"].(string)
	if !ok || role == "" {
		return nil, fmt.Errorf("role is required")
	}
	if err := validateStringLength(role, 50, "role"); err != nil {
		return nil, err
	}

	path := fmt.Sprintf("/roles-permissions/roles/%s/permissions", url.PathEscape(role))
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

func createRole(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	roleCode := ""
	if v, ok := args["role_code"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "role_code"); err != nil {
			return nil, err
		}
		roleCode = sanitizeInput(v)
	} else if v, ok := args["name"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "name"); err != nil {
			return nil, err
		}
		roleCode = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("role_code is required")
	}
	req["role_code"] = roleCode

	roleName := roleCode
	if v, ok := args["role_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "role_name"); err != nil {
			return nil, err
		}
		roleName = sanitizeInput(v)
	} else if v, ok := args["name"].(string); ok && v != "" {
		roleName = sanitizeInput(v)
	}
	req["role_name"] = roleName

	if v, ok := args["description"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "description"); err != nil {
			return nil, err
		}
		req["description"] = sanitizeInput(v)
	}

	respBody, err := client.doRequest("POST", "/roles-permissions/roles", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	result := map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}

	if v, ok := args["permissions"].([]interface{}); ok && len(v) > 0 {
		if _, err := updateRolePermissions(client, map[string]interface{}{
			"role":        roleCode,
			"permissions": v,
		}); err != nil {
			result["permission_update_error"] = err.Error()
		}
	}

	return result, nil
}

func updateRolePermissions(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	role, ok := args["role"].(string)
	if !ok || role == "" {
		return nil, fmt.Errorf("role is required")
	}
	if err := validateStringLength(role, 50, "role"); err != nil {
		return nil, err
	}

	var permissions []string
	if v, ok := args["permissions"].([]interface{}); ok {
		permissions = make([]string, 0, len(v))
		for _, p := range v {
			if ps, ok := p.(string); ok {
				if err := validateStringLength(ps, 100, "permission"); err != nil {
					return nil, err
				}
				permissions = append(permissions, sanitizeInput(ps))
			}
		}
	} else {
		return nil, fmt.Errorf("permissions is required and must be an array")
	}

	req := map[string]interface{}{
		"permissions": permissions,
	}

	path := fmt.Sprintf("/roles-permissions/roles/%s/permissions", url.PathEscape(role))
	respBody, err := client.doRequest("PUT", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// ============== System Config Handlers ==============

func getSystemConfig(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	if err := requireSuperAdmin(client); err != nil {
		return nil, err
	}
	respBody, err := client.doRequest("GET", "/system-config/database", nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

func updateSystemConfig(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	if err := requireSuperAdmin(client); err != nil {
		return nil, err
	}
	req := make(map[string]interface{})

	requiredStringFields := []string{"host", "user", "database"}
	for _, field := range requiredStringFields {
		v, ok := args[field].(string)
		if !ok || strings.TrimSpace(v) == "" {
			return nil, fmt.Errorf("%s is required", field)
		}
		if err := validateStringLength(v, 255, field); err != nil {
			return nil, err
		}
		req[field] = sanitizeInput(v)
	}

	port, ok := args["port"].(float64)
	if !ok || int(port) <= 0 {
		return nil, fmt.Errorf("port is required")
	}
	req["port"] = int(port)

	if v, ok := args["password"].(string); ok {
		if err := validateStringLength(v, 255, "password"); err != nil {
			return nil, err
		}
		req["password"] = v
	}
	if v, ok := args["connectionLimit"].(float64); ok {
		req["connectionLimit"] = int(v)
	}
	if v, ok := args["connectTimeout"].(float64); ok {
		req["connectTimeout"] = int(v)
	}
	if v, ok := args["idleTimeout"].(float64); ok {
		req["idleTimeout"] = int(v)
	}
	if v, ok := args["maxIdle"].(float64); ok {
		req["maxIdle"] = int(v)
	}

	respBody, err := client.doRequest("PUT", "/system-config/database", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// ============== Module Management Handlers ==============

func requiredModuleIDArg(args map[string]interface{}) (string, error) {
	moduleID := strings.TrimSpace(extractStringOverrideValue(args, "module_id"))
	if moduleID == "" {
		moduleID = strings.TrimSpace(extractStringOverrideValue(args, "module_code"))
	}
	if moduleID == "" {
		return "", fmt.Errorf("module_id is required")
	}
	if err := validateStringLength(moduleID, 50, "module_id"); err != nil {
		return "", err
	}
	return sanitizeInput(moduleID), nil
}

func boolLikeValue(value interface{}) (bool, bool) {
	switch typed := value.(type) {
	case bool:
		return typed, true
	case float64:
		return typed != 0, true
	case int:
		return typed != 0, true
	case int32:
		return typed != 0, true
	case int64:
		return typed != 0, true
	case string:
		switch strings.ToLower(strings.TrimSpace(typed)) {
		case "true", "1", "yes", "y":
			return true, true
		case "false", "0", "no", "n":
			return false, true
		}
	}
	return false, false
}

func listModules(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	queryArgs := map[string]interface{}{}
	if v, ok := args["category"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "category"); err != nil {
			return nil, err
		}
		queryArgs["category"] = sanitizeInput(v)
	}
	if v, ok := args["type"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "type"); err != nil {
			return nil, err
		}
		queryArgs["type"] = sanitizeInput(v)
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		queryArgs["status"] = sanitizeInput(v)
	}

	return callJSONAndParse(client, "GET", "/module-configs/list"+buildQueryParams(queryArgs), nil)
}

func getModuleConfig(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/module-configs/%s", url.PathEscape(moduleID)), nil)
}

func updateModuleConfig(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}

	config, ok := args["config"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("config is required and must be an object")
	}

	path := fmt.Sprintf("/module-configs/%s", url.PathEscape(moduleID))
	respBody, err := client.doRequest("PUT", path, map[string]interface{}{"config": config})
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

func validateModuleConfig(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}

	config, ok := args["config"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("config is required and must be an object")
	}

	configJSON, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("failed to encode config: %w", err)
	}

	query := url.Values{}
	query.Set("config", string(configJSON))
	return callJSONAndParse(client, "GET", fmt.Sprintf("/module-configs/%s/validate?%s", url.PathEscape(moduleID), query.Encode()), nil)
}

func enableModule(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}

	req := map[string]interface{}{
		"module_id": moduleID,
	}
	if config, ok := args["config"].(map[string]interface{}); ok {
		req["config"] = config
	}

	return callMessageOnly(client, "POST", "/module-configs/enable", req)
}

func disableModule(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}

	return callMessageOnly(client, "POST", "/module-configs/disable", map[string]interface{}{
		"module_id": moduleID,
	})
}

func listModuleVersions(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/module-configs/%s/versions", url.PathEscape(moduleID)), nil)
}

func createModuleVersion(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}

	config, ok := args["config"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("config is required and must be an object")
	}

	req := map[string]interface{}{
		"config": config,
	}
	if v, ok := args["change_log"].(string); ok && v != "" {
		if err := validateStringLength(v, 1000, "change_log"); err != nil {
			return nil, err
		}
		req["change_log"] = sanitizeInput(v)
	}

	return callJSONAndParse(client, "POST", fmt.Sprintf("/module-configs/%s/versions", url.PathEscape(moduleID)), req)
}

func rollbackModuleVersion(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}
	versionID, err := requiredIntArg(args, "version_id")
	if err != nil {
		return nil, err
	}

	return callMessageOnly(client, "POST", fmt.Sprintf("/module-configs/%s/rollback", url.PathEscape(moduleID)), map[string]interface{}{
		"version_id": versionID,
	})
}

func compareModuleVersion(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}
	versionID, err := requiredIntArg(args, "version_id")
	if err != nil {
		return nil, err
	}

	return callJSONAndParse(client, "GET", fmt.Sprintf("/module-configs/%s/versions/%d/compare", url.PathEscape(moduleID), versionID), nil)
}

func deleteModuleVersion(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}
	versionID, err := requiredIntArg(args, "version_id")
	if err != nil {
		return nil, err
	}

	return callMessageOnly(client, "DELETE", fmt.Sprintf("/module-configs/%s/versions/%d", url.PathEscape(moduleID), versionID), nil)
}

func backupModuleConfig(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/module-configs/%s/backup", url.PathEscape(moduleID)), nil)
}

func restoreModuleConfig(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}

	backupData, ok := args["backup_data"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("backup_data is required and must be an object")
	}

	return callMessageOnly(client, "POST", fmt.Sprintf("/module-configs/%s/restore", url.PathEscape(moduleID)), map[string]interface{}{
		"backup_data": backupData,
	})
}

func listModuleMenus(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/module-configs/%s/menus", url.PathEscape(moduleID)), nil)
}

func updateModuleMenus(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	moduleID, err := requiredModuleIDArg(args)
	if err != nil {
		return nil, err
	}

	rawMenus, ok := args["menus"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("menus is required and must be an array")
	}

	menus := make([]map[string]interface{}, 0, len(rawMenus))
	for idx, rawMenu := range rawMenus {
		menu, ok := rawMenu.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("menus[%d] must be an object", idx)
		}

		menuKey, ok := menu["menu_key"].(string)
		if !ok || strings.TrimSpace(menuKey) == "" {
			return nil, fmt.Errorf("menus[%d].menu_key is required", idx)
		}
		if err := validateStringLength(menuKey, 100, "menu_key"); err != nil {
			return nil, err
		}

		isVisible, ok := boolLikeValue(menu["is_visible"])
		if !ok {
			isVisible, ok = boolLikeValue(menu["is_enabled"])
		}
		if !ok {
			return nil, fmt.Errorf("menus[%d].is_visible is required", idx)
		}

		menus = append(menus, map[string]interface{}{
			"menu_key":   sanitizeInput(menuKey),
			"is_visible": isVisible,
		})
	}

	return callMessageOnly(client, "PUT", fmt.Sprintf("/module-configs/%s/menus", url.PathEscape(moduleID)), map[string]interface{}{
		"menus": menus,
	})
}

// ============== Audit Log Handlers ==============

func listAuditLogs(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}
	args["page"] = page
	args["limit"] = limit

	params := buildQueryParams(args)
	path := "/audit-logs" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func getAuditLogDetail(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	path := fmt.Sprintf("/audit-logs/%d", int(id))
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

// ============== Tenant Management Handlers ==============

func listTenants(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	if err := requireAdmin(client); err != nil {
		return nil, err
	}
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}
	args["page"] = page
	args["limit"] = limit

	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		args["keyword"] = sanitized
	}

	params := buildQueryParams(args)
	path := "/tenants" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func getTenantConfig(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	if err := requireAdmin(client); err != nil {
		return nil, err
	}
	tenantID, ok := args["tenant_id"].(float64)
	if !ok {
		return nil, fmt.Errorf("tenant_id is required")
	}

	path := fmt.Sprintf("/tenants/%d/config", int(tenantID))
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

func updateTenantModules(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	if err := requireSuperAdmin(client); err != nil {
		return nil, err
	}
	tenantID, ok := args["tenant_id"].(float64)
	if !ok {
		return nil, fmt.Errorf("tenant_id is required")
	}

	action, ok := args["action"].(string)
	if !ok || (action != "enable" && action != "disable") {
		return nil, fmt.Errorf("action is required and must be 'enable' or 'disable'")
	}

	var moduleCodes []string
	if v, ok := args["module_codes"].([]interface{}); ok {
		moduleCodes = make([]string, 0, len(v))
		for _, m := range v {
			if ms, ok := m.(string); ok {
				if err := validateStringLength(ms, 50, "module_code"); err != nil {
					return nil, err
				}
				moduleCodes = append(moduleCodes, sanitizeInput(ms))
			}
		}
	} else {
		return nil, fmt.Errorf("module_codes is required and must be an array")
	}

	req := map[string]interface{}{
		"action":       action,
		"module_codes": moduleCodes,
	}

	path := fmt.Sprintf("/tenants/%d/modules", int(tenantID))
	respBody, err := client.doRequest("PUT", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// ============== IoT/Device Management Handlers ==============

func listIoTDevices(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}
	args["page"] = page
	args["limit"] = limit

	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		args["keyword"] = sanitized
	}

	params := buildQueryParams(args)
	path := "/iot/devices" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func resolveDeviceNumericID(client *AssetHubClient, deviceIdentifier string) (string, error) {
	path := "/iot/devices?page=1&pageSize=100&keyword=" + url.QueryEscape(deviceIdentifier)
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return "", err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return "", fmt.Errorf("failed to parse device lookup response: %w", err)
	}

	var rows []map[string]interface{}
	if err := json.Unmarshal(apiResp.Data, &rows); err != nil {
		return "", fmt.Errorf("failed to parse device lookup data: %w", err)
	}

	for _, row := range rows {
		deviceID, _ := row["device_id"].(string)
		deviceCode, _ := row["device_code"].(string)
		if deviceID != deviceIdentifier && deviceCode != deviceIdentifier {
			continue
		}

		switch id := row["id"].(type) {
		case float64:
			return strconv.FormatInt(int64(id), 10), nil
		case string:
			if id != "" {
				return id, nil
			}
		}
	}

	return "", fmt.Errorf("device %q not found", deviceIdentifier)
}

func getDevice(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	var idOrCode string
	if v, ok := args["id"].(float64); ok {
		idOrCode = strconv.FormatFloat(v, 'f', 0, 64)
	} else if v, ok := args["device_id"].(string); ok && v != "" {
		resolvedID, err := resolveDeviceNumericID(client, v)
		if err != nil {
			return nil, err
		}
		idOrCode = resolvedID
	} else if v, ok := args["device_code"].(string); ok && v != "" {
		resolvedID, err := resolveDeviceNumericID(client, v)
		if err != nil {
			return nil, err
		}
		idOrCode = resolvedID
	} else {
		return nil, fmt.Errorf("id, device_id, or device_code is required")
	}

	path := fmt.Sprintf("/iot/devices/%s", idOrCode)
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

func registerDevice(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})
	deviceID := ""

	if v, ok := args["device_id"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "device_id"); err != nil {
			return nil, err
		}
		deviceID = sanitizeInput(v)
	} else if v, ok := args["device_code"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "device_code"); err != nil {
			return nil, err
		}
		deviceID = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("device_id or device_code is required")
	}
	req["device_id"] = deviceID

	if v, ok := args["device_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "device_name"); err != nil {
			return nil, err
		}
		req["device_name"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("device_name is required")
	}

	if v, ok := args["device_type"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "device_type"); err != nil {
			return nil, err
		}
		req["device_type"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("device_type is required")
	}

	if v, ok := args["manufacturer"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "manufacturer"); err != nil {
			return nil, err
		}
		req["manufacturer"] = sanitizeInput(v)
	}
	if v, ok := args["model"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "model"); err != nil {
			return nil, err
		}
		req["model"] = sanitizeInput(v)
	}
	if v, ok := args["serial_number"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "serial_number"); err != nil {
			return nil, err
		}
		req["serial_number"] = sanitizeInput(v)
	}
	if v, ok := args["mac_address"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "mac_address"); err != nil {
			return nil, err
		}
		req["mac_address"] = sanitizeInput(v)
	}
	if v, ok := args["firmware_version"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "firmware_version"); err != nil {
			return nil, err
		}
		req["firmware_version"] = sanitizeInput(v)
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 20, "status"); err != nil {
			return nil, err
		}
		req["status"] = sanitizeInput(v)
	}
	if v, ok := args["remark"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}

	respBody, err := client.doRequest("POST", "/iot/devices", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	result := map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}

		linkReq := map[string]interface{}{
			"device_id":   deviceID,
			"device_type": req["device_type"],
		}
		linkPath := fmt.Sprintf("/iot/devices/assets/%s/link", url.PathEscape(v))
		if _, err := client.doRequest("POST", linkPath, linkReq); err != nil {
			result["link_error"] = err.Error()
		} else {
			result["linked_asset_code"] = v
		}
	}

	return result, nil
}

func updateDeviceStatus(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	status, ok := args["status"].(string)
	if !ok || status == "" {
		return nil, fmt.Errorf("status is required")
	}
	if err := validateStringLength(status, 50, "status"); err != nil {
		return nil, err
	}

	req := map[string]interface{}{
		"status": sanitizeInput(status),
	}

	path := fmt.Sprintf("/iot/devices/%d", id)
	return callMessageOnly(client, "PUT", path, req)
}

func getAssetLocation(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	assetCode, ok := args["asset_code"].(string)
	if !ok || assetCode == "" {
		return nil, fmt.Errorf("asset_code is required")
	}
	if err := validateAssetCode(assetCode); err != nil {
		return nil, err
	}

	path := fmt.Sprintf("/iot/location/assets/%s/location", url.PathEscape(assetCode))
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

func getLocationHistory(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	assetCode, ok := args["asset_code"].(string)
	if !ok || assetCode == "" {
		return nil, fmt.Errorf("asset_code is required")
	}
	if err := validateAssetCode(assetCode); err != nil {
		return nil, err
	}

	params := buildQueryParams(args)
	path := fmt.Sprintf("/iot/location/assets/%s/location/history%s", url.PathEscape(assetCode), params)
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

func listAssetsInArea(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})
	hasFilter := false

	if v, ok, err := optionalFloatArg(args, "minLatitude"); err != nil {
		return nil, fmt.Errorf("minLatitude must be a number")
	} else if ok {
		req["minLatitude"] = v
		hasFilter = true
	}
	if v, ok, err := optionalFloatArg(args, "maxLatitude"); err != nil {
		return nil, fmt.Errorf("maxLatitude must be a number")
	} else if ok {
		req["maxLatitude"] = v
		hasFilter = true
	}
	if v, ok, err := optionalFloatArg(args, "minLongitude"); err != nil {
		return nil, fmt.Errorf("minLongitude must be a number")
	} else if ok {
		req["minLongitude"] = v
		hasFilter = true
	}
	if v, ok, err := optionalFloatArg(args, "maxLongitude"); err != nil {
		return nil, fmt.Errorf("maxLongitude must be a number")
	} else if ok {
		req["maxLongitude"] = v
		hasFilter = true
	}

	_, hasMinLatitude := req["minLatitude"]
	_, hasMaxLatitude := req["maxLatitude"]
	if hasMinLatitude != hasMaxLatitude {
		return nil, fmt.Errorf("minLatitude and maxLatitude must be provided together")
	}
	_, hasMinLongitude := req["minLongitude"]
	_, hasMaxLongitude := req["maxLongitude"]
	if hasMinLongitude != hasMaxLongitude {
		return nil, fmt.Errorf("minLongitude and maxLongitude must be provided together")
	}

	if v, ok := args["building_name"].(string); ok && strings.TrimSpace(v) != "" {
		if err := validateStringLength(v, 200, "building_name"); err != nil {
			return nil, err
		}
		req["building_name"] = sanitizeInput(v)
		hasFilter = true
	}
	if v, ok, err := optionalSignedIntArg(args, "floor_number"); err != nil {
		return nil, err
	} else if ok {
		req["floor_number"] = v
		hasFilter = true
	}

	if !hasFilter {
		return nil, fmt.Errorf("at least one area filter must be provided")
	}

	return callJSONAndParse(client, "POST", "/iot/location/assets/in-area", req)
}

func reportDeviceLocationData(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	deviceID, ok := args["device_id"].(string)
	if !ok || strings.TrimSpace(deviceID) == "" {
		return nil, fmt.Errorf("device_id is required")
	}
	if err := validateStringLength(deviceID, 100, "device_id"); err != nil {
		return nil, err
	}

	req := make(map[string]interface{})
	hasPayload := false

	if v, ok, err := optionalFloatArg(args, "latitude"); err != nil {
		return nil, err
	} else if ok {
		req["latitude"] = v
		hasPayload = true
	}
	if v, ok, err := optionalFloatArg(args, "longitude"); err != nil {
		return nil, err
	} else if ok {
		req["longitude"] = v
		hasPayload = true
	}

	_, hasLatitude := req["latitude"]
	_, hasLongitude := req["longitude"]
	if hasLatitude != hasLongitude {
		return nil, fmt.Errorf("latitude and longitude must be provided together")
	}

	if v, ok, err := optionalFloatArg(args, "altitude"); err != nil {
		return nil, err
	} else if ok {
		req["altitude"] = v
		hasPayload = true
	}
	if v, ok, err := optionalSignedIntArg(args, "signal_strength"); err != nil {
		return nil, err
	} else if ok {
		req["signal_strength"] = v
		hasPayload = true
	}
	if v, ok, err := optionalIntArg(args, "battery_level"); err != nil {
		return nil, err
	} else if ok {
		req["battery_level"] = v
		hasPayload = true
	}
	if v, exists := args["other_data"]; exists && v != nil {
		payload, err := ensureJSONObject(v, "other_data")
		if err != nil {
			return nil, err
		}
		req["other_data"] = payload
		hasPayload = true
	}

	if !hasPayload {
		return nil, fmt.Errorf("at least one location data field must be provided")
	}

	path := fmt.Sprintf("/iot/location/devices/%s/data", url.PathEscape(sanitizeInput(deviceID)))
	return callJSONAndParse(client, "POST", path, req)
}

func reportBeaconLocation(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	deviceID, ok := args["device_id"].(string)
	if !ok || strings.TrimSpace(deviceID) == "" {
		return nil, fmt.Errorf("device_id is required")
	}
	if err := validateStringLength(deviceID, 100, "device_id"); err != nil {
		return nil, err
	}

	locationCode, ok := args["location_code"].(string)
	if !ok || strings.TrimSpace(locationCode) == "" {
		return nil, fmt.Errorf("location_code is required")
	}
	if err := validateStringLength(locationCode, 100, "location_code"); err != nil {
		return nil, err
	}

	return callJSONAndParse(client, "POST", "/iot/location/beacon-location", map[string]interface{}{
		"device_id":     sanitizeInput(deviceID),
		"location_code": sanitizeInput(locationCode),
	})
}

func listBeaconAssets(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok, err := optionalIntArg(args, "page"); err != nil {
		return nil, err
	} else if ok {
		page, limit, _ = validatePagination(v, limit)
	}
	if v, ok, err := optionalIntArg(args, "limit"); err != nil {
		return nil, err
	} else if ok {
		_, limit, _ = validatePagination(page, v)
	}

	queryArgs := map[string]interface{}{
		"page":  page,
		"limit": limit,
	}
	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		queryArgs["keyword"] = sanitized
	}
	if v, ok := args["device_type"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "device_type"); err != nil {
			return nil, err
		}
		queryArgs["device_type"] = sanitizeInput(v)
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		queryArgs["status"] = sanitizeInput(v)
	}

	respBody, err := client.doRequest("GET", "/asset-location/beacon-assets"+buildQueryParams(queryArgs), nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func listLocationCodes(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok, err := optionalIntArg(args, "page"); err != nil {
		return nil, err
	} else if ok {
		page, limit, _ = validatePagination(v, limit)
	}
	if v, ok, err := optionalIntArg(args, "limit"); err != nil {
		return nil, err
	} else if ok {
		_, limit, _ = validatePagination(page, v)
	}

	queryArgs := map[string]interface{}{
		"page":  page,
		"limit": limit,
	}
	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		queryArgs["keyword"] = sanitized
	}
	if v, ok, err := optionalBoolArg(args, "is_active"); err != nil {
		return nil, err
	} else if ok {
		queryArgs["is_active"] = v
	}

	respBody, err := client.doRequest("GET", "/location-codes"+buildQueryParams(queryArgs), nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func getLocationCode(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/location-codes/%d", id), nil)
}

func createLocationCode(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	locationCode, ok := args["location_code"].(string)
	if !ok || strings.TrimSpace(locationCode) == "" {
		return nil, fmt.Errorf("location_code is required")
	}
	if err := validateStringLength(locationCode, 100, "location_code"); err != nil {
		return nil, err
	}

	locationName, ok := args["location_name"].(string)
	if !ok || strings.TrimSpace(locationName) == "" {
		return nil, fmt.Errorf("location_name is required")
	}
	if err := validateStringLength(locationName, 200, "location_name"); err != nil {
		return nil, err
	}

	req := map[string]interface{}{
		"location_code": sanitizeInput(locationCode),
		"location_name": sanitizeInput(locationName),
	}
	stringFields := map[string]int{
		"description":   2000,
		"building_name": 200,
		"room_number":   100,
		"area_name":     200,
	}
	for field, maxLen := range stringFields {
		if v, exists := args[field]; exists {
			typed, ok := v.(string)
			if !ok {
				return nil, fmt.Errorf("%s must be a string", field)
			}
			if err := validateStringLength(typed, maxLen, field); err != nil {
				return nil, err
			}
			req[field] = sanitizeInput(typed)
		}
	}
	if v, ok, err := optionalIntArg(args, "floor_number"); err != nil {
		return nil, err
	} else if ok {
		req["floor_number"] = v
	}
	if v, ok, err := optionalFloatArg(args, "latitude"); err != nil {
		return nil, err
	} else if ok {
		req["latitude"] = v
	}
	if v, ok, err := optionalFloatArg(args, "longitude"); err != nil {
		return nil, err
	} else if ok {
		req["longitude"] = v
	}
	if v, ok, err := optionalBoolArg(args, "is_active"); err != nil {
		return nil, err
	} else if ok {
		req["is_active"] = v
	}

	return callJSONAndParse(client, "POST", "/location-codes", req)
}

func updateLocationCode(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	req := make(map[string]interface{})
	stringFields := map[string]int{
		"location_code": 100,
		"location_name": 200,
		"description":   2000,
		"building_name": 200,
		"room_number":   100,
		"area_name":     200,
	}
	for field, maxLen := range stringFields {
		if v, exists := args[field]; exists {
			typed, ok := v.(string)
			if !ok {
				return nil, fmt.Errorf("%s must be a string", field)
			}
			if err := validateStringLength(typed, maxLen, field); err != nil {
				return nil, err
			}
			req[field] = sanitizeInput(typed)
		}
	}
	if v, ok, err := optionalIntArg(args, "floor_number"); err != nil {
		return nil, err
	} else if ok {
		req["floor_number"] = v
	}
	if v, ok, err := optionalFloatArg(args, "latitude"); err != nil {
		return nil, err
	} else if ok {
		req["latitude"] = v
	}
	if v, ok, err := optionalFloatArg(args, "longitude"); err != nil {
		return nil, err
	} else if ok {
		req["longitude"] = v
	}
	if v, ok, err := optionalBoolArg(args, "is_active"); err != nil {
		return nil, err
	} else if ok {
		req["is_active"] = v
	}
	if len(req) == 0 {
		return nil, fmt.Errorf("at least one field must be provided")
	}

	return callMessageOnly(client, "PUT", fmt.Sprintf("/location-codes/%d", id), req)
}

func deleteLocationCode(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "DELETE", fmt.Sprintf("/location-codes/%d", id), nil)
}

func listLocationAlerts(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok, err := optionalIntArg(args, "page"); err != nil {
		return nil, err
	} else if ok {
		page, limit, _ = validatePagination(v, limit)
	}
	if v, ok, err := optionalIntArg(args, "limit"); err != nil {
		return nil, err
	} else if ok {
		_, limit, _ = validatePagination(page, v)
	}

	queryArgs := map[string]interface{}{
		"page":  page,
		"limit": limit,
	}
	if v, ok, err := optionalBoolArg(args, "is_handled"); err != nil {
		return nil, err
	} else if ok {
		queryArgs["is_handled"] = v
	}
	if v, ok := args["alert_type"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "alert_type"); err != nil {
			return nil, err
		}
		queryArgs["alert_type"] = sanitizeInput(v)
	}
	if v, ok := args["alert_level"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "alert_level"); err != nil {
			return nil, err
		}
		queryArgs["alert_level"] = sanitizeInput(v)
	}
	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		queryArgs["asset_code"] = sanitizeInput(v)
	}

	respBody, err := client.doRequest("GET", "/location-alerts"+buildQueryParams(queryArgs), nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func getLocationAlertStats(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return callJSONAndParse(client, "GET", "/location-alerts/stats", nil)
}

func handleLocationAlert(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	req := make(map[string]interface{})
	if v, exists := args["handle_result"]; exists {
		typed, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("handle_result must be a string")
		}
		if err := validateStringLength(typed, 2000, "handle_result"); err != nil {
			return nil, err
		}
		req["handle_result"] = sanitizeInput(typed)
	}
	if v, exists := args["remark"]; exists {
		typed, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("remark must be a string")
		}
		if err := validateStringLength(typed, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(typed)
	}

	return callMessageOnly(client, "PUT", fmt.Sprintf("/location-alerts/%d/handle", id), req)
}

func batchHandleLocationAlerts(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	ids, err := intSliceArg(args, "ids")
	if err != nil {
		return nil, err
	}

	req := map[string]interface{}{
		"ids": ids,
	}
	if v, exists := args["handle_result"]; exists {
		typed, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("handle_result must be a string")
		}
		if err := validateStringLength(typed, 2000, "handle_result"); err != nil {
			return nil, err
		}
		req["handle_result"] = sanitizeInput(typed)
	}

	return callMessageOnly(client, "POST", "/location-alerts/batch/handle", req)
}

func deleteLocationAlert(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "DELETE", fmt.Sprintf("/location-alerts/%d", id), nil)
}

func getEnvironmentRecords(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return nil, featureUnavailableError("环境监测记录", "当前主服务没有通用环境记录列表接口；请改用 get_environment_latest_by_device、get_environment_latest_by_asset 或 get_environment_asset_series")
}

func getEnvironmentAlerts(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return nil, featureUnavailableError("环境告警", "当前主服务没有通用环境告警列表接口；位置告警请改用 list_location_alerts，环境监测请改用新的 get_environment_* 工具")
}

func getEnvironmentLatestByDevice(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	deviceID, ok := args["device_id"].(string)
	if !ok || strings.TrimSpace(deviceID) == "" {
		return nil, fmt.Errorf("device_id is required")
	}
	if err := validateStringLength(deviceID, 100, "device_id"); err != nil {
		return nil, err
	}

	path := fmt.Sprintf("/iot/environment-monitoring/devices/%s/latest", url.PathEscape(sanitizeInput(deviceID)))
	return callJSONAndParse(client, "GET", path, nil)
}

func getEnvironmentLatestByAsset(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	assetCode, ok := args["asset_code"].(string)
	if !ok || assetCode == "" {
		return nil, fmt.Errorf("asset_code is required")
	}
	if err := validateAssetCode(assetCode); err != nil {
		return nil, err
	}

	path := fmt.Sprintf("/iot/environment-monitoring/assets/%s/latest", url.PathEscape(assetCode))
	return callJSONAndParse(client, "GET", path, nil)
}

func getEnvironmentAssetSeries(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	assetCode, ok := args["asset_code"].(string)
	if !ok || assetCode == "" {
		return nil, fmt.Errorf("asset_code is required")
	}
	if err := validateAssetCode(assetCode); err != nil {
		return nil, err
	}

	queryArgs := map[string]interface{}{}
	if v, ok := args["start_time"].(string); ok && v != "" {
		queryArgs["start_time"] = v
	}
	if v, ok := args["end_time"].(string); ok && v != "" {
		queryArgs["end_time"] = v
	}
	if v, ok, err := optionalIntArg(args, "limit"); err != nil {
		return nil, err
	} else if ok {
		if v < 1 {
			v = 1
		}
		if v > 1000 {
			v = 1000
		}
		queryArgs["limit"] = v
	}

	path := fmt.Sprintf("/iot/environment-monitoring/assets/%s/series%s", url.PathEscape(assetCode), buildQueryParams(queryArgs))
	return callJSONAndParse(client, "GET", path, nil)
}

func getEnvironmentPipelineHealth(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return callJSONAndParse(client, "GET", "/iot/environment-monitoring/pipeline/health", nil)
}

func getEnvironmentPipelineDocs(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return callJSONAndParse(client, "GET", "/iot/environment-monitoring/pipeline/docs", nil)
}

func ingestZoneLocationSample(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	events, err := zoneLocationEventsArg(args)
	if err != nil {
		return nil, err
	}

	return callJSONAndParse(client, "POST", "/iot/zone-location/sample", map[string]interface{}{
		"events": events,
	})
}

func ingestZoneLocationBatch(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	events, err := zoneLocationEventsArg(args)
	if err != nil {
		return nil, err
	}

	req := map[string]interface{}{
		"events": events,
	}

	headers := map[string]string{}
	if v, ok := args["iot_token"].(string); ok && strings.TrimSpace(v) != "" {
		if err := validateStringLength(v, 500, "iot_token"); err != nil {
			return nil, err
		}
		headers["X-IOT-Token"] = strings.TrimSpace(v)
	}

	if len(headers) == 0 {
		return callJSONAndParse(client, "POST", "/iot/zone-location/ingest/batch", req)
	}
	return callJSONWithHeadersAndParse(client, "POST", "/iot/zone-location/ingest/batch", req, headers)
}

func getZoneLocationLatestByDevice(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	deviceID, ok := args["device_id"].(string)
	if !ok || strings.TrimSpace(deviceID) == "" {
		return nil, fmt.Errorf("device_id is required")
	}
	if err := validateStringLength(deviceID, 100, "device_id"); err != nil {
		return nil, err
	}

	path := fmt.Sprintf("/iot/zone-location/devices/%s/latest", url.PathEscape(sanitizeInput(deviceID)))
	return callJSONAndParse(client, "GET", path, nil)
}

func getZoneLocationLatestByAsset(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	assetCode, ok := args["asset_code"].(string)
	if !ok || assetCode == "" {
		return nil, fmt.Errorf("asset_code is required")
	}
	if err := validateAssetCode(assetCode); err != nil {
		return nil, err
	}

	path := fmt.Sprintf("/iot/zone-location/assets/%s/latest", url.PathEscape(assetCode))
	return callJSONAndParse(client, "GET", path, nil)
}

func getZoneLocationAssetSeries(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	assetCode, ok := args["asset_code"].(string)
	if !ok || assetCode == "" {
		return nil, fmt.Errorf("asset_code is required")
	}
	if err := validateAssetCode(assetCode); err != nil {
		return nil, err
	}

	queryArgs := map[string]interface{}{}
	if v, ok := args["start_time"].(string); ok && v != "" {
		queryArgs["start_time"] = v
	}
	if v, ok := args["end_time"].(string); ok && v != "" {
		queryArgs["end_time"] = v
	}
	if v, ok, err := optionalIntArg(args, "limit"); err != nil {
		return nil, err
	} else if ok {
		if v < 1 {
			v = 1
		}
		if v > 1000 {
			v = 1000
		}
		queryArgs["limit"] = v
	}

	path := fmt.Sprintf("/iot/zone-location/assets/%s/series%s", url.PathEscape(assetCode), buildQueryParams(queryArgs))
	return callJSONAndParse(client, "GET", path, nil)
}

func getZoneLocationPipelineHealth(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return callJSONAndParse(client, "GET", "/iot/zone-location/pipeline/health", nil)
}

func getZoneLocationPipelineDocs(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return callJSONAndParse(client, "GET", "/iot/zone-location/pipeline/docs", nil)
}

// ============== Intelligent Alert Handlers ==============

func listAlerts(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}

	query := map[string]interface{}{
		"page":     page,
		"pageSize": limit,
	}

	if v, ok := args["alert_type"].(string); ok && v != "" {
		query["type"] = sanitizeInput(v)
	}
	if v, ok := args["severity"].(string); ok && v != "" {
		query["urgency"] = sanitizeInput(v)
	}
	if v, ok := args["status"].(string); ok && v != "" {
		query["status"] = sanitizeInput(v)
	}

	params := buildQueryParams(query)
	respBody, err := client.doRequest("GET", "/intelligent-alerts"+params, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func acknowledgeAlert(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	alertID := strings.TrimSpace(extractStringOverrideValue(args, "id"))
	if alertID == "" {
		return nil, fmt.Errorf("id is required")
	}
	if err := validateStringLength(alertID, 100, "id"); err != nil {
		return nil, err
	}

	req := map[string]interface{}{}
	if v, ok := args["comment"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "comment"); err != nil {
			return nil, err
		}
		req["handlerNotes"] = sanitizeInput(v)
	}

	path := fmt.Sprintf("/intelligent-alerts/%s/read", url.PathEscape(sanitizeInput(alertID)))
	respBody, err := client.doRequest("POST", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}, nil
}

func resolveAlert(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	alertID := strings.TrimSpace(extractStringOverrideValue(args, "id"))
	if alertID == "" {
		return nil, fmt.Errorf("id is required")
	}
	if err := validateStringLength(alertID, 100, "id"); err != nil {
		return nil, err
	}

	req := map[string]interface{}{}
	if v, ok := args["comment"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "comment"); err != nil {
			return nil, err
		}
		req["handlerNotes"] = sanitizeInput(v)
	}

	path := fmt.Sprintf("/intelligent-alerts/%s/handle", url.PathEscape(sanitizeInput(alertID)))
	respBody, err := client.doRequest("POST", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}, nil
}

// ============== Document Management Handlers ==============

func listDocuments(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}
	args["page"] = page
	args["limit"] = limit

	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		args["keyword"] = sanitized
	}

	params := buildQueryParams(args)
	path := "/technical-documents" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func getDocument(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	path := fmt.Sprintf("/technical-documents/%d", int(id))
	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"data":    apiResp.Data,
	}, nil
}

func uploadDocument(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["title"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "title"); err != nil {
			return nil, err
		}
		req["title"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("title is required")
	}

	if v, ok := args["doc_type"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "doc_type"); err != nil {
			return nil, err
		}
		req["doc_type"] = sanitizeInput(v)
	}

	if v, ok := args["category"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "category"); err != nil {
			return nil, err
		}
		req["category"] = sanitizeInput(v)
	}

	if v, ok := args["description"].(string); ok && v != "" {
		if err := validateStringLength(v, 1000, "description"); err != nil {
			return nil, err
		}
		req["description"] = sanitizeInput(v)
	}

	if v, ok := args["file_url"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "file_url"); err != nil {
			return nil, err
		}
		req["file_url"] = v
	}

	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, err
		}
		req["asset_code"] = v
	}

	respBody, err := client.doRequest("POST", "/technical-documents", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}, nil
}

func reviewDocument(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	reviewStatus := ""
	if v, ok := args["review_status"].(string); ok && v != "" {
		reviewStatus = v
	} else if v, ok := args["action"].(string); ok {
		switch v {
		case "approve":
			reviewStatus = "approved"
		case "reject":
			reviewStatus = "rejected"
		}
	}
	if reviewStatus != "approved" && reviewStatus != "rejected" {
		return nil, fmt.Errorf("review_status is required and must be 'approved' or 'rejected'")
	}

	req := map[string]interface{}{
		"review_status": reviewStatus,
	}
	if v, ok := args["comment"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "comment"); err != nil {
			return nil, err
		}
		req["review_comment"] = sanitizeInput(v)
	}

	path := fmt.Sprintf("/technical-documents/%d/review", int(id))
	respBody, err := client.doRequest("POST", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

func listDocumentTags(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return callJSONAndParse(client, "GET", "/technical-documents/enhanced/tags", nil)
}

func createDocumentTag(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	tagName, ok := args["tag_name"].(string)
	if !ok || strings.TrimSpace(tagName) == "" {
		return nil, fmt.Errorf("tag_name is required")
	}
	if err := validateStringLength(tagName, 100, "tag_name"); err != nil {
		return nil, err
	}

	req := map[string]interface{}{
		"tag_name": sanitizeInput(tagName),
	}
	if v, ok := args["tag_color"].(string); ok && strings.TrimSpace(v) != "" {
		if err := validateStringLength(v, 20, "tag_color"); err != nil {
			return nil, err
		}
		req["tag_color"] = sanitizeInput(v)
	}

	return callJSONAndParse(client, "POST", "/technical-documents/enhanced/tags", req)
}

func deleteDocumentTag(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "DELETE", fmt.Sprintf("/technical-documents/enhanced/tags/%d", id), nil)
}

func updateDocumentTags(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	tagIDs, err := intSliceArg(args, "tag_ids")
	if err != nil {
		return nil, err
	}

	return callMessageOnly(client, "POST", fmt.Sprintf("/technical-documents/enhanced/documents/%d/tags", id), map[string]interface{}{
		"tag_ids": tagIDs,
	})
}

func listDocumentVersions(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/technical-documents/enhanced/documents/%d/versions", id), nil)
}

func createDocumentVersion(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	versionNumber, ok := args["version_number"].(string)
	if !ok || strings.TrimSpace(versionNumber) == "" {
		return nil, fmt.Errorf("version_number is required")
	}
	if err := validateStringLength(versionNumber, 50, "version_number"); err != nil {
		return nil, err
	}

	req := map[string]interface{}{
		"version_number": sanitizeInput(versionNumber),
	}
	if v, ok := args["change_log"].(string); ok && strings.TrimSpace(v) != "" {
		if err := validateStringLength(v, 2000, "change_log"); err != nil {
			return nil, err
		}
		req["change_log"] = sanitizeInput(v)
	}
	if v, ok := args["file_path"].(string); ok && strings.TrimSpace(v) != "" {
		if err := validateStringLength(v, 500, "file_path"); err != nil {
			return nil, err
		}
		req["file_path"] = sanitizeInput(v)
	}
	if v, ok := args["file_hash"].(string); ok && strings.TrimSpace(v) != "" {
		if err := validateStringLength(v, 128, "file_hash"); err != nil {
			return nil, err
		}
		req["file_hash"] = sanitizeInput(v)
	}
	if v, ok := args["file_size"].(float64); ok {
		if v < 0 {
			return nil, fmt.Errorf("file_size cannot be negative")
		}
		req["file_size"] = int(v)
	}

	return callJSONAndParse(client, "POST", fmt.Sprintf("/technical-documents/enhanced/documents/%d/versions", id), req)
}

func favoriteDocument(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "POST", fmt.Sprintf("/technical-documents/enhanced/documents/%d/favorite", id), nil)
}

func unfavoriteDocument(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "DELETE", fmt.Sprintf("/technical-documents/enhanced/documents/%d/favorite", id), nil)
}

func listFavoriteDocuments(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 10
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}

	queryArgs := map[string]interface{}{
		"page":     page,
		"pageSize": limit,
	}
	return callJSONAndParse(client, "GET", "/technical-documents/enhanced/my/favorites"+buildQueryParams(queryArgs), nil)
}

func listDocumentComments(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	queryArgs := map[string]interface{}{}
	if v, ok := args["resolved"].(bool); ok {
		queryArgs["resolved"] = v
	}

	path := fmt.Sprintf("/technical-documents/enhanced/documents/%d/comments", id)
	if len(queryArgs) > 0 {
		path += buildQueryParams(queryArgs)
	}
	return callJSONAndParse(client, "GET", path, nil)
}

func createDocumentComment(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	content, ok := args["content"].(string)
	if !ok || strings.TrimSpace(content) == "" {
		return nil, fmt.Errorf("content is required")
	}
	if err := validateStringLength(content, 2000, "content"); err != nil {
		return nil, err
	}

	req := map[string]interface{}{
		"content": sanitizeInput(content),
	}
	if parentID, exists, err := optionalIntArg(args, "parent_id"); err != nil {
		return nil, err
	} else if exists {
		req["parent_id"] = parentID
	}

	return callJSONAndParse(client, "POST", fmt.Sprintf("/technical-documents/enhanced/documents/%d/comments", id), req)
}

func resolveDocumentComment(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "PUT", fmt.Sprintf("/technical-documents/enhanced/comments/%d/resolve", id), nil)
}

func listDocumentTemplates(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return callJSONAndParse(client, "GET", "/technical-documents/enhanced/templates", nil)
}

func createDocumentTemplate(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	templateName, ok := args["template_name"].(string)
	if !ok || strings.TrimSpace(templateName) == "" {
		return nil, fmt.Errorf("template_name is required")
	}
	if err := validateStringLength(templateName, 200, "template_name"); err != nil {
		return nil, err
	}

	req := map[string]interface{}{
		"template_name": sanitizeInput(templateName),
	}
	if v, ok := args["template_description"].(string); ok && strings.TrimSpace(v) != "" {
		if err := validateStringLength(v, 2000, "template_description"); err != nil {
			return nil, err
		}
		req["template_description"] = sanitizeInput(v)
	}
	if categoryID, exists, err := optionalIntArg(args, "category_id"); err != nil {
		return nil, err
	} else if exists {
		req["category_id"] = categoryID
	}
	if raw, exists := args["template_fields"]; exists && raw != nil {
		switch typed := raw.(type) {
		case map[string]interface{}:
			req["template_fields"] = typed
		case []interface{}:
			req["template_fields"] = typed
		default:
			return nil, fmt.Errorf("template_fields must be an object or array")
		}
	}

	return callJSONAndParse(client, "POST", "/technical-documents/enhanced/templates", req)
}

func deleteDocumentTemplate(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "DELETE", fmt.Sprintf("/technical-documents/enhanced/templates/%d", id), nil)
}

func batchDeleteDocuments(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	documentIDs, err := intSliceArg(args, "document_ids")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "POST", "/technical-documents/enhanced/batch/delete", map[string]interface{}{
		"document_ids": documentIDs,
	})
}

func batchUpdateDocumentCategory(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	documentIDs, err := intSliceArg(args, "document_ids")
	if err != nil {
		return nil, err
	}
	categoryID, exists, err := optionalIntArg(args, "category_id")
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, fmt.Errorf("category_id is required")
	}

	return callMessageOnly(client, "POST", "/technical-documents/enhanced/batch/category", map[string]interface{}{
		"document_ids": documentIDs,
		"category_id":  categoryID,
	})
}

func createDocumentShare(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}

	req := make(map[string]interface{})
	if v, ok := args["expires_days"].(float64); ok {
		if v <= 0 {
			return nil, fmt.Errorf("expires_days must be greater than 0")
		}
		req["expires_days"] = int(v)
	}
	if v, ok := args["max_uploads"].(float64); ok {
		if v <= 0 {
			return nil, fmt.Errorf("max_uploads must be greater than 0")
		}
		req["max_uploads"] = int(v)
	}
	if v, ok := args["remark"].(string); ok && strings.TrimSpace(v) != "" {
		if err := validateStringLength(v, 500, "remark"); err != nil {
			return nil, err
		}
		req["remark"] = sanitizeInput(v)
	}
	if v, ok := args["supplier_name"].(string); ok && strings.TrimSpace(v) != "" {
		if err := validateStringLength(v, 200, "supplier_name"); err != nil {
			return nil, err
		}
		req["supplier_name"] = sanitizeInput(v)
	}
	if v, ok := args["supplier_contact"].(string); ok && strings.TrimSpace(v) != "" {
		if err := validateStringLength(v, 100, "supplier_contact"); err != nil {
			return nil, err
		}
		req["supplier_contact"] = sanitizeInput(v)
	}

	return callJSONAndParse(client, "POST", fmt.Sprintf("/technical-documents/%d/share", id), req)
}

func listDocumentShares(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, err := requiredIntArg(args, "id")
	if err != nil {
		return nil, err
	}
	return callJSONAndParse(client, "GET", fmt.Sprintf("/technical-documents/%d/shares", id), nil)
}

func deleteDocumentShare(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	shareID, err := requiredIntArg(args, "share_id")
	if err != nil {
		return nil, err
	}
	return callMessageOnly(client, "DELETE", fmt.Sprintf("/technical-documents/shares/%d", shareID), nil)
}

func listAssetLabels(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}
	args["page"] = page
	args["limit"] = limit

	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, err
		}
		args["keyword"] = sanitized
	}

	params := buildQueryParams(args)
	path := "/asset-labels" + params

	respBody, err := client.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponseWithPagination
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"data":       apiResp.Data,
		"pagination": apiResp.Pagination,
		"message":    apiResp.Message,
	}, nil
}

func createAssetLabel(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	req := make(map[string]interface{})

	if v, ok := args["name"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "name"); err != nil {
			return nil, err
		}
		req["name"] = sanitizeInput(v)
	} else {
		return nil, fmt.Errorf("name is required")
	}

	if v, ok := args["color"].(string); ok && v != "" {
		if err := validateStringLength(v, 20, "color"); err != nil {
			return nil, err
		}
		req["color"] = sanitizeInput(v)
	}

	if v, ok := args["description"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "description"); err != nil {
			return nil, err
		}
		req["description"] = sanitizeInput(v)
	}

	respBody, err := client.doRequest("POST", "/asset-labels", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    apiResp.Data,
	}, nil
}

func assignAssetLabel(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	assetCode, ok := args["asset_code"].(string)
	if !ok || assetCode == "" {
		return nil, fmt.Errorf("asset_code is required")
	}
	if err := validateAssetCode(assetCode); err != nil {
		return nil, err
	}

	labelID, ok := args["label_id"].(float64)
	if !ok {
		return nil, fmt.Errorf("label_id is required")
	}

	req := map[string]interface{}{
		"asset_code": assetCode,
		"label_id":   int(labelID),
	}

	respBody, err := client.doRequest("POST", "/asset-labels/assign", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
	}, nil
}

// ============== Intelligent Analytics Handlers ==============

func getAIMaintenancePrediction(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return nil, featureUnavailableError("AI维修预测", "当前后端仅开放 /api/maintenance/ai/analysis，未开放独立 prediction 接口")
}

func getAIFailureAnalysis(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return nil, featureUnavailableError("AI故障分析", "风险/故障分析相关后端接口当前未挂载到主服务")
}

func fetchRiskClassificationRecords(client *AssetHubClient, args map[string]interface{}, defaultHighRiskOnly bool) ([]map[string]interface{}, Pagination, map[string]interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}

	queryArgs := map[string]interface{}{
		"page":  page,
		"limit": limit,
	}
	filtering := map[string]interface{}{
		"source_endpoint": "/api/risk/classification",
	}

	assetCodeFilter := ""
	if v, ok := args["asset_code"].(string); ok && v != "" {
		if err := validateAssetCode(v); err != nil {
			return nil, Pagination{}, nil, err
		}
		assetCodeFilter = v
	}

	if v, ok := args["keyword"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, Pagination{}, nil, err
		}
		queryArgs["keyword"] = sanitized
	} else if assetCodeFilter != "" {
		queryArgs["keyword"] = assetCodeFilter
	}

	requestedRiskLevel := ""
	if v, ok := args["risk_level"].(string); ok && v != "" {
		if err := validateStringLength(v, 20, "risk_level"); err != nil {
			return nil, Pagination{}, nil, err
		}
		requestedRiskLevel = strings.ToLower(strings.TrimSpace(v))
		queryArgs["risk_level"] = requestedRiskLevel
	}

	departmentFilter := ""
	if v, ok := args["department"].(string); ok && v != "" {
		sanitized, err := validateKeyword(v)
		if err != nil {
			return nil, Pagination{}, nil, err
		}
		departmentFilter = sanitized
	}

	items, pagination, err := fetchRawArrayData(client, "/risk/classification", queryArgs)
	if err != nil {
		return nil, Pagination{}, nil, err
	}

	filtered := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		if assetCodeFilter != "" && !mapMatchesAnyKeyword(item, assetCodeFilter, "asset_code") {
			continue
		}
		if departmentFilter != "" && !mapMatchesDepartment(item, departmentFilter, "department") {
			continue
		}
		if defaultHighRiskOnly && requestedRiskLevel == "" {
			level := strings.ToLower(extractStringFromMap(item, "risk_level"))
			if level != "high" && level != "critical" {
				continue
			}
		}
		filtered = append(filtered, item)
	}

	filtering["returned_count"] = len(filtered)
	if assetCodeFilter != "" {
		filtering["client_side_asset_code_filter"] = true
	}
	if departmentFilter != "" {
		filtering["client_side_department_filter"] = true
	}
	if defaultHighRiskOnly && requestedRiskLevel == "" {
		filtering["default_risk_levels"] = []string{"high", "critical"}
	}

	return filtered, pagination, filtering, nil
}

func getAssetRiskAssessment(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	items, pagination, filtering, err := fetchRiskClassificationRecords(client, args, false)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
		"filtering":  filtering,
	}, nil
}

func getHighRiskAssets(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	items, pagination, filtering, err := fetchRiskClassificationRecords(client, args, true)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
		"filtering":  filtering,
	}, nil
}

func getRiskDashboard(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	respBody, err := client.doRequest("GET", "/risk/dashboard", nil)
	if err != nil {
		return nil, err
	}

	data, err := parseAPIResponseDataObject(respBody)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data": data,
	}, nil
}

func listRiskControls(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	page, limit := 1, 20
	if v, ok := args["page"].(float64); ok {
		page, limit, _ = validatePagination(int(v), limit)
	}
	if v, ok := args["limit"].(float64); ok {
		_, limit, _ = validatePagination(page, int(v))
	}

	queryArgs := map[string]interface{}{
		"page":  page,
		"limit": limit,
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		queryArgs["status"] = sanitizeInput(v)
	}

	items, pagination, err := fetchRawArrayData(client, "/risk/controls", queryArgs)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"data":       items,
		"pagination": pagination,
	}, nil
}

func updateRiskControl(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	id, ok := args["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	req := make(map[string]interface{})
	if v, ok := args["assessment_id"].(float64); ok {
		req["assessment_id"] = int(v)
	}
	if v, ok := args["control_code"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "control_code"); err != nil {
			return nil, err
		}
		req["control_code"] = sanitizeInput(v)
	}
	if v, ok := args["control_name"].(string); ok && v != "" {
		if err := validateStringLength(v, 200, "control_name"); err != nil {
			return nil, err
		}
		req["control_name"] = sanitizeInput(v)
	}
	if v, ok := args["control_type"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "control_type"); err != nil {
			return nil, err
		}
		req["control_type"] = sanitizeInput(v)
	}
	if v, ok := args["risk_level"].(string); ok && v != "" {
		if err := validateStringLength(v, 20, "risk_level"); err != nil {
			return nil, err
		}
		req["risk_level"] = sanitizeInput(v)
	}
	if v, ok := args["control_description"].(string); ok && v != "" {
		if err := validateStringLength(v, 1000, "control_description"); err != nil {
			return nil, err
		}
		req["control_description"] = sanitizeInput(v)
	}
	if v, ok := args["planned_end_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "planned_end_date"); err != nil {
			return nil, err
		}
		req["planned_end_date"] = v
	}
	if v, ok := args["actual_end_date"].(string); ok && v != "" {
		if err := validateDateFormat(v, "actual_end_date"); err != nil {
			return nil, err
		}
		req["actual_end_date"] = v
	}
	if v, ok := args["responsible_person"].(string); ok && v != "" {
		if err := validateStringLength(v, 100, "responsible_person"); err != nil {
			return nil, err
		}
		req["responsible_person"] = sanitizeInput(v)
	} else if v, ok := args["responsible_person"].(float64); ok {
		req["responsible_person"] = int(v)
	}
	if v, ok := args["status"].(string); ok && v != "" {
		if err := validateStringLength(v, 50, "status"); err != nil {
			return nil, err
		}
		req["status"] = sanitizeInput(v)
	}
	if v, ok := args["progress"].(float64); ok {
		if v < 0 || v > 100 {
			return nil, fmt.Errorf("progress must be between 0 and 100")
		}
		req["progress"] = int(v)
	}
	if v, ok := args["remarks"].(string); ok && v != "" {
		if err := validateStringLength(v, 500, "remarks"); err != nil {
			return nil, err
		}
		req["remarks"] = sanitizeInput(v)
	}

	if len(req) == 0 {
		return nil, fmt.Errorf("at least one updatable field is required")
	}

	path := fmt.Sprintf("/risk/controls/%d", int(id))
	respBody, err := client.doRequest("PUT", path, req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	data, err := parseAPIResponseData(respBody)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"success": apiResp.Success,
		"message": apiResp.Message,
		"data":    data,
	}, nil
}

func getPredictiveMaintenance(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return nil, featureUnavailableError("预测性维护", "predictive-maintenance 接口尚未挂载到主服务")
}

func getAssetHealthIndex(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return nil, featureUnavailableError("资产健康指数", "health 相关接口尚未挂载到主服务")
}

func getDepartmentHealthOverview(client *AssetHubClient, args map[string]interface{}) (interface{}, error) {
	return nil, featureUnavailableError("科室健康总览", "health 相关接口尚未挂载到主服务")
}
