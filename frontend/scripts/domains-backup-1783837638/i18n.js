/**
 * 国际化 API
 * 提供语言切换和翻译相关接口
 */

import { api } from '../client';

export const i18nAPI = {
  /**
   * 获取支持的语言列表
   */
  getLocales: () => api.get('/i18n/locales'),

  /**
   * 获取指定语言的翻译消息
   * @param {string} locale - 语言代码
   * @param {string} namespace - 命名空间
   */
  getMessages: (locale, namespace = 'common') =>
    api.get(`/i18n/messages/${locale}?namespace=${namespace}`),

  /**
   * 翻译文本
   * @param {string} key - 翻译键
   * @param {string} locale - 语言代码
   * @param {string} namespace - 命名空间
   * @param {object} params - 插值参数
   */
  translate: (key, locale, namespace = 'common', params = {}) =>
    api.post('/i18n/translate', { key, locale, namespace, params }),

  /**
   * 切换用户语言偏好
   * @param {string} locale - 语言代码
   */
  switchLanguage: (locale) => api.post('/i18n/switch', { locale }),
};
