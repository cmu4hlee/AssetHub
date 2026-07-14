/**
 * 国际化中间件
 * 处理语言设置和翻译
 */

const i18nService = require('../services/i18n.service');

/**
 * 从请求头或查询参数中获取语言
 */
function getLocaleFromRequest(req) {
  // 1. 从查询参数获取
  const queryLocale = req.query.lang || req.query.locale;
  if (queryLocale && i18nService.isSupported(queryLocale)) {
    return queryLocale;
  }

  // 2. 从请求头获取
  const headerLocale = req.headers['accept-language'];
  if (headerLocale) {
    // 解析 Accept-Language 头
    const locales = headerLocale.split(',').map(l => l.trim().split(';')[0]);
    for (const locale of locales) {
      // 处理类似 zh-CN, en-US 的格式
      const shortLocale = locale.split('-')[0];
      if (i18nService.isSupported(shortLocale)) {
        return shortLocale;
      }
    }
  }

  // 3. 默认语言
  return i18nService.defaultLocale;
}

/**
 * i18n 中间件
 */
function i18nMiddleware(req, res, next) {
  // 获取语言
  const locale = getLocaleFromRequest(req);
  req.locale = locale;

  // 添加翻译函数到请求和响应
  req.t = (key, options = {}) => {
    return i18nService.t(key, { locale, ...options });
  };

  res.locals.t = req.t;

  // 添加语言相关响应头
  res.setHeader('Content-Language', locale);

  next();
}

/**
 * 错误消息国际化中间件
 */
function errorI18nMiddleware(err, req, res, next) {
  const locale = req.locale || i18nService.defaultLocale;

  // 如果错误消息有对应的翻译键
  if (err.messageKey) {
    err.message = i18nService.t(err.messageKey, { locale, ...err.messageParams });
  }

  // 翻译验证错误
  if (err.validationErrors) {
    err.validationErrors = err.validationErrors.map(error => ({
      ...error,
      message: i18nService.t(error.messageKey || error.message, { locale }),
    }));
  }

  next(err);
}

module.exports = {
  i18nMiddleware,
  errorI18nMiddleware,
};
