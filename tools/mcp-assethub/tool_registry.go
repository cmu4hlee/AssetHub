package main

// ToolHandler is a function that handles a tool call.
type ToolHandler func(client *AssetHubClient, args map[string]interface{}) (interface{}, error)

// registeredHandlers holds handlers that should be exposed through MCP tools/list.
var registeredHandlers = make(map[string]ToolHandler)

// RegisterHandler registers a tool handler for MCP exposure.
func RegisterHandler(name string, handler ToolHandler) {
	registeredHandlers[name] = handler
}
