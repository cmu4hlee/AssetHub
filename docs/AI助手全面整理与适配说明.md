# AI 助手全面整理与适配说明

本文档为 **AI 助手** 的单一参考：意图清单、必填项、触发词、后端数据/接口、前端提交 API、范围边界与维护要点。前后端扩展或修改时请与本文档及对方保持一致。

---

## 一、意图清单与分类

| 意图 intent | 中文名 | 是否需填表提交 | 后端数据来源 / 前端提交 API |
|-------------|--------|----------------|-----------------------------|
| **help** | 帮助 | 否 | 仅回复能力说明；说「质量管理」时引导到验收/技术资料/不良事件/计量 |
| **pending_requests** | 待办查询 | 否 | 报修单 + 调配单（asset_transfer_requests pending），注入后汇总 |
| **asset_query** | 查看资产信息 | 否 | searchAssetsByKeyword（按角色/管理科室过滤）；无关键字时提示输入；说「我管理部门的资产」等直接返回本管理科室列表 |
| （查看信息） | 仅展示某资产 | 否 | 按资产编号查详情（getAssetByCode 对资产/科室管理员按管理科室过滤），注入后可提示报修/调配/维修日志/验收/不良事件/计量 |
| **transfer** | 资产调配 | 是 | **申请制**：前端 `assetAPI.applyTransfer(assetCode, { target_department, reason })` → POST /assets/:id/transfer-apply |
| **repair_request** | 资产报修 | 是 | 前端 `maintenanceAPI.createMaintenanceRequest(payload)` → POST /maintenance/requests |
| **idle_publish** | 闲置发布 | 是 | 前端 `idleAPI.publishIdleAsset(v)` → POST /idle |
| **scrapping** | 报废申请 | 是 | 前端 `scrappingAPI.create(v)` → POST /scrapping |
| **maintenance_log** | 维修日志 | 是 | 前端 `maintenanceAPI.createMaintenanceLog(v)` → POST /maintenance/logs |
| **inventory_query** | 盘点查询 | 否 | 盘点列表注入，汇总 |
| **inventory_create** | 发起盘点 | 是 | 前端 `inventoryAPI.createInventory(...)` → POST /inventory |
| **repair_history** | 报修/维修历史 | 否 | 按资产查 maintenance_requests，注入后汇总 |
| **maintenance_plan_query** | 维护计划查询 | 否 | preventive_maintenance_plans，注入后汇总 |
| **maintenance_stats** | 维修统计 | 否 | 维修申请/日志数与总成本，注入后汇总 |
| **acceptance_query** | 验收记录查询 | 否 | getAcceptanceRecordsList(tenantId, limit, assetCode)，支持按资产筛选 |
| **technical_doc_query** | 技术资料查询 | 否 | getTechnicalDocList(tenantId, limit)，汇总并引导到列表页 |
| **adverse_event_query** | 不良事件查询 | 否 | getAdverseEventList(tenantId, limit, assetCode)，支持按资产（表有 asset_code 时） |
| **metrology_query** | 计量记录查询 | 否 | getMetrologyList(tenantId, limit, assetCode)，支持按资产筛选 |
| **org_query** | 当前企业 | 否 | getCurrentTenantInfo(tenantId)，仅回复企业名称 |
| **department_query** | 部门与资产 | 否 | getDepartmentAssetSummary(tenantId)，汇总部门及资产数 |
| **transfer_approve** | 审批调配 | 否（对话内执行） | 后端 approveTransferRequest(connection, { id, approved, approver, tenantId })；仅系统管理员 |

---

## 二、各意图必填项（前后端一致）

与 `backend/services/maintenance-ai-service.js` 的 `REQUIRED_BY_INTENT` 及 `frontend/src/pages/AIMaintenanceManager.jsx` 的 `REQUIRED_BY_INTENT` 保持一致。

| 意图 | 必填字段 |
|------|----------|
| maintenance_log | asset_code, maintenance_type, maintenance_date, maintenance_person, maintenance_content |
| transfer | asset_code, to_department, reason |
| repair_request | asset_code, fault_description |
| idle_publish | publish_person |
| scrapping | asset_code, asset_name, applicant, scrapping_reason |
| inventory_create | inventory_no, inventory_date, inventory_type, inventory_person |
| 其余 | 无（仅查询/帮助/审批，不提交表单） |

---

## 三、触发词与自然语言（后端识别）

下表为典型表述；等价说法、口语、简写也需识别（见系统提示 Natural Language 与 Intent Rules）。

