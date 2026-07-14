# 资产管理系统模块化架构设计文档

## 1. 架构概述

### 1.1 设计目标
- **模块化拆分**：将现有功能模块化，实现低耦合、高内聚
- **租户级配置**：支持租户根据业务需求灵活选择和配置功能模块
- **动态加载**：支持模块的动态加载、初始化、监控和卸载
- **依赖管理**：自动检测和管理模块间的依赖关系
- **配置管理**：实现配置版本控制和备份恢复

### 1.2 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                    前端展示层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  租户模块配置  │  │  模块管理界面  │  │  配置版本管理  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    API网关层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  模块注册API  │  │  配置管理API  │  │  依赖检查API  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   模块管理层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  模块注册中心  │  │  生命周期管理  │  │  依赖关系管理  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   业务模块层                                │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│  │资产│ │维护│ │调配│ │盘点│ │质控│ │AI  │ │其他│     │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   数据存储层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  模块元数据   │  │  租户配置     │  │  配置版本     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 2. 模块元数据结构

### 2.1 模块基本信息

```typescript
interface ModuleMetadata {
  // 基本信息
  id: string;                    // 模块唯一标识
  name: string;                  // 模块名称
  version: string;                // 模块版本（语义化版本）
  description: string;            // 模块描述
  category: ModuleCategory;       // 模块分类
  type: ModuleType;              // 模块类型
  status: ModuleStatus;          // 模块状态
  author: string;                // 作者
  created_at: Date;             // 创建时间
  updated_at: Date;             // 更新时间

  // 依赖和兼容性
  dependencies: ModuleDependency[];  // 依赖的模块列表
  compatibility: CompatibilityRule[]; // 版本兼容性规则
  resource_dependencies: ResourceDependency[]; // 资源依赖

  // 前端配置
  frontend_config: {
    menu_routes: MenuRoute[];    // 菜单路由配置
    components: ComponentConfig[]; // 组件配置
    permissions: string[];       // 所需权限
  };

  // 后端配置
  backend_config: {
    api_endpoints: ApiEndpoint[]; // API端点配置
    database_tables: string[];    // 数据库表
    services: ServiceConfig[];    // 服务配置
    permissions: string[];       // 所需权限
  };

  // 配置项
  config_schema: ConfigSchema[];  // 配置项定义
  default_config: Record<string, any>; // 默认配置

  // 接口定义
  interfaces: ModuleInterface[]; // 模块接口
}
```

### 2.2 模块分类

```typescript
enum ModuleCategory {
  ASSET_MANAGEMENT = 'asset_management',      // 资产管理
  MAINTENANCE = 'maintenance',              // 维护管理
  TRANSFER = 'transfer',                    // 资产调配
  INVENTORY = 'inventory',                  // 资产盘点
  QUALITY_CONTROL = 'quality_control',      // 质量控制
  AI_TOOLS = 'ai_tools',                   // AI工具
  SYSTEM = 'system',                       // 系统管理
  INTEGRATION = 'integration',              // 集成模块
}
```

### 2.3 模块类型

```typescript
enum ModuleType {
  CORE = 'core',           // 核心模块（必需）
  BUSINESS = 'business',   // 业务模块
  INTEGRATION = 'integration', // 集成模块
  EXTENSION = 'extension',  // 扩展模块
}
```

### 2.4 模块状态

```typescript
enum ModuleStatus {
  DEVELOPMENT = 'development',   // 开发中
  TESTING = 'testing',          // 测试中
  STABLE = 'stable',            // 稳定
  DEPRECATED = 'deprecated',     // 已废弃
  DISABLED = 'disabled',        // 已禁用
}
```

### 2.5 模块依赖

```typescript
interface ModuleDependency {
  module_id: string;           // 依赖的模块ID
  min_version?: string;        // 最低版本要求
  max_version?: string;        // 最高版本限制
  type: DependencyType;        // 依赖类型
}

enum DependencyType {
  REQUIRED = 'required',      // 必需依赖
  OPTIONAL = 'optional',      // 可选依赖
  CONFLICT = 'conflict',      // 冲突依赖
}
```

### 2.6 配置项定义

```typescript
interface ConfigSchema {
  key: string;                // 配置项键
  name: string;               // 显示名称
  description: string;         // 描述
  type: ConfigType;           // 配置项类型
  default_value: any;         // 默认值
  required: boolean;          // 是否必需
  validation?: ValidationRule; // 验证规则
  options?: ConfigOption[];    // 选项（用于select类型）
}

enum ConfigType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  JSON = 'json',
}

interface ConfigOption {
  label: string;
  value: any;
  description?: string;
}
```

