const WEAK_JWT_SECRETS = new Set([
  'your-super-secret-jwt-key-change-in-production',
  'development-secret-key-change-in-production',
  'changeme',
  'secret',
  'jwt-secret',
]);

const readEnv = name => String(process.env[name] || '').trim();

const validateCredentialPair = (errors, leftKey, rightKey, label) => {
  const left = readEnv(leftKey);
  const right = readEnv(rightKey);
  const hasLeft = Boolean(left);
  const hasRight = Boolean(right);

  if (hasLeft !== hasRight) {
    errors.push(`${label} 配置不完整：请同时设置 ${leftKey} 和 ${rightKey}`);
  }
};

function validateCriticalEnv({ throwOnError = false, logger = console } = {}) {
  const errors = [];
  const warnings = [];

  const jwtSecret = readEnv('JWT_SECRET');
  if (!jwtSecret) {
    errors.push('缺少必填环境变量 JWT_SECRET');
  } else {
    if (WEAK_JWT_SECRETS.has(jwtSecret)) {
      errors.push('JWT_SECRET 使用了弱默认值，请使用强随机密钥');
    }
    if (jwtSecret.length < 24) {
      errors.push('JWT_SECRET 长度过短，至少需要 24 个字符');
    }
  }

  validateCredentialPair(errors, 'CHAT2DB_USERNAME', 'CHAT2DB_PASSWORD', 'Chat2DB账号');
  validateCredentialPair(
    errors,
    'SQLBOT_OPEN_API_USERNAME',
    'SQLBOT_OPEN_API_PASSWORD',
    'SQLBot账号',
  );

  if (!readEnv('DEEPSEEK_API_KEY')) {
    warnings.push('未配置 DEEPSEEK_API_KEY，DeepSeek 能力将被禁用');
  }
  if (!readEnv('ANTHROPIC_API_KEY')) {
    warnings.push('未配置 ANTHROPIC_API_KEY，Anthropic 能力将被禁用');
  }
  if (!readEnv('CHAT2DB_AI_API_KEY')) {
    warnings.push('未配置 CHAT2DB_AI_API_KEY，Chat2DB AI 增强配置将被跳过');
  }

  if (warnings.length > 0) {
    warnings.forEach(item => logger.warn(`[ENV] ${item}`));
  }

  if (errors.length > 0) {
    if (throwOnError) {
      const error = new Error('关键环境变量校验失败');
      error.details = errors;
      throw error;
    }
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors, warnings };
}

module.exports = {
  validateCriticalEnv,
};
