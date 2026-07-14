-- 财务管理模块数据库表
-- 创建时间: 2026-07-14

-- 预算管理表
CREATE TABLE IF NOT EXISTS `financial_budgets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` VARCHAR(50) NOT NULL,
  `year` INT NOT NULL COMMENT '预算年度',
  `department_name` VARCHAR(200) NOT NULL COMMENT '部门名称',
  `budget_type` ENUM('equipment_procurement', 'maintenance', 'operation', 'other') NOT NULL COMMENT '预算类型',
  `budget_amount` DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT '预算金额',
  `actual_amount` DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT '实际执行金额',
  `notes` TEXT COMMENT '备注',
  `created_by` VARCHAR(100) DEFAULT '' COMMENT '创建人',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_tenant_year_dept_type` (`tenant_id`, `year`, `department_name`, `budget_type`),
  INDEX `idx_tenant_year` (`tenant_id`, `year`),
  INDEX `idx_department` (`department_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预算管理表';

-- 收支记录表
CREATE TABLE IF NOT EXISTS `financial_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` VARCHAR(50) NOT NULL,
  `transaction_type` ENUM('income', 'expense') NOT NULL COMMENT '收支类型: income=收入, expense=支出',
  `category` VARCHAR(100) NOT NULL COMMENT '类别',
  `amount` DECIMAL(15,2) NOT NULL COMMENT '金额',
  `transaction_date` DATE NOT NULL COMMENT '交易日期',
  `asset_code` VARCHAR(100) DEFAULT '' COMMENT '关联资产编码',
  `description` TEXT COMMENT '说明',
  `voucher_no` VARCHAR(100) DEFAULT '' COMMENT '凭证号',
  `created_by` VARCHAR(100) DEFAULT '' COMMENT '创建人',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tenant_date` (`tenant_id`, `transaction_date`),
  INDEX `idx_tenant_type` (`tenant_id`, `transaction_type`),
  INDEX `idx_asset_code` (`asset_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收支记录表';
