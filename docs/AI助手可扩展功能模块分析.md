# AI 助手可扩展功能模块分析

> **主参考**：意图与必填项、触发词、前后端 API 的完整对照见 [AI助手全面整理与适配说明.md](./AI助手全面整理与适配说明.md)。

## 一、项目功能模块总览

基于后端路由与前端菜单，项目主要业务域如下：

| 域 | 后端路由 | 前端页面/菜单 | 主要能力 |
|----|----------|----------------|----------|
| 资产 | `/api/assets` | 资产列表/详情/新增/编辑 | 资产 CRUD、统计、部门/状态筛选 |
| 盘点 | `/api/inventory` | 盘点列表/新建/详情 | 盘点任务、明细、状态、统计 |
| 调配 | `/api/transfer` | 调配记录/调配申请/申请处理 | 调配 CRUD、审批、完成 |
| 闲置 | `/api/idle` | 闲置资产列表/发布 | 发布、分配、取消 |
| 维修维护 | `/api/maintenance` | 维修日志/预防性维护/模板/维修申请/工单/效率/提醒/使用量/成本 | 日志、计划、报修、工单、分析、提醒 |
| 报废 | `/api/scrapping` | 报废申请与流程 | 申请、鉴定、审批 |
| 验收 | `/api/acceptance` | 验收记录/创建 | 验收记录 CRUD、文件、统计 |
| 技术资料 | `/api/technical-documents` | 资料列表/审核 | 资料上传、审核、分享 |
| 资产定位 | `/api/asset-location`, `/api/iot-devices`, IoT 模块 | 地理定位/区域定位/配置 | 定位、信标、设备 |
| 质量管理 | `/api/quality-control`, `/api/adverse-reaction` | 计量/报告识别/质控/统计/不良事件 | 计量、质控、不良事件 |
| 仪表盘 | 资产统计、维护统计等 API | Dashboard | 概览、图表、AI 分析入口 |
| 系统 | users, departments, tenants, roles-permissions, audit-logs, backup, system-config 等 | 用户/部门/企业/角色/日志/备份/连接 | 管理配置 |

---

## 二、AI 助手当前已实现能力

| 意图 | 说明 | 后端/前端支持 |
|------|------|----------------|
| **help** | 帮助/能力说明 | 仅对话，无表单 |
| **pending_requests** | 待办/待审批（报修单+调配单） | 查库注入，仅展示 |
| **asset_query** | 按关键字查资产 | searchAssetsByKeyword，右侧列表 |
| **repair_request** | 资产报修 | 表单收集 → maintenanceAPI.createMaintenanceRequest |
| **transfer** | 资产调配 | 表单收集 → transferAPI.createTransfer |
| **idle_publish** | 闲置发布 | 表单收集 → idleAPI.publishIdleAsset |
| **scrapping** | 报废申请 | 表单收集 → scrappingAPI.create |
| **maintenance_log** | 维修日志登记 | 表单收集 → maintenanceAPI.createMaintenanceLog |
| **inventory_query** | 盘点查询 | 查库注入，右侧列表 |
| **inventory_create** | 发起盘点 | 表单收集 → inventoryAPI.createInventory |
| **repair_history** | 报修/维修历史 | 按资产查 maintenance_requests，右侧列表 |
| **maintenance_plan_query** | 维护计划查询 | 查 preventive_maintenance_plans，右侧列表 |
| **maintenance_stats** | 维修统计 | 维修申请/日志数与总成本，右侧展示 |
| **acceptance_query** | 验收记录查询 | 查 asset_acceptance_records，支持按资产筛选，右侧列表 |
| **technical_doc_query** | 技术资料查询 | 查 technical_documents，右侧列表 + 引导列表页 |
| **adverse_event_query** | 不良事件查询 | 查 adverse_reaction_records，支持按资产筛选（表有 asset_code 时），右侧列表 + 引导列表页 |
| **metrology_query** | 计量记录查询 | 查 metrology_records，支持按资产筛选，右侧列表 + 引导列表页 |
| **质量管理总入口** | 用户说「质量管理」「质管」「质量相关」 | 回复 1～2 句说明可查验收、技术资料、不良事件、计量，intent 填 help |
| **org_query** | 当前企业名称 | 查 tenants，仅展示企业名称/编码 |
| **department_query** | 部门与资产数量 | 查 departments + 按部门统计 assets，右侧列表 |
| **transfer_approve** | 审批调配 | 对话内执行：说「通过第一条」「通过调配 5」或「拒绝调配 5」（仅系统管理员），右侧展示审批结果 |

