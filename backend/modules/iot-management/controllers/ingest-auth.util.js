const crypto = require('crypto');
const db = require('../../../config/database');

let tokenTableReady = false;

const ensureIotTenantTokenTable = async () => {
  if (tokenTableReady) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS iot_tenant_tokens (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      token_name VARCHAR(120) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      token_prefix VARCHAR(24) NOT NULL,
      scope_json LONGTEXT NOT NULL,
      status ENUM('active','revoked') NOT NULL DEFAULT 'active',
      expires_at DATETIME NULL,
      last_used_at DATETIME NULL,
      created_by VARCHAR(100) NULL,
      revoked_by VARCHAR(100) NULL,
      revoked_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT NULL,
      UNIQUE KEY uk_iot_tenant_token_hash (token_hash),
      INDEX idx_iot_tenant_status (tenant_id, status),
      INDEX idx_iot_tenant_created_at (tenant_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='企业IoT接口鉴权Token';
  `);
  tokenTableReady = true;
};

const resolveIotTokenPepper = () => {
  const pepper = String(process.env.IOT_TOKEN_PEPPER || process.env.JWT_SECRET || '').trim();
  if (!pepper) {
    throw new Error('缺少 IOT_TOKEN_PEPPER 或 JWT_SECRET，无法校验 IoT 上报令牌');
  }
  return pepper;
};

const hashIotToken = token => {
  const pepper = resolveIotTokenPepper();
  return crypto.createHash('sha256').update(`${token}:${pepper}`).digest('hex');
};

function getProvidedToken(req) {
  const headerToken = req.headers['x-iot-token'];
  if (headerToken) {
    return String(headerToken).trim();
  }

  const authorization = req.headers.authorization || req.headers.Authorization;
  if (authorization && typeof authorization === 'string') {
    const [scheme, token] = authorization.split(' ');
    if (/^Bearer$/i.test(scheme) && token) {
      return token.trim();
    }
  }

  const queryToken = req.query?.token || req.query?.iot_token;
  if (queryToken) {
    return String(queryToken).trim();
  }

  return '';
}

function normalizeScopes(scopeValue) {
  if (!scopeValue) return [];
  if (Array.isArray(scopeValue)) return scopeValue;
  try {
    const parsed = JSON.parse(scopeValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function findTokenRecordByHash(tokenHash) {
  const [rows] = await db.execute(
    `SELECT id, tenant_id, scope_json, status, expires_at
     FROM iot_tenant_tokens
     WHERE token_hash = ?
     LIMIT 1`,
    [tokenHash],
  );
  return rows.length > 0 ? rows[0] : null;
}

async function hasAnyActiveToken(scopeKey) {
  const [rows] = await db.execute(
    `SELECT scope_json
     FROM iot_tenant_tokens
     WHERE status = 'active'
       AND (expires_at IS NULL OR expires_at > NOW())`,
  );
  if ((rows?.length || 0) <= 0) return false;

  if (!scopeKey) return true;
  return rows.some(item => {
    const scopes = normalizeScopes(item.scope_json);
    return scopes.includes('all') || scopes.includes(scopeKey);
  });
}

async function verifyIngestToken(req, res, options = {}) {
  const {
    expectedToken = '',
    moduleName = 'IoT',
    scope = '',
  } = options;

  const normalizedExpectedToken = String(expectedToken || '').trim();
  const providedToken = getProvidedToken(req);

  if (normalizedExpectedToken && providedToken && providedToken === normalizedExpectedToken) {
    req.iotAuth = { source: 'env', scope };
    return true;
  }

  try {
    await ensureIotTenantTokenTable();
    const hasDbToken = await hasAnyActiveToken(scope);
    const hasEnvToken = normalizedExpectedToken.length > 0;
    if (!hasEnvToken && !hasDbToken) {
      res.status(503).json({
        success: false,
        message: `${moduleName} 上报令牌未配置`,
        hint: '请配置环境变量令牌或创建企业 IoT 令牌后再上报',
      });
      return false;
    }

    if (!providedToken) {
      res.status(401).json({
        success: false,
        message: `${moduleName} 上报令牌无效`,
        hint: '请在 x-iot-token 或 Authorization: Bearer <token> 中提供有效令牌',
      });
      return false;
    }

    const tokenHash = hashIotToken(providedToken);
    const tokenRecord = await findTokenRecordByHash(tokenHash);
    if (!tokenRecord || tokenRecord.status !== 'active') {
      res.status(401).json({
        success: false,
        message: `${moduleName} 上报令牌无效`,
      });
      return false;
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at).getTime() <= Date.now()) {
      res.status(401).json({
        success: false,
        message: `${moduleName} 上报令牌已过期`,
      });
      return false;
    }

    const tokenScopes = normalizeScopes(tokenRecord.scope_json);
    if (scope && !tokenScopes.includes('all') && !tokenScopes.includes(scope)) {
      res.status(403).json({
        success: false,
        message: `${moduleName} 令牌权限不足`,
      });
      return false;
    }

    req.iotAuth = {
      source: 'tenant-token',
      token_id: tokenRecord.id,
      tenant_id: tokenRecord.tenant_id,
      scope,
    };

    await db.execute('UPDATE iot_tenant_tokens SET last_used_at = NOW(), updated_at = NOW() WHERE id = ?', [
      tokenRecord.id,
    ]);

    return true;
  } catch (error) {
    console.error('IoT 上报Token校验失败:', error);
    res.status(500).json({
      success: false,
      message: `${moduleName} 令牌校验失败`,
    });
    return false;
  }
}

module.exports = {
  getProvidedToken,
  verifyIngestToken,
};
