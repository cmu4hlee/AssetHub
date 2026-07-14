/**
 * 轻量级配置服务（微服务独立版本）
 * 避免直接依赖 monolith/backend 下的配置模块。
 */

const warnedKeys = new Set();

const warnOnce = (key, message) => {
  if (warnedKeys.has(key)) {
    return;
  }
  warnedKeys.add(key);
  console.warn(message);
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getDatabaseConfig = () => ({
  host: process.env.DATABASE_HOST || 'localhost',
  port: toInt(process.env.DATABASE_PORT, 3306),
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'asset_management',
});

const getRedisConfig = () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: toInt(process.env.REDIS_PORT, 6379),
  password: process.env.REDIS_PASSWORD || '',
  keyPrefix: process.env.REDIS_PREFIX || 'assethub:',
});

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET && String(process.env.JWT_SECRET).trim();
  if (secret) {
    return secret;
  }

  const fallback = 'assethub-dev-only-secret';
  warnOnce(
    'jwt-secret',
    'WARN: JWT_SECRET 未配置，当前使用仅用于开发环境的默认密钥。'
  );
  return fallback;
};

let configService = null;

const getConfigService = () => {
  if (!configService) {
    configService = {
      getDatabaseConfig,
      getRedisConfig,
      getJwtSecret,
    };
  }

  return configService;
};

module.exports = {
  getConfigService,
};
