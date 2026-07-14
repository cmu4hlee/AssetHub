package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"time"
)

// AssetHubClient is the client for AssetHub API
type AssetHubClient struct {
	BaseURL    string
	APIKey     string
	Token      string
	Username   string
	Password   string
	TenantID   int
	Role       string
	HTTPClient *http.Client
}

type RuntimeAuthContext struct {
	ID        string `json:"id"`
	Token     string `json:"token"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	TenantID  int    `json:"tenantId"`
	CreatedAt int64  `json:"createdAt"`
	ExpiresAt int64  `json:"expiresAt"`
}

// APIResponse is the standard API response format
type APIResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Message string          `json:"message"`
}

// Pagination holds pagination info
type Pagination struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
}

// UnmarshalJSON supports multiple pagination field shapes used by AssetHub.
func (p *Pagination) UnmarshalJSON(data []byte) error {
	type rawPagination struct {
		Page            *int `json:"page"`
		Limit           *int `json:"limit"`
		PageSize        *int `json:"pageSize"`
		PageSizeSnake   *int `json:"page_size"`
		Total           *int `json:"total"`
		TotalPages      *int `json:"totalPages"`
		TotalPagesSnake *int `json:"total_pages"`
	}

	var raw rawPagination
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	if raw.Page != nil {
		p.Page = *raw.Page
	}

	switch {
	case raw.Limit != nil:
		p.Limit = *raw.Limit
	case raw.PageSize != nil:
		p.Limit = *raw.PageSize
	case raw.PageSizeSnake != nil:
		p.Limit = *raw.PageSizeSnake
	}

	if raw.Total != nil {
		p.Total = *raw.Total
	}

	switch {
	case raw.TotalPagesSnake != nil:
		p.TotalPages = *raw.TotalPagesSnake
	case raw.TotalPages != nil:
		p.TotalPages = *raw.TotalPages
	case p.Total > 0 && p.Limit > 0:
		p.TotalPages = (p.Total + p.Limit - 1) / p.Limit
	}

	return nil
}

// APIResponseWithPagination is response with pagination
type APIResponseWithPagination struct {
	Success    bool            `json:"success"`
	Data       json.RawMessage `json:"data"`
	Pagination Pagination      `json:"pagination"`
	Message    string          `json:"message"`
}

// APIResponseWithList is response with data.list structure
type APIResponseWithList struct {
	Success bool     `json:"success"`
	Data    ListData `json:"data"`
	Message string   `json:"message"`
}

// ListData holds the list and pagination wrapper
type ListData struct {
	List       []Asset    `json:"list"`
	Pagination Pagination `json:"pagination"`
}

// LoginRequest is the login request body
type LoginRequest struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	TenantCode string `json:"tenant_code,omitempty"`
}

// LoginResponse is the login response
type LoginResponse struct {
	Token       string       `json:"token"`
	TokenExpiry int          `json:"tokenExpiry"`
	User        UserInfo     `json:"user"`
	Enterprises []Enterprise `json:"enterprises"`
}

// UserInfo represents user info in login response
type UserInfo struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	RealName string `json:"real_name"`
	Role     string `json:"role"`
	Status   string `json:"status"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	TenantID int    `json:"tenant_id"`
}

// Enterprise represents an enterprise/tenant
type Enterprise struct {
	ID         int    `json:"id"`
	TenantCode string `json:"tenant_code"`
	TenantName string `json:"tenant_name"`
	Role       string `json:"role"`
	IsDefault  int    `json:"is_default"`
}

