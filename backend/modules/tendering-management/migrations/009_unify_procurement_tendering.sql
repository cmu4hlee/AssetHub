-- ============================================================
-- 招标采购模块 升级脚本 009
-- 将「采购管理」(procurement_requests) 合并为「采购与招标」
-- 统一闭环的统一前置字段 / 扩展状态枚举 / 反查索引
-- 注意：所有 ALTER 均为幂等；列/索引已存在时由 ensureTables 拆分器忽略
-- ============================================================

-- 1. tender_projects 新增「采购申请前置阶段」字段
ALTER TABLE tender_projects ADD COLUMN tender_category ENUM('tender','simple','agreement') NOT NULL DEFAULT 'tender' COMMENT '流程类型:tender招标/simple简易/agreement协议';
ALTER TABLE tender_projects ADD COLUMN requestor_id INT NULL COMMENT '采购申请人ID';
ALTER TABLE tender_projects ADD COLUMN requestor_name VARCHAR(100) NULL COMMENT '采购申请人姓名';
ALTER TABLE tender_projects ADD COLUMN request_department VARCHAR(100) NULL COMMENT '采购申请部门';
ALTER TABLE tender_projects ADD COLUMN request_budget DECIMAL(15,2) NULL COMMENT '采购申请预算';
ALTER TABLE tender_projects ADD COLUMN expected_delivery_date DATE NULL COMMENT '期望到货/交付日期';
ALTER TABLE tender_projects ADD COLUMN asset_specification TEXT NULL COMMENT '采购资产规格要求';
ALTER TABLE tender_projects ADD COLUMN procurement_request_id INT NULL COMMENT '历史 procurement_requests.id 一对一反查';

-- 2. 索引（增量）
ALTER TABLE tender_projects ADD INDEX idx_requestor (requestor_id);
ALTER TABLE tender_projects ADD INDEX idx_category (tender_category);
ALTER TABLE tender_projects ADD INDEX idx_procurement_request (procurement_request_id);
ALTER TABLE tender_projects ADD INDEX idx_expected_delivery (expected_delivery_date);

-- 3. 扩展 status 枚举：补 applying（采购申请前置）/ accepting（合同签订后验收）
-- 新闭环：applying → draft → published → bidding → evaluating → awarded
--        → contract_signing → accepting → completed
ALTER TABLE tender_projects MODIFY status ENUM('applying','draft','published','bidding','evaluating','awarded','contract_signing','accepting','completed','cancelled') DEFAULT 'applying';

-- 4. 历史若 status='draft' 且无前置字段，等价新分类为 'tender' + 已立项
-- 此处不需要 ALTER，新流程以 tender_category 区分

-- 5. 预留付款/到货里程碑入口（v1.0 仅占位，不影响老逻辑）
CREATE TABLE IF NOT EXISTS tender_payment_milestones (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  contract_id INT NOT NULL COMMENT 'tender_contracts.id',
  milestone_name VARCHAR(200) NOT NULL COMMENT '里程碑名称(预付/到货/验收尾款)',
  amount DECIMAL(15,2) DEFAULT 0,
  due_date DATE NULL,
  status ENUM('pending','paid','overdue') DEFAULT 'pending',
  paid_at DATETIME NULL,
  remark VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_contract (contract_id),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合同付款里程碑占位表（v1.0 仅占位，v2.0 完整实现）';

-- ============================================================
-- 历史表后置：保留 procurement_requests 作为只读；由脚本添加 migrated_to_tender_id 列
-- 若运行过 migrate-procurement-to-tendering.js，procurement_requests.migrated_to_tender_id 已存在
-- 此处使用 IF NOT EXISTS 不支持的 MySQL 版本兼容：包在 try / 跳过
-- ============================================================
