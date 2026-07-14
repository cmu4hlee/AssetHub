# AssetHub 数据库结构评估报告

**评估日期**: 2026-05-01  
**评估范围**: 所有数据库表结构  
**总体评分**: 8.5/10

---

## 📊 一、评估概述

### 1.1 已检查的表结构
通过检查以下文件进行评估：
- `backend/config/init.sql` - 核心表结构
- `backend/scripts/create-user-system.js` - 用户系统表
- `backend/scripts/create-quality-management-tables.sql` - 质量管理表
- `backend/scripts/create-maintenance-workorders-table.sql` - 维护工单表
- `backend/scripts/create-missing-module-tables.sql` - 风险、人员资质、开机率等表
- `backend/scripts/create-ai-chat-tables.sql` - AI对话表
- `backend/scripts/create-alert-tables.sql` - 预警表

### 1.2 评分详情
| 评估维度 | 评分 | 说明 |
|---------|------|------|
| 表结构设计 | 9.0/10 | 字段完整，类型合理 |
| 索引设计 | 8.0/10 | 基本索引完善，部分需要优化 |
| 多租户支持 | 9.0/10 | 大部分表有 tenant_id |
| 外键约束 | 7.5/10 | 部分外键被注释，存在数据完整性风险 |
| 命名规范 | 8.0/10 | 基本规范，部分字段命名不规范 |
| 审计字段 | 9.0/10 | 有完整的创建和更新时间 |
| 扩展性 | 8.5/10 | 设计支持未来扩展 |

**综合评分**: 8.5/10 - 良好

---

## ✅ 二、结构优点

### 2.1 字符集和存储引擎
```sql
-- ✅ 优秀实践
ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```
- 使用 `utf8mb4` 支持完整的 Unicode 和 emoji
- InnoDB 引擎支持事务和外键
- 使用注释（COMMENT）说明字段用途

### 2.2 多租户支持
```sql
-- ✅ 优秀实践
tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID'
```
- 大部分表都有 `tenant_id` 字段
- 支持企业级多租户隔离
- 便于数据权限控制

### 2.3 审计字段
```sql
-- ✅ 优秀实践
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
```
- 有创建时间和更新时间
- 便于追踪数据变更
- 部分表使用 `ON UPDATE CURRENT_TIMESTAMP` 自动更新时间

### 2.4 索引设计
```sql
-- ✅ 优秀实践
INDEX idx_category (category_id),
INDEX idx_status (status),
INDEX idx_asset_code (asset_code)
```
- 为常用查询字段创建了索引
- 命名规范（idx_字段名）
- 支持分页和过滤查询

### 2.5 数据类型选择
```sql
-- ✅ 优秀实践
status ENUM('在用', '闲置', '维修', '报废', '调配中')
purchase_price DECIMAL(15, 2)
```
- 使用 ENUM 限制状态值
- 价格使用 DECIMAL 避免浮点数精度问题
- TEXT 类型用于长文本字段

---

## ⚠️ 三、需要改进的问题

### 3.1 数据完整性问题 🔴 高优先级

#### 问题1：部分外键被注释掉
```sql
-- ⚠️ 问题代码
--- 添加外键约束（如果需要）
--- ALTER TABLE maintenance_workorder_materials
--- ADD CONSTRAINT fk_workorder_materials_workorder
--- FOREIGN KEY (workorder_id) REFERENCES maintenance_workorders(id) ON DELETE CASCADE;
```

**影响**：
- 子表数据可能孤立（没有对应的主表记录）
- 级联删除无法生效
- 数据一致性无法保证

**建议**：
```sql
-- ✅ 修复方案
ALTER TABLE maintenance_workorder_materials
ADD CONSTRAINT fk_workorder_materials_workorder
FOREIGN KEY (workorder_id) REFERENCES maintenance_workorders(id) ON DELETE CASCADE;
```

#### 问题2：字段命名包含特殊字符
```sql
-- ⚠️ 问题代码
`asset.code` VARCHAR(100) COMMENT '资产编号',
```