// Asset represents an asset
type Asset struct {
	ID                    int             `json:"id"`
	TenantID              int             `json:"tenant_id"`
	AssetCode             string          `json:"asset_code"`
	AssetName             string          `json:"asset_name"`
	CategoryID            int             `json:"category_id"`
	CategorySecondaryID   int             `json:"category_secondary_id"`
	CategoryName          string          `json:"category_name"`
	CategorySecondaryName string          `json:"category_secondary_name"`
	Brand                 string          `json:"brand"`
	Model                 string          `json:"model"`
	Specification         string          `json:"specification"`
	PurchaseDate          string          `json:"purchase_date"`
	PurchasePrice         string          `json:"purchase_price"`
	CurrentValue          string          `json:"current_value"`
	Location              string          `json:"location"`
	Department            string          `json:"department"`
	DepartmentNew         string          `json:"department_new"`
	DepartmentNewName     string          `json:"department_new_name"`
	UseDepartment         string          `json:"use_department"`
	Unit                  string          `json:"unit"`
	ResponsiblePerson     string          `json:"responsible_person"`
	ResponsiblePersonName string          `json:"responsible_person_name"`
	Status                string          `json:"status"`
	Supplier              string          `json:"supplier"`
	WarrantyPeriod        string          `json:"warranty_period"`
	WarrantyEndDate       string          `json:"warranty_end_date"`
	Remark                string          `json:"remark"`
	CreatedAt             string          `json:"created_at"`
	UpdatedAt             string          `json:"updated_at"`
	CreatedBy             string          `json:"created_by"`
	UpdatedBy             string          `json:"updated_by"`
	AssetDepartmentCode   string          `json:"asset_department_code"`
	Depreciation          *Depreciation   `json:"depreciation,omitempty"`
	Images                []AssetImage    `json:"images,omitempty"`
	LatestLocation        *LatestLocation `json:"latest_location,omitempty"`
}

