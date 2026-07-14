# Agent Mesh 架构说明

## 目标

在资产业务中建立多代理协同机制，形成「协调代理 + 领域代理」的网状协作。

已落地的 6 个代理：

1. 资产台账代理（asset_ledger）
2. 维保代理（maintenance）
3. 质控合规代理（quality_compliance）
4. IoT 代理（iot）
5. 成本折旧代理（cost_depreciation）
6. 协调代理（coordinator）

---

## 调用方式

后端新增统一入口：`/api/agent-mesh`

- `GET /api/agent-mesh/topology`
  - 返回当前 Agent Mesh 节点与边结构
- `POST /api/agent-mesh/init`
  - 初始化一次会话，返回 `conversationId`
- `POST /api/agent-mesh/message`
  - 输入自然语言请求，由协调代理自动路由相关子代理并汇总结论

### 智能引擎接口（按“逐一执行”落地）

- `POST /api/agent-mesh/intelligence/predictive-maintenance`
  - 基于 IoT 时序 + 维修历史输出故障概率和剩余寿命（RUL）
- `POST /api/agent-mesh/intelligence/risk-score`
  - 统一市场/合规/设备风险评分，并提供降噪（冷却+去抖）结果
- `GET /api/agent-mesh/intelligence/risk-trend`
  - 读取风险快照趋势（均值分数、高风险数量、抑制告警数量）
- `POST /api/agent-mesh/intelligence/health-index`
  - 计算组合级资产健康指数（状态+成本+风险反向+战略匹配）
- `GET /api/agent-mesh/intelligence/health-trend`
  - 读取健康快照趋势（平均健康指数、低健康资产数量、趋势方向）
- `GET /api/agent-mesh/microservice/roadmap`
  - 查看认证权限、资产核心、维保核心的渐进拆分路线
- `GET /api/agent-mesh/microservice/events`
  - 查看事件总线契约与 outbox 策略

## 前端入口

- 菜单：`资产AI助手 -> Agent Mesh 智能中枢`
- 路由：`/ai-assistant/agent-mesh`
- 支持高风险资产一键跳转创建工单（`/maintenance/workorders/new` 预填资产与处置建议）
- 工单支持回写风险来源信息（`source_type`、`source_ref_id`、`source_event_at`、`source_payload`）

---

## 协作流程

1. 协调代理读取用户请求并根据关键词路由子代理
2. 子代理并行拉取各自领域指标（台账、维保、质控、IoT、折旧）
3. 协调代理执行结果合并，输出统一结论和下一步建议
4. 若外部 LLM 网关可用，优先由 LLM生成总结；否则使用本地回退模板

---

## 当前实现特点

- 支持租户隔离（按 `tenant_id` 查询）
- 支持缺表降级（某模块表不存在时返回空指标，不中断整体响应）
- 支持会话上下文（`conversationId` + 历史消息）
- 支持拓扑查询，便于前端可视化 Agent Mesh
- 支持预测维护、风险评分、健康指数三条智能能力链路
- 支持微服务拆分路线与事件契约可视化输出