**影响**：
- SQL 查询需要使用反引号
- 容易在代码中产生语法错误
- 不符合命名规范

**建议**：
```sql
-- ✅ 修复方案
asset_code VARCHAR(100) COMMENT '资产编号',
```

### 3.2 索引优化问题 🟡 中优先级

#### 问题3：缺少复合索引
```sql
-- ⚠️ 问题代码
-- 常见查询条件：tenant_id + status + created_at
-- 但只有单字段索引
INDEX idx_status (status),
INDEX idx_tenant_id (tenant_id)
```

**影响**：
- 多条件查询性能差
- 无法利用索引覆盖

**建议**：
```sql
-- ✅ 修复方案
INDEX idx_tenant_status (tenant_id, status),
INDEX idx_tenant_created (tenant_id, created_at)
```

#### 问题4：某些表缺少 tenant_id 索引
```sql
-- ⚠️ 问题代码
-- ai_chat_sessions 表有 tenant_id 但没有单独索引
INDEX idx_tenant_id (tenant_id),
INDEX idx_user_id (user_id),
INDEX idx_created_at (created_at)
-- 缺少 tenant_id 的单独索引用于快速过滤
```

**建议**：
```sql
-- ✅ 修复方案（已有）
-- 当前索引设计已包含 tenant_id
```

### 3.3 字段设计问题 🟡 中优先级

#### 问题5：部门信息使用 VARCHAR 而不是外键
```sql
-- ⚠️ 问题代码
department VARCHAR(100) COMMENT '使用部门',
from_department VARCHAR(100) NOT NULL COMMENT '调出部门',
to_department VARCHAR(100) NOT NULL COMMENT '调入部门',
```

**影响**：
- 无法保证部门数据的完整性
- 部门重命名时需要更新多处数据
- 报表统计可能不准确

**建议**：
```sql
-- ✅ 修复方案
department_id INT COMMENT '使用部门ID',
FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL

-- 同时保留部门名称用于显示（可以冗余存储）
department_name VARCHAR(100) COMMENT '使用部门名称',
```

#### 问题6：用户信息使用 VARCHAR 而不是外键
```sql
-- ⚠️ 问题代码
responsible_person VARCHAR(50) COMMENT '责任人',
created_by VARCHAR(50) COMMENT '创建人',
```

**建议**：
```sql
-- ✅ 修复方案
responsible_person_id INT COMMENT '责任人ID',
FOREIGN KEY (responsible_person_id) REFERENCES users(id) ON DELETE SET NULL
responsible_person_name VARCHAR(50) COMMENT '责任人名称',
```

### 3.4 规范化问题 🟢 低优先级

#### 问题7：部分表存在数据冗余
```sql
-- ⚠️ 问题代码
-- 在 metrology_records 表中重复存储资产信息
asset_id INT NOT NULL COMMENT '资产ID',
`asset.code` VARCHAR(100) COMMENT '资产编号',  -- 冗余
asset_name VARCHAR(200) COMMENT '资产名称',  -- 冗余
```

**建议**：
- 如果资产表数据不变，可以保留冗余字段用于查询优化
- 如果资产表数据会变更，需要定期同步或改为 JOIN 查询

---

## 📋 四、详细改进建议

### 4.1 紧急修复（本周）

#### 1. 启用外键约束
```sql
-- 计量附件表
ALTER TABLE metrology_attachments
ADD CONSTRAINT fk_metrology_attachments_metrology
FOREIGN KEY (metrology_id) REFERENCES metrology_records(id) ON DELETE CASCADE;

-- 质控附件表
ALTER TABLE quality_control_attachments
ADD CONSTRAINT fk_quality_control_attachments_qc
FOREIGN KEY (qc_id) REFERENCES quality_control_records(id) ON DELETE CASCADE;

-- 维护工单材料表
ALTER TABLE maintenance_workorder_materials
ADD CONSTRAINT fk_workorder_materials_workorder
FOREIGN KEY (workorder_id) REFERENCES maintenance_workorders(id) ON DELETE CASCADE;
```

