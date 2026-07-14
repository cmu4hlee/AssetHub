package main

import (
	"os"
	"strconv"
)

// Config holds the AssetHub MCP server configuration
type Config struct {
	APIURL     string
	APIKey     string
	Token      string
	Username   string
	Password   string
	TenantID   int
	ToolPrefix string // Optional prefix for tool names (e.g., "assethub")
}

func LoadConfig() *Config {
	cfg := &Config{
		APIURL:     getEnv("ASSETHUB_API_URL", "http://localhost:5183/api"),
		APIKey:     getEnv("ASSETHUB_API_KEY", ""),
		Token:      getEnv("ASSETHUB_TOKEN", ""),
		Username:   getEnv("ASSETHUB_USERNAME", ""),
		Password:   getEnv("ASSETHUB_PASSWORD", ""),
		TenantID:   getEnvInt("ASSETHUB_TENANT_ID", 0),
		ToolPrefix: getEnv("ASSETHUB_TOOL_PREFIX", "assethub"),
	}
	return cfg
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}
