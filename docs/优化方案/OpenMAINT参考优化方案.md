# OpenMAINT 参考优化方案

## 一、OpenMAINT 项目特点分析

### 1.1 核心功能模块
OpenMAINT 是一个开源的物业和设施管理系统（FM - Facility Management），主要特点包括：

1. **资产和空间管理**
   - 建筑物、基础设施、技术设备、家具等详细登记
   - 空间层次结构管理（建筑-楼层-房间）
   - 资产分类和属性管理
   - 资产生命周期跟踪

2. **维护管理**
   - 预防性维护（基于时间/使用量/条件的计划）
   - 计划性维护（维护手册驱动）
   - 故障性维护（工单管理）
   - 维护工作流程和审批
   - 维护历史记录

3. **物流和库存管理**
   - 仓库管理
   - 物料清单（BOM）
   - 采购管理
   - 库存预警
   - 物料与维护活动关联

4. **经济管理**
   - 预算管理
   - 维护成本跟踪
   - 供应商管理
   - 合同管理
   - 成本分析和报表

5. **能源和环境管理**
   - 能源消耗记录
   - 计量读数管理
   - 能源效率分析
   - 环境指标监控

6. **GIS 和 BIM 支持**
   - 地理参考系统
   - 地图可视化
   - 2D GIS 矢量布局
   - 3D BIM 模型集成

7. **技术架构**
   - 基于 CMDBuild 平台
   - Java + JavaScript
   - PostgreSQL 数据库
   - 高度可配置和可扩展

---

## 二、当前项目功能对比

### 2.1 已有功能 ✅
- ✅ 资产管理（基础CRUD、分类、状态管理）
- ✅ 资产盘点（记录、明细、差异跟踪）
- ✅ 资产调配（申请、审批、记录）
- ✅ 闲置资产管理
- ✅ 维护日志（基础记录）
- ✅ 资产定位（基础位置信息）
- ✅ 用户和权限管理
- ✅ 部门管理

### 2.2 缺失或待完善功能 ❌
- ❌ 预防性维护计划（已有页面但功能不完整）
- ❌ 工单管理系统
- ❌ 库存/物料管理
- ❌ 供应商管理
- ❌ 合同管理
- ❌ 预算和成本分析
- ❌ 能源管理
- ❌ GIS/BIM 集成
- ❌ 工作流程引擎
- ❌ 高级报表和仪表盘
- ❌ 文档管理
- ❌ 移动端支持

---

## 三、优化补充方案

### 3.1 维护管理增强 ⭐⭐⭐⭐⭐

#### 3.1.1 预防性维护计划完善
**优先级：高**
**参考 OpenMAINT：基于维护手册的工作流程**

**当前状态：**
- 已有 `PreventiveMaintenanceList.jsx` 页面，但功能不完整

**优化方案：**
1. **维护计划模板**
   - 创建可复用的维护计划模板
   - 支持按资产类型、品牌、型号自动匹配模板
   - 模板包含：维护项目、周期、所需物料、工时估算

2. **计划生成和执行**
   - 自动生成维护计划（基于资产购置日期、上次维护日期）
   - 支持多种触发条件：
     - 时间周期（每X月/年）
     - 使用量（运行小时数、使用次数）
     - 条件触发（基于传感器数据）
   - 维护计划自动生成工单

3. **维护执行跟踪**
   - 维护任务分配
   - 执行进度跟踪
   - 维护结果记录（完成、延期、取消）
   - 维护效果评估

