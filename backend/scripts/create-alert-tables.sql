-- 智能预警相关表结构
-- 创建于: 2026-03-06

-- 预警设置表
CREATE TABLE IF NOT EXISTS alert_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  -- 各类预警的阈值配置（JSON格式存储）
  maintenance_threshold JSON COMMENT '保养预警阈值配置，如：{"days": [7,3,1]}',
  qualification_threshold JSON COMMENT '资质预警阈值配置，如：{"days": [90,30,7]}',
  inspection_threshold JSON COMMENT '检验预警阈值配置，如：{"days": [90,30,7]}',
  safety_threshold JSON COMMENT '安全检测预警阈值配置，如：{"days": [30,7,1]}',
  uptime_threshold JSON COMMENT '开机率预警阈值配置，如：{"threshold": 95}',
  -- 通知方式配置
  notification_methods JSON COMMENT '通知方式配置，如：{"email": true, "sms": false, "app": true}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uk_tenant_user (tenant_id, user_id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户预警设置表';

-- 预警记录表（用于记录已生成的预警）
CREATE TABLE IF NOT EXISTS alert_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  alert_id VARCHAR(100) NOT NULL COMMENT '预警唯一标识，如：maintenance_123',
  alert_type ENUM('maintenance_due', 'qualification_expire', 'inspection_due', 'safety_expire', 'uptime_low') NOT NULL,
  title VARCHAR(200) NOT NULL COMMENT '预警标题',
  content TEXT COMMENT '预警内容',
  urgency ENUM('high', 'medium', 'low') DEFAULT 'medium' COMMENT '紧急程度',
  related_id INT COMMENT '关联记录ID',
  related_type VARCHAR(50) COMMENT '关联记录类型',
  action_url VARCHAR(500) COMMENT '操作链接',
  -- 状态管理
  status ENUM('pending', 'read', 'handled', 'ignored') DEFAULT 'pending' COMMENT '预警状态',
  read_at TIMESTAMP NULL DEFAULT NULL COMMENT '阅读时间',
  handled_at TIMESTAMP NULL DEFAULT NULL COMMENT '处理时间',
  handled_by INT COMMENT '处理人',
  handler_notes TEXT COMMENT '处理备注',
  -- 元数据
  data JSON COMMENT '预警相关数据',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_tenant (tenant_id),
  INDEX idx_alert_id (alert_id),
  INDEX idx_alert_type (alert_type),
  INDEX idx_status (status),
  INDEX idx_urgency (urgency),
  INDEX idx_created_at (created_at),
  UNIQUE KEY uk_tenant_alert (tenant_id, alert_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警记录表';

-- 预警通知日志表
CREATE TABLE IF NOT EXISTS alert_notification_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  alert_id VARCHAR(100) NOT NULL,
  notification_type ENUM('email', 'sms', 'app', 'wechat') NOT NULL COMMENT '通知方式',
  recipient VARCHAR(200) NOT NULL COMMENT '接收人',
  subject VARCHAR(200) COMMENT '通知主题',
  content TEXT COMMENT '通知内容',
  status ENUM('pending', 'sent', 'failed') DEFAULT 'pending' COMMENT '发送状态',
  error_message TEXT COMMENT '错误信息',
  sent_at TIMESTAMP NULL DEFAULT NULL COMMENT '发送时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_alert_id (alert_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警通知日志表';

-- 用户预警已读状态（同一条预警可按用户独立已读）
CREATE TABLE IF NOT EXISTS alert_read_states (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  alert_id VARCHAR(100) NOT NULL COMMENT '预警唯一标识，如：maintenance_123',
  alert_type VARCHAR(64) NOT NULL COMMENT '预警类型，如：maintenance_due',
  related_id INT COMMENT '预警关联记录ID',
  read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '标记已读时间',
  handled_at TIMESTAMP NULL DEFAULT NULL COMMENT '标记已处理时间',
  handled_by INT COMMENT '处理人ID',
  handler_notes TEXT COMMENT '处理备注',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_user_alert (tenant_id, user_id, alert_id),
  INDEX idx_tenant_user (tenant_id, user_id),
  INDEX idx_tenant_type (tenant_id, alert_type),
  INDEX idx_read_at (read_at),
  INDEX idx_handled_at (handled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警已读状态表';

-- 插入默认预警设置示例数据（可选）
-- INSERT INTO alert_settings (tenant_id, user_id, maintenance_threshold, qualification_threshold, 
--   inspection_threshold, safety_threshold, uptime_threshold, notification_methods)
-- VALUES (1, 1, 
--   '{"days": [7,3,1]}',
--   '{"days": [90,30,7]}',
--   '{"days": [90,30,7]}',
--   '{"days": [30,7,1]}',
--   '{"threshold": 95}',
--   '{"email": true, "sms": false, "app": true}'
-- );
