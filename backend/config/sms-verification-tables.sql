-- 短信验证码表
CREATE TABLE IF NOT EXISTS sms_verification_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL COMMENT '手机号',
  code VARCHAR(10) NOT NULL COMMENT '验证码',
  tenant_id INT NULL COMMENT '租户ID（新用户注册时为NULL）',
  expires_at DATETIME NOT NULL COMMENT '过期时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_phone_tenant (phone, tenant_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='短信验证码表';

-- 用户表添加手机号字段（如果不存在）
-- ALTER TABLE users ADD COLUMN phone VARCHAR(20) COMMENT '手机号' AFTER email;
-- ALTER TABLE users ADD UNIQUE INDEX idx_phone_tenant (phone, tenant_id);