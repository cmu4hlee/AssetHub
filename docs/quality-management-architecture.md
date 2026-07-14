# 质量管理系统模块化架构设计文档

## 1. 架构概述

本设计将质量管理系统划分为三个核心功能模块，通过明确定义的接口进行通信，确保低耦合性。

### 1.1 模块划分

| 模块名称 | 模块ID | 模块类型 | 主要职责 |
|---------|--------|---------|----------|
| 计量与质量控制模块 | quality-control | business | 计量标准管理、质量检测流程、数据采集与分析 |
| 不良事件管理模块 | adverse-event | business | 事件上报、分类分级、处理流程跟踪、根本原因分析及预防措施管理 |
| 系统公共模块 | quality-common | core | 用户权限管理、数据字典、日志记录等基础支撑功能 |

### 1.2 设计原则

- **低耦合性**：模块间通过明确定义的接口通信，任何模块的修改不应影响其他模块的正常运行
- **高内聚性**：每个模块专注于自己的核心功能，职责清晰
- **可扩展性**：采用面向对象设计原则，确保代码可维护性和可扩展性
- **数据独立性**：数据库设计考虑模块间数据关联，同时保持数据独立性
- **可测试性**：各模块具备独立的单元测试和集成测试用例

## 2. 模块详细设计

### 2.1 计量与质量控制模块 (quality-control)

#### 2.1.1 核心功能
- 计量标准管理
- 质量检测流程
- 数据采集与分析
- 质量控制记录管理
- 计量器具管理

#### 2.1.2 目录结构

```
backend/modules/quality-control/
├── config/
│   └── module.config.js       # 模块配置文件
├── services/
│   ├── metrology.service.js    # 计量器具服务
│   ├── quality-control.service.js  # 质量控制服务
│   └── data-analysis.service.js    # 数据分析服务
├── models/
│   ├── metrology.model.js      # 计量器具模型
│   ├── quality-control.model.js    # 质量控制模型
│   └── data-analysis.model.js  # 数据分析模型
└── routes/
    └── quality-control.js      # 路由定义
```

#### 2.1.3 服务接口

**IMetrologyService**
- `getMetrologyById(id)` - 根据ID获取计量器具
- `createMetrology(data)` - 创建计量器具
- `updateMetrology(id, data)` - 更新计量器具
- `deleteMetrology(id)` - 删除计量器具
- `getExpiringMetrology(days)` - 获取即将过期的计量器具
- `getMetrologyStatistics()` - 获取计量器具统计

**IQualityControlService**
- `getQualityControlById(id)` - 根据ID获取质量控制记录
- `createQualityControl(data)` - 创建质量控制记录
- `updateQualityControl(id, data)` - 更新质量控制记录
- `deleteQualityControl(id)` - 删除质量控制记录
- `getQualityControlStatistics()` - 获取质量控制统计
- `getAssetQualityHistory(assetCode)` - 获取资产质量历史

**IDataAnalysisService**
- `analyzeQualityTrend(params)` - 分析质量趋势
- `analyzeDefectDistribution(params)` - 分析缺陷分布
- `generateQualityReport(params)` - 生成质量报告

#### 2.1.4 数据模型

**核心数据表**
- `quality_control_records` - 质量控制记录
- `quality_control_attachments` - 质量控制附件
- `quality_management_cycles` - 质量管理周期
- `metrology_instruments` - 计量器具（新增）
- `metrology_calibration_records` - 计量校准记录（新增）

### 2.2 不良事件管理模块 (adverse-event)

#### 2.2.1 核心功能
- 事件上报
- 分类分级
- 处理流程跟踪
- 根本原因分析
- 预防措施管理

#### 2.2.2 目录结构

```
backend/modules/adverse-event/
├── config/
│   └── module.config.js       # 模块配置文件
├── services/
│   ├── adverse-event.service.js   # 不良事件服务
│   ├── workflow.service.js        # 工作流服务
│   └── analysis.service.js        # 分析服务
├── models/
│   ├── adverse-event.model.js     # 不良事件模型
│   ├── workflow.model.js          # 工作流模型
│   └── analysis.model.js          # 分析模型
└── routes/
    └── adverse-event.js           # 路由定义
```

#### 2.2.3 服务接口

**IAdverseEventService**
- `getAdverseEventById(id)` - 根据ID获取不良事件
- `createAdverseEvent(data)` - 创建不良事件
- `updateAdverseEvent(id, data)` - 更新不良事件
- `deleteAdverseEvent(id)` - 删除不良事件
- `getAdverseEventStatistics()` - 获取不良事件统计

