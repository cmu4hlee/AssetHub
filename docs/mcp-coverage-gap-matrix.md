# AssetHub MCP 覆盖缺口矩阵

本文档用于回答一个很具体的问题：

> 当前 `mcp-assethub` 是否已经覆盖主应用的大多数功能？

结论是：**没有。当前 MCP 已覆盖 AI 助手最核心的一批链路，但距离“覆盖主应用全部主要功能”还有明显差距。**

这份矩阵按“主应用模块 -> 后端路由 -> 当前 MCP 工具 -> 覆盖状态 -> 缺口 -> 建议补齐工具 -> 优先级”整理，便于后续直接排开发任务。

---

## 1. 判定标准

本文使用 4 种覆盖状态：

| 状态 | 含义 |
| --- | --- |
| `较完整` | MCP 已覆盖该模块的核心查询与核心写操作，OpenClaw 可以比较稳定地完成主要任务 |
| `部分覆盖` | MCP 已接入一部分关键能力，但仍缺少大量用户在主应用中实际可用的子功能 |
| `未覆盖` | 主应用或后端已有模块，但 MCP 没有对应工具 |
| `失效/过期` | MCP 工具名已经存在，但 handler 直接报“不可用”或说明文字与当前后端实际挂载状态不一致 |

优先级定义：

- `P0`：直接影响 OpenClaw 成为“可操作主应用”的核心短板，建议优先补
- `P1`：高频模块的重要缺口，建议第二批补
- `P2`：补齐型或低频管理功能，可放在后续批次

---

## 2. 总体判断

