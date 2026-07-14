-- 消息平台集成相关表结构
-- 创建于: 2026-03-06

-- 集成渠道配置表
CREATE TABLE IF NOT EXISTS integration_channels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  channel_key VARCHAR(50) NOT NULL COMMENT '渠道标识: wechat/sms/feishu/dingtalk',
  channel_name VARCHAR(100) NOT NULL COMMENT '渠道名称',
  enabled TINYINT(1) DEFAULT 0 COMMENT '是否启用',
  config JSON COMMENT '渠道配置（加密存储敏感信息）',
  templates JSON COMMENT '消息模板配置',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uk_tenant_channel (tenant_id, channel_key),
  INDEX idx_tenant (tenant_id),
  INDEX idx_channel_key (channel_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息平台集成渠道配置表';

-- 消息发送日志表
CREATE TABLE IF NOT EXISTS integration_message_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  channel_key VARCHAR(50) NOT NULL COMMENT '发送渠道',
  message_type VARCHAR(50) COMMENT '消息类型',
  recipient VARCHAR(200) NOT NULL COMMENT '接收人',
  title VARCHAR(200) COMMENT '消息标题',
  content TEXT COMMENT '消息内容',
  template_id VARCHAR(100) COMMENT '使用的模板ID',
  template_params JSON COMMENT '模板参数',
  status ENUM('pending', 'sent', 'failed', 'delivered') DEFAULT 'pending' COMMENT '发送状态',
  error_message TEXT COMMENT '错误信息',
  retry_count INT DEFAULT 0 COMMENT '重试次数',
  sent_at TIMESTAMP NULL DEFAULT NULL COMMENT '发送时间',
  delivered_at TIMESTAMP NULL DEFAULT NULL COMMENT '送达时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_channel (channel_key),
  INDEX idx_status (status),
  INDEX idx_recipient (recipient),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息发送日志表';

-- 消息模板表（备用，如果使用独立表存储模板）
CREATE TABLE IF NOT EXISTS integration_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  channel_key VARCHAR(50) NOT NULL COMMENT '所属渠道',
  template_code VARCHAR(100) NOT NULL COMMENT '模板编码',
  template_name VARCHAR(200) NOT NULL COMMENT '模板名称',
  template_content TEXT NOT NULL COMMENT '模板内容',
  template_type ENUM('text', 'markdown', 'html', 'card') DEFAULT 'text' COMMENT '模板类型',
  variables JSON COMMENT '模板变量定义',
  description TEXT COMMENT '模板说明',
  is_default TINYINT(1) DEFAULT 0 COMMENT '是否默认模板',
  enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uk_tenant_channel_code (tenant_id, channel_key, template_code),
  INDEX idx_tenant (tenant_id),
  INDEX idx_channel (channel_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息模板表';

-- 插入默认模板数据示例（可选）
-- INSERT INTO integration_templates (tenant_id, channel_key, template_code, template_name, template_content, description)
-- VALUES 
-- (1, 'sms', 'maintenance_reminder', '保养提醒', '您好，设备{asset_name}的保养计划将于{date}到期，请及时处理。', '设备保养到期提醒'),
-- (1, 'wechat', 'qualification_expire', '资质到期提醒', '您的{certificate_name}将于{date}到期，请及时办理续期。', '人员资质到期提醒');