// LatestLocation represents the latest location record
type LatestLocation struct {
	Location   string  `json:"location"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
	RecordedAt string  `json:"recorded_at"`
}

// Depreciation holds depreciation info
type Depreciation struct {
	Method                  string  `json:"method"`
	MethodLabel             string  `json:"methodLabel"`
	Rate                    float64 `json:"rate"`
	ServiceLife             int     `json:"service_life"`
	PurchasePrice           float64 `json:"purchasePrice"`
	ResidualValue           float64 `json:"residualValue"`
	MonthlyDepreciation     float64 `json:"monthlyDepreciation"`
	Accumulated             float64 `json:"accumulated"`
	AccumulatedDepreciation float64 `json:"accumulatedDepreciation"`
	CurrentValue            float64 `json:"current_value"`
	CurrentBookValue        float64 `json:"currentBookValue"`
	DepreciationRate        float64 `json:"depreciationRate"`
	MonthsUsed              int     `json:"monthsUsed"`
	RemainingMonths         int     `json:"remainingMonths"`
	AsOfDate                string  `json:"asOfDate"`
	IsFullyDepreciated      bool    `json:"isFullyDepreciated"`
}

// AssetImage represents an asset image
type AssetImage struct {
	ID        int    `json:"id"`
	URL       string `json:"url"`
	IsPrimary bool   `json:"is_primary"`
}

// AssetCategory represents an asset category
type AssetCategory struct {
	ID       int             `json:"id"`
	Name     string          `json:"name"`
	Code     string          `json:"code"`
	ParentID *int            `json:"parent_id"`
	Children []AssetCategory `json:"children,omitempty"`
}

// Statistics holds asset statistics
type Statistics struct {
	TotalAssets int            `json:"total_count"`
	TotalValue  string         `json:"total_value"`
	ByStatus    []StatusStat   `json:"by_status"`
	ByCategory  []CategoryStat `json:"by_category"`
}

// StatisticsResponse holds the newer overview-wrapped statistics payload.
type StatisticsResponse struct {
	Overview     StatisticsOverview `json:"overview"`
	TotalAssets  int                `json:"total_assets"`
	ByStatus     []StatusStat       `json:"by_status"`
	ByCategory   []CategoryStat     `json:"by_category"`
	ValueSummary ValueSummary       `json:"value_summary"`
}

// StatisticsOverview holds the top-level overview summary fields.
type StatisticsOverview struct {
	TotalAssets int    `json:"total_count"`
	TotalValue  string `json:"total_value"`
}

// ValueSummary holds additional aggregate value fields returned by newer APIs.
type ValueSummary struct {
	TotalPurchaseValue string `json:"total_purchase_value"`
	TotalCurrentValue  string `json:"total_current_value"`
}

// StatusStat holds status statistics
type StatusStat struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

// CategoryStat holds category statistics
type CategoryStat struct {
	CategoryName string `json:"category"`
	Count        int    `json:"count"`
	Value        string `json:"value"`
}

// DepartmentStat holds department statistics
type DepartmentStat struct {
	DepartmentCode string `json:"department_code"`
	DepartmentName string `json:"department_name"`
	TotalAssets    int    `json:"total_assets"`
	TotalValue     string `json:"total_value"`
}

// ValueStatistics holds value statistics
type ValueStatistics struct {
	TotalPurchaseValue string `json:"total_purchase_value"`
	TotalCurrentValue  string `json:"total_current_value"`
	AvgPurchasePrice   string `json:"avg_purchase_price,omitempty"`
	LowValueAssets     int    `json:"low_value_assets,omitempty"`
}

// Department represents a department
type Department struct {
	ID       int          `json:"id"`
	Name     string       `json:"name"`
	Code     string       `json:"code"`
	ParentID *int         `json:"parent_id"`
	Children []Department `json:"children,omitempty"`
}

// User represents a user
type User struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	RealName    string `json:"real_name"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	Status      string `json:"status"`
	LastLogin   string `json:"last_login_at"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
}

// TransferRequest is the transfer application request
type TransferRequest struct {
	AssetCode        string `json:"asset_code"`
	TargetDepartment string `json:"target_department"`
	Reason           string `json:"reason"`
	TransferDate     string `json:"transfer_date"`
}

// Transfer represents a transfer record
type Transfer struct {
	ID           int    `json:"id"`
	AssetCode    string `json:"asset_code"`
	AssetName    string `json:"asset_name"`
	CurrentDept  string `json:"current_department"`
	TargetDept   string `json:"target_department"`
	Status       string `json:"status"`
	StatusCN     string `json:"status_cn"`
	Reason       string `json:"reason"`
	TransferDate string `json:"transfer_date"`
	Applicant    string `json:"applicant"`
	CreatedAt    string `json:"created_at"`
}

// IdleAsset represents an idle asset
type IdleAsset struct {
	ID            int    `json:"id"`
	AssetCode     string `json:"asset_code"`
	AssetName     string `json:"asset_name"`
	CategoryName  string `json:"category_name"`
	PublishDate   string `json:"publish_date"`
	PublishPerson string `json:"publish_person"`
	Status        string `json:"status"`
	Remark        string `json:"remark"`
}

// MaintenanceLog represents a maintenance log
type MaintenanceLog struct {
	ID                 int     `json:"id"`
	RequestNo          string  `json:"request_no"`
	AssetCode          string  `json:"asset_code"`
	AssetName          string  `json:"asset_name"`
	MaintenanceType    string  `json:"maintenance_type"`
	MaintenanceDate    string  `json:"maintenance_date"`
	MaintenancePerson  string  `json:"maintenance_person"`
	MaintenanceContent string  `json:"maintenance_content"`
	MaintenanceCost    float64 `json:"maintenance_cost"`
	Status             string  `json:"status"`
}

// MaintenanceRequest is a maintenance request
type MaintenanceRequest struct {
	AssetCode     string `json:"asset_code"`
	Type          string `json:"type"`
	Urgency       string `json:"urgency"`
	Description   string `json:"description"`
	ContactPerson string `json:"contact_person"`
	ContactPhone  string `json:"contact_phone"`
}

// WorkOrder represents a maintenance work order
type WorkOrder struct {
	ID             int     `json:"id"`
	AssetID        int     `json:"asset_id"`
	AssetName      string  `json:"asset_name"`
	Type           string  `json:"type"`
	Priority       string  `json:"priority"`
	Description    string  `json:"description"`
	Status         string  `json:"status"`
	ReportedBy     string  `json:"reported_by"`
	AssignedTo     int     `json:"assigned_to"`
	ScheduledDate  string  `json:"scheduled_date"`
	EstimatedHours float64 `json:"estimated_hours"`
}

// WorkflowTask represents a workflow task
type WorkflowTask struct {
	ID          int                    `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Assignee    string                 `json:"assignee"`
	Status      string                 `json:"status"`
	DueDate     string                 `json:"due_date"`
	Variables   map[string]interface{} `json:"variables,omitempty"`
}

