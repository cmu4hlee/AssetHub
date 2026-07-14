package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// MCP JSON-RPC protocol types
type MCPRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
	ID      interface{}     `json:"id,omitempty"`
}

type MCPResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	Result  interface{} `json:"result,omitempty"`
	Error   *MCPError   `json:"error,omitempty"`
	ID      interface{} `json:"id,omitempty"`
}

type MCPError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type MCPErrorCode int

const (
	ParseError     MCPErrorCode = -32700
	InvalidRequest MCPErrorCode = -32600
	MethodNotFound MCPErrorCode = -32601
	InvalidParams  MCPErrorCode = -32602
	InternalError  MCPErrorCode = -32603
)

const defaultProtocolVersion = "2024-11-05"

var supportedProtocolVersions = map[string]struct{}{
	defaultProtocolVersion: {},
}

var protocolVersionDatePattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// Hide tools whose handlers are known placeholders until the backend actually mounts them.
var hiddenTools = map[string]struct{}{
	"get_todo_tasks":                 {},
	"complete_task":                  {},
	"get_environment_records":        {},
	"get_environment_alerts":         {},
	"get_ai_maintenance_prediction":  {},
	"get_ai_failure_analysis":        {},
	"get_predictive_maintenance":     {},
	"get_asset_health_index":         {},
	"get_department_health_overview": {},
}

// Initialize params and result
type InitializeParams struct {
	ProtocolVersion string `json:"protocolVersion"`
	Capabilities    struct {
		Tools bool `json:"tools"`
	} `json:"capabilities"`
	ClientInfo struct {
		Name    string `json:"name"`
		Version string `json:"version"`
	} `json:"clientInfo"`
}

type InitializeResult struct {
	ProtocolVersion string             `json:"protocolVersion"`
	Capabilities    ServerCapabilities `json:"capabilities"`
	ServerInfo      ServerServerInfo   `json:"serverInfo"`
}

type ServerCapabilities struct {
	Tools *ToolsCapability `json:"tools"`
}

type ToolsCapability struct {
	ListChanged bool `json:"listChanged,omitempty"`
}

type ServerServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// Tool types
type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

type ListToolsResult struct {
	Tools []Tool `json:"tools"`
}

type CallToolParams struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments,omitempty"`
}