**数据库设计：**
```sql
-- 维护计划模板表
CREATE TABLE maintenance_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  asset_type VARCHAR(50),
  brand VARCHAR(100),
  model VARCHAR(100),
  maintenance_items TEXT, -- JSON格式存储维护项目
  cycle_type ENUM('time', 'usage', 'condition'),
  cycle_value INT,
  estimated_hours DECIMAL(10,2),
  required_materials TEXT, -- JSON格式
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 维护计划表（增强）
ALTER TABLE maintenance_plans ADD COLUMN template_id INT;
ALTER TABLE maintenance_plans ADD COLUMN trigger_type ENUM('time', 'usage', 'condition');
ALTER TABLE maintenance_plans ADD COLUMN trigger_value INT;
ALTER TABLE maintenance_plans ADD COLUMN last_maintenance_date DATE;
ALTER TABLE maintenance_plans ADD COLUMN next_maintenance_date DATE;
ALTER TABLE maintenance_plans ADD COLUMN auto_generate_workorder BOOLEAN DEFAULT TRUE;
```

#### 3.1.2 工单管理系统
**优先级：高**
**参考 OpenMAINT：故障性维护工单流程**

**优化方案：**
1. **工单创建**
   - 支持多种来源：故障报修、预防性维护、巡检发现
   - 工单分类：紧急、重要、一般
   - 工单优先级自动计算

2. **工单流程**
   - 工单状态：待分配 → 进行中 → 待验收 → 已完成 → 已关闭
   - 工单分配（自动/手动）
   - 工单审批流程
   - 工单转派

3. **工单执行**
   - 执行人员记录
   - 工时记录
   - 物料消耗记录
   - 故障原因分析
   - 解决方案记录

4. **工单验收**
   - 验收标准
   - 验收结果
   - 满意度评价

**数据库设计：**
```sql
-- 工单表
CREATE TABLE work_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  work_order_no VARCHAR(50) UNIQUE NOT NULL,
  asset_id INT,
  maintenance_plan_id INT, -- 关联维护计划
  source_type ENUM('fault', 'preventive', 'inspection', 'other'),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  priority ENUM('low', 'normal', 'high', 'urgent'),
  status ENUM('pending', 'assigned', 'in_progress', 'pending_acceptance', 'completed', 'closed', 'cancelled'),
  assigned_to INT, -- 执行人
  assigned_at DATETIME,
  started_at DATETIME,
  completed_at DATETIME,
  accepted_at DATETIME,
  accepted_by INT,
  estimated_hours DECIMAL(10,2),
  actual_hours DECIMAL(10,2),
  fault_cause TEXT,
  solution TEXT,
  acceptance_result ENUM('passed', 'failed', 'partial'),
  satisfaction_score INT, -- 1-5分
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
);

-- 工单物料消耗表
CREATE TABLE work_order_materials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  work_order_id INT NOT NULL,
  material_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20),
  unit_price DECIMAL(10,2),
  total_cost DECIMAL(15,2),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
```

---

### 3.2 库存管理模块 ⭐⭐⭐⭐⭐

**优先级：高**
**参考 OpenMAINT：物流和库存管理**

**优化方案：**
1. **物料管理**
   - 物料主数据（编码、名称、规格、单位）
   - 物料分类
   - 物料属性（品牌、型号、供应商等）

2. **仓库管理**
   - 多仓库支持
   - 库位管理
   - 库存数量跟踪
   - 库存预警（最低库存、最高库存）

3. **库存操作**
   - 入库（采购入库、退料入库、调拨入库）
   - 出库（领用出库、调拨出库、报废出库）
   - 盘点
   - 调拨

4. **采购管理**
   - 采购申请
   - 采购订单
   - 采购入库
   - 采购对账

5. **物料与维护关联**
   - 维护计划关联物料清单
   - 工单自动扣减库存
   - 物料消耗统计