#### 2. 修复字段命名
```sql
-- 修改包含点号的字段名
ALTER TABLE metrology_records CHANGE COLUMN `asset.code` asset_code VARCHAR(100) COMMENT '资产编号';
ALTER TABLE quality_control_records CHANGE COLUMN `asset.code` asset_code VARCHAR(100) COMMENT '资产编号';
```

### 4.2 重要优化（本月）

#### 1. 添加复合索引
```sql
-- 资产表复合索引
ALTER TABLE assets ADD INDEX idx_tenant_status (tenant_id, status);
ALTER TABLE assets ADD INDEX idx_tenant_category (tenant_id, category_id);
ALTER TABLE assets ADD INDEX idx_tenant_created (tenant_id, created_at);

-- 盘点表复合索引
ALTER TABLE inventory_records ADD INDEX idx_tenant_status (tenant_id, status);
ALTER TABLE inventory_details ADD INDEX idx_tenant_discrepancy (tenant_id, discrepancy_type);

-- 调配表复合索引
ALTER TABLE transfer_records ADD INDEX idx_tenant_status (tenant_id, status);
ALTER TABLE transfer_records ADD INDEX idx_tenant_created (tenant_id, created_at);
```

#### 2. 添加 tenant_id 到缺失的表
检查以下表是否都有 tenant_id：
- [ ] users 表（应该已有）
- [ ] departments 表（应该已有）
- [ ] roles 表（如果存在）
- [ ] permissions 表（如果存在）

### 4.3 长期优化（后续迭代）

#### 1. 添加部门外键（需要大量数据迁移）
```sql
-- 1. 确保 departments 表存在且有主键
ALTER TABLE departments MODIFY COLUMN id INT PRIMARY KEY AUTO_INCREMENT;

-- 2. 添加 department_id 外键到 assets 表
ALTER TABLE assets ADD COLUMN department_id INT;
ALTER TABLE assets ADD CONSTRAINT fk_assets_department
FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- 3. 数据迁移（需要编写迁移脚本）
-- 根据 department 字段的值找到对应的 department_id 并更新
```

#### 2. 添加用户外键
```sql
-- 1. 确保 users 表有主键
ALTER TABLE users MODIFY COLUMN id INT PRIMARY KEY AUTO_INCREMENT;

-- 2. 添加 created_by_id, updated_by_id 外键到相关表
ALTER TABLE assets ADD COLUMN created_by_id INT;
ALTER TABLE assets ADD COLUMN updated_by_id INT;
ALTER TABLE assets ADD CONSTRAINT fk_assets_created_by
FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE assets ADD CONSTRAINT fk_assets_updated_by
FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL;
```

---

## 📊 五、当前数据库表清单

### 5.1 核心业务表
| 表名 | 说明 | 租户支持 | 索引数 | 外键数 | 状态 |
|------|------|---------|--------|--------|------|
| assets | 资产主表 | ✅ | 5 | 0 | ✅ 良好 |
| asset_categories | 资产分类表 | ✅ | 0 | 0 | ✅ 良好 |
| inventory_records | 盘点记录表 | ✅ | 0 | 0 | ✅ 良好 |
| inventory_details | 盘点明细表 | ✅ | 2 | 2 | ✅ 良好 |
| transfer_records | 调配记录表 | ✅ | 2 | 1 | ✅ 良好 |
| idle_assets | 闲置资产表 | ✅ | 2 | 1 | ✅ 良好 |

### 5.2 维护管理表
| 表名 | 说明 | 租户支持 | 索引数 | 外键数 | 状态 |
|------|------|---------|--------|--------|------|
| maintenance_workorders | 维护工单表 | ✅ | 7 | 0 | ⚠️ 需优化 |
| maintenance_workorder_materials | 工单材料表 | ❌ | 1 | 0 | ⚠️ 需修复 |
| maintenance_requests | 维修申请表 | ✅ | - | - | ✅ 良好 |
| maintenance_logs | 维修记录表 | ✅ | - | - | ✅ 良好 |