特点：以「资产」为中心，覆盖资产查看、报修、调配、闲置、报废、维修日志、待办、盘点、维护计划、维修统计、验收、技术资料、不良事件、计量、当前企业、部门与资产、**对话内审批调配**等，边界明确（不跑偏）。

---

## 三、可被 AI 助手扩展的功能模块（按可行性排序）

### 高可行性（接口清晰、与资产强相关、自然语言易表达）

1. **盘点（inventory）**
   - 现状：有列表、创建、详情、状态更新、明细批量等 API。
   - 可做：
     - **查询**：如「最近一次盘点」「某部门盘点状态」→ 调用 GET `/api/inventory` 或统计接口，汇总后回复。
     - **创建**：如「发起盘点，盘点名称 xxx，部门 xxx」→ 收集名称、部门、计划日期等 → POST `/api/inventory`（需对接前端 inventoryAPI）。
   - 建议意图：`inventory_query`（查盘点）、`inventory_create`（发起盘点）。

2. **维修申请/工单状态与审批**
   - 现状：报修已支持创建；另有 GET `/api/maintenance/requests`、审批/开始/完成等接口。
   - 可做：
     - 待办中已包含「报修单」；可再扩展「我发起的维修申请」「某资产维修历史」→ 调用 requests 列表或按 asset_code 筛选，注入上下文后由助手汇总。
     - 若需「审批报修」「开始维修」「完成维修」，可增加只读查询 + 引导到具体工单链接或简单审批意图（需权限与接口对接）。
   - 建议：先做 `repair_history`（某资产报修/维修历史查询），再视需求做审批快捷操作。

3. **预防性维护计划（plans）**
   - 现状：GET/POST `/api/maintenance/plans`，按资产、计划名等查询。
   - 可做：
     - 「某资产有哪些维护计划」「即将到期的维护计划」→ 调用 plans 列表或提醒接口，汇总后回复。
   - 建议意图：`maintenance_plan_query`（只读）。

4. **验收记录（acceptance）**
   - 现状：GET/POST `/api/acceptance/records`，有统计接口。
   - 可做：
     - 「最近验收记录」「某资产验收情况」→ 调用 records 或统计，汇总回复。
     - 「创建验收」需字段较多，可做简化版或仅引导到「创建验收」页面。
   - 建议意图：`acceptance_query`、可选 `acceptance_create`（简化表单）。