| 意图 | 典型与扩展触发词 |
|------|------------------|
| help | 帮助、你能做什么、有什么功能、怎么用、你会啥、能干嘛、**质量管理、质管、质量相关、质量模块** |
| pending_requests | 待办、待审批、报修单、调配单、我提交的报修、有啥要批的、待我批的 |
| asset_query | 查资产、查看资产、资产信息、搜资产、找设备、有啥资产 + 关键字；**我管理部门的资产、本部门资产明细、我管的科室资产**（资产/科室管理员直接返回本管理科室列表） |
| transfer | 调配、资产调配、我要调配、调部门、把某资产调到某部门 |
| repair_request | 报修、资产报修、我要报修、故障、坏了要修、设备坏了、申请报修 |
| idle_publish | 闲置、发布闲置、发闲置 |
| scrapping | 报废、申请报废、办报废 |
| maintenance_log | 登记维修、维修日志、填维修日志、记维修、保养记录 |
| inventory_query | 盘点记录、最近盘点、查盘点、盘点列表 |
| inventory_create | 发起盘点、创建盘点、新建盘点、我要盘点 |
| repair_history | 报修历史、维修历史、某资产报修记录、修过啥 |
| maintenance_plan_query | 维护计划、预防性维护、即将到期、计划维护 |
| maintenance_stats | 维修统计、维修成本、成本统计 |
| acceptance_query | 验收记录、查验收、最近验收、**某资产的验收**、验收列表 |
| technical_doc_query | 技术资料、技术文档、资料查询、质管资料 |
| adverse_event_query | 不良事件、不良事件记录、**某资产的不良事件** |
| metrology_query | 计量记录、计量查询、计量到期、**某设备计量**、质控计量 |
| org_query | 当前企业、企业名称、我们公司、公司叫啥 |
| department_query | 部门列表、有哪些部门、部门下资产 |
| transfer_approve | 审批通过、通过调配、同意调配、通过第一条、拒绝调配、通过调配 5 |

**按资产筛选**：用户说「TEST001的验收」「设备A的不良事件」「XXX的计量」时，从消息中解析资产编号（正则 `([A-Za-z0-9_\-]{2,80})\s*的\s*(?:验收|不良事件|计量)`），并传入 getAcceptanceRecordsList / getAdverseEventList / getMetrologyList 的第三参 assetCode。

**管理科室权限**：资产管理员/科室管理员在助手中只能查看自己管理部门的资产；**系统管理员**查看「本部门资产明细」时也按该用户的管理科室（managed_departments）过滤，仅展示其管理部门的资产。(1) 查资产+关键字、按资产编号查详情（getAssetByCode 传入 role/managedDepartments 过滤）均仅限管理科室；(2) 说「我管理部门的资产」「本部门资产明细」等会按角色查库：资产/科室管理员用其管理科室，系统管理员用其管理科室（有则过滤，无或 * 则本租户全部），超级管理员为本租户全部；结果在下方明细展示，不向 AI 注入列表。

**动态意图（待办不抢占）**：初始化会加载待办数据供前端展示「待审批调配单」卡片，但 AI 是否在本轮回复待办由「用户是否明确询问」决定。仅当用户消息匹配待办触发词（待办、待审批、报修单、调配单、我提交的报修、维修申请状态、调配申请、有啥要批的、待我批的）时，设置 `userAskedPendingThisRound` 并注入待办回复块；否则不注入，AI 按用户当前问题自然回复（如打招呼则简短回应、问资产则答资产），避免开场或普通对话被待办意图抢占。系统提示中已约束：未询问时不要主动提及待办。

---

## 四、调配：申请制与审批（适配 AI 助手）

- **提交**：仅走 **调配申请**（asset_transfer_requests）。必填：资产编号、调入部门、调配原因。前端调用 `assetAPI.applyTransfer(assetCode, { target_department, reason })`，对应 POST /assets/:id/transfer-apply。
- **待办与审批**：待办列表与「通过第一条」「通过调配 5」均针对 asset_transfer_requests；审批逻辑在 `transfer-approval-service.js`，对话内由系统管理员执行。
- **不再在 AI 内使用**：POST /transfer（transfer_records）已不在助手提交流程中使用。

详见《资产调配逻辑整理.md》。

---

## 五、质量管理（验收、技术资料、不良事件、计量）

- **验收**：getAcceptanceRecordsList(tenantId, limit, assetCode)。支持「某资产的验收」解析资产并筛选。
- **技术资料**：getTechnicalDocList(tenantId, limit)。只读汇总，引导到「技术资料」列表页。
- **不良事件**：getAdverseEventList(tenantId, limit, assetCode)。若表有 asset_code 列则按资产筛选。
- **计量**：getMetrologyList(tenantId, limit, assetCode)。支持按资产；注入时可提醒即将到期。
- **总入口**：用户说「质量管理」「质管」「质量相关」且未命中上述任一时，设置 qualityManagementIntro，注入 1～2 句说明可查验收、技术资料、不良事件、计量，intent 填 help。
- **查资产后提示**：展示资产信息时可提示「也可查本资产的验收、不良事件、计量」。

---

## 六、范围边界与超出范围