### 2.7 模块接口

```typescript
interface ModuleInterface {
  name: string;               // 接口名称
  type: InterfaceType;        // 接口类型
  definition: string;         // 接口定义
  description: string;        // 接口描述
}

enum InterfaceType {
  LIFECYCLE = 'lifecycle',   // 生命周期接口
  DATA = 'data',             // 数据接口
  EVENT = 'event',           // 事件接口
  UI = 'ui',                // UI接口
}
```

## 3. 模块接口标准

### 3.1 生命周期接口

```typescript
interface ModuleLifecycle {
  // 初始化
  async initialize(config?: Record<string, any>): Promise<void>;
  
  // 启动
  async start(): Promise<void>;
  
  // 停止
  async stop(): Promise<void>;
  
  // 配置更新
  async updateConfig(config: Record<string, any>): Promise<void>;
  
  // 健康检查
  async healthCheck(): Promise<HealthStatus>;
  
  // 卸载
  async uninstall(): Promise<void>;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  metrics?: Record<string, any>;
}
```

### 3.2 数据接口

```typescript
interface ModuleDataInterface {
  // 数据查询
  async query(params: QueryParams): Promise<any>;
  
  // 数据创建
  async create(data: any): Promise<any>;
  
  // 数据更新
  async update(id: string, data: any): Promise<any>;
  
  // 数据删除
  async delete(id: string): Promise<void>;
  
  // 数据导入
  async import(data: any[]): Promise<ImportResult>;
  
  // 数据导出
  async export(params: ExportParams): Promise<any>;
}
```

### 3.3 事件接口

```typescript
interface ModuleEventInterface {
  // 事件订阅
  subscribe(event: string, handler: EventHandler): void;
  
  // 事件取消订阅
  unsubscribe(event: string, handler: EventHandler): void;
  
  // 事件发布
  publish(event: string, data: any): void;
  
  // 事件监听
  on(event: string, handler: EventHandler): void;
  
  // 事件触发
  emit(event: string, data: any): void;
}
```

## 4. 模块注册中心设计

### 4.1 注册中心职责
- 模块注册与注销
- 模块元数据管理
- 模块状态监控
- 模块依赖解析
- 模块冲突检测

### 4.2 注册中心API

```typescript
interface ModuleRegistry {
  // 注册模块
  register(module: ModuleMetadata): Promise<void>;
  
  // 注销模块
  unregister(moduleId: string): Promise<void>;
  
  // 获取模块信息
  getModule(moduleId: string): Promise<ModuleMetadata>;
  
  // 获取所有模块
  getAllModules(): Promise<ModuleMetadata[]>;
  
  // 获取启用的模块
  getEnabledModules(tenantId?: string): Promise<ModuleMetadata[]>;
  
  // 检查依赖
  checkDependencies(moduleId: string): Promise<DependencyCheckResult>;
  
  // 检查冲突
  checkConflicts(moduleId: string): Promise<ConflictCheckResult>;
  
  // 获取模块状态
  getModuleStatus(moduleId: string): Promise<ModuleStatus>;
  
  // 更新模块状态
  updateModuleStatus(moduleId: string, status: ModuleStatus): Promise<void>;
}
```

## 5. 租户配置管理

### 5.1 租户配置结构

```typescript
interface TenantModuleConfig {
  tenant_id: string;
  module_id: string;
  enabled: boolean;
  config: Record<string, any>;
  version: string;
  enabled_at?: Date;
  disabled_at?: Date;
  created_at: Date;
  updated_at: Date;
}
```

### 5.2 配置管理API

```typescript
interface TenantConfigManager {
  // 启用模块
  enableModule(tenantId: string, moduleId: string, config?: Record<string, any>): Promise<void>;
  
  // 禁用模块
  disableModule(tenantId: string, moduleId: string): Promise<void>;
  
  // 获取租户配置
  getTenantConfig(tenantId: string): Promise<TenantModuleConfig[]>;
  
  // 更新模块配置
  updateModuleConfig(tenantId: string, moduleId: string, config: Record<string, any>): Promise<void>;
  
  // 获取模块配置
  getModuleConfig(tenantId: string, moduleId: string): Promise<Record<string, any>>;
  
  // 验证配置
  validateConfig(moduleId: string, config: Record<string, any>): Promise<ValidationResult>;
}
```