5. **维修/成本与效率统计（只读）**
   - 现状：/efficiency/*、/costs/*、/analysis/*、/statistics 等。
   - 可做：
     - 「本月维修成本」「维修效率概览」「某资产维修次数」→ 调用对应统计或分析接口，助手汇总成自然语言。
   - 建议意图：`maintenance_stats` 或合并到「查资产」时附带维修/成本摘要。

### 中可行性（需明确字段与权限）

6. **技术资料（technical-documents）**
   - 现状：资料列表、审核、上传（含外部分享）。
   - 可做：
     - 「某资产关联的技术资料」「待审核资料数量」→ 若后端支持按 asset_code 或状态查，可注入结果后汇总。
   - 创建/上传多为文件，不适合在助手中完整做，仅查询 + 引导到列表/审核页即可。

7. **不良事件（adverse-reaction）**
   - 现状：列表、表单、详情。
   - 可做：
     - 「最近不良事件」「与某资产相关的不良事件」→ 若 API 支持按资产或时间查询，可只读汇总。
   - 填报涉及较多结构化字段与流程，建议仅查询或简单登记引导。

8. **计量/质控（quality-control, metrology）**
   - 现状：计量管理、报告识别、质控、统计分析。
   - 可做：
     - 「某设备计量到期情况」「质控统计」→ 若有按资产或设备查询的 API，可只读汇总。
   - 录入与审批流程复杂，助手侧以查询和引导为主。

### 较低优先级（管理类、敏感操作）

9. **部门/用户/租户/角色**
   - 多为系统管理，且涉及权限与安全，不适合在助手中做增删改。
   - 可做：仅「查询」如「某部门下有哪些资产」「当前企业名称」等只读能力（若后端有对应查询 API）。

10. **备份、数据库连接、API 文档**
    - 系统运维与开发向，不适合对普通业务用户暴露在助手中。

---

## 四、推荐实现顺序与方式

| 优先级 | 能力 | 意图建议 | 实现要点 |
|--------|------|----------|----------|
| P0 | 盘点查询 + 发起盘点 | inventory_query, inventory_create | 封装 inventory API；提示词与 REQUIRED_BY_INTENT 增加盘点；前端提交时调 inventoryAPI |
| P1 | 某资产维修/报修历史 | repair_history 或扩展 asset_query | 按 asset_code 查 maintenance/requests 或 logs，注入上下文汇总 |
| P1 | 维护计划查询 | maintenance_plan_query | GET maintenance/plans，支持按资产或「即将到期」筛选后汇总 |
| P2 | 维修/成本统计摘要 | maintenance_stats | 调用 efficiency/overview 或 costs/trend，自然语言汇总 |
| P2 | 验收记录查询 | acceptance_query | GET acceptance/records 或 statistics，汇总回复 |
| P3 | 技术资料/不良事件/计量查询 | technical_doc_query, adverse_event_query, metrology_query | 已实现：只读查询 + 右侧列表 + 引导到列表页 |
| P4 | 部门/企业只读查询 | org_query, department_query | 已实现：当前企业名称；部门列表及各部门资产数量 |

---

## 五、实现时共性要点

1. **后端（maintenance-ai-service.js）**
   - 在 `ASSISTANT_INTENTS`、`REQUIRED_BY_INTENT`、意图识别表与系统提示中增加新意图。
   - 为「查询类」意图：在识别到关键词时调用对应 API，将结果注入 `effectiveContext`（如 `inventoryList`、`repairHistory`），并在系统提示中说明「仅汇总、不收集表单」。
   - 为「创建类」意图：定义必填/选填字段，从对话中解析或由 AI 填入 `extracted_fields`，合并到 `mergedForm`，前端按意图调用对应 API 提交。

2. **前端（AIMaintenanceManager.jsx）**
   - 在 `REQUIRED_BY_INTENT`、`INTENT_LABELS`、提交分支中增加新意图。
   - 右侧信息区按意图展示对应列表或说明（如盘点列表、维修历史摘要）。
   - 提交时根据 intent 调用新 API（如 inventoryAPI.create）。

3. **权限与租户**
   - 新接口若需租户隔离，使用 `requireTenantId` 与 `getTenantId`；查询类按当前用户角色过滤（与 asset_query 类似）。

4. **不跑偏**
   - 帮助说明与系统提示中明确列出新增能力，并继续强调「仅处理资产及相关业务」。

---

## 六、小结

- **已覆盖**：资产查询、报修、调配、闲置发布、报废、维修日志、待办（报修+调配）、帮助，且边界清晰。
- **最易扩展且价值高**：盘点（查+建）、维修/报修历史、维护计划查询、维修与成本统计、验收查询。
- **以只读与引导为主**：技术资料、不良事件、计量/质控、部门等，先做查询与跳转，再视需求做简单创建或审批入口。

按上述顺序在现有「意图 + 表单 + 提交」与「只读注入 + 汇总」框架下扩展即可，无需改动整体架构。

---

## 七、近期完善说明

- **资产调配**：AI 助手内调配已统一为申请制（POST /assets/:id/transfer-apply），必填资产编号、调入部门、调配原因；与待办、审批一致。
- **自然语言与范围**：增强口语/同义识别（如「坏了要修」「有啥要批的」）；超出范围时 1～2 句友好收束、可变换措辞。
- **质量管理适配**：验收、不良事件、计量支持按资产筛选（如「TEST001的验收」「某设备计量到期」）；新增「质量管理」「质管」总入口；从「XXX的验收/不良事件/计量」中解析资产编号；查资产后提示可查本资产的验收、不良事件、计量。
- **前端**：欢迎语与使用流程中突出质量管理；示例增加「质量管理 / 查验收 / 计量到期 / 某资产的不良事件」。
