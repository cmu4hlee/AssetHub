# OpenCode + AssetHub MCP 集成示例

这份示例约定如下：

- `OpenCode` 负责大模型对话和 MCP 工具调度
- `assethub MCP` 负责用户身份解析、权限确认、租户隔离、业务查询和管理
- 应用侧统一传递：
  - `Authorization: Bearer <JWT>`
  - `X-Tenant-ID: <当前租户ID>`

## 推荐原则

1. 普通用户可以只依赖 token 获取角色和当前租户上下文。
2. 超级管理员 `su` 涉及租户级查询时，必须显式传 `tenant_id`。
3. 提示词里要明确要求：身份类问题先查 `get_current_auth_context`，业务数据先查 `assethub MCP`。
4. 后端不要把共享用户名和密码写死进 MCP 配置，避免租户污染。

## 文件说明

- 提示词模板：[opencode-assethub-prompt-template.js](/Users/cjlee/PJ/AssetHub/backend/services/opencode-assethub-prompt-template.js)
- Express 后端示例：[opencode-assethub-router.example.js](/Users/cjlee/PJ/AssetHub/backend/examples/opencode-assethub-router.example.js)
- 前端 API 封装：[opencodeAssistant.js](/Users/cjlee/PJ/AssetHub/frontend/src/api/opencodeAssistant.js)
- 前端页面示例：[OpenCodeAssistantExample.jsx](/Users/cjlee/PJ/AssetHub/frontend/src/examples/OpenCodeAssistantExample.jsx)

## 最小 MCP 调用模板

先确认当前用户、角色和当前租户：

```json
{
  "_auth_token": "<JWT_TOKEN>",
  "tenant_id": 3
}
```

工具：

```text
get_current_auth_context
```

查资产统计：

```json
{
  "_auth_token": "<JWT_TOKEN>",
  "tenant_id": 3
}
```

工具：

```text
get_asset_statistics
```

## OpenCode 提示词模板

后端建议使用：

```js
const prompt = buildOpenCodeAssetHubPrompt({
  messages,
  currentSessionHint: {
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    tenantId,
    tenantName: req.user.tenant_name,
  },
  runtimeToolContext: {
    toolRuntimeContext: {
      assethub: {
        _auth_context_id: authRegistration.id,
        tenant_id: tenantId,
      },
    },
  },
});
```

## Node/Express 封装方式

如果你要在自己应用里单独封装一层：

```js
const { createOpencodeAssetHubExampleRouter } = require('./backend/examples/opencode-assethub-router.example');

app.use('/api/opencode-example', authenticate, createOpencodeAssetHubExampleRouter());
```

然后前端统一调用：

```text
POST /api/opencode-example/chat/completions
```

## 前端调用方式

前端可以直接复用现有 axios 拦截器，因为当前项目已经自动注入：

- `Authorization`
- `X-Tenant-ID`

调用示例：

```js
import {
  createOpenCodeAssetHubSystemMessage,
  sendOpenCodeAssistantMessage,
} from '../api/opencodeAssistant';

const result = await sendOpenCodeAssistantMessage({
  sessionId,
  messages: [
    createOpenCodeAssetHubSystemMessage(),
    { role: 'user', content: '当前资产总量是多少' },
  ],
});

console.log(result.content);
```

## 适合你的最终形态

你当前最适合的落地方式是：

1. 应用前端只负责发消息。
2. 应用后端负责读取 `token + tenant_id`。
3. 应用后端负责注册 `_auth_context_id`。
4. OpenCode 只通过 `assethub MCP` 做身份确认和业务查询。
5. 对 `su` 一类多租户账号，始终显式传 `tenant_id`。
