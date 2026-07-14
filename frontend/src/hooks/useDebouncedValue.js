import { useState, useEffect, useRef } from 'react';

/**
 * 防抖值 Hook
 * @param {*} value - 需要防抖的值
 * @param {number} delay - 延迟毫秒数，默认 300
 * @returns 防抖后的值
 *
 * 用于搜索输入等场景，避免每次按键都触发请求
 */
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, delay]);

  return debounced;
}
