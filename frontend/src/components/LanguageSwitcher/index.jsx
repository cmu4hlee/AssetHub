import React from 'react';
import { Dropdown, Button, Space, message } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { supportedLanguages, getCurrentLanguage } from '../../i18n';
import { i18nAPI } from '../../utils/api';

const LanguageSwitcher = ({ type = 'dropdown', size = 'middle' }) => {
  const { i18n, t } = useTranslation();
  const currentLang = getCurrentLanguage();

  const handleLanguageChange = async (langCode) => {
    try {
      // 先切换前端语言
      await i18n.changeLanguage(langCode);
      
      // 尝试同步到后端（用户已登录时）
      try {
        await i18nAPI.switchLanguage(langCode);
      } catch (_error) {
        // 用户未登录时忽略错误
      }
      
      message.success(t('common.success'));
    } catch (error) {
      message.error(t('common.failed'));
      console.error('Language switch error:', error);
    }
  };

  const currentLanguage = supportedLanguages.find(lang => lang.code === currentLang) || supportedLanguages[0];

  const menuItems = supportedLanguages.map(lang => ({
    key: lang.code,
    label: (
      <Space>
        <span>{lang.flag}</span>
        <span>{lang.name}</span>
      </Space>
    ),
    onClick: () => handleLanguageChange(lang.code),
  }));

  if (type === 'button') {
    return (
      <Button
        type="text"
        icon={<GlobalOutlined />}
        size={size}
        onClick={() => {
          const nextLang = currentLang === 'zh-CN' ? 'en-US' : 'zh-CN';
          handleLanguageChange(nextLang);
        }}
        title={t('common.select')}
      >
        {currentLanguage.name}
      </Button>
    );
  }

  return (
    <Dropdown
      menu={{ items: menuItems, selectedKeys: [currentLang] }}
      placement="bottomRight"
      arrow
    >
      <Button
        type="text"
        icon={<GlobalOutlined />}
        size={size}
      >
        <Space>
          <span>{currentLanguage.flag}</span>
          <span>{currentLanguage.name}</span>
        </Space>
      </Button>
    </Dropdown>
  );
};

export default LanguageSwitcher;
