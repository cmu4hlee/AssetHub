import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';

const resources = {
  'zh-CN': zhCN,
  'en-US': enUS,
  zh: zhCN,
  en: enUS,
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh-CN',
    debug: import.meta.env.DEV,

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false,
    },
  });

// 兼容旧 namespace 语法 'poct:tab.home' (代码里这样写, 实际资源是 translation.poct.tab.home)
// 因为 zh-CN/index.js 展开 poct.json 内容到 translation 下, 没有独立 poct namespace
// 包装 t(): 检测 'xxx:yyy' 形式, 如果 'xxx' 不是真 namespace, 自动转为 'xxx.yyy'
const _originalT = i18n.t.bind(i18n);
const _validNamespaces = new Set(i18n.options.ns || ['translation']);
i18n.t = function (key, ...args) {
  if (typeof key === 'string' && key.includes(':')) {
    const [prefix, ...rest] = key.split(':');
    if (prefix && !_validNamespaces.has(prefix)) {
      // 旧 namespace 语法 → 转为点分 key
      return _originalT(`${prefix}.${rest.join(':')}`, ...args);
    }
  }
  return _originalT(key, ...args);
};

export default i18n;

export const supportedLanguages = [
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
];

export const changeLanguage = (lng) => {
  return i18n.changeLanguage(lng);
};

export const getCurrentLanguage = () => {
  return i18n.language;
};
