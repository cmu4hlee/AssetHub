# 模块分类优化建议方案

## 一、当前分类存在的问题

### 1. 分类粒度不一致
- **物联与定位**：5个模块，过于分散，子模块过多
- **系统基础**：4个模块，较为合理
- **质量与安全** vs **质量与合规**：边界不清，容易混淆

### 2. 模块归属不合理
- `asset-risk-management`（设备风险管理）归类在"质量与安全"，但更符合"合规性管理"范畴
- `uptime-management`（开机率管理）归类在"分析与统计"，但更应属于"设备运维"

### 3. 命名不统一
- `asset-management` 实际为"库存管理"，但名称易引起歧义
- `quality-common` 名称过于抽象

### 4. 重复功能
- `iot-management` 与多个子模块功能存在交叉
- `maintenance-management` 和 `preventive-maintenance-management` 可进一步整合

---

## 二、建议的分类体系

### 🏛️ 第一层：基础支撑层（4个模块）
```
基础支撑
├── 用户中心 (user-management)          # 用户、角色、权限
├── 组织架构 (department-management)    # 部门、科室管理
├── 消息中心 (message-integration)      # 通知、消息、集成
└── 平台公共 (platform-common)          # 原 quality-common，更名
```

### 📦 第二层：资产核心层（5个模块）
```
资产核心
├── 资产台账 (asset-management)         # 资产全生命周期管理
├── 资产标签 (label-management)         # 标签模板与打印
├── 采购管理 (procurement-management)   # 采购申请到验收
├── 资产调配 (transfer-management)      # 调拨、借用、归还
└── 资产报废 (disposal-management)      # 报废申请与处置
```

### 🔧 第三层：运维管理层（6个模块）
```
运维管理
├── 维修工单 (maintenance-management)       # 日常维修、报修
├── 预防维护 (preventive-maintenance)       # 计划性维护
├── 计量质控 (metrology-management)         # 原 quality-control，更名
├── 分级保养 (graded-maintenance)           # 原 compliance-management-保养部分
├── 设备巡检 (inspection-management)        # 巡检计划与执行
└── 开机率管理 (uptime-management)          # 从"分析与统计"移入
```

### ⚠️ 第四层：安全合规层（4个模块）
```
安全合规
├── 合规管理 (compliance-management)        # 规范合规、文档管理
├── 风险评估 (risk-management)              # 原 asset-risk-management
├── 特种设备 (special-equipment)            # 原 compliance-management-特种设备
├── 不良事件 (adverse-event-management)     # 安全事件管理
└── 人员资质 (staff-qualification)          # 从"人力资源"移入
```

### 🤖 第五层：智能物联层（4个模块）
```
智能物联
├── IoT平台 (iot-platform)                  # 合并原 iot-management
├── 资产定位 (asset-location)               # 合并原 iot-geo-location + iot-zone-location
├── 环境监测 (environment-monitoring)       # 原 iot-environment-monitoring
└── 设备监测 (device-monitoring)            # 原 iot-asset-monitoring
```

### 🧠 第六层：智能应用层（3个模块）
```
智能应用
├── AI助手 (ai-assistant)                   # 原 asset-ai-assistant
├── CT维护助手 (ct-maintenance-assistant)   # 专用助手
└── 业务助手 (business-ops-assistant)       # 业务操作助手
```

### 📊 第七层：分析决策层（3个模块）
```
分析决策
├── 资产分析 (asset-analytics)              # 资产数据统计分析
├── 成本管理 (cost-management)              # 原 depreciation-management 扩展
└── 质控分析 (quality-analytics)            # 原 quality-assurance-management
```

---

## 三、模块调整建议

### 1. 模块合并建议

| 原模块 | 建议合并到 | 说明 |
|--------|-----------|------|
| `iot-management` | `iot-platform` | 作为IoT核心平台 |
| `iot-geo-location-management` | `asset-location` | 合并定位功能 |
| `iot-zone-location-management` | `asset-location` | 合并定位功能 |
| `iot-asset-monitoring-management` | `device-monitoring` | 设备监测统一 |
| `iot-environment-monitoring-management` | `environment-monitoring` | 环境监测 |

### 2. 模块拆分建议

| 原模块 | 拆分建议 | 说明 |
|--------|---------|------|
| `compliance-management` | 拆分为 `graded-maintenance` + `special-equipment` + `safety-inspection` + `compliance-docs` | 功能过于庞大 |

### 3. 模块更名建议

| 原名称 | 建议名称 | 原因 |
|--------|---------|------|
| `asset-management` | `asset-registry` 或 `asset-core` | 避免"库存"歧义 |
| `quality-common` | `platform-common` | 名称更直观 |
| `quality-control` | `metrology-management` | 实际为计量管理 |
| `quality-assurance-management` | `quality-analytics` | 实际是质控分析 |

### 4. 分类调整建议

| 模块 | 原分类 | 建议分类 | 原因 |
|------|--------|---------|------|
| `uptime-management` | 分析与统计 | 运维管理 | 属于设备运维范畴 |
| `asset-risk-management` | 质量与安全 | 安全合规 | 属于合规管理 |
| `staff-qualification` | 人力资源 | 安全合规 | 属于合规要求 |
| `compliance-management` | 质量与合规 | 安全合规 | 统一合规管理 |

---

## 四、依赖关系优化建议

### 核心依赖原则
```
基础支撑层 ← 被所有层依赖
资产核心层 ← 被运维、合规、物联层依赖
运维管理层 ← 被分析决策层依赖
```

### 建议的依赖关系
```yaml
# 基础支撑
platform-common:
  dependencies: []

user-management:
  dependencies: [platform-common]

department-management:
  dependencies: [platform-common]

# 资产核心
asset-management:
  dependencies: [user-management, department-management]

# 运维管理
maintenance-management:
  dependencies: [asset-management, user-management]

metrology-management:  # 原 quality-control
  dependencies: [asset-management, platform-common]

# 安全合规
compliance-management:
  dependencies: [asset-management, maintenance-management]

risk-management:  # 原 asset-risk-management
  dependencies: [asset-management, compliance-management]

staff-qualification:
  dependencies: [user-management, compliance-management]

# 智能物联
iot-platform:
  dependencies: [asset-management]
```

---

## 五、实施建议

### 阶段一：命名和分类调整（低风险）
1. 更新模块分类字段
2. 调整前端菜单结构
3. 更新文档和Swagger

### 阶段二：模块合并（中风险）
1. 数据迁移
2. 接口兼容层
3. 前端路由调整

### 阶段三：架构重构（高风险）
1. 微服务拆分
2. 数据库重构
3. API网关调整

---

## 六、推荐的新分类实施

基于当前系统现状，推荐采用渐进式优化，优先实施分类调整：

```javascript
// 建议的新分类配置
const NEW_CATEGORIES = {
  '基础支撑': 'foundation',
  '资产核心': 'asset-core',
  '运维管理': 'operations',
  '安全合规': 'compliance',
  '智能物联': 'iot',
  '智能应用': 'ai',
  '分析决策': 'analytics'
};
```

这样可以：
1. 保持现有模块不动，降低风险
2. 重新梳理菜单和导航结构
3. 为未来微服务拆分奠定基础
