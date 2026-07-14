# AssetHub 直连 API Skill 生成说明

本文档用于生成一个不依赖 `assethub` MCP、而是直接调用 AssetHub 系统 HTTP API 的 skill 草稿。

这份说明基于以下现有资料整理：

- `docs/OpenClaw技能调用说明.md`
- `docs/OpenClaw系统提示词与技能模板.md`
- `docs/API_全量接口说明_供AI读取.md`
- `docs/skill-drafts/openclaw-assethub/SKILL.md`
- 当前后端路由实现，尤其是：
  - `backend/routes/assets/asset.transfer.js`
  - `backend/routes/maintenance/requests.router.js`
  - `backend/services/maintenance/requests.service.js`
  - `backend/routes/idle.js`
  - `backend/routes/scrapping.js`
  - `backend/routes/inventory.js`

## 1. 为什么要拆出直连 API Skill

现有 `openclaw-assethub` skill 的核心定位是：

- 优先走 `assethub_*` MCP 工具
- 依赖 `_auth_context_id`
- 让 OpenClaw 在多租户上下文里安全调用业务能力

但有些场景更适合单独准备一个直连 API 版本：

- 运行环境没有加载 MCP
- 希望精确控制 HTTP 请求、Header、重试和回查
- 需要把 skill 发给另一个支持 shell / HTTP 的代理系统
- 需要让 skill 明确“先登录，再调用 `/api/*`”，而不是依赖工具封装

因此更适合新增一个平行 skill，而不是直接覆盖现有 MCP 版 skill。

## 2. 这次建议产物

建议保留两层产物：

1. 说明文档
   - 用于让人理解 skill 的定位、结构和约束
2. skill draft
   - 用于直接复制到 skill 目录继续使用或安装

本次草稿已经放在：

- 说明文档：
  - `docs/AssetHub直连API技能生成说明.md`
- skill draft：
  - `docs/skill-drafts/openclaw-assethub-direct-api/`

## 3. 推荐 skill 目录结构

```text
openclaw-assethub-direct-api/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── auth-and-workflows.md
│   └── asset-management-endpoints.md
└── scripts/
    └── assethub_api.sh
```

说明：

- `SKILL.md` 只放触发条件、默认规则和最小工作流
- 详细接口说明放到 `references/`
- 可执行的登录与请求助手放到 `scripts/`

## 4. 直连 API Skill 的定位

这个 skill 的目标不是“描述系统”，而是“真的去调用系统 API 完成资产管理任务”。

它的默认行为应该是：

1. 登录 `POST /api/users/login`
2. 解析 `token`、`tenant_id`
3. 按用户意图走 `/api/assets`、`/api/maintenance`、`/api/inventory`、`/api/scrapping`、`/api/idle`、`/api/assets/transfer-requests` 等接口
4. 写操作遵循先查后写、写后回查

## 5. 与 MCP 版 skill 的边界

推荐规则：

- 如果运行时已经提供 `_auth_context_id` 且能直接调 `assethub_*` 工具，优先使用现有 MCP 版 skill
- 如果目标运行时没有 MCP，或者任务明确要求“直接调用系统 API”，使用这个直连 API skill
- 两个 skill 不要互相覆盖；它们是平行能力，不是替代关系

## 6. 运行时约定

建议 skill 通过环境变量读取运行参数，而不是硬编码：

| 变量 | 说明 |
|---|---|
| `ASSETHUB_API_URL` | API 基础地址，默认可用 `http://localhost:5183/api` |
| `ASSETHUB_API_USERNAME` | 登录用户名 |
| `ASSETHUB_API_PASSWORD` | 登录密码 |
| `ASSETHUB_TENANT_ID` | 可选，显式租户 |
| `ASSETHUB_IOT_TOKEN` | 可选，仅 IoT 上报类接口使用 |
| `ASSETHUB_SESSION_FILE` | 可选，会话缓存文件路径 |

约束：

- 不要在 skill 文本里硬编码账号密码
- 普通业务接口默认走 Bearer Token
- IoT 上报类接口优先使用 IoT Token，不要混用普通用户登录态

## 7. 默认工作流

### 7.1 登录

- 接口：`POST /api/users/login`
- 保存：
  - `data.token`
  - `data.user`
  - `data.user.tenant_id`
  - `data.enterprises`

### 7.2 确认租户

- 普通用户：默认使用 `data.user.tenant_id`
- 超级管理员：只有明确跨企业操作时才传 `X-Tenant-ID`
- 非超级管理员：不要随意切换租户

### 7.3 接口发现

在进入非核心模块前，优先调用：

- `GET /api/api-documentation/modules`
- `GET /api/api-documentation/module/{path}`
- `GET /api/api-documentation/endpoints`

这样 skill 可以先知道模块是否存在、当前环境有哪些实时接口。

### 7.4 先查后写

写操作统一遵循：

1. 查对象
2. 识别真实 ID / 编码
3. 执行写入
4. 回查详情或列表确认结果

### 7.5 错误处理

- `400`：补字段，不盲目重试
- `401`：重新登录
- `403`：权限 / 租户 / 模块限制，停止写操作
- `404`：资源不存在，回到查询步骤
- `500`：保留上下文，提示稍后重试

## 8. 资产管理核心能力映射

以下是建议优先覆盖到 skill 的主链路。

