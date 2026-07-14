-- 供应商主数据表
CREATE TABLE IF NOT EXISTS suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  supplier_code VARCHAR(100) NOT NULL COMMENT '供应商编码',
  supplier_name VARCHAR(200) NOT NULL COMMENT '供应商名称',
  contact_person VARCHAR(100) COMMENT '联系人',
  contact_phone VARCHAR(50) COMMENT '联系电话',
  contact_email VARCHAR(100) COMMENT '联系邮箱',
  address TEXT COMMENT '地址',
  tax_number VARCHAR(50) COMMENT '税号',
  bank_name VARCHAR(200) COMMENT '开户银行',
  bank_account VARCHAR(50) COMMENT '银行账号',
  category VARCHAR(100) COMMENT '供应商类别',
  status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  remark TEXT COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(50) COMMENT '创建人',
  updated_by VARCHAR(50) COMMENT '更新人',
  UNIQUE KEY uk_tenant_code (tenant_id, supplier_code),
  INDEX idx_supplier_name (supplier_name),
  INDEX idx_category (category),
  INDEX idx_status (status),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商主数据表';

-- 为assets表添加supplier_id外键字段（可选，如果需要严格的外键关联）
-- ALTER TABLE assets ADD COLUMN supplier_id INT NULL COMMENT '供应商ID' AFTER supplier;
-- ALTER TABLE assets ADD INDEX idx_supplier_id (supplier_id);
-- ALTER TABLE assets ADD CONSTRAINT fk_asset_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
