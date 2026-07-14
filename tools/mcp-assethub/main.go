package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	logFile, err := os.OpenFile("/tmp/mcp-assethub.log", os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to open log file: %v\n", err)
		os.Exit(1)
	}
	log.SetOutput(logFile)
	log.SetFlags(0)

	log.Printf("MCP Server starting\n")

	cfg := LoadConfig()
	log.Printf("Config loaded: APIURL=%s, Username=%s, TenantID=%d\n", cfg.APIURL, cfg.Username, cfg.TenantID)

	client := NewAssetHubClient(cfg.APIURL, cfg.APIKey, cfg.Token, cfg.Username, cfg.Password, cfg.TenantID)

	if cfg.Username != "" && cfg.Password != "" {
		if err := client.Login(cfg.Username, cfg.Password); err != nil {
			log.Printf("Login failed: %v\n", err)
		} else {
			log.Printf("Login successful\n")
		}
	}

	log.Printf("Tool prefix: %s\n", cfg.ToolPrefix)
	server := NewMCPServer(client, cfg.ToolPrefix)

	// Set up signal handling for graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Run server in goroutine so we can wait for signals
	go server.Run()

	// Wait for shutdown signal
	sig := <-sigCh
	log.Printf("Received signal: %v\n", sig)
	server.Shutdown()
	// Give Run() time to clean up
	log.Printf("Exiting...\n")
}
