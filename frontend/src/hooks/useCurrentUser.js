import { useState, useEffect } from 'react';
import crypto from '../utils/crypto';

/**
 * 统一读取当前用户信息的 Hook
 * 自动使用 crypto.getItemAsync 解密读取敏感用户数据
 *
 * @returns {{ user: object|null, loading: boolean }}
 */
const useCurrentUser = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const u = await crypto.getItemAsync('user');
        if (!cancelled) {
          setUser(u);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const isAuthenticated = !!user;

  return { user, loading, isAuthenticated };
};

export default useCurrentUser;