type ToolResult struct {
	Content []ToolContent `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

type ToolContent struct {
	Type string `json:"type"` // "text" or "image"
	Text string `json:"text,omitempty"`
	Mime string `json:"mimeType,omitempty"`
}

// MCPServer is the main MCP server
type MCPServer struct {
	client      *AssetHubClient
	tools       map[string]ToolHandler
	mu          sync.Mutex
	toolPrefix  string
	shutdownCh  chan struct{}
	cleanupFunc func() // optional cleanup callback
}

// NewMCPServer creates a new MCP server
func NewMCPServer(client *AssetHubClient, toolPrefix string) *MCPServer {
	s := &MCPServer{
		client:     client,
		tools:      make(map[string]ToolHandler),
		toolPrefix: toolPrefix,
		shutdownCh: make(chan struct{}),
	}
	s.registerTools()
	return s
}

// Shutdown gracefully shuts down the server
func (s *MCPServer) Shutdown() {
	close(s.shutdownCh)
}

// SetCleanupFunc sets an optional cleanup function to run on shutdown
func (s *MCPServer) SetCleanupFunc(f func()) {
	s.cleanupFunc = f
}

// registerTools registers all available tools
func (s *MCPServer) registerTools() {
	// Register handlers for MCP exposure
	RegisterHandler("list_assets", listAssets)
	RegisterHandler("list_all_assets", listAllAssets)
	RegisterHandler("get_asset", getAsset)
	RegisterHandler("create_asset", createAsset)
	RegisterHandler("update_asset", updateAsset)
	RegisterHandler("delete_asset", deleteAsset)
	RegisterHandler("get_asset_categories", getAssetCategories)
	RegisterHandler("get_asset_statistics", getAssetStatistics)
	RegisterHandler("get_department_statistics", getDepartmentStatistics)
	RegisterHandler("get_value_statistics", getValueStatistics)
	RegisterHandler("list_depreciation", listDepreciation)
	RegisterHandler("get_depreciation_detail", getDepreciationDetail)
	RegisterHandler("get_depreciation_summary_by_department", getDepreciationSummaryByDepartment)
	RegisterHandler("get_depreciation_summary_by_type", getDepreciationSummaryByType)
	RegisterHandler("get_depreciation_summary_by_month", getDepreciationSummaryByMonth)
	RegisterHandler("get_asset_change_logs", getAssetChangeLogs)
	RegisterHandler("list_idle_assets", listIdleAssets)
	RegisterHandler("publish_idle_asset", publishIdleAsset)
	RegisterHandler("allocate_idle_asset", allocateIdleAsset)
	RegisterHandler("cancel_idle_asset", cancelIdleAsset)

	// Transfer tools
	RegisterHandler("transfer_asset", transferAsset)
	RegisterHandler("list_transfers", listTransfers)
	RegisterHandler("approve_transfer", approveTransfer)
	RegisterHandler("execute_transfer", executeTransfer)

	// Maintenance tools
	RegisterHandler("list_maintenance_logs", listMaintenanceLogs)
	RegisterHandler("create_maintenance_log", createMaintenanceLog)
	RegisterHandler("get_maintenance_templates", getMaintenanceTemplates)
	RegisterHandler("get_maintenance_efficiency", getMaintenanceEfficiency)
	RegisterHandler("list_maintenance_plans", listMaintenancePlans)
	RegisterHandler("get_maintenance_plan", getMaintenancePlan)
	RegisterHandler("create_maintenance_plan", createMaintenancePlan)
	RegisterHandler("update_maintenance_plan", updateMaintenancePlan)
	RegisterHandler("complete_maintenance_plan", completeMaintenancePlan)
	RegisterHandler("delete_maintenance_plan", deleteMaintenancePlan)
	RegisterHandler("get_maintenance_plan_history", getMaintenancePlanHistory)
	RegisterHandler("list_reminders", listReminders)
	RegisterHandler("send_reminder", sendReminder)
	RegisterHandler("config_reminder", configReminder)
	RegisterHandler("check_reminders", checkReminders)
	RegisterHandler("list_maintenance_workorders", listMaintenanceWorkorders)
	RegisterHandler("get_maintenance_workorder", getMaintenanceWorkorder)
	RegisterHandler("create_maintenance_workorder", createMaintenanceWorkorder)
	RegisterHandler("assign_workorder", assignWorkorder)
	RegisterHandler("start_workorder", startWorkorder)
	RegisterHandler("complete_workorder", completeWorkorder)
	RegisterHandler("close_workorder", closeWorkorder)
	RegisterHandler("cancel_workorder", cancelWorkorder)
	RegisterHandler("add_workorder_materials", addWorkorderMaterials)
	RegisterHandler("list_maintenance_requests", listMaintenanceRequests)
	RegisterHandler("get_maintenance_request", getMaintenanceRequest)
	RegisterHandler("create_maintenance_request", createMaintenanceRequest)
	RegisterHandler("approve_maintenance_request", approveMaintenanceRequest)
	RegisterHandler("start_maintenance_request", startMaintenanceRequest)
	RegisterHandler("complete_maintenance_request", completeMaintenanceRequest)
	RegisterHandler("update_workorder_status", updateWorkorderStatus)
	RegisterHandler("list_usage_records", listUsageRecords)
	RegisterHandler("create_usage_record", createUsageRecord)
	RegisterHandler("list_usage_triggered", listUsageTriggered)
	RegisterHandler("process_usage_triggered", processUsageTriggered)

	// Workflow tools
	RegisterHandler("get_todo_tasks", getTodoTasks)
	RegisterHandler("complete_task", completeTask)
	RegisterHandler("get_default_workflow", getDefaultWorkflow)
	RegisterHandler("list_workflow_states", listWorkflowStates)
	RegisterHandler("list_workflow_transitions", listWorkflowTransitions)
	RegisterHandler("apply_asset_transition", applyAssetTransition)
	RegisterHandler("list_asset_workflows", listAssetWorkflows)
	RegisterHandler("get_asset_workflow", getAssetWorkflow)
	RegisterHandler("create_asset_workflow", createAssetWorkflow)
	RegisterHandler("update_asset_workflow", updateAssetWorkflow)
	RegisterHandler("delete_asset_workflow", deleteAssetWorkflow)

	// Auxiliary tools
	RegisterHandler("list_departments", listDepartments)
	RegisterHandler("list_users", listUsers)
	RegisterHandler("get_current_auth_context", getCurrentAuthContext)
	RegisterHandler("query_department_asset_profile", queryDepartmentAssetProfile)
	RegisterHandler("query_asset_operation_overview", queryAssetOperationOverview)
	RegisterHandler("query_workflow_pending_summary", queryWorkflowPendingSummary)

	// AI tools
	RegisterHandler("init_ai_conversation", initAIConversation)
	RegisterHandler("send_ai_message", sendAIMessage)
	RegisterHandler("get_ai_pending", getAIPending)
	RegisterHandler("get_ai_analysis", getAIAnalysis)

	// IoT/Patient Volume tools
	RegisterHandler("get_patient_volume_records", getPatientVolumeRecords)
	RegisterHandler("get_asset_usage_stats", getAssetUsageStats)

	// Procurement tools
	RegisterHandler("list_procurements", listProcurements)
	RegisterHandler("create_procurement", createProcurement)
	RegisterHandler("approve_procurement", approveProcurement)

	// Quality Control tools
	RegisterHandler("list_quality_controls", listQualityControls)
	RegisterHandler("create_quality_control", createQualityControl)
	RegisterHandler("get_quality_statistics", getQualityStatistics)

	// Inventory tools
	RegisterHandler("list_inventory", listInventory)
	RegisterHandler("create_inventory_record", createInventoryRecord)
	RegisterHandler("adjust_inventory", adjustInventory)
	RegisterHandler("list_inventory_plans", listInventoryPlans)
	RegisterHandler("get_inventory_plan", getInventoryPlan)
	RegisterHandler("create_inventory_plan", createInventoryPlan)
	RegisterHandler("update_inventory_plan", updateInventoryPlan)
	RegisterHandler("activate_inventory_plan", activateInventoryPlan)
	RegisterHandler("complete_inventory_plan", completeInventoryPlan)
	RegisterHandler("cancel_inventory_plan", cancelInventoryPlan)
	RegisterHandler("list_inventory_tasks", listInventoryTasks)
	RegisterHandler("get_inventory_task", getInventoryTask)
	RegisterHandler("create_inventory_task", createInventoryTask)
	RegisterHandler("assign_inventory_task", assignInventoryTask)
	RegisterHandler("start_inventory_task", startInventoryTask)
	RegisterHandler("complete_inventory_task", completeInventoryTask)
	RegisterHandler("update_inventory_task", updateInventoryTask)
	RegisterHandler("cancel_inventory_task", cancelInventoryTask)
	RegisterHandler("list_inventory_discrepancies", listInventoryDiscrepancies)
	RegisterHandler("get_inventory_discrepancy", getInventoryDiscrepancy)
	RegisterHandler("handle_inventory_discrepancy", handleInventoryDiscrepancy)
	RegisterHandler("batch_handle_inventory_discrepancies", batchHandleInventoryDiscrepancies)
	RegisterHandler("get_inventory_discrepancy_statistics", getInventoryDiscrepancyStatistics)
	RegisterHandler("generate_inventory_discrepancies", generateInventoryDiscrepancies)

	// Scrapping tools
	RegisterHandler("list_scrappings", listScrappings)
	RegisterHandler("create_scrapping", createScrapping)
	RegisterHandler("approve_scrapping", approveScrapping)

	// Acceptance tools
	RegisterHandler("list_acceptances", listAcceptances)
	RegisterHandler("create_acceptance", createAcceptance)

	// Dashboard & Statistics tools
	RegisterHandler("get_dashboard_overview", getDashboardOverview)
	RegisterHandler("get_asset_age_distribution", getAssetAgeDistribution)
	RegisterHandler("get_maintenance_cost_analysis", getMaintenanceCostAnalysis)

	// User Management tools
	RegisterHandler("create_user", createUser)
	RegisterHandler("update_user", updateUser)
	RegisterHandler("reset_user_password", resetUserPassword)
	RegisterHandler("assign_user_role", assignUserRole)

	// Role & Permission tools
	RegisterHandler("list_roles", listRoles)
	RegisterHandler("get_role_permissions", getRolePermissions)
	RegisterHandler("create_role", createRole)
	RegisterHandler("update_role_permissions", updateRolePermissions)

	// System Config tools
	RegisterHandler("get_system_config", getSystemConfig)
	RegisterHandler("update_system_config", updateSystemConfig)

	// Module Management tools
	RegisterHandler("list_modules", listModules)
	RegisterHandler("get_module_config", getModuleConfig)
	RegisterHandler("update_module_config", updateModuleConfig)
	RegisterHandler("validate_module_config", validateModuleConfig)
	RegisterHandler("enable_module", enableModule)
	RegisterHandler("disable_module", disableModule)
	RegisterHandler("list_module_versions", listModuleVersions)
	RegisterHandler("create_module_version", createModuleVersion)
	RegisterHandler("rollback_module_version", rollbackModuleVersion)
	RegisterHandler("compare_module_version", compareModuleVersion)
	RegisterHandler("delete_module_version", deleteModuleVersion)
	RegisterHandler("backup_module_config", backupModuleConfig)
	RegisterHandler("restore_module_config", restoreModuleConfig)
	RegisterHandler("list_module_menus", listModuleMenus)
	RegisterHandler("update_module_menus", updateModuleMenus)

	// Audit Log tools
	RegisterHandler("list_audit_logs", listAuditLogs)
	RegisterHandler("get_audit_log_detail", getAuditLogDetail)

	// Tenant Management tools
	RegisterHandler("list_tenants", listTenants)
	RegisterHandler("get_tenant_config", getTenantConfig)
	RegisterHandler("update_tenant_modules", updateTenantModules)

	// IoT/Device Management tools
	RegisterHandler("list_iot_devices", listIoTDevices)
	RegisterHandler("get_device", getDevice)
	RegisterHandler("register_device", registerDevice)
	RegisterHandler("update_device_status", updateDeviceStatus)
	RegisterHandler("get_asset_location", getAssetLocation)
	RegisterHandler("get_location_history", getLocationHistory)
	RegisterHandler("list_assets_in_area", listAssetsInArea)
	RegisterHandler("report_device_location_data", reportDeviceLocationData)
	RegisterHandler("report_beacon_location", reportBeaconLocation)
	RegisterHandler("list_beacon_assets", listBeaconAssets)
	RegisterHandler("list_location_codes", listLocationCodes)
	RegisterHandler("get_location_code", getLocationCode)
	RegisterHandler("create_location_code", createLocationCode)
	RegisterHandler("update_location_code", updateLocationCode)
	RegisterHandler("delete_location_code", deleteLocationCode)
	RegisterHandler("list_location_alerts", listLocationAlerts)
	RegisterHandler("get_location_alert_stats", getLocationAlertStats)
	RegisterHandler("handle_location_alert", handleLocationAlert)
	RegisterHandler("batch_handle_location_alerts", batchHandleLocationAlerts)
	RegisterHandler("delete_location_alert", deleteLocationAlert)
	RegisterHandler("get_environment_records", getEnvironmentRecords)
	RegisterHandler("get_environment_alerts", getEnvironmentAlerts)
	RegisterHandler("get_environment_latest_by_device", getEnvironmentLatestByDevice)
	RegisterHandler("get_environment_latest_by_asset", getEnvironmentLatestByAsset)
	RegisterHandler("get_environment_asset_series", getEnvironmentAssetSeries)
	RegisterHandler("get_environment_pipeline_health", getEnvironmentPipelineHealth)
	RegisterHandler("get_environment_pipeline_docs", getEnvironmentPipelineDocs)
	RegisterHandler("ingest_zone_location_sample", ingestZoneLocationSample)
	RegisterHandler("ingest_zone_location_batch", ingestZoneLocationBatch)
	RegisterHandler("get_zone_location_latest_by_device", getZoneLocationLatestByDevice)
	RegisterHandler("get_zone_location_latest_by_asset", getZoneLocationLatestByAsset)
	RegisterHandler("get_zone_location_asset_series", getZoneLocationAssetSeries)
	RegisterHandler("get_zone_location_pipeline_health", getZoneLocationPipelineHealth)
	RegisterHandler("get_zone_location_pipeline_docs", getZoneLocationPipelineDocs)

	// Intelligent Alert tools
	RegisterHandler("list_alerts", listAlerts)
	RegisterHandler("acknowledge_alert", acknowledgeAlert)
	RegisterHandler("resolve_alert", resolveAlert)

	// Document Management tools
	RegisterHandler("list_documents", listDocuments)
	RegisterHandler("get_document", getDocument)
	RegisterHandler("upload_document", uploadDocument)
	RegisterHandler("review_document", reviewDocument)
	RegisterHandler("list_document_tags", listDocumentTags)
	RegisterHandler("create_document_tag", createDocumentTag)
	RegisterHandler("delete_document_tag", deleteDocumentTag)
	RegisterHandler("update_document_tags", updateDocumentTags)
	RegisterHandler("list_document_versions", listDocumentVersions)
	RegisterHandler("create_document_version", createDocumentVersion)
	RegisterHandler("favorite_document", favoriteDocument)
	RegisterHandler("unfavorite_document", unfavoriteDocument)
	RegisterHandler("list_favorite_documents", listFavoriteDocuments)
	RegisterHandler("list_document_comments", listDocumentComments)
	RegisterHandler("create_document_comment", createDocumentComment)
	RegisterHandler("resolve_document_comment", resolveDocumentComment)
	RegisterHandler("list_document_templates", listDocumentTemplates)
	RegisterHandler("create_document_template", createDocumentTemplate)
	RegisterHandler("delete_document_template", deleteDocumentTemplate)
	RegisterHandler("batch_delete_documents", batchDeleteDocuments)
	RegisterHandler("batch_update_document_category", batchUpdateDocumentCategory)
	RegisterHandler("create_document_share", createDocumentShare)
	RegisterHandler("list_document_shares", listDocumentShares)
	RegisterHandler("delete_document_share", deleteDocumentShare)
	RegisterHandler("list_asset_labels", listAssetLabels)
	RegisterHandler("create_asset_label", createAssetLabel)
	RegisterHandler("assign_asset_label", assignAssetLabel)

	// Intelligent Analytics tools
	RegisterHandler("get_ai_maintenance_prediction", getAIMaintenancePrediction)
	RegisterHandler("get_ai_failure_analysis", getAIFailureAnalysis)
	RegisterHandler("get_asset_risk_assessment", getAssetRiskAssessment)
	RegisterHandler("get_high_risk_assets", getHighRiskAssets)
	RegisterHandler("get_risk_dashboard", getRiskDashboard)
	RegisterHandler("list_risk_controls", listRiskControls)
	RegisterHandler("update_risk_control", updateRiskControl)
	RegisterHandler("get_predictive_maintenance", getPredictiveMaintenance)
	RegisterHandler("get_asset_health_index", getAssetHealthIndex)
	RegisterHandler("get_department_health_overview", getDepartmentHealthOverview)

	// Expose every registered handler through the MCP tools/list surface.
	for name, handler := range registeredHandlers {
		if !shouldExposeTool(name) {
			continue
		}
		s.tools[name] = handler
	}
}

func isSupportedProtocolVersion(version string) bool {
	if _, ok := supportedProtocolVersions[version]; ok {
		return true
	}

	// MCP protocol versions are date-based. Accept well-formed newer date versions
	// so client upgrades do not break initialize when the feature surface is unchanged.
	return protocolVersionDatePattern.MatchString(version)
}

func shouldExposeTool(name string) bool {
	_, hidden := hiddenTools[name]
	return !hidden
}

// Handle processes incoming MCP requests
func (s *MCPServer) Handle(req MCPRequest) MCPResponse {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Handle notifications (no ID) - return empty response
	if req.ID == nil {
		switch req.Method {
		case "notifications/initialized":
			// Cursor sends this after initialize to signal it's ready
			return MCPResponse{}
		default:
			// Silently ignore unknown notifications
			return MCPResponse{}
		}
	}

	switch req.Method {
	case "initialize":
		return s.handleInitialize(req)
	case "tools/list":
		return s.handleListTools(req)
	case "tools/call":
		return s.handleCallTool(req)
	case "ping":
		return MCPResponse{
			JSONRPC: "2.0",
			Result:  map[string]bool{"pong": true},
			ID:      req.ID,
		}
	default:
		return MCPResponse{
			JSONRPC: "2.0",
			Error: &MCPError{
				Code:    int(MethodNotFound),
				Message: fmt.Sprintf("method not found: %s", req.Method),
			},
			ID: req.ID,
		}
	}
}

func (s *MCPServer) handleInitialize(req MCPRequest) MCPResponse {
	// Cursor may send partial/minimal params, be tolerant
	protocolVersion := defaultProtocolVersion

	if req.Params != nil && len(req.Params) > 0 {
		// Try to extract protocolVersion from raw JSON
		var raw map[string]interface{}
		if err := json.Unmarshal(req.Params, &raw); err == nil {
			if v, ok := raw["protocolVersion"].(string); ok && v != "" {
				if !isSupportedProtocolVersion(v) {
					return s.errorResponse(req.ID, InvalidParams, fmt.Sprintf("unsupported protocol version: %s", sanitizeLogMessage(v)))
				}
				protocolVersion = v
			}
		}
	}

	result := InitializeResult{
		ProtocolVersion: protocolVersion,
		Capabilities: ServerCapabilities{
			Tools: &ToolsCapability{},
		},
		ServerInfo: ServerServerInfo{
			Name:    "assethub-mcp-server",
			Version: "1.0.0",
		},
	}

	return MCPResponse{
		JSONRPC: "2.0",
		Result:  result,
		ID:      req.ID,
	}
}

func (s *MCPServer) handleListTools(req MCPRequest) MCPResponse {
	start := time.Now()
	tools := make([]Tool, 0, len(s.tools))
	for name, handler := range s.tools {
		tool := withRuntimeOverrides(getToolDefinition(name))
		if tool.Name != "" {
			// Add prefix if configured (Cursor compatibility)
			if s.toolPrefix != "" {
				tool.Name = s.toolPrefix + "_" + tool.Name
			}
			tools = append(tools, tool)
		}
		_ = handler // Handler is used in call
	}
	sort.Slice(tools, func(i, j int) bool {
		return tools[i].Name < tools[j].Name
	})

	RecordMetric("tools/list", time.Since(start), false)

	return MCPResponse{
		JSONRPC: "2.0",
		Result: ListToolsResult{
			Tools: tools,
		},
		ID: req.ID,
	}
}

func (s *MCPServer) handleCallTool(req MCPRequest) MCPResponse {
	start := time.Now()
	var params CallToolParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		RecordMetric("tools/call", time.Since(start), true)
		return s.errorResponse(req.ID, InvalidParams, "invalid params")
	}

	toolName := params.Name
	// Strip prefix if present (Cursor compatibility)
	if s.toolPrefix != "" && strings.HasPrefix(toolName, s.toolPrefix+"_") {
		toolName = strings.TrimPrefix(toolName, s.toolPrefix+"_")
	} else if s.toolPrefix != "" && strings.HasPrefix(toolName, s.toolPrefix) {
		toolName = strings.TrimPrefix(toolName, s.toolPrefix)
	}

	handler, ok := s.tools[toolName]
	if !ok {
		RecordMetric("tools/call", time.Since(start), true)
		return s.errorResponse(req.ID, MethodNotFound, fmt.Sprintf("tool not found: %s", sanitizeLogMessage(params.Name)))
	}

	resolvedArgs, err := resolveRuntimeArgs(params.Arguments)
	if err != nil {
		RecordMetric("tools/call", time.Since(start), true)
		return s.errorResponse(req.ID, InvalidParams, sanitizeErrorMessage(err.Error()))
	}

	runtimeClient := s.client.CloneWithRuntimeArgs(resolvedArgs)

	// Ensure authenticated
	if err := runtimeClient.EnsureAuthenticated(); err != nil {
		RecordMetric("tools/call", time.Since(start), true)
		return s.errorResponse(req.ID, InternalError, "authentication failed")
	}

	result, err := handler(runtimeClient, resolvedArgs)
	if err != nil {
		// Security: Return sanitized error to client, log full details internally
		sanitizedMsg := sanitizeErrorMessage(err.Error())
		log.Printf("Tool error: method=%s, error=%s\n", toolName, err.Error())
		RecordMetric("tools/call", time.Since(start), true)
		return MCPResponse{
			JSONRPC: "2.0",
			Result: ToolResult{
				Content: []ToolContent{
					{Type: "text", Text: fmt.Sprintf("Error: %s", sanitizedMsg)},
				},
				IsError: true,
			},
			ID: req.ID,
		}
	}

	// Convert result to JSON
	resultJSON, err := json.Marshal(result)
	if err != nil {
		RecordMetric("tools/call", time.Since(start), true)
		return s.errorResponse(req.ID, InternalError, "failed to process result")
	}

	RecordMetric("tools/call", time.Since(start), false)

	return MCPResponse{
		JSONRPC: "2.0",
		Result: ToolResult{
			Content: []ToolContent{
				{Type: "text", Text: string(resultJSON)},
			},
		},
		ID: req.ID,
	}
}

func (s *MCPServer) errorResponse(id interface{}, code MCPErrorCode, message string) MCPResponse {
	return MCPResponse{
		JSONRPC: "2.0",
		Error: &MCPError{
			Code:    int(code),
			Message: message,
		},
		ID: id,
	}
}

// rateLimiter implements simple rate limiting
type rateLimiter struct {
	mu        sync.Mutex
	count     int
	lastReset time.Time
	limit     int
	window    time.Duration
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{
		count:     0,
		lastReset: time.Now(),
		limit:     limit,
		window:    window,
	}
}

func (r *rateLimiter) allow() bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	if now.Sub(r.lastReset) > r.window {
		r.count = 0
		r.lastReset = now
	}

	if r.count >= r.limit {
		return false
	}
	r.count++
	return true
}

// Run starts the MCP server using stdio transport
func (s *MCPServer) Run() {
	log.Printf("MCP Server started\n")

	// Rate limiter: 100 requests per 10 seconds
	rateLimiter := newRateLimiter(100, 10*time.Second)

	defer func() {
		if r := recover(); r != nil {
			log.Printf("PANIC: %v\n", r)
		}
		if s.cleanupFunc != nil {
			s.cleanupFunc()
		}
		log.Printf("MCP Server stopped\n")
	}()

	reader := bufio.NewReaderSize(os.Stdin, 65536)
	stdout := bufio.NewWriterSize(os.Stdout, 65536)

	for {
		// Check shutdown first
		select {
		case <-s.shutdownCh:
			log.Printf("Shutdown signal received\n")
			return
		default:
		}

		// Make reader non-blocking for shutdown check
		req, framed, err := readRequest(reader)
		if err != nil {
			if err == io.EOF {
				time.Sleep(100 * time.Millisecond)
				continue
			}
			log.Printf("Decode error: %v\n", err)
			continue
		}

		// Apply rate limiting
		if !rateLimiter.allow() {
			log.Printf("Rate limit exceeded for method=%s\n", req.Method)
			resp := s.errorResponse(req.ID, InternalError, "rate limit exceeded")
			if err := writeResponse(stdout, resp, framed); err != nil {
				log.Printf("Encode error: %v\n", err)
			}
			stdout.Flush()
			os.Stdout.Sync()
			continue
		}

		resp := s.Handle(req)
		// Security: Only log method name and status, never log full response body
		log.Printf("Request: method=%s\n", req.Method)
		if resp.Error != nil {
			// Log sanitized error message only
			log.Printf("Response: error_code=%d\n", resp.Error.Code)
		} else {
			log.Printf("Response: success=true\n")
		}

		if err := writeResponse(stdout, resp, framed); err != nil {
			log.Printf("Encode error: %v\n", err)
		}
		stdout.Flush()
		os.Stdout.Sync()
	}
}

func readRequest(reader *bufio.Reader) (MCPRequest, bool, error) {
	if err := discardLeadingWhitespace(reader); err != nil {
		return MCPRequest{}, false, err
	}

	leading, err := reader.Peek(1)
	if err != nil {
		return MCPRequest{}, false, err
	}

	if leading[0] == '{' || leading[0] == '[' {
		payload, err := readRawJSONPayload(reader)
		if err != nil {
			return MCPRequest{}, false, err
		}

		var req MCPRequest
		if err := json.Unmarshal(payload, &req); err != nil {
			return MCPRequest{}, false, err
		}
		return req, false, nil
	}

	payload, err := readFramedPayload(reader)
	if err != nil {
		return MCPRequest{}, false, err
	}

	var req MCPRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		return MCPRequest{}, true, err
	}
	return req, true, nil
}

func discardLeadingWhitespace(reader *bufio.Reader) error {
	for {
		leading, err := reader.Peek(1)
		if err != nil {
			return err
		}
		switch leading[0] {
		case ' ', '\t', '\n', '\r':
			if _, err := reader.ReadByte(); err != nil {
				return err
			}
		default:
			return nil
		}
	}
}

func readFramedPayload(reader *bufio.Reader) ([]byte, error) {
	contentLength := -1

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return nil, err
		}

		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			break
		}

		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}

		headerName := strings.ToLower(strings.TrimSpace(parts[0]))
		headerValue := strings.TrimSpace(parts[1])

		if headerName == "content-length" {
			length, err := strconv.Atoi(headerValue)
			if err != nil {
				return nil, fmt.Errorf("invalid content-length: %w", err)
			}
			contentLength = length
		}
	}

	if contentLength < 0 {
		return nil, fmt.Errorf("missing content-length header")
	}

	payload := make([]byte, contentLength)
	if _, err := io.ReadFull(reader, payload); err != nil {
		return nil, err
	}

	return payload, nil
}

func readRawJSONPayload(reader *bufio.Reader) ([]byte, error) {
	var payload bytes.Buffer
	depth := 0
	inString := false
	escaped := false
	started := false

	for {
		b, err := reader.ReadByte()
		if err != nil {
			return nil, err
		}

		if !started {
			if b != '{' && b != '[' {
				return nil, fmt.Errorf("unexpected raw JSON prefix %q", b)
			}
			started = true
			depth = 1
			payload.WriteByte(b)
			continue
		}

		payload.WriteByte(b)

		if inString {
			if escaped {
				escaped = false
				continue
			}
			switch b {
			case '\\':
				escaped = true
			case '"':
				inString = false
			}
			continue
		}

		switch b {
		case '"':
			inString = true
		case '{', '[':
			depth++
		case '}', ']':
			depth--
			if depth == 0 {
				return payload.Bytes(), nil
			}
		}
	}
}

func writeResponse(writer *bufio.Writer, resp MCPResponse, framed bool) error {
	if resp.JSONRPC == "" && resp.Result == nil && resp.Error == nil && resp.ID == nil {
		return nil
	}

	payload, err := json.Marshal(resp)
	if err != nil {
		return err
	}

	if framed {
		if _, err := fmt.Fprintf(writer, "Content-Length: %d\r\n\r\n", len(payload)); err != nil {
			return err
		}
		_, err = writer.Write(payload)
		return err
	}

	if _, err := writer.Write(payload); err != nil {
		return err
	}
	return writer.WriteByte('\n')
}

// sanitizeErrorMessage removes potentially sensitive information from error messages
// before sending to clients
func sanitizeErrorMessage(msg string) string {
	// Remove potential file paths
	msg = stripFilePaths(msg)
	// Remove potential IP addresses (but keep last octet for debugging)
	msg = stripIPAddresses(msg)
	// Remove potential database connection strings
	msg = stripConnectionStrings(msg)
	// Limit length to prevent abuse
	if len(msg) > 200 {
		msg = msg[:200] + "..."
	}
	return msg
}

// sanitizeLogMessage removes potentially sensitive information from log messages
func sanitizeLogMessage(msg string) string {
	// Remove passwords or tokens that might appear in URLs
	msg = stripTokens(msg)
	if len(msg) > 100 {
		msg = msg[:100]
	}
	return msg
}

// stripFilePaths removes file system paths from strings
func stripFilePaths(s string) string {
	// Remove common path patterns
	paths := []string{
		"/Users/", "/home/", "/var/", "/tmp/", "\\Users\\", "C:\\",
	}
	for _, p := range paths {
		if idx := strings.Index(s, p); idx != -1 {
			// Keep only filename
			s = s[:idx] + "[path]"
		}
	}
	return s
}

// stripIPAddresses masks IP addresses for privacy
func stripIPAddresses(s string) string {
	// Simple pattern for IPv4
	for {
		idx := strings.Index(s, "192.168.")
		if idx == -1 {
			idx = strings.Index(s, "10.")
		}
		if idx == -1 {
			idx = strings.Index(s, "172.")
		}
		if idx == -1 {
			break
		}
		// Find end of IP
		end := idx
		for end < len(s) && (s[end] >= '0' && s[end] <= '9' || s[end] == '.') {
			end++
		}
		s = s[:idx] + "[IP]" + s[end:]
	}
	return s
}

// stripConnectionStrings removes database connection strings
func stripConnectionStrings(s string) string {
	// Remove common connection string patterns
	patterns := []string{
		"Password=", "password=", "pwd=", "Pwd=",
		"ApiKey=", "api_key=", "apiKey=",
		"Bearer ", "Token=", "token=",
	}
	for _, pattern := range patterns {
		if idx := strings.Index(s, pattern); idx != -1 {
			end := idx + len(pattern)
			for end < len(s) && s[end] != ' ' && s[end] != '&' && s[end] != ';' {
				end++
			}
			s = s[:idx] + pattern + "[REDACTED]" + s[end:]
		}
	}
	return s
}

// stripTokens removes authentication tokens from strings
func stripTokens(s string) string {
	// Remove JWT tokens and similar
	if strings.Contains(s, "Bearer ") {
		parts := strings.Split(s, "Bearer ")
		if len(parts) > 1 {
			token := parts[1]
			// Keep first 10 chars for identification
			if len(token) > 15 {
				s = parts[0] + "Bearer " + token[:10] + "...[TRUNCATED]"
			}
		}
	}
	return s
}
