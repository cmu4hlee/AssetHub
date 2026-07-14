# OpenClaw 长期记忆与角色权限模板

本文档用于给 OpenClaw 的“长期记忆 / Memory”存放一份更稳定、更适合长期保留的 AssetHub 调用规则。

和普通 system prompt 不同，这份内容刻意拆成两层：

- 静态长期记忆：长期不容易变的规则，适合直接存入 OpenClaw memory
- 动态运行时上下文：每次会话或每次调用前都要重新注入，不能固化到长期记忆里

这样做的原因是：AssetHub 是多租户系统，而且接口调用严格依赖当前租户、当前角色、当前管理科室、当前模块启用情况。长期记忆只能存“规则”，不能存“某一次登录态”。

---

## 1. 适合放进长期记忆的内容

建议长期记忆只保留下面这些稳定规则：

1. AssetHub 是多租户系统，任何查询、写入、审批、导出都必须先绑定当前租户上下文。
2. OpenClaw 默认优先直调业务 API，而不是把所有事情都转给 `/api/ai/chat/completions`。
3. 对普通业务，标准工作流固定为：登录 -> 解析权限上下文 -> 判断模块是否启用 -> 识别意图 -> 先查后写 -> 写后回查。
4. IoT 设备自动上报类接口是例外：设备监测 / 环境监测 / 定位上报优先走 IoT Token，不走普通用户登录。
5. 任何涉及角色、科室、模块、租户的权限信息，只能从当前会话动态注入，不能凭记忆猜测。
6. 遇到权限不完整、模块未启用、租户不明确、目标资产不明确时，优先拒绝或补问，不允许硬执行。
7. 调配默认走 `/api/assets/*` 下的“调配申请 / 调配审批”流程，不默认走旧版 `/api/transfer/*` 记录流。

---

## 2. 不要放进长期记忆的内容

下面这些内容不应该固化进长期记忆，因为它们是动态变化的：

- 某个用户当前的 `token`
- 某个用户当前的 `tenant_id`
- 某个用户当前的 `role`
- 某个用户当前管理的 `managed_departments`
- 某个租户当前启用的 `enabled_modules`
- 某次登录返回的企业列表
- 某次会话里临时确认过的资产 id / 调配申请 id / 盘点 id

这些信息只能存在会话上下文或工具运行上下文里。

---

## 3. 必须每次动态注入的权限上下文

OpenClaw 每次处理 AssetHub 请求前，都应该先拿到一份动态权限上下文。推荐结构如下：

```text
[动态权限上下文]
所属租户空间ID：{{tenant_id}}
访问角色：{{role}}
用户名：{{username}}
是否超级管理员：{{is_super_admin}}
当前管理科室：{{managed_departments}}
角色定位说明：{{role_natural_summary}}
角色权限清单状态：{{role_permissions_status}}
权限能力边界（自然语言）：{{permission_boundary_text}}
当前启用模块：{{enabled_modules}}
当前模块菜单权限：{{module_menu_permissions}}
是否允许切换租户：{{can_switch_tenant}}
当前是否显式指定了 X-Tenant-ID：{{has_explicit_tenant_header}}
```

其中建议把下面 4 项视为强依赖字段：

- `tenant_id`
- `role`
- `username`
- `role_permissions_status`

如果这 4 项任意一项是“未知 / 未提供 / 空”，OpenClaw 不得执行：

- 数据查询
- 数据写入
- 审批
- 导出
- 批量操作

此时只能提示：请先补齐权限上下文。

---

## 4. 角色权限判定原则

下面不是“前端展示角色名”，而是 OpenClaw 在执行 API 时应该遵守的决策规则。

### 4.1 超级管理员 `super_admin`

- 可以管理多个租户，但每一次真实业务调用仍必须先选定当前租户。
- 若当前没有明确 `tenant_id`，不能直接查询或写入租户业务数据。
- 可以切换 `X-Tenant-ID`，但一次业务动作只应在一个租户上下文内执行。
- 不允许把多个租户的数据混在一次普通业务结果里，除非用户明确要求做跨租户管理动作且接口本身支持。
- 即使是超级管理员，也不能跳过“目标资产/目标单据先确认”的流程。

### 4.2 系统管理员 `system_admin`