// AssetChangeLog represents an asset change log
type AssetChangeLog struct {
	ID         int    `json:"id"`
	ChangeType string `json:"change_type"`
	FieldName  string `json:"field_name"`
	OldValue   string `json:"old_value"`
	NewValue   string `json:"new_value"`
	ChangedBy  string `json:"changed_by"`
	ChangedAt  string `json:"changed_at"`
	Remark     string `json:"remark"`
}

// MaintenanceTemplate represents a maintenance template
type MaintenanceTemplate struct {
	ID               int      `json:"id"`
	Name             string   `json:"name"`
	MaintenanceType  string   `json:"maintenance_type"`
	CheckItems       []string `json:"check_items"`
	StandardDuration int      `json:"standard_duration"`
	EstimatedCost    float64  `json:"estimated_cost"`
}

// AIPendingData represents AI pending requests data
type AIPendingData struct {
	Repairs   []AIRepairItem   `json:"repairs"`
	Transfers []AITransferItem `json:"transfers"`
}

// AIRepairItem represents a pending repair item
type AIRepairItem struct {
	ID               int    `json:"id"`
	RequestNo        string `json:"request_no"`
	AssetCode        string `json:"asset_code"`
	FaultDescription string `json:"fault_description"`
	Status           string `json:"status"`
	RequestDate      string `json:"request_date"`
}

// AITransferItem represents a pending transfer item
type AITransferItem struct {
	ID               int    `json:"id"`
	AssetCode        string `json:"asset_code"`
	TargetDepartment string `json:"target_department"`
	Status           string `json:"status"`
}

// PatientVolumeRecord represents a patient volume record
type PatientVolumeRecord struct {
	ID           int    `json:"id"`
	AssetCode    string `json:"asset_code"`
	AssetName    string `json:"asset_name"`
	PatientID    string `json:"patient_id"`
	EventTime    string `json:"event_time"`
	IngestSource string `json:"ingest_source"`
	CreatedAt    string `json:"created_at"`
}

// AssetUsageStats represents asset usage statistics
type AssetUsageStats struct {
	AssetCode          string `json:"asset_code"`
	AssetName          string `json:"asset_name"`
	UsageCount         int    `json:"usage_count"`
	UniquePatientCount int    `json:"unique_patient_count"`
	FirstUseTime       string `json:"first_use_time"`
	LastUseTime        string `json:"last_use_time"`
}

// NewAssetHubClient creates a new AssetHub client
func NewAssetHubClient(baseURL, apiKey, token, username, password string, tenantID int) *AssetHubClient {
	return &AssetHubClient{
		BaseURL:  baseURL,
		APIKey:   apiKey,
		Token:    token,
		Username: username,
		Password: password,
		TenantID: tenantID,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        10,
				IdleConnTimeout:     90 * time.Second,
				TLSHandshakeTimeout: 10 * time.Second,
			},
		},
	}
}

func requestBodyIsNil(body interface{}) bool {
	if body == nil {
		return true
	}

	value := reflect.ValueOf(body)
	switch value.Kind() {
	case reflect.Chan, reflect.Func, reflect.Interface, reflect.Map, reflect.Pointer, reflect.Slice:
		return value.IsNil()
	default:
		return false
	}
}

func requestMethodDisallowsBody(method string) bool {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case http.MethodGet, http.MethodHead:
		return true
	default:
		return false
	}
}

