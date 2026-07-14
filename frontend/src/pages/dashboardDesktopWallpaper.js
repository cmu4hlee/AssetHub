/**
 * 桌面壁纸配置 - 独立模块
 * 与 DashboardDesktop.jsx 解耦，便于独立维护壁纸资源
 */

export const PRESET_WALLPAPERS = [
  { id: 'default', name: '默认壁纸', color: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' },
  { id: 'gradient-blue', name: '蓝色渐变', color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'gradient-purple', name: '紫色星空', color: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' },
  { id: 'gradient-sunset', name: '落日余晖', color: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)' },
  { id: 'gradient-ocean', name: '蓝色海洋', color: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)' },
  { id: 'gradient-forest', name: '森林绿', color: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)' },
  { id: 'gradient-dark', name: '深空灰', color: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { id: 'gradient-aurora', name: '极光', color: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 50%, #00c6ff 100%)' },
  { id: 'gradient-pink', name: '粉色浪漫', color: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)' },
  { id: 'gradient-gold', name: '金色典雅', color: 'linear-gradient(135deg, #c9a227 0%, #f5d67b 50%, #c9a227 100%)' },
  { id: 'gradient-emerald', name: '翠绿', color: 'linear-gradient(135deg, #134e5e 0%, #2e8b57 50%, #134e5e 100%)' },
  { id: 'gradient-midnight', name: '午夜蓝', color: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
];

export const DESKTOP_WALLPAPER_KEY = 'fnos_desktop_wallpaper_v1';
export const DESKTOP_THEME_KEY = 'fnos_desktop_theme_v1';

export const normalizeWallpaper = (wallpaper) => {
  if (!wallpaper?.id) return null;
  const preset = PRESET_WALLPAPERS.find(item => item.id === wallpaper.id);
  return preset || wallpaper;
};
