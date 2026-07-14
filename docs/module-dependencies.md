# 模块依赖关系优化方案

## 依赖层次架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         第一层：基础支撑                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │user-management│  │department-   │  │quality-common│            │
│  │   (用户管理)  │  │management    │  │(平台公共)    │            │
│  │              │  │   (部门管理)  │  │              │            │
│  └──────────────┘  └──────┬───────┘  └──────┬───────┘            │
│                           │                  │                   │
└───────────────────────────┼──────────────────┼───────────────────┘
                            │                  │
┌───────────────────────────┼──────────────────┼───────────────────┐
│                      第二层：资产核心                             │
│                           │                  │                   │
│              ┌────────────▼──────────────────▼──────┐            │
│              │     asset-management (库存管理)       │            │
│              │         所有业务模块的基础             │            │
│              └────────────┬──────────────────────────┘            │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────────┐
│                      第三层：业务应用                             │
│                           │                                      │
│     ┌─────────────────────┼─────────────────────┐                │
│     │                     │                     │                │
│     ▼                     ▼                     ▼                │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐              │
│  │ 运维管理  │      │ 安全合规  │      │ 分析决策  │              │
│  │maintenance│     │ adverse  │      │deprecia- │              │
│  │inventory │      │   event  │      │  tion    │              │
│  │ quality  │      │   risk   │      │assurance │              │
│  └──────────┘      └──────────┘      └──────────┘              │
│                           │                                      │
│              ┌────────────┘                                      │
│              │                                                   │
│              ▼                                                   │
│       ┌──────────────┐                                          │
│       │iot-management│                                          │
│       │ (物联网管理)  │                                          │
│       └──────┬───────┘                                          │
│              │                                                   │
└──────────────┼───────────────────────────────────────────────────┘
               │
┌──────────────┼───────────────────────────────────────────────────┐
│         第四层：IoT子模块（功能扩展）                              │
│              │                                                   │
│     ┌────────┼────────┐                                          │
│     │        │        │                                          │
│     ▼        ▼        ▼                                          │
│  ┌────────┐┌────────┐┌────────┐                                  │
│  │监测模块││定位模块││环境模块│                                  │
│  └────────┘└────────┘└────────┘                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 关键依赖规则

### 1. 基础支撑层
- **user-management**: 无依赖，被所有模块依赖
- **department-management**: 依赖 user-management
- **quality-common**: 依赖 user-management

### 2. 资产核心层
- **asset-management**: 
  - 必需依赖: user-management
  - 可选依赖: department-management
  - 说明: 作为核心资产模块，被几乎所有业务模块依赖

### 3. 业务应用层
依赖关系应符合业务逻辑：
- **inventory** (盘点) → asset-management
- **procurement** (采购) → asset-management
- **maintenance** (维修) → asset-management + user-management
- **quality-control** (计量) → asset-management + quality-common
- **adverse-event** (不良事件) → asset-management + quality-common

### 4. IoT层
- **iot-management**: 依赖 asset-management
- **IoT子模块**: 依赖 iot-management
  - iot-asset-monitoring → iot-management + asset-management
  - iot-environment-monitoring → iot-management
  - iot-geo-location → iot-management + asset-management
  - iot-zone-location → iot-management

## 依赖优化建议

### 1. 循环依赖检查
✅ 当前无循环依赖

### 2. 过度依赖检查
⚠️ 以下模块依赖较多，建议简化：
- quality-control: 依赖 quality-common + asset-management + user-management
  - 建议: 通过 asset-management 间接依赖 user-management

### 3. 缺失依赖检查
✅ 所有业务模块都正确依赖了 asset-management

## 依赖优化后的好处

1. **清晰的层次结构**: 便于理解和维护
2. **模块化部署**: 可按层部署和升级
3. **故障隔离**: 底层故障不会影响上层
4. **便于测试**: 可分层进行单元测试