// doRequest performs an HTTP request
func (c *AssetHubClient) doRequest(method, path string, body interface{}) ([]byte, error) {
	var reqBody io.Reader
	if !requestMethodDisallowsBody(method) && !requestBodyIsNil(body) {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	url := c.BaseURL + path
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "AssetHub-MCP-Server/1.0")

	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}

	if c.TenantID > 0 {
		req.Header.Set("X-Tenant-ID", fmt.Sprintf("%d", c.TenantID))
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// doRequestWithHeaders performs an HTTP request with extra headers
func (c *AssetHubClient) doRequestWithHeaders(method, path string, body interface{}, headers map[string]string) ([]byte, error) {
	var reqBody io.Reader
	if !requestMethodDisallowsBody(method) && !requestBodyIsNil(body) {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	url := c.BaseURL + path
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "AssetHub-MCP-Server/1.0")

	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}

	if c.TenantID > 0 {
		req.Header.Set("X-Tenant-ID", fmt.Sprintf("%d", c.TenantID))
	}

	// Add extra headers (for high-risk operations)
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// isRetryableError checks if an error should trigger a retry
func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// Retry on 5xx server errors
	if strings.Contains(errStr, "API error (status 5") {
		return true
	}
	// Retry on connection errors
	if strings.Contains(errStr, "connection refused") ||
		strings.Contains(errStr, "timeout") ||
		strings.Contains(errStr, "no such host") ||
		strings.Contains(errStr, "connection reset") {
		return true
	}
	return false
}

// doRequestWithRetry performs an HTTP request with retry and exponential backoff
func (c *AssetHubClient) doRequestWithRetry(method, path string, body interface{}, maxRetries int) ([]byte, error) {
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		resp, err := c.doRequest(method, path, body)
		if err == nil {
			return resp, nil
		}
		if !isRetryableError(err) {
			// Non-retryable error, return immediately
			return nil, err
		}
		lastErr = err
		if i < maxRetries-1 {
			// Exponential backoff: 100ms, 200ms, 400ms, ...
			backoff := time.Duration(1<<uint(i)) * 100 * time.Millisecond
			if backoff > 5*time.Second {
				backoff = 5 * time.Second
			}
			time.Sleep(backoff)
		}
	}
	return nil, lastErr
}

// Login performs login and stores the token
func (c *AssetHubClient) Login(username, password string) error {
	req := LoginRequest{Username: username, Password: password}
	respBody, err := c.doRequest("POST", "/users/login", req)
	if err != nil {
		return err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		return fmt.Errorf("login failed: %s", apiResp.Message)
	}

	var loginResp LoginResponse
	if err := json.Unmarshal(apiResp.Data, &loginResp); err != nil {
		return fmt.Errorf("failed to parse login data: %w", err)
	}

	c.Token = loginResp.Token
	c.Role = loginResp.User.Role
	if c.TenantID <= 0 {
		switch {
		case loginResp.User.TenantID > 0:
			c.TenantID = loginResp.User.TenantID
		default:
			for _, enterprise := range loginResp.Enterprises {
				if enterprise.IsDefault == 1 {
					c.TenantID = enterprise.ID
					break
				}
			}
			if c.TenantID == 0 && len(loginResp.Enterprises) > 0 {
				c.TenantID = loginResp.Enterprises[0].ID
			}
		}
	}
	return nil
}

