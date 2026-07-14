# AssetHub MCP Server

基于 MCP (Model Context Protocol) 的 AssetHub 资产管理系统 AI 集成工具。

## 功能特性

- 支持资产全生命周期管理（查询、创建、更新、删除）
- 资产调拨、报废、闲置处理
- 维修维护管理
- 资产工作流与状态迁移
- 部门、用户查询
- 资产统计报表

## 安装

### 方式一：直接下载二进制

从 releases 页面下载对应平台的二进制文件。

### 方式二：从源码编译

```bash
git clone <repo-url>
cd mcp-assethub
go build -o mcp-assethub .
```

## 配置

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `ASSETHUB_API_URL` | 是 | http://localhost:5183/api | AssetHub API 地址 |
| `ASSETHUB_API_KEY` | 否 | - | API Key（预留） |
| `ASSETHUB_TOKEN` | 否 | - | 直接使用 JWT Token（优先） |
| `ASSETHUB_USERNAME` | 否 | - | 登录用户名 |
| `ASSETHUB_PASSWORD` | 否 | - | 登录密码 |
| `ASSETHUB_TENANT_ID` | 否 | 0 | 默认租户ID，0 表示不显式注入共享租户 |

说明：

- 当前版本仅实现 `stdio` 传输。
- 所有工具现在都支持可选 `tenant_id` 参数，可在单次调用时临时覆盖默认租户上下文。
- 所有工具也支持可选运行时认证覆盖参数 `_auth_username`、`_auth_password`、`_auth_token`，仅供受信任代理按单次调用注入；若传入 `_auth_username/_auth_password`，MCP 会清空默认共享 Token 并改用这组凭证重新鉴权。
- 所有工具还支持可选 `_auth_context_id` 参数，供受信任代理传入短时运行时认证上下文 ID；MCP 会从本机安全目录读取真实 token/租户。目录可通过 `ASSETHUB_RUNTIME_AUTH_STORE_DIR` 指定，默认是系统临时目录下的 `assethub-ai-runtime-auth`。
- 推荐把 `ASSETHUB_TOKEN` / `ASSETHUB_USERNAME` / `ASSETHUB_PASSWORD` 只用于本地 CLI 调试；正式的 Web 应用集成优先使用“运行时 token 模式”。
- 当调用方以 `_auth_token` 或 `_auth_context_id` 注入运行时身份时，MCP 不再继承启动时的默认租户，避免把共享租户上下文错误带入当前用户请求。
- 如果前端当前已经切换到某个租户，请同时传入 `tenant_id`；仅凭 JWT 一般只能稳定解析“默认租户”或“当前未选租户”的状态，无法百分之百推断前端当前正在查看的租户。
- 新增 `get_current_auth_context` 工具，可直接基于当前调用凭证解析当前用户、角色、当前生效租户、菜单权限、角色权限和当前租户模块，适合作为上层 AI 在执行管理/查询前的第一步。
- `get_value_statistics` 表示资产价值汇总，不等于折旧统计。
- 折旧相关查询请优先使用新增的折旧工具，而不是 `get_value_statistics`。

### 配置示例

**方式1: 使用用户名密码登录**
```bash
export ASSETHUB_API_URL=http://localhost:5183/api
export ASSETHUB_USERNAME=admin
export ASSETHUB_PASSWORD=your-password
./mcp-assethub
```

**方式2: 直接使用 Token**
```bash
export ASSETHUB_API_URL=http://localhost:5183/api
export ASSETHUB_TOKEN=your-jwt-token
./mcp-assethub
```

## 与 OpenCode 集成

### 1. 配置 OpenCode

推荐使用“运行时鉴权”模式，不在 OpenCode 或 Cursor 配置里写死用户名和密码，而是由受信任的 Web 后端在每次工具调用前注入短时 `_auth_context_id`。

如果你的调用链路不是“模型直接看见工具参数”，也可以直接传 `_auth_token`；但对于 OpenCode 这类会让模型决定工具调用参数的场景，仍推荐让后端先把 token 注册成 `_auth_context_id`，避免把真实 token 暴露进提示词或模型输出路径。