**数据库设计：**
```sql
-- 物料主数据表
CREATE TABLE materials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  material_code VARCHAR(50) UNIQUE NOT NULL,
  material_name VARCHAR(200) NOT NULL,
  category_id INT,
  specification TEXT,
  unit VARCHAR(20) NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  supplier_id INT,
  min_stock DECIMAL(10,2), -- 最低库存
  max_stock DECIMAL(10,2), -- 最高库存
  safety_stock DECIMAL(10,2), -- 安全库存
  unit_price DECIMAL(10,2),
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 仓库表
CREATE TABLE warehouses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  warehouse_code VARCHAR(50) UNIQUE NOT NULL,
  warehouse_name VARCHAR(200) NOT NULL,
  location VARCHAR(200),
  manager_id INT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 库存表
CREATE TABLE inventory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  warehouse_id INT NOT NULL,
  material_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  reserved_quantity DECIMAL(10,2) DEFAULT 0, -- 预留数量
  location VARCHAR(100), -- 库位
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_warehouse_material (warehouse_id, material_id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (material_id) REFERENCES materials(id)
);

-- 库存操作记录表
CREATE TABLE inventory_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  transaction_no VARCHAR(50) UNIQUE NOT NULL,
  transaction_type ENUM('in', 'out', 'transfer', 'adjust', 'count'),
  warehouse_id INT,
  material_id INT,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2),
  related_id INT, -- 关联单据ID（采购单、工单等）
  related_type VARCHAR(50), -- 关联单据类型
  operator_id INT,
  operation_date DATETIME NOT NULL,
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 3.3 经济管理模块 ⭐⭐⭐⭐

**优先级：中高**
**参考 OpenMAINT：预算、成本、供应商、合同管理**

**优化方案：**
1. **预算管理**
   - 年度/月度预算制定
   - 预算分类（维护预算、采购预算、能源预算等）
   - 预算执行跟踪
   - 预算预警

2. **成本跟踪**
   - 资产全生命周期成本
   - 维护成本统计（人工、物料、外包）
   - 采购成本
   - 能源成本
   - 成本分析报表

3. **供应商管理**
   - 供应商主数据
   - 供应商评价
   - 供应商分类（设备供应商、维护服务商、物料供应商）
   - 供应商合同管理

4. **合同管理**
   - 合同主数据（采购合同、维护合同、租赁合同）
   - 合同条款管理
   - 合同执行跟踪
   - 合同到期提醒
   - 合同付款管理

**数据库设计：**
```sql
-- 预算表
CREATE TABLE budgets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  budget_year INT NOT NULL,
  budget_month INT,
  budget_type ENUM('maintenance', 'purchase', 'energy', 'other'),
  department_id INT,
  budget_amount DECIMAL(15,2) NOT NULL,
  used_amount DECIMAL(15,2) DEFAULT 0,
  remaining_amount DECIMAL(15,2),
  status ENUM('draft', 'approved', 'executing', 'closed'),
  created_by INT,
  approved_by INT,
  approved_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 供应商表
CREATE TABLE suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_code VARCHAR(50) UNIQUE NOT NULL,
  supplier_name VARCHAR(200) NOT NULL,
  supplier_type ENUM('equipment', 'maintenance', 'material', 'other'),
  contact_person VARCHAR(50),
  contact_phone VARCHAR(50),
  contact_email VARCHAR(100),
  address TEXT,
  rating INT, -- 1-5分
  status ENUM('active', 'inactive', 'blacklist') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 合同表
CREATE TABLE contracts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contract_no VARCHAR(50) UNIQUE NOT NULL,
  contract_name VARCHAR(200) NOT NULL,
  contract_type ENUM('purchase', 'maintenance', 'lease', 'service', 'other'),
  supplier_id INT,
  asset_id INT, -- 关联资产（如果是资产相关合同）
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  contract_amount DECIMAL(15,2),
  paid_amount DECIMAL(15,2) DEFAULT 0,
  status ENUM('draft', 'active', 'expired', 'terminated') DEFAULT 'draft',
  terms TEXT, -- 合同条款
  renewal_reminder_days INT DEFAULT 30, -- 到期提醒天数
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 成本记录表
CREATE TABLE cost_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cost_type ENUM('maintenance', 'purchase', 'energy', 'depreciation', 'other'),
  asset_id INT,
  work_order_id INT,
  contract_id INT,
  amount DECIMAL(15,2) NOT NULL,
  cost_date DATE NOT NULL,
  description TEXT,
  department_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 3.4 能源管理模块 ⭐⭐⭐