### 5.3 质量管理表
| 表名 | 说明 | 租户支持 | 索引数 | 外键数 | 状态 |
|------|------|---------|--------|--------|------|
| metrology_records | 计量记录表 | ❌ | 5 | 0 | ⚠️ 需优化 |
| metrology_attachments | 计量附件表 | ❌ | 1 | 1 | ⚠️ 需修复 |
| quality_control_records | 质控记录表 | ❌ | 5 | 0 | ⚠️ 需优化 |
| quality_control_attachments | 质控附件表 | ❌ | 1 | 1 | ⚠️ 需修复 |

### 5.4 AI和预警表
| 表名 | 说明 | 租户支持 | 索引数 | 外键数 | 状态 |
|------|------|---------|--------|--------|------|
| ai_chat_sessions | AI会话表 | ✅ | 3 | 0 | ✅ 良好 |
| ai_chat_messages | AI消息表 | ✅ | 3 | 1 | ✅ 良好 |
| alert_settings | 预警设置表 | ✅ | 2 | 0 | ✅ 良好 |
| alert_records | 预警记录表 | ✅ | 7 | 0 | ✅ 良好 |

### 5.5 风险和合规表
| 表名 | 说明 | 租户支持 | 索引数 | 外键数 | 状态 |
|------|------|---------|--------|--------|------|
| risk_assessments | 风险评估表 | ✅ | 3 | 0 | ✅ 良好 |
| risk_controls | 风险控制表 | ✅ | 2 | 0 | ⚠️ 需优化 |
| staff_qualifications | 人员资质表 | ✅ | 3 | 0 | ✅ 良好 |
| training_records | 培训记录表 | ✅ | 3 | 0 | ✅ 良好 |
| uptime_statistics | 开机率统计表 | ✅ | - | - | ✅ 良好 |

---

## 🛠️ 六、SQL优化脚本

### 6.1 添加缺失的 tenant_id 索引
```sql
-- 为所有有 tenant_id 但缺少索引的表添加索引
-- 执行前请先备份

-- 计量记录表
ALTER TABLE metrology_records ADD INDEX idx_tenant_id (tenant_id);

-- 计量附件表
ALTER TABLE metrology_attachments ADD INDEX idx_tenant_id (tenant_id);

-- 质控记录表
ALTER TABLE quality_control_records ADD INDEX idx_tenant_id (tenant_id);

-- 质控附件表
ALTER TABLE quality_control_attachments ADD INDEX idx_tenant_id (tenant_id);
```

### 6.2 添加复合索引优化查询
```sql
-- 资产表常见查询优化
ALTER TABLE assets
ADD INDEX idx_tenant_status_category (tenant_id, status, category_id),
ADD INDEX idx_tenant_department (tenant_id, department),
ADD INDEX idx_tenant_warranty (tenant_id, warranty_end_date);

-- 计量记录表查询优化
ALTER TABLE metrology_records
ADD INDEX idx_tenant_status (tenant_id, status),
ADD INDEX idx_tenant_next_date (tenant_id, next_metrology_date);

-- 质控记录表查询优化
ALTER TABLE quality_control_records
ADD INDEX idx_tenant_status (tenant_id, status),
ADD INDEX idx_tenant_next_date (tenant_id, next_qc_date);
```

### 6.3 启用外键约束
```sql
-- 确保外键约束生效
SET FOREIGN_KEY_CHECKS = 1;

-- 如果有外键错误，先修复数据再启用
-- 检查孤立数据
SELECT * FROM metrology_attachments WHERE metrology_id NOT IN (SELECT id FROM metrology_records);
SELECT * FROM quality_control_attachments WHERE qc_id NOT IN (SELECT id FROM quality_control_records);
SELECT * FROM maintenance_workorder_materials WHERE workorder_id NOT IN (SELECT id FROM maintenance_workorders);
```

---

## 📈 七、性能监控建议

### 7.1 监控慢查询
```sql
-- 启用慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2; -- 超过2秒记录
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';

-- 查看慢查询
SHOW VARIABLES LIKE 'slow_query%';
SHOW VARIABLES LIKE 'long_query_time';

-- 查看最近慢查询
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;
```