- **只做**：查看资产、报修、调配、闲置发布、报废申请、登记维修日志、帮助说明、待办/待审批、盘点查询与发起、报修/维修历史、维护计划、维修统计、验收/技术资料/不良事件/计量查询、当前企业、部门与资产、审批调配。
- **不做**：天气、闲聊、编程、通用知识、非资产与维修的其他业务。
- **超出范围时**：1～2 句自然、友好收束，提示可说「帮助」；可变换措辞；intent 填 help。

---

## 七、涉及文件索引

| 类型 | 路径 |
|------|------|
| 后端意图与提示词 | backend/services/maintenance-ai-service.js（ASSISTANT_INTENTS, REQUIRED_BY_INTENT, 系统提示, 注入分支, extractInfoFromUserMessage） |
| 调配审批服务 | backend/services/transfer-approval-service.js |
| 前端意图与提交 | frontend/src/pages/AIMaintenanceManager.jsx（REQUIRED_BY_INTENT, INTENT_LABELS, handleSubmitByIntent, noSubmitIntents） |
| 前端 API | frontend/src/utils/api.js（assetAPI.applyTransfer, getTransferRequests, approveTransferRequest；maintenanceAPI, idleAPI, scrappingAPI, inventoryAPI） |
| 路由 | backend/routes/maintenance-ai.js（init, message, pending, **feedback**）；backend/routes/assets.js（transfer-apply, transfer-requests, approve） |
| 学习上下文表 | ai_assistant_learned_context（需先执行 scripts/create-ai-assistant-learned-context-table.js） |
| 文档 | docs/资产调配逻辑整理.md；docs/AI助手可扩展功能模块分析.md |

---

## 八、维护与扩展要点

1. **新增意图**：在 backend 的 ASSISTANT_INTENTS、REQUIRED_BY_INTENT、Intent Rules、注入分支与 currentIntent 分支中增加；在 frontend 的 REQUIRED_BY_INTENT、INTENT_LABELS、noSubmitIntents 及 handleSubmitByIntent 中同步；若需提交则在前端 api.js 与对应 case 中接好 API。
2. **新增必填项**：同时改 backend 的 REQUIRED_BY_INTENT 与 frontend 的 REQUIRED_BY_INTENT，并更新 Fields by Intent 与表单展示。
3. **自然语言**：在系统提示 Intent Rules 与 Natural Language 中补充等价说法；必要时在 extractInfoFromUserMessage 中增加解析。
4. **质量管理**：按资产筛选时统一使用 qualityAssetCode（当前表单/本轮解析），并在注入结果中注明「已按资产 XXX 筛选」或「资产 XXX 暂无…」。

---

## 九、可变上下文与自我学习

通过「学习上下文」让 AI 助手的上下文随租户使用而**可变**，实现**自我学习与进化**（无需重训模型）。

### 机制概要

- **存储**：表 `ai_assistant_learned_context`，按租户存储两类记录：
  - **correction**：用户纠正（系统原推断意图 → 用户纠正后的意图）
  - **phrase**：成功表述（用户原话摘要 → 成功提交的意图，可选）
- **注入**：每次构建本轮 prompt 时，读取该租户最近若干条学习记录，拼成 `<injected_system>以下为系统根据本租户历史交互学习到的提示…</injected_system>` 注入到用户消息前，模型即可结合历史纠正/习惯调整理解。
- **记录纠正**：当用户消息包含「不对」「我要的是」「弄错了」等且能解析出纠正后的意图时，自动写入一条 correction 记录（原意图来自上一轮 context.currentIntent）。
- **记录成功表述（可选）**：前端在用户**成功提交**表单后，可调用 `POST /maintenance/ai/feedback`，传 `{ phrase, intent }`，写入 phrase 类记录，用于后续「本租户常用『xxx』表示报修」等注入。

### 使用方式

1. **建表**：`node backend/scripts/create-ai-assistant-learned-context-table.js`
2. **纠正**：用户说「不对，我要的是调配」等即可自动记录，无需配置。
3. **成功反馈（可选）**：前端在 `handleSubmitByIntent` 成功回调里调用 `POST /maintenance/ai/feedback`，body 传 `{ phrase: 用户最后一句话或摘要, intent: currentIntent }`。

### 涉及代码

- 表结构：`backend/scripts/create-ai-assistant-learned-context-table.js`
- 读写与注入：`maintenance-ai-service.js`（getLearnedContextForTenant、recordLearnedContext、submitLearningFeedback；callDeepSeekAPI 内注入；sendMessage 末尾纠正检测与记录）
- 反馈接口：`backend/routes/maintenance-ai.js` 的 `POST /feedback`

按本文档与《资产调配逻辑整理》《AI助手可扩展功能模块分析》保持一致即可保持「全面整理、适配 AI 助手」的单一事实来源。