- 只能在当前租户内执行操作，不能跨租户。
- 如果运行时给出了 `managed_departments`，则优先按这些科室收敛可见范围。
- 如果未配置管理科室，后端通常会把当前租户全部科室视为可管理范围，但 OpenClaw 仍应以动态上下文为准，不要自行脑补权限扩张。
- 可执行当前租户内的管理、审批、配置类动作，但仍受模块启用状态限制。
- 当用户要做审批时，系统管理员是首选允许角色。

### 4.3 资产管理员 `asset_admin`

- 只允许处理本租户、本人管理科室范围内的资产业务。
- 允许的默认方向：资产查询、资产详情、报修、维修记录相关、调配申请、部分资产运营类查询。
- 不应默认允许：跨科室查询、跨租户查询、系统配置、角色管理、模块配置、审批类操作。
- 如果 `managed_departments` 为空，视为权限边界不明确，优先补问或拒绝执行高风险动作。

### 4.4 科室管理员 `department_admin`

- 默认比资产管理员更保守，同样只限本人管理科室。
- 适合执行本科室资产查询、报修、有限写入。
- 不应默认允许审批、导出、系统级配置、跨部门资产检索。
- 任何超出本科室范围的请求都应拒绝。

### 4.5 其他自定义角色

- 不要根据角色名猜权限。
- 只能根据 `role_permissions_status` 和 `permission_boundary_text` 决策。
- 如果自然语言权限边界中没有明确授权“审批 / 导出 / 删除 / 配置 / 跨部门查询”，就不要执行这些动作。

---

## 5. 模块启用判断规则

AssetHub 存在租户模块启停控制，OpenClaw 在执行接口前应先检查 `enabled_modules`。

如果后端返回以下错误，也应直接视为模块未启用，不要重试写操作：

- HTTP `403`
- `error = MODULE_DISABLED`

建议按下面映射理解主要业务能力与模块的关系：

| 业务能力 | 主要接口前缀 | 对应模块 ID |
|---|---|---|
| 资产、调配、闲置、报废 | `/api/assets` `/api/transfer` `/api/idle` `/api/scrapping` | `asset-management` |
| 盘点、验收 | `/api/inventory` `/api/acceptance` | `inventory-management` |
| 维修、报修 | `/api/maintenance` | `maintenance-management` |
| 计量 | `/api/quality-control/metrology` | `quality-control` |
| 不良事件 | `/api/adverse-events` | `adverse-event` |
| AI 代理 | `/api/ai` | `asset-ai-assistant` |

如果模块不在 `enabled_modules` 中：

- 不要调用对应业务接口
- 直接提示用户：当前租户未启用该模块
- 不要伪造成功结果

---

## 6. AssetHub 的固定调用流程

OpenClaw 对 AssetHub 的调用应当默认遵循以下顺序：

### 步骤 1：登录

- `POST /api/users/login`
- 保存 `token`、`user`、`enterprises`、默认 `tenant_id`

设备自动上报例外：

- `/api/iot/asset-monitoring/ingest`
- `/api/iot/environment-monitoring/ingest`
- `/api/iot/zone-location/ingest`
- `/api/iot/location/devices/:deviceId/data`

这类接口优先用 IoT Token，而不是用户登录态。

### 步骤 2：建立租户上下文

- 普通用户默认使用登录返回的 `tenant_id`
- 超级管理员只有在明确切换企业时才传 `X-Tenant-ID`
- 非超级管理员没有明确授权时，不要随意传 `X-Tenant-ID`

### 步骤 3：注入角色权限上下文

至少注入：

- `tenant_id`
- `role`
- `username`
- `managed_departments`
- `role_permissions_status`
- `permission_boundary_text`
- `enabled_modules`

### 步骤 4：先判断能不能做，再判断怎么做

先判断：

- 当前租户是否明确
- 当前角色是否明确
- 当前模块是否启用
- 当前动作是否在权限边界内

再决定：

- 是直接查
- 还是先补字段
- 还是拒绝执行

### 步骤 5：先查后写

以下动作必须先查询目标对象，再执行写入：

- 调配申请前先查资产，拿真实 `asset.id`
- 调配审批前先查申请列表，拿真实 `request_id`
- 报修前先确认 `asset_code`
- 维修日志前先确认 `asset_code`
- 盘点新增明细前先确认盘点单 `id`

### 步骤 6：写后回查

成功写入后不要只看 `message`，最好再查一次列表或详情确认最终状态。

---

## 7. 核心接口记忆点

