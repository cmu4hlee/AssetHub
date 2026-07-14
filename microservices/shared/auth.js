/**
 * 微服务通用认证中间件
 * - 优先信任网关透传的 X-User-* 请求头
 * - 其次解析 Authorization Bearer Token
 */

const { getConfigService } = require('./config-service');

let jwtLib = null;
try {
  jwtLib = require('jsonwebtoken');
} catch (error) {
  // jsonwebtoken 缺失时退化到仅解码，不做签名校验（仅开发环境建议）
}

const toInt = value => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeUser = decoded => ({
  id: decoded.id ?? decoded.userId ?? null,
  username: decoded.username ?? decoded.user_name ?? null,
  role: decoded.role || 'user',
  tenant_id: toInt(
    decoded.tenant_id ?? decoded.tenantId ?? decoded.tenantID ?? decoded.selected_tenant_id
  ),
});

const decodeJwtPayload = token => {
  const parts = String(token).split('.');
  if (parts.length !== 3) {
    throw new Error('INVALID_TOKEN_FORMAT');
  }

  const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
  return JSON.parse(payload);
};

const authenticate = (req, res, next) => {
  const headerUserId = req.headers['x-user-id'];
  const headerUserRole = req.headers['x-user-role'];
  const headerTenantId = req.headers['x-tenant-id'];

  if (headerUserId || headerUserRole || headerTenantId) {
    req.user = {
      id: toInt(headerUserId) ?? headerUserId ?? null,
      role: headerUserRole || 'user',
      tenant_id: toInt(headerTenantId),
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    return res.status(401).json({
      success: false,
      message: '缺少认证令牌',
      code: 'UNAUTHORIZED',
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '无效的认证令牌',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    let decoded;

    if (jwtLib) {
      const secret = getConfigService().getJwtSecret();
      decoded = jwtLib.verify(token, secret);
    } else {
      decoded = decodeJwtPayload(token);
    }

    req.user = normalizeUser(decoded);
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '认证失败或令牌已过期',
      code: 'INVALID_TOKEN',
    });
  }
};

module.exports = {
  authenticate,
};
