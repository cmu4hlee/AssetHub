import { useState, useEffect, useCallback } from 'react';

/**
 * 统一管理 localStorage 的 Hook
 * 自动缓存 JSON.parse 结果，减少重复解析开销
 *
 * @param {string} key - localStorage 键名
 * @param {any} initialValue - 初始值（当键不存在时使用）
 * @returns {[any, Function, Function]} [值, 设置值函数, 删除函数]
 */
const useLocalStorage = (key, initialValue) => {
  // 使用函数初始化，避免每次渲染时都调用 JSON.parse
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`useLocalStorage: 读取 ${key} 失败:`, error);
      return initialValue;
    }
  });

  // 更新值
  const setValue = useCallback((value) => {
    try {
      // 支持函数式更新
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(`useLocalStorage: 保存 ${key} 失败:`, error);
    }
  }, [key, storedValue]);

  // 删除值
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`useLocalStorage: 删除 ${key} 失败:`, error);
    }
  }, [key, initialValue]);

  // 跨标签页同步（当其他标签修改了 localStorage 时同步更新）
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.warn(`useLocalStorage: 同步 ${key} 失败:`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, removeValue];
};

export default useLocalStorage;