## 6. 配置版本控制

### 6.1 版本控制结构

```typescript
interface ConfigVersion {
  id: string;
  tenant_id: string;
  module_id: string;
  version: string;
  config: Record<string, any>;
  change_log: string;
  created_by: string;
  created_at: Date;
  is_current: boolean;
}
```

### 6.2 版本控制API

```typescript
interface ConfigVersionManager {
  // 创建版本
  createVersion(tenantId: string, moduleId: string, config: Record<string, any>, changeLog: string): Promise<ConfigVersion>;
  
  // 获取版本历史
  getVersionHistory(tenantId: string, moduleId: string): Promise<ConfigVersion[]>;
  
  // 获取当前版本
  getCurrentVersion(tenantId: string, moduleId: string): Promise<ConfigVersion>;
  
  // 回滚版本
  rollbackVersion(tenantId: string, moduleId: string, versionId: string): Promise<void>;
  
  // 对比版本
  compareVersions(versionId1: string, versionId2: string): Promise<ConfigDiff>;
  
  // 删除版本
  deleteVersion(versionId: string): Promise<void>;
}
```

## 7. 数据库设计

### 7.1 模块元数据表

```sql
CREATE TABLE `system_modules` (
  `id` VARCHAR(50) PRIMARY KEY COMMENT '模块ID',
  `name` VARCHAR(100) NOT NULL COMMENT '模块名称',
  `version` VARCHAR(20) NOT NULL COMMENT '模块版本',
  `description` TEXT COMMENT '模块描述',
  `category` VARCHAR(50) NOT NULL COMMENT '模块分类',
  `type` VARCHAR(20) NOT NULL COMMENT '模块类型',
  `status` VARCHAR(20) NOT NULL COMMENT '模块状态',
  `author` VARCHAR(100) COMMENT '作者',
  `dependencies` JSON COMMENT '依赖关系',
  `compatibility` JSON COMMENT '兼容性规则',
  `frontend_config` JSON COMMENT '前端配置',
  `backend_config` JSON COMMENT '后端配置',
  `config_schema` JSON COMMENT '配置项定义',
  `default_config` JSON COMMENT '默认配置',
  `interfaces` JSON COMMENT '接口定义',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`),
  INDEX `idx_status` (`status`),
  INDEX `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统模块元数据表';
```

### 7.2 租户模块配置表

```sql
CREATE TABLE `tenant_module_configs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT NOT NULL COMMENT '租户ID',
  `module_id` VARCHAR(50) NOT NULL COMMENT '模块ID',
  `enabled` TINYINT(1) DEFAULT 0 COMMENT '是否启用',
  `config` JSON COMMENT '模块配置',
  `version` VARCHAR(20) COMMENT '配置版本',
  `enabled_at` TIMESTAMP NULL COMMENT '启用时间',
  `disabled_at` TIMESTAMP NULL COMMENT '禁用时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_tenant_module` (`tenant_id`, `module_id`),
  INDEX `idx_tenant_id` (`tenant_id`),
  INDEX `idx_module_id` (`module_id`),
  INDEX `idx_enabled` (`enabled`),
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`module_id`) REFERENCES `system_modules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户模块配置表';
```

### 7.3 配置版本表

```sql
CREATE TABLE `module_config_versions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT NOT NULL COMMENT '租户ID',
  `module_id` VARCHAR(50) NOT NULL COMMENT '模块ID',
  `version` VARCHAR(20) NOT NULL COMMENT '版本号',
  `config` JSON NOT NULL COMMENT '配置内容',
  `change_log` TEXT COMMENT '变更日志',
  `created_by` VARCHAR(100) COMMENT '创建人',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `is_current` TINYINT(1) DEFAULT 0 COMMENT '是否当前版本',
  INDEX `idx_tenant_module` (`tenant_id`, `module_id`),
  INDEX `idx_version` (`version`),
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`module_id`) REFERENCES `system_modules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模块配置版本表';
```

### 7.4 模块依赖关系表