**优先级：中**
**参考 OpenMAINT：能源消耗记录和分析**

**优化方案：**
1. **能源计量**
   - 能源类型（电、水、气、油等）
   - 计量点管理
   - 计量读数记录（定期录入/自动采集）
   - 计量设备管理

2. **能源分析**
   - 能源消耗趋势
   - 能耗对比（同比、环比）
   - 能耗排名
   - 能耗预警

3. **能源成本**
   - 能源单价管理
   - 能源成本计算
   - 能源成本报表

**数据库设计：**
```sql
-- 能源计量点表
CREATE TABLE energy_meters (
  id INT PRIMARY KEY AUTO_INCREMENT,
  meter_code VARCHAR(50) UNIQUE NOT NULL,
  meter_name VARCHAR(200) NOT NULL,
  energy_type ENUM('electricity', 'water', 'gas', 'oil', 'other'),
  asset_id INT, -- 关联资产
  location VARCHAR(200),
  unit VARCHAR(20), -- 单位（kWh, m³, L等）
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 能源读数记录表
CREATE TABLE energy_readings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  meter_id INT NOT NULL,
  reading_date DATE NOT NULL,
  reading_value DECIMAL(15,2) NOT NULL,
  previous_reading DECIMAL(15,2),
  consumption DECIMAL(15,2), -- 消耗量
  unit_price DECIMAL(10,4),
  cost DECIMAL(15,2),
  reading_type ENUM('manual', 'auto'),
  recorded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meter_id) REFERENCES energy_meters(id)
);
```

---

### 3.5 GIS/BIM 集成增强 ⭐⭐⭐

**优先级：中**
**参考 OpenMAINT：地理参考和可视化**

**当前状态：**
- 已有基础资产定位功能（`AssetLocationMap.jsx`）

**优化方案：**
1. **GIS 地图集成**
   - 集成地图API（高德地图、百度地图、OpenStreetMap）
   - 资产位置标注
   - 区域资产查询
   - 路径规划（维护人员路线）

2. **建筑平面图**
   - 上传建筑平面图
   - 在平面图上标注资产位置
   - 楼层管理
   - 房间管理

3. **BIM 集成（可选）**
   - 3D模型查看器
   - 资产在3D模型中的定位
   - 维护信息在BIM中的标注

**技术方案：**
- 前端：集成 Leaflet/Mapbox 地图库
- 后端：存储坐标信息，提供地理查询API
- 可选：Three.js 用于3D模型展示

---

### 3.6 工作流程引擎 ⭐⭐⭐⭐

**优先级：中高**
**参考 OpenMAINT：基于工作流程的审批**

**优化方案：**
1. **流程定义**
   - 可视化流程设计器
   - 流程节点配置（审批、会签、条件分支）
   - 流程版本管理

2. **流程实例**
   - 流程启动
   - 任务分配
   - 流程流转
   - 流程监控

3. **应用场景**
   - 资产调配审批
   - 采购申请审批
   - 维护计划审批
   - 合同审批

**技术方案：**
- 使用工作流引擎库（如：`node-red`、`bpmn-js`）
- 或自研简单工作流引擎

---

### 3.7 报表和仪表盘增强 ⭐⭐⭐⭐

**优先级：中高**

**优化方案：**
1. **数据可视化**
   - 使用 ECharts/Chart.js 增强图表
   - 仪表盘自定义
   - 实时数据刷新

2. **报表类型**
   - 资产统计报表
   - 维护成本报表
   - 库存报表
   - 能源消耗报表
   - 预算执行报表
   - 供应商评价报表

3. **报表导出**
   - Excel导出
   - PDF导出
   - 定时报表发送

---

### 3.8 文档管理 ⭐⭐⭐

**优先级：中**

**优化方案：**
1. **文档分类**
   - 资产文档（说明书、保修卡、合同）
   - 维护文档（维护手册、维修记录）
   - 合同文档
   - 其他文档