| 场景 | 推荐接口 | 说明 |
|---|---|---|
| 登录 | `POST /api/users/login` | 获取 Bearer Token 和默认租户 |
| 资产列表 | `GET /api/assets` | 资产搜索、过滤、分页 |
| 资产详情 | `GET /api/assets/{id}` | 查询单个资产 |
| 新增资产 | `POST /api/assets` | 当前文档已知最小必填为 `asset_code`、`asset_name`、`category_id` |
| 更新资产 | `PUT /api/assets/{id}` | 资产修改 |
| 删除资产 | `DELETE /api/assets/{id}` | 删除资产 |
| 维修申请列表 | `GET /api/maintenance/requests` | 查询报修单 |
| 创建维修申请 | `POST /api/maintenance/requests` | 当前服务实现要求 `asset_code` + `fault_description` |
| 维修申请审批 | `POST /api/maintenance/requests/{id}/approve` | 审批报修申请 |
| 维修日志列表 | `GET /api/maintenance/logs` | 查询维修日志 |
| 新增维修日志 | `POST /api/maintenance/logs` | 记录维修动作 |
| 闲置列表 | `GET /api/idle` | 查询闲置资产 |
| 闲置发布 | `POST /api/idle` | `publish_person` 必填；`asset_code` 或 `asset_name` 至少一个 |
| 报废列表 | `GET /api/scrapping` | 查询报废申请 |
| 新建报废申请 | `POST /api/scrapping` | `asset_code`、`asset_name`、`applicant`、`scrapping_reason` 必填 |
| 盘点列表 | `GET /api/inventory` | 查询盘点记录 |
| 发起盘点 | `POST /api/inventory` | 创建盘点记录 |
| 新增盘点明细 | `POST /api/inventory/{id}/details` | 为盘点记录追加明细 |
| 调配申请列表 | `GET /api/assets/transfer-requests` | 查询调配申请 |
| 发起调配申请 | `POST /api/assets/{id}/transfer-apply` | 需要 `reason` 和目标部门 |
| 调配审批 | `POST /api/assets/transfer-requests/{request_id}/approve` | 审批结果使用 `approved` 或 `action` |

## 9. 几个当前代码层面的关键兼容点

这些点值得明确写进 skill 参考资料，因为它们和旧文档不完全一致。

### 9.1 维修申请字段

旧的运行时文档常写：

- `issue_description`

但当前后端实际创建逻辑在 `backend/services/maintenance/requests.service.js` 中要求：

- `asset_code`
- `fault_description`

因此直连 API skill 的建议是：

- 默认按 `fault_description` 发送
- 为了兼容旧调用方，可以同时带上 `issue_description`

### 9.2 调配申请路径参数

旧说明常建议必须先拿真实资产 `id` 再调：

- `POST /api/assets/{id}/transfer-apply`

当前代码 `backend/routes/assets/asset.transfer.js` 已兼容：

- 资产数值 `id`
- `asset_code`

因此建议 skill 仍然先查资产再操作，但实现上可兼容两种路径参数。

### 9.3 闲置发布

当前实现要求：

- `publish_person` 必填
- `asset_code` 和 `asset_name` 至少一个

不要把它误写成“必须同时传两者”。

## 10. helper 脚本的作用

本次 skill draft 附带了一个 helper：

- `docs/skill-drafts/openclaw-assethub-direct-api/scripts/assethub_api.sh`

它现在主要解决五件事：

1. 自动登录并缓存 token
2. 统一附带 `Authorization` / `X-Tenant-ID`
3. 对写请求自动附带 `Idempotency-Key`
4. 在显式设置 `ASSETHUB_HIGH_RISK_CONFIRM=YES` 时，可对后端返回的高风险确认挑战做二次重放
5. 提供模块发现和通用请求入口

可直接用于 skill 中的执行模板。

如果运行时对脚本子进程网络访问有限制，则直接退回到 raw `curl` 模板即可，skill 仍然可以正常工作。

示例：

```bash
bash scripts/assethub_api.sh login
bash scripts/assethub_api.sh modules
bash scripts/assethub_api.sh module assets
bash scripts/assethub_api.sh request GET /assets?page=1&pageSize=20
bash scripts/assethub_api.sh request POST /maintenance/requests '{"asset_code":"A001","fault_description":"无法开机"}'
ASSETHUB_HIGH_RISK_CONFIRM=YES bash scripts/assethub_api.sh request DELETE /assets/123
```

## 11. 安装方式建议

如果后续要把这个草稿变成正式 skill，建议复制到本机 skill 目录，例如：

```text
~/.codex/skills/openclaw-assethub-direct-api/
```

保留以下文件即可：

- `SKILL.md`
- `agents/openai.yaml`
- `references/*`
- `scripts/assethub_api.sh`

## 12. 推荐使用策略

在 AssetHub 项目里，后续建议同时保留两种 skill：

- `openclaw-assethub`
  - 面向 MCP 运行时
- `openclaw-assethub-direct-api`
  - 面向直接 HTTP API 运行时

这样可以覆盖两类接入方式：

- 有 MCP 的智能编排
- 无 MCP 的确定性 HTTP 调用

## 13. 结论

这次新增的直连 API skill 草稿，适合用来：

- 给 OpenClaw / Codex / 其他代理系统做直接接口调用
- 在没有 MCP 的时候完整完成资产管理业务流程
- 作为后续生成正式 skill、提示词、Agent 配置的基础底稿

如果后面还要继续扩展，优先补充两类内容：

1. 更多模块的接口映射
2. 更多 helper 脚本命令封装