**IWorkflowService**
- `startWorkflow(eventId, data)` - 启动工作流
- `updateWorkflowStatus(workflowId, status)` - 更新工作流状态
- `getWorkflowHistory(eventId)` - 获取工作流历史
- `getPendingWorkflows()` - 获取待处理工作流

**IAnalysisService**
- `analyzeRootCause(eventId, data)` - 分析根本原因
- `generatePreventiveMeasures(eventId, data)` - 生成预防措施
- `analyzeEventTrends(params)` - 分析事件趋势
- `generateRiskAssessment(eventId)` - 生成风险评估

#### 2.2.4 数据模型

**核心数据表**
- `adverse_reaction_records` - 不良事件记录
- `adverse_reaction_attachments` - 不良事件附件
- `adverse_reaction_workflow` - 不良事件工作流
- `root_cause_analyses` - 根本原因分析（新增）
- `preventive_measures` - 预防措施（新增）

### 2.3 系统公共模块 (quality-common)

#### 2.3.1 核心功能
- 用户权限管理
- 数据字典
- 日志记录
- 系统配置
- 通知管理

#### 2.3.2 目录结构

```
backend/modules/quality-common/
├── config/
│   └── module.config.js       # 模块配置文件
├── services/
│   ├── permission.service.js     # 权限服务
│   ├── data-dictionary.service.js  # 数据字典服务
│   ├── logger.service.js          # 日志服务
│   └── notification.service.js    # 通知服务
├── models/
│   ├── permission.model.js        # 权限模型
│   ├── data-dictionary.model.js   # 数据字典模型
│   ├── log.model.js               # 日志模型
│   └── notification.model.js      # 通知模型
└── routes/
    └── quality-common.js          # 路由定义
```

#### 2.3.3 服务接口

**IPermissionService**
- `checkPermission(userId, permission)` - 检查用户权限
- `getUserPermissions(userId)` - 获取用户权限
- `assignPermission(userId, permission)` - 分配权限
- `revokePermission(userId, permission)` - 撤销权限

**IDataDictionaryService**
- `getDictionaryItems(category)` - 获取数据字典项
- `createDictionaryItem(data)` - 创建数据字典项
- `updateDictionaryItem(id, data)` - 更新数据字典项
- `deleteDictionaryItem(id)` - 删除数据字典项

**ILoggerService**
- `logAction(userId, action, details)` - 记录操作日志
- `getLogs(params)` - 获取日志记录
- `getLogStatistics()` - 获取日志统计

**INotificationService**
- `sendNotification(userId, message, type)` - 发送通知
- `getUserNotifications(userId)` - 获取用户通知
- `markNotificationAsRead(notificationId)` - 标记通知为已读

#### 2.3.4 数据模型

**核心数据表**
- `quality_permissions` - 质量系统权限（新增）
- `quality_data_dictionary` - 质量系统数据字典（新增）
- `quality_logs` - 质量系统日志（新增）
- `quality_notifications` - 质量系统通知（新增）

## 3. 模块间依赖关系

### 3.1 依赖矩阵

| 模块 | 依赖模块 | 依赖类型 | 版本要求 |
|------|---------|---------|----------|
| quality-control | quality-common | required | 1.0.0+ |
| quality-control | asset-management | required | 1.0.0+ |
| quality-control | user-management | required | 1.0.0+ |
| adverse-event | quality-common | required | 1.0.0+ |
| adverse-event | asset-management | required | 1.0.0+ |
| adverse-event | user-management | required | 1.0.0+ |
| quality-common | user-management | required | 1.0.0+ |
| quality-common | department-management | optional | 1.0.0+ |

### 3.2 通信接口

模块间通过标准化的服务接口进行通信，具体如下：

#### 3.2.1 quality-control → quality-common
- `IPermissionService` - 权限检查
- `IDataDictionaryService` - 获取质量相关数据字典
- `ILoggerService` - 记录质量控制操作日志
- `INotificationService` - 发送质量控制相关通知

#### 3.2.2 adverse-event → quality-common
- `IPermissionService` - 权限检查
- `IDataDictionaryService` - 获取不良事件相关数据字典
- `ILoggerService` - 记录不良事件操作日志
- `INotificationService` - 发送不良事件相关通知

#### 3.2.3 quality-control → asset-management
- `IAssetService` - 获取资产信息
- `IAssetCategoryService` - 获取资产分类信息

