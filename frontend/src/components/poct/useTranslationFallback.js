// 临时回退: react-i18next 包未安装,使用占位 t 函数
export const useTranslation = () => ({ t: (key) => key });