// ListAllAssets retrieves all assets without pagination
func (c *AssetHubClient) ListAllAssets() ([]Asset, error) {
	respBody, err := c.doRequest("GET", "/assets/all", nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var assets []Asset
	if err := json.Unmarshal(apiResp.Data, &assets); err != nil {
		return nil, fmt.Errorf("failed to parse assets: %w", err)
	}

	return assets, nil
}

// EnsureAuthenticated ensures the client has a valid token
func (c *AssetHubClient) EnsureAuthenticated() error {
	if c.Token == "" && c.Username != "" && c.Password != "" {
		return c.Login(c.Username, c.Password)
	}
	return nil
}

// CloneWithRuntimeArgs returns a shallow copy of the client with per-call overrides applied.
func (c *AssetHubClient) CloneWithRuntimeArgs(args map[string]interface{}) *AssetHubClient {
	clone := *c

	overrideUsername, hasUsername := extractStringOverride(args, "_auth_username")
	overridePassword, hasPassword := extractStringOverride(args, "_auth_password")
	overrideToken, hasToken := extractStringOverride(args, "_auth_token")
	hasRuntimeAuthOverride := hasUsername || hasPassword || hasToken

	// Runtime auth must not inherit the shared startup tenant implicitly.
	// Otherwise a per-call token can be combined with a stale shared tenant ID
	// and leak/contaminate tenant-scoped queries.
	if hasRuntimeAuthOverride {
		clone.TenantID = 0
		clone.Role = ""
	}

	if hasUsername {
		clone.Username = overrideUsername
	}
	if hasPassword {
		clone.Password = overridePassword
	}
	if hasToken {
		clone.Token = overrideToken
	}

	// When a trusted proxy injects a per-call username/password pair, we must not
	// keep reusing the long-lived shared token from server startup.
	if (hasUsername || hasPassword) && !hasToken {
		clone.Token = ""
	}

	if tenantID, ok := extractTenantOverride(args); ok && tenantID > 0 {
		clone.TenantID = tenantID
	}

	return &clone
}

func extractTenantOverride(args map[string]interface{}) (int, bool) {
	if len(args) == 0 {
		return 0, false
	}

	value, ok := args["tenant_id"]
	if !ok || value == nil {
		return 0, false
	}

	switch v := value.(type) {
	case float64:
		return int(v), true
	case int:
		return v, true
	case int32:
		return int(v), true
	case int64:
		return int(v), true
	case string:
		parsed, err := strconv.Atoi(v)
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func extractStringOverride(args map[string]interface{}, key string) (string, bool) {
	if len(args) == 0 {
		return "", false
	}

	value, ok := args[key]
	if !ok || value == nil {
		return "", false
	}

	switch v := value.(type) {
	case string:
		return v, true
	default:
		return fmt.Sprintf("%v", v), true
	}
}

func resolveRuntimeArgs(args map[string]interface{}) (map[string]interface{}, error) {
	if len(args) == 0 {
		return args, nil
	}

	resolved := make(map[string]interface{}, len(args)+4)
	for key, value := range args {
		resolved[key] = value
	}

	contextID, ok := extractStringOverride(args, "_auth_context_id")
	if !ok || contextID == "" {
		return resolved, nil
	}

	authContext, err := loadRuntimeAuthContext(contextID)
	if err != nil {
		return nil, err
	}

	if _, exists := resolved["_auth_token"]; !exists && authContext.Token != "" {
		resolved["_auth_token"] = authContext.Token
	}
	if _, exists := resolved["_auth_username"]; !exists && authContext.Username != "" {
		resolved["_auth_username"] = authContext.Username
	}
	if _, exists := resolved["_auth_password"]; !exists && authContext.Password != "" {
		resolved["_auth_password"] = authContext.Password
	}
	if _, exists := resolved["tenant_id"]; !exists && authContext.TenantID > 0 {
		resolved["tenant_id"] = authContext.TenantID
	}

	return resolved, nil
}

func loadRuntimeAuthContext(contextID string) (*RuntimeAuthContext, error) {
	storeDir := os.Getenv("ASSETHUB_RUNTIME_AUTH_STORE_DIR")
	if storeDir == "" {
		storeDir = filepath.Join(os.TempDir(), "assethub-ai-runtime-auth")
	}

	filePath := filepath.Join(storeDir, contextID+".json")
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read runtime auth context: %w", err)
	}

	var context RuntimeAuthContext
	if err := json.Unmarshal(raw, &context); err != nil {
		return nil, fmt.Errorf("failed to parse runtime auth context: %w", err)
	}

	if context.ExpiresAt > 0 && time.Now().UnixMilli() > context.ExpiresAt {
		return nil, fmt.Errorf("runtime auth context expired")
	}

	return &context, nil
}