OpenCode 示例可直接参考 [`examples/opencode.runtime-auth.json`](./examples/opencode.runtime-auth.json)：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "lmstudio/qwen/qwen3.5-35b-a3b",
  "mcp": {
    "assethub": {
      "type": "local",
      "command": [
        "/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/mcp-assethub"
      ],
      "environment": {
        "ASSETHUB_API_URL": "http://localhost:5183/api",
        "ASSETHUB_RUNTIME_AUTH_STORE_DIR": "/tmp/assethub-ai-runtime-auth",
        "ASSETHUB_TOOL_PREFIX": "assethub"
      },
      "enabled": true
    }
  }
}
```

Cursor 示例可直接参考 [`examples/cursor.mcp.runtime-auth.json`](./examples/cursor.mcp.runtime-auth.json)：

```json
{
  "mcpServers": {
    "assethub": {
      "command": "/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/mcp-assethub",
      "env": {
        "ASSETHUB_API_URL": "http://localhost:5183/api",
        "ASSETHUB_RUNTIME_AUTH_STORE_DIR": "/tmp/assethub-ai-runtime-auth",
        "ASSETHUB_TOOL_PREFIX": "assethub"
      }
    }
  }
}
```

如果你只是本地命令行调试，也仍然可以继续使用 `ASSETHUB_TOKEN` 或 `ASSETHUB_USERNAME/ASSETHUB_PASSWORD` 的静态模式。

### 2. 使用对话

```
> 帮我查询所有在用的电子设备
> 创建一个新的测试资产
> 查询资产统计信息
> 帮我将A001资产申请调拨到财务部
> 查询当前位置编码和位置告警
```

### 3. 推荐的上层 AI 调用顺序

对于接入 OpenCode、Cursor 或自研 AI 应用，推荐把 `get_current_auth_context` 作为租户敏感问题的第一跳：

1. 应用把当前登录态 token 交给受信任代理。
2. 代理把 token 以 `_auth_context_id` 或 `_auth_token` 的形式传给 MCP；如果前端当前已选租户，同时传 `tenant_id`。
3. AI 先调用 `get_current_auth_context`，确认当前用户、角色、权限、菜单和租户模块。
4. AI 再根据这个上下文调用 `list_assets`、`get_asset_statistics`、`list_users`、`update_role_permissions` 等具体工具。

这样可以把“当前是谁、当前在哪个租户、当前有什么权限”统一收口到 MCP，而不是让上层应用和提示词各自维护一份。

## 可用工具

### 资产工具

| 工具名 | 描述 |
|--------|------|
| `list_assets` | 获取资产列表 |
| `get_asset` | 获取资产详情 |
| `create_asset` | 创建资产 |
| `update_asset` | 更新资产 |
| `delete_asset` | 删除资产 |
| `get_asset_categories` | 获取资产类别 |
| `get_asset_statistics` | 资产总览统计 |
| `get_value_statistics` | 资产价值统计 |
| `list_depreciation` | 折旧列表与汇总 |
| `get_depreciation_detail` | 折旧详情 |
| `get_depreciation_summary_by_department` | 按部门汇总折旧 |
| `get_depreciation_summary_by_type` | 按类型汇总折旧 |
| `get_depreciation_summary_by_month` | 月度折旧趋势 |
| `list_idle_assets` | 闲置资产列表 |

### 调配工具

| 工具名 | 描述 |
|--------|------|
| `transfer_asset` | 申请资产调拨 |
| `publish_idle_asset` | 发布闲置资产 |
| `allocate_idle_asset` | 调配闲置资产 |
| `list_transfers` | 调拨记录列表 |
| `approve_transfer` | 审批调拨 |
| `execute_transfer` | 执行调拨 |
| `create_scrapping` | 申请报废 |
| `list_scrappings` | 报废申请列表 |
| `approve_scrapping` | 审批报废 |

### 维修工具

| 工具名 | 描述 |
|--------|------|
| `list_maintenance_logs` | 维修日志 |
| `create_maintenance_request` | 创建维修申请 |
| `list_maintenance_workorders` | 维修工单 |
| `update_workorder_status` | 更新工单状态 |

### 工作流工具

| 工具名 | 描述 |
|--------|------|
| `get_default_workflow` | 获取默认资产流程 |
| `list_workflow_states` | 获取流程状态列表 |
| `list_workflow_transitions` | 获取流程迁移规则 |
| `apply_asset_transition` | 执行资产状态迁移 |
| `list_asset_workflows` | 获取资产流程定义列表 |

### 辅助工具

| 工具名 | 描述 |
|--------|------|
| `list_departments` | 部门列表 |
| `list_users` | 用户列表 |
| `get_current_auth_context` | 基于当前调用凭证获取当前用户/角色/租户/权限/菜单/模块上下文 |

## 开发

### 项目结构

```
mcp-assethub/
├── main.go         # 入口
├── server.go       # MCP服务器实现
├── client.go       # AssetHub API客户端
├── tools.go        # 工具定义
├── tool_handlers.go # 工具实现
├── config.go       # 配置
├── docs/           # 生成的 MCP/API 对照文档
├── scripts/        # 文档生成脚本
└── go.mod
```

### 重新生成 API 文档

在仓库根目录执行：

```bash
node backend/scripts/generate-swagger.js
node tools/mcp-assethub/scripts/generate_mcp_api_docs.js
```

生成结果：

- `backend/docs/swagger.json`
- `backend/docs/api-documentation.json`
- `backend/docs/api-documentation.md`
- `tools/mcp-assethub/docs/mcp-api-update-map.json`
- `tools/mcp-assethub/docs/mcp-api-update-guide.md`

说明：

- `backend/docs/api-documentation.md` 是面向后端接口的完整详细调用文档。
- `tools/mcp-assethub/docs/mcp-api-update-guide.md` 是面向现有 `mcp-assethub` 更新的工具到后端接口对照文档。
- `tools/mcp-assethub/docs/mcp-api-update-map.json` 适合程序化消费，用于批量校对 MCP 工具与后端 API 的匹配情况。

### 运行测试

```bash
go run . &
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}' | jsonrpc
```