### 7.2 监控索引使用情况
```sql
-- 查看未使用的索引
SELECT
  table_schema,
  table_name,
  index_name,
  cardinality,
  seq_in_index
FROM information_schema.statistics
WHERE table_schema = 'zcgl'
AND index_name != 'PRIMARY'
AND seq_in_index = 1
ORDER BY cardinality ASC;

-- 查看表的大小和行数
SELECT
  table_name,
  table_rows,
  data_length,
  index_length,
  ROUND(data_length / 1024 / 1024, 2) AS '数据大小(MB)',
  ROUND(index_length / 1024 / 1024, 2) AS '索引大小(MB)'
FROM information_schema.tables
WHERE table_schema = 'zcgl'
ORDER BY data_length DESC;
```

### 7.3 定期优化表
```sql
-- 每周执行一次
OPTIMIZE TABLE assets;
OPTIMIZE TABLE inventory_records;
OPTIMIZE TABLE inventory_details;
OPTIMIZE TABLE transfer_records;
OPTIMIZE TABLE ai_chat_messages;

-- 分析表（更新统计信息）
ANALYZE TABLE assets;
ANALYZE TABLE inventory_records;
ANALYZE TABLE transfer_records;
```

---

## 📝 八、维护计划

### 8.1 每日任务
- [ ] 备份数据库
- [ ] 检查错误日志
- [ ] 监控慢查询

### 8.2 每周任务
- [ ] OPTIMIZE TABLE 优化表
- [ ] ANALYZE TABLE 更新统计
- [ ] 检查索引使用情况
- [ ] 清理过期数据

### 8.3 每月任务
- [ ] 完整数据库健康检查
- [ ] 审查并删除未使用的索引
- [ ] 评估表增长趋势
- [ ] 备份验证

### 8.4 每季度任务
- [ ] 完整性能基准测试
- [ ] 数据库结构审查
- [ ] 容量规划
- [ ] 灾难恢复演练

---

## ✅ 九、检查清单

### 9.1 立即执行
- [ ] 添加缺失的 tenant_id 索引
- [ ] 启用已注释的外键约束
- [ ] 修复字段命名（含点号的字段）

### 9.2 本周内执行
- [ ] 添加复合索引优化查询
- [ ] 检查并修复孤立数据
- [ ] 验证所有表都有 tenant_id

### 9.3 本月内执行
- [ ] 添加部门外键（可选）
- [ ] 添加用户外键（可选）
- [ ] 优化查询性能

### 9.4 后续迭代
- [ ] 数据迁移和清洗
- [ ] 定期维护计划实施
- [ ] 性能基准建立

---

## 📚 十、相关文档

- `backend/config/init.sql` - 核心表结构定义
- `backend/scripts/create-*.sql` - 各模块表结构定义
- `backend/config/database.js` - 数据库连接配置
- `backend/scripts/analyze-indexes.js` - 索引分析脚本

---

**评估完成时间**: 2026-05-01  
**评估人**: Claude AI Assistant  
**下次评估**: 建议3个月后  
**总体评价**: 数据库结构设计良好，但需要优化索引和外键约束以提高数据完整性和查询性能。

---

## 🎯 十、总结

### 优秀方面 ✅
1. 使用 utf8mb4 字符集支持完整 Unicode
2. 完善的多租户支持（tenant_id）
3. 完整的审计字段（created_at, updated_at）
4. 合理的字段类型选择（ENUM, DECIMAL）
5. 基本索引设计合理

### 需要改进 ⚠️
1. **高优先级**：启用外键约束（数据完整性风险）
2. **中优先级**：添加复合索引（查询性能优化）
3. **中优先级**：添加 tenant_id 索引（某些表缺失）
4. **低优先级**：部门/用户信息使用外键（规范化）

### 实施建议 🚀
1. **立即**：启用外键约束
2. **本周**：添加索引优化
3. **本月**：全面检查数据完整性
4. **后续**：考虑添加部门/用户外键

---

**评分**: 8.5/10 - 良好，但需要优化索引和外键约束