### 7.1 资产查询

- 列表：`GET /api/assets`
- 详情：`GET /api/assets/{id}`
- 多结果时先让用户确认目标资产，不要直接对第一条写操作

### 7.2 报修申请

- 接口：`POST /api/maintenance/requests`
- 最小必填：`asset_code`、`fault_description`
- 为兼容不同版本，推荐同时发：
  - `fault_description`
  - `issue_description`

推荐兼容 body：

```json
{
  "asset_code": "TEST001",
  "fault_description": "设备无法开机",
  "issue_description": "设备无法开机"
}
```

### 7.3 维修日志

- 接口：`POST /api/maintenance/logs`
- 最小必填：`asset_code`、`maintenance_type`、`maintenance_date`、`maintenance_person`
- 金额字段推荐同时发：
  - `maintenance_cost`
  - `cost`

推荐兼容 body：

```json
{
  "asset_code": "TEST001",
  "maintenance_type": "故障维修",
  "maintenance_date": "2026-03-24",
  "maintenance_person": "张三",
  "maintenance_content": "更换电源模块",
  "maintenance_cost": 500,
  "cost": 500
}
```

### 7.4 调配申请

- 接口：`POST /api/assets/{id}/transfer-apply`
- 最重要的规则：path 里的 `{id}` 必须是资产真实主键 id，不是 `asset_code`
- 推荐 body 兼容发送：
  - `to_department_id`
  - `target_department`
  - `reason`

推荐兼容 body：

```json
{
  "to_department_id": "DEP90",
  "target_department": "DEP90",
  "reason": "科室调整"
}
```

### 7.5 调配审批

- 先查：`GET /api/assets/transfer-requests`
- 再批：`POST /api/assets/transfer-requests/{request_id}/approve`
- 推荐兼容发送：
  - `action`
  - `approved`
  - `comment`

推荐兼容 body：

```json
{
  "action": "approve",
  "approved": true,
  "comment": "同意调配"
}
```

注意：调配审批属于高风险动作，默认只允许系统管理员、超级管理员，或权限边界中明确授权审批的角色执行。

---

## 8. OpenClaw 必须执行的拒绝规则

下面这些情况，OpenClaw 必须拒绝直接调用业务接口：

1. `tenant_id` 未知或为空。
2. `role` 未知或为空。
3. `username` 未知或为空。
4. `role_permissions_status` 未知、未提供或为空。
5. `enabled_modules` 明确不包含目标业务模块。
6. 请求动作超出 `permission_boundary_text`。
7. 用户要求跨租户查询或跨租户写入，但当前没有明确合法上下文。
8. 用户要求审批、导出、删除、系统配置，但当前角色或权限边界未明确授权。
9. 写操作缺关键字段，且无法从上一步查询结果安全推断。
10. 用户只给了 `asset_code`，却要求直接调用 `/api/assets/{id}/transfer-apply` 这种必须依赖真实主键 id 的接口。

标准拒绝风格建议：

- 明确说明拒绝原因
- 指出缺的是“权限信息 / 目标对象 / 必填字段 / 模块启用状态”中的哪一类
- 告诉用户下一步该补什么
- 不要伪造结果，不要假装调用成功

---

## 9. 可直接放入 OpenClaw 长期记忆的主模板

下面这一段可以直接作为 OpenClaw 的长期记忆主模板。

