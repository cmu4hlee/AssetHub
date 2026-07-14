# MiniMax OAuth 接入说明

## 为什么需要 OAuth
MiniMax Portal 支持 OAuth 授权模式，比 API Key 更适合企业账号（按组织管理、可审计、可一键回收）。**OAuth 认证必须由你本人在终端交互完成**，因为其中包含浏览器跳转回调步骤，我无法在脚本里替你完成。

## 你需要在终端执行的步骤

### 1) 打开终端（macOS Terminal / iTerm / 其他）

### 2) 跑以下命令（二选一）

```bash
cd /Users/mac/Desktop/OpenClaw

# 方式 1：登录并设为默认
pnpm openclaw models auth login --provider minimax-portal --set-default

# 方式 2：第一次 onboard 时选 minimax-portal
pnpm openclaw onboard --auth-choice minimax-portal
```

### 3) 按终端提示选择端点
```
? 选择端点
  ❯ CN   (api.minimaxi.com)
    Global (api.minimax.io)
```

### 4) 完成浏览器跳转
终端会打印一个 URL + device code，浏览器打开 URL、粘贴 code、登录、授权。

### 5) 拿到 access_token 后写入 .env
```bash
# 终端会打印 token；复制到 backend/.env 里：
MINIMAX_ACCESS_TOKEN=<你拿到的 token>
```

### 6) 重启后端服务
```bash
# 不需要重启前端；只重启 backend
cd /Volumes/移动硬盘（500）/AssetHub/backend
npm run start
```

### 7) 验证连接
访问 `POST /api/tendering/approvals/ai/assist`，填入 `entity_type=tender_projects&entity_id=1` 测试。
若返回的 `decision` 是真实分析（不是 fallback "API_KEY 未配置"），就说明通了。

## 自动 fallback
- 若 OAuth token 过期 → API 返回 401 → client 抛错 → AIAssistant 自动用 `_fallbackSuggest()` 返回基于规则的占位建议
- **不会阻塞业务审批**

## 在前端如何看到 AI 建议
1. 发起一个高风险流程（如：发布一个 budget≥50000 的招标）
2. 进 `http://localhost:3000/tendering/approvals`（我的审批）
3. 找到 record，点「AI 建议」按钮或打开抽屉
4. 抽屉内点「实时流式生成」即可看到 SSE 流式输出

## OAuth 与 API Key 的优先级
1. 若 `MINIMAX_ACCESS_TOKEN` 存在 → 优先使用 Bearer Token
2. 否则若 `MINIMAX_API_KEY` 存在 → 走 x-api-key 头
3. 否则 → 不可用，自动 fallback

## 故障排查
| 现象 | 排查 |
|---|---|
| fallback "API_KEY 未配置" | 没设环境变量；检查 `.env` 是否被 backend 进程加载 |
| HTTP 401 | access_token 过期，去 Portal 重新跑 OAuth；或 key 被 revoke |
| HTTP 403 | 账号没有调用 `MiniMax-M2.7` 的权限 |
| HTTP 404 | baseUrl 不对；CN 用 `https://api.minimaxi.com/anthropic`，Global 用 `https://api.minimax.io/anthropic` |
| HTTP 429 | 触发了 rate limit；调小调用频次 |
| 流式只输出一行 | 服务端/代理对 SSE 不友好；确认 Node 版本 ≥ 18 |

## 我的工作
在你执行 OAuth 期间，我会等待你回话（你说"接上了"或"还是 fallback"），再决定要不要进一步调试。一旦你贴出 access_token 或告诉我 fallback 是否消失，我会：
- 检查 health
- 跑 ai-approval-assistant.test.js
- 必要时修正 endpoint / header