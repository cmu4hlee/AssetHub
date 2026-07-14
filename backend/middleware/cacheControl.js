/**
 * HTTP 缓存控制中间件
 * 为不同类型的响应设置合适的缓存策略
 */

/**
 * 缓存控制选项
 */
const CACHE_OPTIONS = {
  // 不缓存
  NO_CACHE: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
  // 短期缓存（1分钟）
  SHORT: {
    'Cache-Control': 'public, max-age=60, s-maxage=60',
  },
  // 中期缓存（5分钟）
  MEDIUM: {
    'Cache-Control': 'public, max-age=300, s-maxage=300',
  },
  // 长期缓存（1小时）
  LONG: {
    'Cache-Control': 'public, max-age=3600, s-maxage=3600, immutable',
  },
  // 私有缓存（仅浏览器，5分钟）
  PRIVATE: {
    'Cache-Control': 'private, max-age=300, s-maxage=0',
  },
  // 静态资源（1年）
  STATIC: {
    'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
  },
};

/**
 * 创建缓存中间件
 * @param {string|Object} cacheType - 缓存类型或自定义缓存选项
 */
function createCacheMiddleware(cacheType = 'NO_CACHE') {
  const options = typeof cacheType === 'string'
    ? CACHE_OPTIONS[cacheType] || CACHE_OPTIONS.NO_CACHE
    : cacheType;

  return (req, res, next) => {
    // 设置缓存头
    Object.entries(options).forEach(([header, value]) => {
      res.setHeader(header, value);
    });
    next();
  };
}

/**
 * 静态资源缓存中间件
 * 用于 CSS, JS, 图片等静态资源
 */
const staticCache = createCacheMiddleware('STATIC');

/**
 * API 响应不缓存中间件
 * 用于需要实时数据的 API
 */
const noCache = createCacheMiddleware('NO_CACHE');

/**
 * 短期缓存中间件
 * 用于变化较频繁但不要求实时性的数据
 */
const shortCache = createCacheMiddleware('SHORT');

/**
 * 中期缓存中间件
 * 用于变化较少的参考数据
 */
const mediumCache = createCacheMiddleware('MEDIUM');

/**
 * 长期缓存中间件
 * 用于几乎不变化的数据
 */
const longCache = createCacheMiddleware('LONG');

/**
 * 私有缓存中间件
 * 用于用户特定的数据（只能缓存在浏览器私有缓存中）
 */
const privateCache = createCacheMiddleware('PRIVATE');

/**
 * ETag 生成中间件
 * 为响应生成 ETag 并处理条件请求
 */
function etagMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    // 如果已经有 ETag，跳过
    if (res.get('ETag')) {
      return originalJson(data);
    }

    // 生成简单的 ETag（基于响应内容的 hash）
    const content = JSON.stringify(data);
    const hash = require('crypto')
      .createHash('md5')
      .update(content)
      .digest('hex');

    res.set('ETag', `"${hash}"`);
    return originalJson(data);
  };

  next();
}

/**
 * 条件请求处理中间件
 * 处理 If-None-Match 和 If-Modified-Since
 */
function conditionalRequest(req, res, next) {
  // 如果是条件请求且 ETag 匹配，返回 304
  const ifNoneMatch = req.headers['if-none-match'];
  const etag = res.get('ETag');

  if (ifNoneMatch && etag && ifNoneMatch === etag) {
    res.status(304);
    res.end();
    return;
  }

  // 如果有 Last-Modified，处理 If-Modified-Since
  const ifModifiedSince = req.headers['if-modified-since'];
  const lastModified = res.get('Last-Modified');

  if (ifModifiedSince && lastModified) {
    const requestTime = new Date(ifModifiedSince).getTime();
    const responseTime = new Date(lastModified).getTime();

    if (responseTime <= requestTime) {
      res.status(304);
      res.end();
      return;
    }
  }

  next();
}

/**
 * 清除缓存中间件
 * 用于 POST, PUT, DELETE 请求后清除相关缓存
 */
function clearCacheMiddleware(patterns = []) {
  return (req, res, next) => {
    // 在响应发送后清除缓存（使用 res.on('finish')）
    res.on('finish', () => {
      // 这里可以添加缓存清除逻辑
      // 如果使用 Redis 缓存，可以在这里清除相关键
      if (patterns.length > 0 && req.cacheService) {
        const method = req.method.toUpperCase();
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
          // 清除匹配的缓存键
          patterns.forEach(pattern => {
            req.cacheService.deleteByPattern?.(pattern);
          });
        }
      }
    });
    next();
  };
}

/**
 * 根据路径自动选择缓存策略
 */
function autoCache(req, res, next) {
  const {path} = req;

  // 静态资源
  if (/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i.test(path)) {
    return staticCache(req, res, next);
  }

  // 健康检查不缓存
  if (path.includes('/health') || path.includes('/ready')) {
    return noCache(req, res, next);
  }

  // 仪表盘数据短期缓存
  if (path.includes('/dashboard')) {
    return shortCache(req, res, next);
  }

  // 列表查询默认不缓存（由前端控制）
  if (req.method === 'GET' && (path.includes('/list') || path.includes('/search'))) {
    return noCache(req, res, next);
  }

  // 详情查询短期缓存
  if (req.method === 'GET' && /\/[0-9]+$/.test(path)) {
    return shortCache(req, res, next);
  }

  // 默认不缓存
  return noCache(req, res, next);
}

module.exports = {
  CACHE_OPTIONS,
  createCacheMiddleware,
  staticCache,
  noCache,
  shortCache,
  mediumCache,
  longCache,
  privateCache,
  etagMiddleware,
  conditionalRequest,
  clearCacheMiddleware,
  autoCache,
};
