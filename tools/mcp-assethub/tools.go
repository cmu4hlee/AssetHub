package main

// Tool definitions for AssetHub MCP server
// This file contains the main getToolDefinition dispatcher that delegates to category-specific helpers.
// Tool definitions are organized into separate files:
//   - tools_definitions.go: Core helpers (depreciationFilterProperties, validation functions)
//   - tools_asset.go: Asset management tools
//   - tools_transfer.go: Transfer, idle, scrap tools
//   - tools_maintenance.go: Maintenance and workflow tools
//   - tools_common.go: Auxiliary/common tools
//   - tools_system.go: User, role, permission, module, audit, tenant management
//   - tools_iot.go: IoT device, location, environment monitoring, alerts
//   - tools_business.go: AI, procurement, quality control, inventory, dashboard
//   - tools_analytics.go: Intelligent analytics and document management

func getToolDefinition(name string) Tool {
	// Try each category in order
	if tool := assetToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := depreciationToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := assetLifecycleToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := transferToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := scrapToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := maintenanceToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := workflowToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := auxiliaryToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := acceptanceToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := userManagementToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := rolePermissionToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := systemConfigToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := moduleToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := auditToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := tenantToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := iotDeviceToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := locationTrackingToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := locationCodeToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := locationAlertToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := environmentMonitoringToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := zoneLocationToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := intelligentAlertToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := iotPatientVolumeToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := aiToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := procurementToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := qualityControlToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := inventoryToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := dashboardToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := analyticsToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := documentToolDefinition(name); tool.Name != "" {
		return tool
	}
	if tool := assetLabelToolDefinition(name); tool.Name != "" {
		return tool
	}

	return Tool{}
}

func withRuntimeOverrides(tool Tool) Tool {
	if tool.Name == "" {
		return tool
	}

	if tool.InputSchema == nil {
		tool.InputSchema = map[string]interface{}{"type": "object"}
	}

	properties, ok := tool.InputSchema["properties"].(map[string]interface{})
	if !ok || properties == nil {
		properties = map[string]interface{}{}
	}

	if _, exists := properties["tenant_id"]; !exists {
		properties["tenant_id"] = map[string]interface{}{
			"type":        "integer",
			"description": "可选。仅供受信任代理按本次调用临时覆盖当前 MCP 客户端租户，不要向终端用户索取",
		}
	}

	if _, exists := properties["_auth_username"]; !exists {
		properties["_auth_username"] = map[string]interface{}{
			"type":        "string",
			"description": "可选。仅供受信任代理按本次调用临时覆盖 MCP 登录用户名，不要向终端用户索取",
		}
	}

	if _, exists := properties["_auth_password"]; !exists {
		properties["_auth_password"] = map[string]interface{}{
			"type":        "string",
			"description": "可选。仅供受信任代理按本次调用临时覆盖 MCP 登录密码，不要向终端用户索取",
		}
	}

	if _, exists := properties["_auth_token"]; !exists {
		properties["_auth_token"] = map[string]interface{}{
			"type":        "string",
			"description": "可选。仅供受信任代理按本次调用临时覆盖 MCP Bearer Token；若提供则优先于默认共享凭证",
		}
	}

	if _, exists := properties["_auth_context_id"]; !exists {
		properties["_auth_context_id"] = map[string]interface{}{
			"type":        "string",
			"description": "可选。仅供受信任代理注入短时运行时认证上下文 ID；MCP 将在本机安全目录中解析真实 token/租户",
		}
	}

	tool.InputSchema["properties"] = properties
	return tool
}
