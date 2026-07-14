/**
 * 国际化服务
 * 提供多语言翻译支持
 */

const path = require('path');
const fs = require('fs');

class I18nService {
  constructor() {
    this.locales = {};
    this.defaultLocale = 'zh';
    this.supportedLocales = ['zh', 'en'];
    this.loadTranslations();
  }

  /**
   * 加载翻译文件
   */
  loadTranslations() {
    const localesDir = path.join(__dirname, '../locales');

    for (const locale of this.supportedLocales) {
      const localePath = path.join(localesDir, locale);
      if (fs.existsSync(localePath)) {
        this.locales[locale] = {};

        // 加载所有命名空间
        const files = fs.readdirSync(localePath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const namespace = file.replace('.json', '');
            const filePath = path.join(localePath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            this.locales[locale][namespace] = JSON.parse(content);
          }
        }
      }
    }
  }

  /**
   * 设置默认语言
   */
  setDefaultLocale(locale) {
    if (this.supportedLocales.includes(locale)) {
      this.defaultLocale = locale;
    }
  }

  /**
   * 获取翻译
   */
  t(key, options = {}) {
    const { locale = this.defaultLocale, namespace = 'common', ...interpolation } = options;

    // 获取翻译
    const translations = this.locales[locale]?.[namespace];
    if (!translations) {
      return key;
    }

    // 解析键值路径
    const keys = key.split('.');
    let value = translations;

    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        return key;
      }
    }

    // 字符串插值
    if (typeof value === 'string') {
      return this.interpolate(value, interpolation);
    }

    return value;
  }

  /**
   * 字符串插值
   */
  interpolate(str, values) {
    return str.replace(/\{(\w+)\}/g, (match, key) => {
      return values[key] !== undefined ? values[key] : match;
    });
  }

  /**
   * 检查语言是否支持
   */
  isSupported(locale) {
    return this.supportedLocales.includes(locale);
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLocales() {
    return this.supportedLocales.map(code => ({
      code,
      name: this.getLocaleName(code),
    }));
  }

  /**
   * 获取语言名称
   */
  getLocaleName(locale) {
    const names = {
      zh: '简体中文',
      en: 'English',
    };
    return names[locale] || locale;
  }

  /**
   * 重新加载翻译
   */
  reload() {
    this.locales = {};
    this.loadTranslations();
  }
}

// 创建单例
const i18nService = new I18nService();

module.exports = i18nService;
