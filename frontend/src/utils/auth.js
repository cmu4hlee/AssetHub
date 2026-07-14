import crypto from './crypto';

const parseJSON = value => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

// 检查是否是 JWT token (base64 编码的字符串)
const isJWTLike = value => {
  if (!value || typeof value !== 'string') return false;
  // JWT token 有三部分，用 . 分隔
  const parts = value.split('.');
  return parts.length === 3;
};

const OPENCLAW_WEB_CREDENTIALS_KEY = 'openclaw_web_credentials';

// 同步读取用户信息（优先缓存，兼容简单编码和加密数据）
const getSyncUser = () => {
  // 优先内存缓存（crypto.getItem 会检查 memoryCache）
  const cached = crypto.getItem('user');
  if (cached) return cached;

  // 兼容简单编码数据（非 E: 开头）
  const rawUser = localStorage.getItem('user');
  if (rawUser) {
    if (isJWTLike(rawUser)) {
      console.warn('检测到 localStorage 中存储了 JWT token 而不是用户对象');
      return null;
    }
    // 如果是简单编码（非加密），直接解码
    if (!rawUser.startsWith('E:')) {
      const decoded = crypto.decodeSimple(rawUser);
      return decoded ? parseJSON(decoded) : null;
    }
    // E: 开头的加密数据无法同步解密，返回 null（调用方应使用异步方式）
    return null;
  }
  return null;
};

const auth = {
  getToken() {
    return crypto.getItem('token') || '';
  },

  getUser() {
    return getSyncUser();
  },

  async getUserAsync() {
    // 首先尝试同步读取（缓存或简单编码）
    const user = getSyncUser();
    if (user) return user;

    // 如果是加密数据，异步解密
    return await crypto.getItemAsync('user');
  },

  getSelectedEnterprise() {
    const cached = crypto.getItem('selectedEnterprise');
    if (cached) return cached;

    const raw = localStorage.getItem('selectedEnterprise');
    if (raw && !raw.startsWith('E:')) {
      const decoded = crypto.decodeSimple(raw);
      return decoded ? parseJSON(decoded) : null;
    }
    return null;
  },

  async getSelectedEnterpriseAsync() {
    const selected = this.getSelectedEnterprise();
    if (selected) return selected;
    return await crypto.getItemAsync('selectedEnterprise');
  },

  getEffectiveTenantId() {
    const user = this.getUser();
    if (user?.role === 'super_admin') {
      const selectedEnterprise = this.getSelectedEnterprise();
      return selectedEnterprise?.id || user?.tenant_id || null;
    }

    return user?.tenant_id || null;
  },

  setOpenClawCredentials(credentials = {}) {
    const username = String(credentials.username || '').trim();
    const password = String(credentials.password || '').trim();

    if (!username || !password) {
      sessionStorage.removeItem(OPENCLAW_WEB_CREDENTIALS_KEY);
      return;
    }

    sessionStorage.setItem(
      OPENCLAW_WEB_CREDENTIALS_KEY,
      JSON.stringify({
        username,
        password,
      }),
    );
  },

  getOpenClawCredentials() {
    const stored = parseJSON(sessionStorage.getItem(OPENCLAW_WEB_CREDENTIALS_KEY));
    if (!stored || typeof stored !== 'object') {
      return null;
    }

    const username = String(stored.username || '').trim();
    const password = String(stored.password || '').trim();
    if (!username || !password) {
      return null;
    }

    return {
      username,
      password,
    };
  },

  clearOpenClawCredentials() {
    sessionStorage.removeItem(OPENCLAW_WEB_CREDENTIALS_KEY);
  },
};

export default auth;
