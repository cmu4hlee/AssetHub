/**
 * 访问控制中间件
 * 用于 IP 白名单和域名白名单检查
 */
const config = require('../config/app.config');

/**
 * 获取客户端真实 IP 地址
 */
function getClientIP(req) {
  // 如果启用了信任代理，从 X-Forwarded-For 获取
  if (config.network.trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // X-Forwarded-For 可能包含多个 IP，取第一个
      return forwarded.split(',')[0].trim();
    }
    // 如果没有 X-Forwarded-For，尝试 X-Real-IP
    if (req.headers['x-real-ip']) {
      return req.headers['x-real-ip'];
    }
  }
  // 否则使用连接 IP
  return req.connection.remoteAddress || req.socket.remoteAddress || req.ip;
}

/**
 * 检查 IP 是否在白名单中
 */
function isIPAllowed(ip) {
  if (!config.network.enableIPWhitelist || config.network.allowedIPs.length === 0) {
    return true; // 未启用白名单或白名单为空，允许所有 IP
  }

  // 检查精确匹配
  if (config.network.allowedIPs.includes(ip)) {
    return true;
  }

  // 检查 CIDR 格式（如 192.168.1.0/24）
  for (const allowedIP of config.network.allowedIPs) {
    if (allowedIP.includes('/')) {
      if (isIPInCIDR(ip, allowedIP)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 检查 IP 是否在 CIDR 范围内
 */
function isIPInCIDR(ip, cidr) {
  try {
    const [network, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength);

    const ipToNumber = ip => {
      return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    };

    const networkNum = ipToNumber(network);
    const ipNum = ipToNumber(ip);
    const mask = (0xffffffff << (32 - prefix)) >>> 0;

    return (networkNum & mask) === (ipNum & mask);
  } catch (error) {
    console.error('CIDR 检查错误:', error);
    return false;
  }
}

/**
 * 检查域名是否在白名单中
 */
function isDomainAllowed(host) {
  if (!config.network.enableDomainWhitelist || config.network.allowedDomains.length === 0) {
    return true; // 未启用白名单或白名单为空，允许所有域名
  }

  // 检查精确匹配
  if (config.network.allowedDomains.includes(host)) {
    return true;
  }

  // 检查通配符匹配（如 *.example.com）
  for (const allowedDomain of config.network.allowedDomains) {
    if (allowedDomain.startsWith('*.')) {
      const domain = allowedDomain.substring(2);
      if (host.endsWith(`.${domain}`) || host === domain) {
        return true;
      }
    }
  }

  return false;
}

/**
 * IP 白名单中间件
 */
function ipWhitelistMiddleware(req, res, next) {
  if (!config.network.enableIPWhitelist) {
    return next(); // 未启用 IP 白名单检查
  }

  const clientIP = getClientIP(req);

  if (!isIPAllowed(clientIP)) {
    console.warn(`🚫 IP 访问被拒绝: ${clientIP} - ${req.method} ${req.path}`);
    return res.status(403).json({
      success: false,
      message: '访问被拒绝：您的 IP 地址不在允许列表中',
      ip: clientIP,
    });
  }

  next();
}

/**
 * 域名白名单中间件
 */
function domainWhitelistMiddleware(req, res, next) {
  if (!config.network.enableDomainWhitelist) {
    return next(); // 未启用域名白名单检查
  }

  const host = req.headers.host || req.hostname;
  const domain = host.split(':')[0]; // 移除端口号

  if (!isDomainAllowed(domain)) {
    console.warn(`🚫 域名访问被拒绝: ${domain} - ${req.method} ${req.path}`);
    return res.status(403).json({
      success: false,
      message: '访问被拒绝：您的域名不在允许列表中',
      domain,
    });
  }

  next();
}

/**
 * 组合访问控制中间件
 */
function accessControlMiddleware(req, res, next) {
  // 先检查域名
  if (config.network.enableDomainWhitelist) {
    const host = req.headers.host || req.hostname;
    const domain = host.split(':')[0];
    if (!isDomainAllowed(domain)) {
      console.warn(`🚫 域名访问被拒绝: ${domain} - ${req.method} ${req.path}`);
      return res.status(403).json({
        success: false,
        message: '访问被拒绝：您的域名不在允许列表中',
        domain,
      });
    }
  }

  // 再检查 IP
  if (config.network.enableIPWhitelist) {
    const clientIP = getClientIP(req);
    if (!isIPAllowed(clientIP)) {
      console.warn(`🚫 IP 访问被拒绝: ${clientIP} - ${req.method} ${req.path}`);
      return res.status(403).json({
        success: false,
        message: '访问被拒绝：您的 IP 地址不在允许列表中',
        ip: clientIP,
      });
    }
  }

  next();
}

module.exports = {
  ipWhitelistMiddleware,
  domainWhitelistMiddleware,
  accessControlMiddleware,
  getClientIP,
  isIPAllowed,
  isDomainAllowed,
};