2. **文档功能**
   - 文档上传
   - 文档版本管理
   - 文档预览
   - 文档下载
   - 文档关联（关联资产、工单等）

**当前状态：**
- 已有资产图片上传功能
- 已有维护日志附件功能
- 可扩展为通用文档管理

---

### 3.9 移动端支持 ⭐⭐⭐

**优先级：中**

**优化方案：**
1. **移动端功能**
   - 资产扫码查询
   - 工单处理
   - 维护记录录入
   - 库存盘点
   - 消息通知

2. **技术方案**
   - 响应式设计（当前前端已部分支持）
   - PWA（Progressive Web App）
   - 或开发原生App（React Native/Flutter）

---

### 3.10 系统架构优化 ⭐⭐⭐⭐

**优先级：中高**

**优化方案：**
1. **微服务化（可选）**
   - 按模块拆分服务
   - API网关
   - 服务注册与发现

2. **缓存优化**
   - Redis缓存
   - 查询结果缓存
   - 会话管理

3. **消息队列**
   - 异步任务处理
   - 消息通知
   - 事件驱动

4. **搜索优化**
   - Elasticsearch集成
   - 全文搜索
   - 高级查询

---

## 四、实施优先级建议

### 第一阶段（核心功能完善）⭐⭐⭐⭐⭐
1. **维护管理增强**
   - 预防性维护计划完善
   - 工单管理系统
   - 预计工作量：2-3周

2. **库存管理模块**
   - 物料管理
   - 仓库管理
   - 库存操作
   - 预计工作量：2-3周

### 第二阶段（业务扩展）⭐⭐⭐⭐
3. **经济管理模块**
   - 预算管理
   - 成本跟踪
   - 供应商管理
   - 合同管理
   - 预计工作量：3-4周

4. **工作流程引擎**
   - 流程定义
   - 流程实例
   - 预计工作量：2-3周

### 第三阶段（功能增强）⭐⭐⭐
5. **报表和仪表盘增强**
   - 数据可视化
   - 报表导出
   - 预计工作量：1-2周

6. **GIS/BIM 集成增强**
   - 地图集成
   - 平面图管理
   - 预计工作量：2-3周

7. **能源管理模块**
   - 能源计量
   - 能源分析
   - 预计工作量：1-2周

### 第四阶段（优化提升）⭐⭐
8. **文档管理完善**
   - 预计工作量：1周

9. **移动端支持**
   - 预计工作量：2-3周

10. **系统架构优化**
    - 预计工作量：持续优化

---

## 五、技术选型建议

### 5.1 前端增强
- **图表库**：ECharts 或 Chart.js
- **地图库**：Leaflet 或 Mapbox
- **工作流**：bpmn-js（流程设计器）
- **文件预览**：react-pdf-viewer、react-office-viewer

### 5.2 后端增强
- **缓存**：Redis
- **消息队列**：Bull（基于Redis）
- **搜索**：Elasticsearch（可选）
- **文件存储**：MinIO 或 阿里云OSS
- **定时任务**：node-cron

### 5.3 数据库优化
- **索引优化**：为常用查询字段添加索引
- **分区表**：大数据量表考虑分区
- **读写分离**：高并发场景考虑

---

## 六、总结

通过参考 OpenMAINT 的设计理念和功能模块，当前项目可以在以下方面进行优化：

1. **维护管理**：从基础日志记录升级为完整的维护管理体系
2. **库存管理**：新增物料和仓库管理，支持维护活动
3. **经济管理**：增加预算、成本、供应商、合同管理
4. **工作流程**：引入工作流引擎，规范业务流程
5. **数据可视化**：增强报表和仪表盘
6. **空间管理**：增强GIS/BIM集成
7. **能源管理**：新增能源消耗跟踪和分析

建议按照优先级分阶段实施，先完善核心的维护管理和库存管理功能，再逐步扩展其他模块。

---

**文档创建时间**：2026-01-09
**参考项目**：OpenMAINT (https://www.openmaint.org/)