```sql
CREATE TABLE `module_dependencies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `module_id` VARCHAR(50) NOT NULL COMMENT '模块ID',
  `dependency_module_id` VARCHAR(50) NOT NULL COMMENT '依赖模块ID',
  `dependency_type` VARCHAR(20) NOT NULL COMMENT '依赖类型',
  `min_version` VARCHAR(20) COMMENT '最低版本',
  `max_version` VARCHAR(20) COMMENT '最高版本',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_module_dependency` (`module_id`, `dependency_module_id`),
  INDEX `idx_module_id` (`module_id`),
  INDEX `idx_dependency_module_id` (`dependency_module_id`),
  FOREIGN KEY (`module_id`) REFERENCES `system_modules`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`dependency_module_id`) REFERENCES `system_modules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模块依赖关系表';
```

## 8. 现有模块映射

### 8.1 核心模块
- **资产管理模块** (asset_management)
  - 路由: assets.js
  - 页面: AssetList, AssetForm, AssetDetail
  - 表: assets, asset_categories, asset_images, etc.

- **用户管理模块** (user_management)
  - 路由: users.js
  - 页面: UserList, UserForm
  - 表: users, user_managed_departments

- **部门管理模块** (department_management)
  - 路由: departments.js
  - 页面: DepartmentList, DepartmentForm, DepartmentDetail
  - 表: departments

### 8.2 业务模块
- **维护管理模块** (maintenance)
  - 路由: maintenance.js
  - 页面: MaintenanceLogList, PreventiveMaintenanceList, etc.
  - 表: maintenance_logs, maintenance_templates, preventive_maintenance_plans

- **资产调配模块** (transfer)
  - 路由: transfer.js
  - 页面: TransferList, TransferForm, TransferRequestList
  - 表: transfer_records, asset_transfer_requests

- **资产盘点模块** (inventory)
  - 路由: inventory.js
  - 页面: InventoryList, InventoryForm, InventoryDetail
  - 表: inventory, inventory_details, inventory_records

- **质量控制模块** (quality_control)
  - 路由: quality-control.js
  - 页面: QualityControlList, QualityControlForm, MetrologyList
  - 表: quality_control_records, metrology_records

### 8.3 集成模块
- **AI工具模块** (ai_tools)
  - 路由: asset-ai-analysis.js
  - 页面: AssetAIAnalysis, AIQuestionRecords
  - 表: asset_ai_analysis_logs

- **IoT设备模块** (iot_devices)
  - 路由: iot-devices.js
  - 页面: IoTDeviceManagement, BeaconLocation, AssetLocationMap
  - 表: iot_devices, asset_locations, asset_device_mapping

### 8.4 扩展模块
- **技术文档模块** (technical_documents)
  - 路由: technical-documents.js
  - 页面: TechnicalDocumentsList, TechnicalDocumentsUpload
  - 表: technical_documents, technical_document_asset_relations

- **不良事件模块** (adverse_reaction)
  - 路由: adverse-reaction.js
  - 页面: AdverseReactionList, AdverseReactionForm
  - 表: adverse_reaction_records

- **验收管理模块** (acceptance)
  - 路由: acceptance.js
  - 页面: AcceptanceList, AcceptanceForm
  - 表: acceptance_applications, asset_acceptance_records

## 9. 实施计划

### 阶段一：基础设施（高优先级）
1. 创建数据库表结构
2. 实现模块注册中心
3. 实现生命周期管理
4. 实现依赖关系管理

### 阶段二：配置管理（高优先级）
1. 实现租户配置管理
2. 实现配置版本控制
3. 实现配置备份恢复
4. 开发前端配置界面

### 阶段三：模块迁移（中优先级）
1. 定义现有模块元数据
2. 重构核心模块
3. 重构业务模块
4. 重构集成模块

### 阶段四：优化完善（低优先级）
1. 性能优化
2. 文档完善
3. 测试覆盖
4. 用户培训

## 10. 开发规范

### 10.1 模块开发规范
1. 必须实现生命周期接口
2. 必须定义完整的元数据
3. 必须实现配置验证
4. 必须提供单元测试

### 10.2 接口规范
1. 使用RESTful API设计
2. 统一的错误处理
3. 完整的API文档
4. 版本化管理

### 10.3 数据库规范
1. 使用外键约束
2. 添加适当的索引
3. 数据库迁移脚本
4. 数据备份策略

## 11. 安全考虑

### 11.1 权限控制
- 模块级别的访问控制
- 配置级别的权限控制
- 操作审计日志

### 11.2 数据安全
- 敏感配置加密存储
- 配置传输加密
- 定期安全审计

### 11.3 系统安全
- 模块沙箱隔离
- 资源使用限制
- 恶意模块检测