当前仓库里后端主服务已经挂载了大量业务路由，例如资产、盘点、调配、闲置、维修、IoT、技术资料、质量管理、采购、系统管理、租户、模块、工作流、风险、人员资质、开机率等。[backend/server.js](/Users/cjlee/PJ/AssetHub/backend/server.js#L395)

但 `mcp-assethub` 目前并没有对这些模块做等价覆盖。仓库自带生成文档也说明 MCP 与后端 API 仍存在偏差：

- `MCP tools: 95`
- `MCP backend requests: 83`
- `Unmatched requests: 22`

见：[tools/mcp-assethub/docs/mcp-api-update-guide.md](/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/docs/mcp-api-update-guide.md#L1)

---

## 3. 覆盖矩阵

| 主应用模块 | 主入口 / 后端路由 | 当前 MCP 覆盖 | 状态 | 主要缺口 | 建议新增或修复的 MCP 工具 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| 资产基础管理 | `/assets`、`/assets/add`；`/api/assets` | 已有 `list_assets`、`list_all_assets`、`get_asset`、`create_asset`、`update_asset`、`delete_asset`、统计与变更日志工具 | `较完整` | 资产导入导出、图片、重复校验等未通过 MCP 暴露 | `import_assets`、`export_assets`、`list_asset_images`、`upload_asset_image`、`check_asset_duplicate` | `P1` |
| 资产盘点 | `/inventory`、`/inventory/self`；`/api/inventory`、`/api/inventory-plans`、`/api/inventory-tasks`、`/api/inventory-discrepancies`、`/api/inventory-reports` | 已有 `list_inventory`、`create_inventory_record`、`adjust_inventory`，并已补 `list/get/create/update/activate/complete/cancel_inventory_plan`、`list/get/create/assign/start/complete/update/cancel_inventory_task`、`list/get/handle/batch_handle_inventory_discrepancies`、`get_inventory_discrepancy_statistics`、`generate_inventory_discrepancies` | `部分覆盖` | 盘点主流程和差异闭环已接通，但报表导出、删除计划/任务、更多盘点明细能力仍未通过 MCP 暴露 | `export_inventory_report`、`delete_inventory_plan`、`delete_inventory_task`、`list_inventory_details`、`update_inventory_detail` | `P1` |
| 资产流程 | `/asset-workflows`；`/api/workflow`、`/api/asset-workflows` | 已补 `get_default_workflow`、`list_workflow_states`、`list_workflow_transitions`、`apply_asset_transition`，并已补 `list/get/create/update/delete_asset_workflow` | `较完整` | 默认流程查询、迁移执行、流程定义 CRUD 已接通；仍缺少待办任务类接口，因为后端当前未开放 `workflow/tasks` 主链路 | 修复或补齐真正可用的 `workflow/tasks/todo`、`workflow/tasks/{id}/complete` 后端接口，再同步恢复 MCP 能力 | `P1` |
| 临时资产 | `/temp-assets`；`/api/temp-assets` | 无 | `未覆盖` | 临时资产查询、创建、修改、删除全部缺失 | `list_temp_assets`、`get_temp_asset`、`create_temp_asset`、`update_temp_asset`、`delete_temp_asset` | `P1` |
| 折旧管理 | `/depreciation`；`/api/depreciation` | 已有折旧列表、详情、按部门/类型/月汇总 | `部分覆盖` | 缺少折旧计算、折旧导出、折旧方法查询 | `calculate_depreciation`、`export_depreciation`、`list_depreciation_methods` | `P2` |
| 调配 / 闲置 / 报废 | `/transfer`、`/transfer/new`、`/transfer/requests`、`/idle`；`/api/transfer`、`/api/idle`、`/api/scrapping` | 已有 `transfer_asset`、`list_transfers`、`approve_transfer`、`execute_transfer`、`list_idle_assets`、`publish_idle_asset`、`allocate_idle_asset`、`cancel_idle_asset`、`list_scrappings`、`create_scrapping`、`approve_scrapping` | `较完整` | 仍缺少部分明细/取消/删除/完成类动作 | `get_transfer`、`delete_transfer`、`get_scrapping`、`dispose_scrapping`、`complete_scrapping`、`delete_scrapping` | `P1` |
| 维修维护 | `/maintenance/*`；`/api/maintenance` 下挂日志、计划、请求、模板、工单、分析、成本、提醒、使用量、评价等 | 已有日志、模板、效率、故障维修申请主流程，并已补 `list/get/create/update/complete/delete_maintenance_plan`、`get_maintenance_plan_history`、`list/send/config/check_reminders`、`list/create_usage_record`、`list/process_usage_triggered`、`get/create_maintenance_workorder`、`assign/start/complete/close/cancel_workorder`、`add_workorder_materials`，同时修正了 `update_workorder_status` | `较完整` | 评价、工单删除/更细粒度编辑、成本明细专用工具仍未单独暴露；后端工单存在新旧双轨接口，MCP 当前优先对齐 legacy 工单主流程以保证可操作性 | `list_maintenance_evaluations`、`create_maintenance_evaluation`、`delete_maintenance_workorder`、`update_maintenance_workorder`、`list_maintenance_costs`、`get_maintenance_cost_detail` | `P1` |
| 资产定位 / IoT / 告警 | `/asset-location`、`/beacon-location`、`/iot-devices`；`/api/asset-location`、`/api/iot-devices`、`/api/iot`、`/api/location-codes`、`/api/location-alerts`、`/api/intelligent-alerts` | 已有设备、位置、智能告警、患者流量、资产使用量工具，并已补 `list/get/create/update/delete_location_code`、`list/get_stats/handle/batch_handle/delete_location_alert`、`get_environment_latest_by_device`、`get_environment_latest_by_asset`、`get_environment_asset_series`、`get_environment_pipeline_health`、`get_environment_pipeline_docs`、`list_assets_in_area`、`report_device_location_data`、`report_beacon_location`、`list_beacon_assets`、`ingest_zone_location_sample`、`ingest_zone_location_batch`、`get_zone_location_latest_by_device`、`get_zone_location_latest_by_asset`、`get_zone_location_asset_series`、`get_zone_location_pipeline_health`、`get_zone_location_pipeline_docs`，并修复 `update_device_status` | `较完整` | 核心位置查询、Beacon/设备上报、区域分析与管理侧样例写入已接通；剩余缺口主要是手动资产位置更新、批量资产位置查询等收尾能力。旧工具 `get_environment_records`、`get_environment_alerts` 仍仅作为兼容占位保留；`ingest_zone_location_batch` 属硬件 ingest 调试接口，通常仍需单独 IoT token | `update_asset_location`、`get_batch_asset_locations`、`ingest_zone_location_event` | `P2` |
| 技术资料 | `/technical-documents`、`/technical-documents/review`；`/api/technical-documents`、`/api/technical-documents/enhanced`、`/api/technical-documents/ai` | 已有 `list_documents`、`get_document`、`upload_document`、`review_document`，并已补 `list/create/delete_document_tag`、`update_document_tags`、`list/create_document_version`、`favorite/unfavorite_document`、`list_favorite_documents`、`list/create/resolve_document_comment`、`list/create/delete_document_template`、`batch_delete_documents`、`batch_update_document_category`、`create/list/delete_document_share` | `较完整` | 技术资料增强主链路已接通，但分类 CRUD、访问历史、统计、AI 文档分析能力仍未通过 MCP 暴露 | `list_document_categories`、`create_document_category`、`update_document_category`、`delete_document_category`、`list_document_history`、`record_document_view`、`get_document_statistics`、`search_document_ai`、`summarize_document_ai`、`suggest_document_tags_ai` | `P1` |
| 质量管理 | `/quality-control/metrology`、`/quality-control/qc`、`/quality-control/statistics`、`/adverse-reaction`；`/api/quality-control`、`/api/adverse-reaction` | 只有 `list_quality_controls`、`create_quality_control`、`get_quality_statistics` | `部分覆盖` | 计量管理、报告上传识别、质控详情/更新/删除、不良事件管理未覆盖 | `list_metrology_records`、`get_metrology_record`、`create_metrology_record`、`update_metrology_record`、`delete_metrology_record`、`upload_metrology_report`、`get_quality_control_detail`、`update_quality_control`、`delete_quality_control`、`list_adverse_events`、`create_adverse_event`、`update_adverse_event` | `P1` |
| 验收管理 | `/acceptance`、`/acceptance/create`；`/api/acceptance` | 已有 `list_acceptances`、`create_acceptance` | `部分覆盖` | 详情、修改、删除、审核等动作缺失 | `get_acceptance`、`update_acceptance`、`delete_acceptance`、`approve_acceptance` | `P2` |
| 采购管理 | `/api/procurement` | 已有 `list_procurements`、`create_procurement`、`approve_procurement` | `较完整` | 若后续前端增加更多采购流转动作，还需继续补 | `get_procurement`、`cancel_procurement` | `P2` |
| 用户 / 角色 / 租户 / 审计 / 系统配置 | `/users`、`/roles-permissions`、`/tenants`、`/audit-logs`、`/database-connection`；`/api/users`、`/api/roles-permissions`、`/api/tenants`、`/api/audit-logs`、`/api/system-config` | 已有用户、角色权限、租户列表/配置、审计日志、数据库配置基础工具 | `部分覆盖` | 部门 CRUD、租户创建修改删除、更多系统管理动作未覆盖 | `create_department`、`update_department`、`delete_department`、`create_tenant`、`update_tenant`、`delete_tenant` | `P1` |
| 模块管理高级能力 | `/modules`；`/api/module-configs` | 已补 `list_modules`（对齐租户模块配置列表）、`get_module_config`、`validate_module_config`、`update_module_config`、`enable_module`、`disable_module`、`list/create/rollback/compare/delete_module_version`、`backup/restore_module_config`、`list/update_module_menus` | `较完整` | 模块依赖图、冲突检查、运行状态、运行日志等仍停留在 `moduleAPI` 侧，尚未通过 MCP 覆盖 | `get_module_dependencies`、`check_module_conflicts`、`get_module_status`、`list_module_logs` | `P1` |
| 仪表盘配置 / 云同步 / 备份 / 集成通道 | `/dashboard-configs`、`/cloud-sync`、`/integration`；`/api/dashboard-configs`、`/api/cloud-sync`、`/api/backup`、`/api/integration`、`/api/message-integration` | 无 | `未覆盖` | 这些后台管理能力没有 MCP 工具 | `list_dashboard_configs`、`create_dashboard_config`、`update_dashboard_config`、`delete_dashboard_config`、`list_cloud_sync_jobs`、`run_backup`、`list_backups`、`restore_backup`、`list_integration_channels`、`update_integration_channel` | `P2` |
| 风险管理 | `/risk`、`/risk/assessment`；`/api/risk` | 已修复 `get_asset_risk_assessment`、`get_high_risk_assets`，并补 `get_risk_dashboard`、`list_risk_controls`、`update_risk_control` | `部分覆盖` | 风险查询与控制更新已接通，但风险评估/控制的创建、删除和更完整生命周期仍未通过 MCP 暴露 | `create_risk_assessment`、`update_risk_assessment`、`delete_risk_assessment`、`create_risk_control`、`delete_risk_control` | `P1` |
| 人员资质 | `/staff`、`/staff/qualifications`、`/staff/training`；`/api/staff` | 无 | `未覆盖` | 资格证、培训、考核等人员资质管理未接入 | `get_staff_dashboard`、`list_qualifications`、`create_qualification`、`update_qualification`、`delete_qualification`、`list_training_records`、`create_training_record`、`update_training_record`、`delete_training_record` | `P2` |
| 开机率管理 | `/uptime`、`/uptime/operation-logs`、`/uptime/statistics`；`/api/uptime` | 无 | `未覆盖` | 开机率概览、运行日志、统计全部未接入 | `get_uptime_dashboard`、`list_operation_logs`、`create_operation_log`、`update_operation_log`、`delete_operation_log`、`list_uptime_statistics` | `P2` |
| 材料 / 条码 / 位置编码等边缘模块 | `/api/materials`、`/api/barcode-scan`、`/api/location-codes` | 无 | `未覆盖` | 材料库存、维修领用、条码校验、位置编码管理未接入 | `list_materials`、`create_material`、`list_material_transactions`、`create_material_requirement`、`issue_material_requirement`、`verify_barcode`、`generate_barcode`、`list_location_codes` | `P2` |

---

## 4. 明确存在“工具定义了，但实际不可用”的项

下面这些功能不能算“已覆盖”，因为当前 handler 明确返回 `featureUnavailableError`：

| 工具 | 当前状态 | 说明 |
| --- | --- | --- |
| `get_todo_tasks` | 不可用 | 当前后端未暴露 `/api/workflow/tasks/todo`，[tool_handlers.go](/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/tool_handlers.go#L1185) |
| `complete_task` | 不可用 | 当前后端未暴露 `/api/workflow/tasks/:id/complete`，[tool_handlers.go](/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/tool_handlers.go#L1190) |
| `get_environment_records` | 不可用 | 该名字对应的“通用环境记录列表”接口在主服务中并不存在；应改用 `get_environment_latest_by_device`、`get_environment_latest_by_asset` 或 `get_environment_asset_series`，[tool_handlers.go](/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/tool_handlers.go#L7381) |
| `get_environment_alerts` | 不可用 | 该名字对应的“通用环境告警列表”接口在主服务中并不存在；位置告警请改用 `list_location_alerts`，环境监测请改用新的 `get_environment_*` 工具，[tool_handlers.go](/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/tool_handlers.go#L7385) |
| `get_ai_maintenance_prediction` | 不可用 | 后端没有独立 prediction 接口，[tool_handlers.go](/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/tool_handlers.go#L5007) |
| `get_ai_failure_analysis` | 不可用 | 当前接线说明过时，[tool_handlers.go](/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/tool_handlers.go#L5011) |
| `get_predictive_maintenance` | 不可用 | 依赖接口未接入主服务，[tool_handlers.go](/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/tool_handlers.go#L5023) |
| `get_asset_health_index` | 不可用 | 相关接口未挂载，[tool_handlers.go](/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/tool_handlers.go#L5027) |
| `get_department_health_overview` | 不可用 | 相关接口未挂载，[tool_handlers.go](/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/tool_handlers.go#L5031) |

---

## 5. 建议优先级排期

### 5.1 P0：先让 OpenClaw 具备“主应用核心操作力”

建议第一批优先补这些：

1. 修复风险模块与所有“定义了但不可用”的工具
2. 临时资产 / 质量管理高频缺口
3. 临时资产与质量管理高频缺口
4. 技术资料的 AI / 分类 / 历史统计收尾能力
5. 用户 / 租户 / 部门更多写操作

理由：

- 这些模块用户在主应用里真实使用频率高
- 这些模块是 AI 助手最容易被问到“帮我查 / 帮我改 / 帮我处理”的区域
- 这些缺口会直接导致 OpenClaw 只能回答一半，或者必须退回“请到页面操作”

### 5.2 P1：补齐高频业务边界

第二批建议补：

1. 标签模板与打印
2. 位置模块收尾：手动资产位置更新 / 批量资产位置查询 / 单条 zone ingest
3. 质量管理中的计量、不良事件
4. 临时资产
5. 用户 / 租户 / 部门更多写操作

### 5.3 P2：补齐后台支撑模块

第三批建议补：

1. 仪表盘配置
2. 云同步 / 备份 / 集成通道
3. 开机率管理
4. 人员资质
5. 材料管理、条码扫描等边缘能力

---

## 6. 最小可执行补齐顺序

如果只按“最少开发成本，最快提升 AI 可用性”的思路，推荐按下面顺序做：

1. 修复当前失效工具
2. 补位置模块收尾能力：手动资产位置更新 / 批量资产位置查询 / 单条 zone ingest
3. 补质量管理中的计量 / 不良事件
4. 补临时资产和后台管理型模块
5. 补技术资料 AI、分类、历史统计等收尾能力
6. 补用户 / 租户 / 部门更多写操作
7. 再补标签打印、开机率、人员资质和运维类模块

---

## 7. 一句话结论

当前 `mcp-assethub` 已经足够支撑 OpenClaw 处理 **部分核心资产问题**，但还不足以让 OpenClaw 成为“可以替代用户在主应用里完成大多数操作”的统一入口。

如果目标是让 OpenClaw 真正成为主应用级 AI 操作层，就需要按本文档的矩阵继续补 MCP。