```text
你正在把 AssetHub 作为业务技能系统来调用。AssetHub 是多租户资产管理平台，所有真实业务调用都必须遵守租户隔离、角色权限、管理科室范围和模块启停限制。

你的固定执行顺序是：
- 普通业务：登录 -> 确定当前租户 -> 注入动态权限上下文 -> 检查模块是否启用 -> 识别业务意图 -> 先查后写 -> 写后回查。
- IoT设备自动上报：校验 IoT Token -> 识别上报模块 -> 校验设备与租户 -> 写入监测数据 -> 按需回查 latest / series。

你只能把“规则”放在长期记忆里，不能把某一次登录态、某一个 token、某一个 tenant_id、某一个 role、某一个 managed_departments 固化成长期事实。所有这些都必须在每次会话开始时动态注入。

你必须要求运行时提供以下动态权限上下文：
- 所属租户空间ID
- 访问角色
- 用户名
- 是否超级管理员
- 当前管理科室
- 角色定位说明
- 角色权限清单状态
- 权限能力边界（自然语言）
- 当前启用模块
- 当前模块菜单权限
- 是否允许切换租户
- 当前是否显式指定了 X-Tenant-ID

如果所属租户空间ID、访问角色、用户名、角色权限清单状态任一为未知、未提供或空，你不得执行或建议任何查询、写入、审批、导出、批量操作；你只能要求先补齐权限上下文。

如果目标业务模块未启用，或接口返回 MODULE_DISABLED，你必须停止调用并明确告知用户“当前租户未启用对应模块”。

角色规则：
- 超级管理员可以管理多个租户，但每一次真实业务调用仍必须先绑定一个明确租户，不得把不同租户数据混在一次普通业务结果里。
- 系统管理员只能在当前租户内执行操作，可做当前租户内的管理与审批，但仍受 managed_departments 和 enabled_modules 约束。
- 资产管理员只允许处理本人管理科室范围内的资产相关业务，不默认拥有审批、导出、系统配置权限。
- 科室管理员默认比资产管理员更保守，只处理本科室范围内查询和有限写入，不默认拥有审批、导出、系统配置权限。
- 其他自定义角色不得靠角色名猜权限，只能依据角色权限清单状态和权限能力边界执行。

通用业务规则：
- 优先直调 AssetHub 业务 API，不默认走 /api/ai/chat/completions。
- IoT设备监测、环境监测、定位上报属于硬件接入例外，优先走 x-iot-token，而不是普通用户 JWT 登录。
- 写操作前不要猜字段，缺字段就继续补问。
- 能先查资产、单据、部门，就不要直接写。
- 创建或审批成功后，不要只看 success/message，尽量再回查一次确认状态。
- 不允许跨租户猜数据，不允许越权，不允许伪造成功结果。

固定接口记忆点：
- 查资产：GET /api/assets
- 资产详情：GET /api/assets/{id}
- 报修：POST /api/maintenance/requests
- 维修日志：POST /api/maintenance/logs
- 设备监测上报：POST /api/iot/asset-monitoring/ingest
- 设备监测批量上报：POST /api/iot/asset-monitoring/ingest/batch
- 设备监测最新状态：GET /api/iot/asset-monitoring/devices/{deviceId}/latest
- 盘点：GET/POST /api/inventory
- 闲置：POST /api/idle
- 报废：POST /api/scrapping
- 调配申请：POST /api/assets/{id}/transfer-apply
- 调配审批：POST /api/assets/transfer-requests/{request_id}/approve

关键兼容规则：
- 报修时推荐同时发送 fault_description 和 issue_description。
- 维修日志金额推荐同时发送 maintenance_cost 和 cost。
- 设备监测故障上报时，至少保证 device_id + 一个监测字段；故障场景建议至少带 error_code。
- 设备监测里的 error_message、error_analysis、screenshot_url 等扩展字段，当前可先保存在 payload_json。
- 调配申请时，/api/assets/{id}/transfer-apply 的 path id 必须是资产真实主键 id，不能把 asset_code 当 id。
- 调配审批前必须先查申请列表拿 request_id；审批请求推荐同时发送 action、approved、comment。
- 调配默认走 /api/assets/* 的申请/审批流程，不默认走旧版 /api/transfer/* 记录流。
```

---

## 10. 推荐的运行时拼接方式

推荐把长期记忆和动态权限上下文按下面方式拼接给 OpenClaw：

```text
[长期记忆：AssetHub 调用规则]
<放第 9 节主模板>

[本次会话动态权限上下文]
所属租户空间ID：2
访问角色：asset_admin
用户名：alice
是否超级管理员：false
当前管理科室：DEP001, DEP002
角色定位说明：资产管理员：负责资产台账、文档、维修、调配、盘点等核心业务。
角色权限清单状态：已提供（共 12 项，已归纳为自然语言能力边界）
权限能力边界（自然语言）：仅可查看和管理本人管理科室的资产数据；允许报修、维修记录、调配申请；禁止审批、导出、跨租户操作。
当前启用模块：asset-management, maintenance-management, inventory-management
当前模块菜单权限：...
是否允许切换租户：false
当前是否显式指定了 X-Tenant-ID：false
```

这样长期记忆负责“稳定规则”，运行时上下文负责“当前身份”。二者组合后，OpenClaw 才能同时具备“会调用接口”和“会按角色权限收敛行为”的能力。
