import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';

const THEME_STORAGE_KEY = 'assettube_theme_mode';
const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const getInitialTheme = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme');
    if (themeParam === 'dark' || themeParam === 'light') {
      return themeParam;
    }
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' || saved === 'light' ? saved : 'light';
  };

  const [themeMode, setThemeMode] = useState(getInitialTheme);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    document.documentElement.setAttribute('data-theme', themeMode);
    document.body.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  const value = useMemo(() => {
    const toggleThemeMode = () => {
      setThemeMode(prev => (prev === 'dark' ? 'light' : 'dark'));
    };
    return {
      themeMode,
      setThemeMode,
      toggleThemeMode,
    };
  }, [themeMode]);

  const antdThemeConfig = useMemo(
    () => ({
      algorithm:
        themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      getPopupContainer: trigger => trigger?.ownerDocument?.body || document.body,
      token:
        themeMode === 'dark'
          ? {
              colorPrimary: '#d97757',
              colorInfo: '#7db3d9',
              colorSuccess: '#8fa874',
              colorWarning: '#d4a03a',
              colorError: '#c94d45',
              colorBgBase: '#141413',
              colorBgLayout: '#141413',
              colorBgContainer: '#1c1b1a',
              colorBgElevated: '#262524',
              colorBgSpotlight: '#1c1b1a',
              colorBgMask: 'rgba(0, 0, 0, 0.5)',
              colorBorder: '#3d3c3a',
              colorBorderSecondary: '#2e2d2b',
              colorText: '#f5f4f2',
              colorTextSecondary: '#a8a5a1',
              colorTextTertiary: '#7a7875',
              colorTextQuaternary: '#565452',
              colorFill: 'rgba(255, 255, 255, 0.06)',
              colorFillSecondary: 'rgba(255, 255, 255, 0.03)',
              colorFillTertiary: 'rgba(255, 255, 255, 0.015)',
              colorFillQuaternary: 'rgba(255, 255, 255, 0.008)',
              colorLink: '#c9756b',
              colorLinkHover: '#d98780',
              colorLinkActive: '#b5635a',
              borderRadius: 8,
              borderRadiusLG: 12,
              borderRadiusSM: 4,
            }
          : {
              colorPrimary: '#d97757',
              colorInfo: '#6a9bcc',
              colorSuccess: '#788c5d',
              colorWarning: '#d4a03a',
              colorError: '#c94d45',
              colorBgBase: '#fdfcfa',
              colorBgLayout: '#f7f5f2',
              colorBgContainer: '#fdfcfa',
              colorBgElevated: '#ffffff',
              colorBgSpotlight: '#ffffff',
              colorBgMask: 'rgba(0, 0, 0, 0.5)',
              colorBorder: '#d4d1cc',
              colorBorderSecondary: '#e8e5e0',
              colorText: '#1a1918',
              colorTextSecondary: '#5c5956',
              colorTextTertiary: '#8a8784',
              colorTextQuaternary: '#b5b2ae',
              colorFill: 'rgba(26, 25, 24, 0.03)',
              colorFillSecondary: 'rgba(26, 25, 24, 0.015)',
              colorFillTertiary: 'rgba(26, 25, 24, 0.008)',
              colorFillQuaternary: 'rgba(26, 25, 24, 0.004)',
              colorLink: '#c9756b',
              colorLinkHover: '#d98780',
              colorLinkActive: '#b5635a',
              borderRadius: 8,
              borderRadiusLG: 12,
              borderRadiusSM: 4,
            },
    }),
    [themeMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={antdThemeConfig}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useThemeMode = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return ctx;
};
