-- =====================================================
-- 维保管理模块 - 数据库迁移脚本
-- 包含：保修合同、发票、付款、档案、保修信息、保修历史、保修提醒
-- =====================================================

-- 1. 保修合同表
CREATE TABLE IF NOT EXISTS `warranty_contracts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `contract_no` varchar(100) NOT NULL COMMENT '合同编号',
  `contract_name` varchar(200) NOT NULL COMMENT '合同名称',
  `asset_code` varchar(100) NOT NULL COMMENT '资产编号',
  `asset_name` varchar(200) DEFAULT NULL COMMENT '资产名称',
  `supplier_name` varchar(200) DEFAULT NULL COMMENT '供应商/服务商名称',
  `supplier_contact` varchar(200) DEFAULT NULL COMMENT '供应商联系方式',
  `warranty_type` enum('原厂保修','延保','第三方保修','自行维修') DEFAULT '原厂保修' COMMENT '保修类型',
  `start_date` date NOT NULL COMMENT '保修开始日期',
  `end_date` date NOT NULL COMMENT '保修结束日期',
  `contract_amount` decimal(12,2) DEFAULT 0.00 COMMENT '合同金额',
  `coverage_scope` text COMMENT '保修范围',
  `service_level` varchar(200) DEFAULT NULL COMMENT '服务等级/响应级别',
  `response_time` varchar(100) DEFAULT NULL COMMENT '响应时间承诺',
  `status` enum('生效中','即将到期','已过期','已终止') DEFAULT '生效中' COMMENT '合同状态',
  `remark` text COMMENT '备注',
  `created_by` varchar(100) DEFAULT NULL COMMENT '创建人',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_contract_no_tenant` (`contract_no`, `tenant_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_asset_code` (`asset_code`),
  KEY `idx_status` (`status`),
  KEY `idx_end_date` (`end_date`),
  KEY `idx_warranty_contracts_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='保修合同表';

-- 2. 保修发票表
CREATE TABLE IF NOT EXISTS `warranty_invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `contract_id` int DEFAULT NULL COMMENT '关联合同ID',
  `invoice_no` varchar(100) NOT NULL COMMENT '发票编号',
  `invoice_code` varchar(100) DEFAULT NULL COMMENT '发票代码',
  `invoice_type` enum('增值税专用发票','增值税普通发票','其他') DEFAULT '增值税普通发票' COMMENT '发票类型',
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00 COMMENT '发票金额',
  `tax_amount` decimal(12,2) DEFAULT 0.00 COMMENT '税额',
  `invoice_date` date NOT NULL COMMENT '开票日期',
  `issuer` varchar(200) DEFAULT NULL COMMENT '开票方',
  `receiver` varchar(200) DEFAULT NULL COMMENT '收票方',
  `file_path` varchar(500) DEFAULT NULL COMMENT '发票文件路径',
  `status` enum('待审核','已审核','已驳回') DEFAULT '待审核' COMMENT '审核状态',
  `remark` text COMMENT '备注',
  `created_by` varchar(100) DEFAULT NULL COMMENT '创建人',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_invoice_no_tenant` (`invoice_no`, `tenant_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_contract_id` (`contract_id`),
  KEY `idx_invoice_date` (`invoice_date`),
  KEY `idx_warranty_invoices_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='保修发票表';

-- 3. 保修付款表
CREATE TABLE IF NOT EXISTS `warranty_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `contract_id` int DEFAULT NULL COMMENT '关联合同ID',
  `invoice_id` int DEFAULT NULL COMMENT '关联发票ID',
  `payment_no` varchar(100) NOT NULL COMMENT '付款单号',
  `payment_type` enum('预付款','进度款','尾款','全款','其他') DEFAULT '全款' COMMENT '付款类型',
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00 COMMENT '付款金额',
  `payment_method` enum('银行转账','支票','现金','其他') DEFAULT '银行转账' COMMENT '付款方式',
  `payment_date` date NOT NULL COMMENT '付款日期',
  `payee` varchar(200) DEFAULT NULL COMMENT '收款方',
  `bank_account` varchar(100) DEFAULT NULL COMMENT '收款账号',
  `status` enum('待付款','已付款','已取消') DEFAULT '待付款' COMMENT '付款状态',
  `file_path` varchar(500) DEFAULT NULL COMMENT '付款凭证文件路径',
  `remark` text COMMENT '备注',
  `created_by` varchar(100) DEFAULT NULL COMMENT '创建人',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_no_tenant` (`payment_no`, `tenant_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_contract_id` (`contract_id`),
  KEY `idx_invoice_id` (`invoice_id`),
  KEY `idx_payment_date` (`payment_date`),
  KEY `idx_warranty_payments_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='保修付款表';

-- 4. 保修档案表
CREATE TABLE IF NOT EXISTS `warranty_archives` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `contract_id` int DEFAULT NULL COMMENT '关联合同ID',
  `archive_no` varchar(100) NOT NULL COMMENT '档案编号',
  `archive_name` varchar(200) NOT NULL COMMENT '档案名称',
  `document_type` enum('合同原件','验收报告','保修证书','技术资料','维修记录','其他') DEFAULT '其他' COMMENT '文档类型',
  `asset_code` varchar(100) DEFAULT NULL COMMENT '关联资产编号',
  `file_path` varchar(500) NOT NULL COMMENT '文件路径',
  `file_size` bigint DEFAULT 0 COMMENT '文件大小(字节)',
  `description` text COMMENT '描述',
  `archive_date` date DEFAULT NULL COMMENT '归档日期',
  `retention_until` date DEFAULT NULL COMMENT '保管截止日期',
  `status` enum('在档','已移交','已销毁') DEFAULT '在档' COMMENT '档案状态',
  `created_by` varchar(100) DEFAULT NULL COMMENT '创建人',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_archive_no_tenant` (`archive_no`, `tenant_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_contract_id` (`contract_id`),
  KEY `idx_asset_code` (`asset_code`),
  KEY `idx_document_type` (`document_type`),
  KEY `idx_warranty_archives_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='保修档案表';

-- 5. 保修信息维护表（扩展资产的保修信息）
CREATE TABLE IF NOT EXISTS `warranty_info` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `asset_code` varchar(100) NOT NULL COMMENT '资产编号',
  `asset_name` varchar(200) DEFAULT NULL COMMENT '资产名称',
  `contract_id` int DEFAULT NULL COMMENT '关联合同ID',
  `warranty_status` enum('在保','过保','即将到期','待确认') DEFAULT '在保' COMMENT '保修状态',
  `warranty_type` enum('原厂保修','延保','第三方保修','自行维修','无保修') DEFAULT '原厂保修' COMMENT '保修类型',
  `start_date` date DEFAULT NULL COMMENT '保修开始日期',
  `end_date` date DEFAULT NULL COMMENT '保修结束日期',
  `warranty_period_months` int DEFAULT NULL COMMENT '保修期（月）',
  `supplier_name` varchar(200) DEFAULT NULL COMMENT '保修服务方',
  `supplier_contact` varchar(200) DEFAULT NULL COMMENT '服务方联系方式',
  `coverage_details` text COMMENT '保修范围详情',
  `exclusions` text COMMENT '不包含项',
  `service_hotline` varchar(100) DEFAULT NULL COMMENT '服务热线',
  `remark` text COMMENT '备注',
  `created_by` varchar(100) DEFAULT NULL COMMENT '创建人',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asset_code_tenant` (`asset_code`, `tenant_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_contract_id` (`contract_id`),
  KEY `idx_warranty_status` (`warranty_status`),
  KEY `idx_end_date` (`end_date`),
  KEY `idx_warranty_info_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='保修信息维护表';

-- 6. 保修历史记录表
CREATE TABLE IF NOT EXISTS `warranty_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `warranty_info_id` int DEFAULT NULL COMMENT '关联保修信息ID',
  `asset_code` varchar(100) NOT NULL COMMENT '资产编号',
  `asset_name` varchar(200) DEFAULT NULL COMMENT '资产名称',
  `change_type` enum('新增','修改','续保','过保','终止','状态变更') NOT NULL COMMENT '变更类型',
  `field_name` varchar(100) DEFAULT NULL COMMENT '变更字段',
  `old_value` text COMMENT '旧值',
  `new_value` text COMMENT '新值',
  `change_description` text COMMENT '变更说明',
  `changed_by` varchar(100) DEFAULT NULL COMMENT '操作人',
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_warranty_info_id` (`warranty_info_id`),
  KEY `idx_asset_code` (`asset_code`),
  KEY `idx_change_type` (`change_type`),
  KEY `idx_changed_at` (`changed_at`),
  KEY `idx_warranty_history_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='保修历史记录表';

-- 7. 保修提醒配置表（报修到期提醒 + 提醒人 + 提醒日期）
CREATE TABLE IF NOT EXISTS `warranty_reminders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `warranty_info_id` int DEFAULT NULL COMMENT '关联保修信息ID',
  `contract_id` int DEFAULT NULL COMMENT '关联合同ID',
  `asset_code` varchar(100) NOT NULL COMMENT '资产编号',
  `asset_name` varchar(200) DEFAULT NULL COMMENT '资产名称',
  `reminder_type` enum('到期提醒','过保提醒','报修提醒','续保提醒') DEFAULT '到期提醒' COMMENT '提醒类型',
  `reminder_date` date NOT NULL COMMENT '提醒日期',
  `expire_date` date DEFAULT NULL COMMENT '到期日期',
  `recipients` text COMMENT '提醒人列表(JSON数组：用户ID或姓名)',
  `recipient_names` text COMMENT '提醒人姓名列表(逗号分隔，便于展示)',
  `reminder_days_before` int DEFAULT 30 COMMENT '提前几天提醒',
  `message` text COMMENT '提醒消息内容',
  `status` enum('待发送','已发送','已处理','已忽略') DEFAULT '待发送' COMMENT '提醒状态',
  `sent_at` timestamp NULL DEFAULT NULL COMMENT '发送时间',
  `created_by` varchar(100) DEFAULT NULL COMMENT '创建人',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_warranty_info_id` (`warranty_info_id`),
  KEY `idx_asset_code` (`asset_code`),
  KEY `idx_reminder_date` (`reminder_date`),
  KEY `idx_status` (`status`),
  KEY `idx_warranty_reminders_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='保修提醒表';

-- 8. 保修提醒配置表（全局/资产级提醒规则配置）
CREATE TABLE IF NOT EXISTS `warranty_reminder_configs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `asset_code` varchar(100) DEFAULT NULL COMMENT '资产编号（空表示全局配置）',
  `reminder_days_before` int NOT NULL DEFAULT 30 COMMENT '提前几天提醒',
  `reminder_dates` text COMMENT '提醒日期列表(JSON数组，如每月1号、到期前30天等)',
  `recipients` text COMMENT '提醒人列表(JSON数组)',
  `recipient_names` text COMMENT '提醒人姓名列表(逗号分隔)',
  `reminder_types` varchar(500) DEFAULT '["system"]' COMMENT '提醒方式(JSON)',
  `enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `created_by` varchar(100) DEFAULT NULL COMMENT '创建人',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_asset_code` (`asset_code`),
  UNIQUE KEY `uk_tenant_asset` (`tenant_id`, `asset_code`),
  KEY `idx_warranty_reminder_configs_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='保修提醒配置表';
