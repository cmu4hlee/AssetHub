-- 维护工单表迁移脚本
-- 运行前请确保备份数据库

-- 创建维护工单表（如果不存在）
CREATE TABLE IF NOT EXISTS maintenance_workorders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT DEFAULT 1,
  work_order_no VARCHAR(50) NOT NULL COMMENT '工单编号',
  asset_code VARCHAR(50) COMMENT '关联资产编号',
  title VARCHAR(200) NOT NULL COMMENT '工单标题',
  description TEXT COMMENT '工单描述',
  priority INT DEFAULT 3 COMMENT '优先级：1-紧急，2-高，3-中，4-低',
  status VARCHAR(20) DEFAULT 'pending' COMMENT '状态：pending-待分配，assigned-已分配，in_progress-进行中，pending_review-待审核，completed-已完成，closed-已关闭，cancelled-已取消',
  planned_start_date DATETIME COMMENT '计划开始时间',
  planned_end_date DATETIME COMMENT '计划结束时间',
  estimated_hours DECIMAL(10,2) COMMENT '预估工时',
  actual_start_date DATETIME COMMENT '实际开始时间',
  actual_end_date DATETIME COMMENT '实际结束时间',
  actual_hours DECIMAL(10,2) COMMENT '实际工时',
  assigned_to VARCHAR(50) COMMENT '负责人',
  assigned_by VARCHAR(50) COMMENT '分配人',
  assigned_at DATETIME COMMENT '分配时间',
  completed_by VARCHAR(50) COMMENT '完成人',
  completed_at DATETIME COMMENT '完成时间',
  work_content TEXT COMMENT '实际工作内容',
  materials JSON COMMENT '材料清单',
  labor_cost DECIMAL(12,2) DEFAULT 0 COMMENT '人工费',
  outsourcing_cost DECIMAL(12,2) DEFAULT 0 COMMENT '外包费',
  other_cost DECIMAL(12,2) DEFAULT 0 COMMENT '其他费用',
  cancel_reason TEXT COMMENT '取消原因',
  remark TEXT COMMENT '备注',
  created_by VARCHAR(50) COMMENT '创建人',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_work_order_no (work_order_no),
  INDEX idx_asset_code (asset_code),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_created_at (created_at),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维护工单表';

-- 创建维护工单材料表（如果不存在）
CREATE TABLE IF NOT EXISTS maintenance_workorder_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workorder_id INT NOT NULL COMMENT '工单ID',
  name VARCHAR(200) NOT NULL COMMENT '材料名称',
  specification VARCHAR(100) COMMENT '规格型号',
  quantity DECIMAL(10,2) NOT NULL COMMENT '数量',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '单价',
  unit VARCHAR(50) COMMENT '单位',
  supplier VARCHAR(100) COMMENT '供应商',
  remark TEXT COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workorder_id (workorder_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维护工单材料表';

-- 添加外键约束（如果需要）
-- ALTER TABLE maintenance_workorder_materials
-- ADD CONSTRAINT fk_workorder_materials_workorder
-- FOREIGN KEY (workorder_id) REFERENCES maintenance_workorders(id) ON DELETE CASCADE;

-- 插入一些示例数据（可选）
-- INSERT INTO maintenance_workorders (work_order_no, asset_code, title, priority, status, created_by)
-- VALUES ('WO202502010001', 'asset-001', '设备定期维护', 3, 'pending', '系统管理员');