#### 3.2.4 adverse-event → asset-management
- `IAssetService` - 获取资产信息

## 4. 数据库设计

### 4.1 数据关联设计

**模块间数据关联**
- `quality_control_records.asset_code` → `assets.asset_code`
- `adverse_reaction_records.asset_code` → `assets.asset_code`
- `quality_control_records.created_by` → `users.id`
- `adverse_reaction_records.created_by` → `users.id`
- `quality_permissions.user_id` → `users.id`

**模块内数据关联**
- `quality_control_attachments.qc_id` → `quality_control_records.id`
- `adverse_reaction_attachments.event_id` → `adverse_reaction_records.id`
- `adverse_reaction_workflow.event_id` → `adverse_reaction_records.id`
- `root_cause_analyses.event_id` → `adverse_reaction_records.id`
- `preventive_measures.analysis_id` → `root_cause_analyses.id`

### 4.2 数据独立性保障

- **表前缀**：每个模块的数据表使用模块特定的前缀
- **外键约束**：使用软外键（通过应用层验证）而非硬外键
- **数据访问**：模块只能访问自己的数据表和明确授权的其他模块数据表
- **事务边界**：每个模块的操作在独立的事务中执行

## 5. 配置管理

### 5.1 模块配置选项

**quality-control 模块配置**
- `enable_metrology_management` - 是否启用计量管理
- `enable_quality_control` - 是否启用质量控制
- `metrology_calibration_days` - 计量校准提前提醒天数
- `quality_inspection_frequency` - 质量检查频率
- `data_retention_period` - 数据保留期限

**adverse-event 模块配置**
- `enable_adverse_event` - 是否启用不良事件管理
- `event_reporting_channels` - 事件上报渠道
- `severity_levels` - 严重程度级别定义
- `workflow_timeout_days` - 工作流超时天数
- `analysis_retention_period` - 分析记录保留期限

**quality-common 模块配置**
- `enable_permission_management` - 是否启用权限管理
- `enable_data_dictionary` - 是否启用数据字典
- `enable_logging` - 是否启用日志记录
- `enable_notifications` - 是否启用通知功能
- `log_retention_days` - 日志保留天数

### 5.2 配置管理流程

1. 模块启动时加载默认配置
2. 租户管理员可以通过管理界面修改配置
3. 配置变更通过版本控制记录
4. 支持配置的回滚和恢复

## 6. 测试策略

### 6.1 单元测试

**测试覆盖范围**
- 服务层接口测试
- 数据访问层测试
- 业务逻辑测试
- 异常处理测试

**测试框架**
- Mocha + Chai
- Sinon 用于模拟依赖
- Istanbul 用于代码覆盖率分析

### 6.2 集成测试

**测试场景**
- 模块间接口调用测试
- 数据库操作集成测试
- API 端点集成测试
- 工作流集成测试

**测试环境**
- 独立的测试数据库
- 模拟的外部依赖服务
- 标准化的测试数据

### 6.3 代码覆盖率要求

- 单元测试覆盖率：≥85%
- 集成测试覆盖率：≥80%
- 总体代码覆盖率：≥80%

## 7. 部署与集成

### 7.1 部署策略

- **容器化部署**：每个模块可以独立部署
- **模块化启动**：支持按需启动模块
- **版本管理**：每个模块有独立的版本号
- **依赖管理**：自动处理模块间依赖关系

### 7.2 集成流程

1. 模块注册到系统模块管理中心
2. 系统验证模块依赖关系
3. 加载模块配置和服务
4. 初始化模块数据结构
5. 启动模块服务

## 8. 监控与维护

### 8.1 监控指标

- **服务健康状态**：模块服务的运行状态
- **接口调用频率**：API 接口的调用次数和响应时间
- **错误率**：模块操作的错误率
- **数据量增长**：模块数据表的大小和增长趋势

### 8.2 维护策略

- **日志管理**：集中化的日志收集和分析
- **性能优化**：定期的性能分析和优化
- **安全审计**：定期的安全检查和漏洞扫描
- **备份策略**：模块数据的定期备份

## 9. 结论

本设计通过模块化架构将质量管理系统划分为三个核心功能模块，实现了低耦合、高内聚的系统架构。每个模块具备明确的职责边界、独立的代码组织结构、专用的数据模型和标准化的接口定义。

该架构设计不仅满足了当前的业务需求，还为未来的功能扩展和技术升级提供了良好的基础。通过严格的测试策略和代码质量要求，确保了系统的可靠性和可维护性。