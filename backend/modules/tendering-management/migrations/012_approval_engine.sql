-- ============================================================
-- 招标采购模块 升级脚本 012
-- 统一审批引擎：approval_flows / approval_nodes /
--                approval_records / approval_todos
-- 取代 tender_* 各表内"内联修改"的传统审批模式
-- 全部幂等；迁移到生产只需运行 1 次。
-- ============================================================

-- 1) 流程模板（按 entity_type 缓存，避免每次重建节点）
CREATE TABLE IF NOT EXISTS approval_flows (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  entity_type VARCHAR(60) NOT NULL COMMENT '对象类型: tender_projects/tender_contracts/tender_invoices/tender_payments/tender_acceptances',
  flow_code VARCHAR(80) NOT NULL COMMENT '流程编码,如 TENDER_PUBLISH_FLOW',
  flow_name VARCHAR(200) NOT NULL,
  trigger_action VARCHAR(80) NOT NULL COMMENT '触发动作: publish / award / contract_sign / archive / invoice_pay / payment_submit / acceptance_accept',
  condition_json JSON NULL COMMENT '触发条件(如 budget_amount > 50000 走多级审批)',
  priority INT DEFAULT 100,
  enabled BOOLEAN DEFAULT TRUE,
  description VARCHAR(500) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_flow_code (tenant_id, entity_type, flow_code),
  INDEX idx_entity (entity_type),
  INDEX idx_trigger (trigger_action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批流模板';

-- 2) 节点（流程节点定义：审批人/角色/条件）
CREATE TABLE IF NOT EXISTS approval_nodes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  flow_id INT NOT NULL,
  seq INT NOT NULL COMMENT '节点顺序 1..N',
  node_name VARCHAR(200) NOT NULL,
  approver_type ENUM('role','user','department_head','creator','auto') DEFAULT 'role' COMMENT '审批人来源',
  approver_role VARCHAR(80) NULL COMMENT '角色编码,如 department_admin / finance / system_admin',
  approver_user_id INT NULL,
  condition_json JSON NULL COMMENT '节点条件(如金额>100000 启用本节点)',
  required BOOLEAN DEFAULT TRUE COMMENT '是否必须审批',
  allow_skip BOOLEAN DEFAULT FALSE COMMENT '是否允许跳过',
  timeout_hours INT NULL COMMENT '审批超时(小时)',
  description VARCHAR(500) NULL,
  INDEX idx_flow (flow_id),
  INDEX idx_seq (seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批节点定义';

-- 3) 审批实例（每个业务单据的某次审批）
CREATE TABLE IF NOT EXISTS approval_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  flow_id INT NULL COMMENT 'null 表示系统默认内联审批',
  entity_type VARCHAR(60) NOT NULL,
  entity_id INT NOT NULL,
  trigger_action VARCHAR(80) NOT NULL,
  current_node_seq INT DEFAULT 1,
  status ENUM('pending','approved','rejected','cancelled','expired') NOT NULL DEFAULT 'pending',
  total_nodes INT DEFAULT 1,
  initiator_id INT NULL,
  initiator_name VARCHAR(100) NULL,
  snapshot_json JSON NULL COMMENT '发起时业务快照（金额、状态等）',
  remark VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  INDEX idx_tenant (tenant_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_status (status),
  INDEX idx_initiator (initiator_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批实例';

-- 4) 节点审批历史（每一节点谁批/驳回）
CREATE TABLE IF NOT EXISTS approval_node_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  record_id INT NOT NULL,
  node_id INT NULL,
  node_seq INT NOT NULL,
  approver_id INT NULL,
  approver_name VARCHAR(100) NULL,
  decision ENUM('pending','approved','rejected','skipped','expired') NOT NULL DEFAULT 'pending',
  opinion VARCHAR(1000) NULL,
  acted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_record (record_id),
  INDEX idx_approver (approver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='节点审批历史';

-- 5) 待办（每个审批人的待处理任务）
CREATE TABLE IF NOT EXISTS approval_todos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  record_id INT NOT NULL,
  node_id INT NULL,
  approver_id INT NOT NULL,
  status ENUM('pending','done','cancelled','transferred') NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  due_at DATETIME NULL,
  done_at DATETIME NULL,
  INDEX idx_tenant (tenant_id),
  INDEX idx_approver (approver_id, status),
  INDEX idx_record (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批待办';

-- ============================================================
-- 内置流程模板：tendering 5 个关键审批门
-- （启动时由 ApprovalEngine.seed() 兜底写入，不依赖外部脚本）
-- ============================================================
-- 流程 1: 招标发布审批
--   节点 1: 部门负责人（条件 budget>50000）
--   节点 2: 资产主管（system_admin）
--   节点 3: 总经理（super_admin）

-- 流程 2: 定标审批（中标）
--   节点 1: 资产主管
--   节点 2: 财务主管（finance）

-- 流程 3: 合同签订审批
--   节点 1: 资产主管
--   节点 2: 法务（legal）

-- 流程 4: 发票核验
--   节点 1: 财务主管
--   节点 2: 财务总监（条件 amount>50000）

-- 流程 5: 付款提交
--   节点 1: 资产主管
--   节点 2: 财务（条件 amount>10000）