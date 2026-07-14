/**
 * 飞书开放平台 API 客户端
 * 封装 tenant_access_token 获取/缓存、消息发送、OAuth 换 token、用户信息查询等能力
 *
 * 文档参考:
 *   - 获取 tenant_access_token: https://open.feishu.cn/document/server-docs/authentication-management/access-token/tenant_access_token_internal
 *   - 发送消息: https://open.feishu.cn/document/server-docs/im-v1/message/create
 *   - 获取用户 access_token: https://open.feishu.cn/document/server-docs/authentication-management/access-token/get-user-access-token
 *   - 获取用户信息: https://open.feishu.cn/document/server-docs/authentication-management/login-state-management/get
 */
const axios = require('axios');
const logger = require('../../../config/logger');
const { cacheService, redis } = require('../../../services/redis');

const FEISHU_HOST = process.env.FEISHU_HOST || 'https://open.feishu.cn';
const FEISHU_API_PREFIX = '/open-apis';

// 内存级 token 缓存（redis 不可用时降级使用）
const memoryTokenCache = new Map(); // key -> { value, expireAt }

/**
 * 读取缓存（优先 redis，降级内存）
 */
async function readCache(key) {
  try {
    if (redis && redis.status === 'ready') {
      const v = await cacheService.get(key, 0);
      return v;
    }
  } catch (e) {
    // 忽略，走内存
  }
  const entry = memoryTokenCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expireAt) {
    memoryTokenCache.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * 写入缓存（带 TTL，秒）
 */
async function writeCache(key, value, ttlSeconds) {
  try {
    if (redis && redis.status === 'ready') {
      await cacheService.set(key, value, ttlSeconds, 0);
      return;
    }
  } catch (e) {
    // 忽略，走内存
  }
  memoryTokenCache.set(key, {
    value,
    expireAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * 解析飞书应用凭证
 * 优先级: 显式参数 > 环境变量
 */
function resolveCredentials(options = {}) {
  const appId = options.appId || process.env.FEISHU_APP_ID || '';
  const appSecret = options.appSecret || process.env.FEISHU_APP_SECRET || '';
  if (!appId || !appSecret) {
    const err = new Error('飞书应用凭证缺失：请配置 FEISHU_APP_ID / FEISHU_APP_SECRET');
    err.code = 'FEISHU_CREDENTIAL_MISSING';
    throw err;
  }
  return { appId, appSecret };
}

/**
 * 获取 tenant_access_token（带缓存，默认 7000s，略小于飞书的 7200s）
 * @param {Object} [options]
 * @param {string} [options.appId]
 * @param {string} [options.appSecret]
 * @param {boolean} [options.forceRefresh] - 强制刷新
 * @returns {Promise<string>}
 */
async function getTenantAccessToken(options = {}) {
  const { appId, appSecret } = resolveCredentials(options);
  const cacheKey = `feishu:tenant_access_token:${appId}`;

  if (!options.forceRefresh) {
    const cached = await readCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const url = `${(options.host || FEISHU_HOST)}${FEISHU_API_PREFIX}/auth/v3/tenant_access_token/internal`;
  let response;
  try {
    response = await axios.post(
      url,
      { app_id: appId, app_secret: appSecret },
      { timeout: 10000, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  } catch (e) {
    const err = new Error(`获取 tenant_access_token 网络错误: ${e.message}`);
    err.code = 'FEISHU_NETWORK_ERROR';
    err.cause = e;
    throw err;
  }

  const data = response.data;
  if (!data || data.code !== 0) {
    const err = new Error(`获取 tenant_access_token 失败: ${data?.msg || '未知错误'} (code=${data?.code})`);
    err.code = 'FEISHU_API_ERROR';
    err.apiCode = data?.code;
    err.apiMsg = data?.msg;
    throw err;
  }

  const token = data.tenant_access_token;
  const expire = Math.min(Number(data.expire) || 7200, 7200) - 200; // 留 200s 缓冲
  await writeCache(cacheKey, token, expire);
  logger.info('飞书 tenant_access_token 已获取并缓存', { appId, expire });
  return token;
}

/**
 * 构造 OAuth 授权 URL（网页授权扫码）
 * @param {Object} [options]
 * @param {string} [options.redirectUri] - 回调地址
 * @param {string} [options.state] - 防 CSRF
 */
function buildAuthUrl(options = {}) {
  const { appId } = resolveCredentials(options);
  const redirectUri =
    options.redirectUri || process.env.FEISHU_REDIRECT_URI || '';
  const state = options.state || Math.random().toString(36).slice(2);
  const params = new URLSearchParams({
    app_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  return {
    authUrl: `${FEISHU_HOST}${FEISHU_API_PREFIX}/authen/v1/authorize?${params.toString()}`,
    state,
  };
}

/**
 * 用授权 code 换取 user_access_token
 * @param {string} code
 * @param {Object} [options]
 */
async function getUserAccessToken(code, options = {}) {
  const tenantAccessToken = await getTenantAccessToken(options);
  const url = `${FEISHU_HOST}${FEISHU_API_PREFIX}/authen/v1/access_token`;
  let response;
  try {
    response = await axios.post(
      url,
      { grant_type: 'authorization_code', code },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${tenantAccessToken}`,
        },
      },
    );
  } catch (e) {
    const err = new Error(`换取 user_access_token 网络错误: ${e.message}`);
    err.code = 'FEISHU_NETWORK_ERROR';
    err.cause = e;
    throw err;
  }

  const data = response.data;
  if (!data || data.code !== 0) {
    const err = new Error(`换取 user_access_token 失败: ${data?.msg || '未知错误'} (code=${data?.code})`);
    err.code = 'FEISHU_API_ERROR';
    err.apiCode = data?.code;
    err.apiMsg = data?.msg;
    throw err;
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    openId: data.open_id,
    unionId: data.union_id,
    userId: data.user_id,
    expiresIn: data.expires_in,
    refreshTokenExpiresIn: data.refresh_expires_in,
  };
}

/**
 * 获取已登录用户信息（通过 user_access_token）
 * @param {string} userAccessToken
 * @param {Object} [options]
 */
async function getUserInfoByUserToken(userAccessToken, options = {}) {
  const url = `${(options.host || FEISHU_HOST)}${FEISHU_API_PREFIX}/authen/v1/user_info`;
  let response;
  try {
    response = await axios.get(url, {
      timeout: 10000,
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
  } catch (e) {
    const err = new Error(`获取飞书用户信息网络错误: ${e.message}`);
    err.code = 'FEISHU_NETWORK_ERROR';
    err.cause = e;
    throw err;
  }

  const data = response.data;
  if (!data || data.code !== 0) {
    const err = new Error(`获取飞书用户信息失败: ${data?.msg || '未知错误'} (code=${data?.code})`);
    err.code = 'FEISHU_API_ERROR';
    err.apiCode = data?.code;
    err.apiMsg = data?.msg;
    throw err;
  }

  return {
    openId: data.data?.open_id,
    unionId: data.data?.union_id,
    userId: data.data?.user_id,
    name: data.data?.name,
    avatarUrl: data.data?.avatar_url,
    email: data.data?.email,
    mobile: data.data?.mobile,
    employeeNo: data.data?.employee_no,
    tenantKey: data.data?.tenant_key,
  };
}

/**
 * 通过 open_id/user_id/union_id 获取用户基本信息（使用 tenant_access_token）
 * @param {string} userIdType - open_id / user_id / union_id / mobiles / emails
 * @param {string} userId
 * @param {Object} [options]
 */
async function getUserByUserId(userIdType, userId, options = {}) {
  const tenantAccessToken = await getTenantAccessToken(options);
  const url = `${FEISHU_HOST}${FEISHU_API_PREFIX}/contact/v3/users/${encodeURIComponent(userId)}?user_id_type=${userIdType}`;
  let response;
  try {
    response = await axios.get(url, {
      timeout: 10000,
      headers: { Authorization: `Bearer ${tenantAccessToken}` },
    });
  } catch (e) {
    const err = new Error(`获取飞书用户信息网络错误: ${e.message}`);
    err.code = 'FEISHU_NETWORK_ERROR';
    err.cause = e;
    throw err;
  }

  const data = response.data;
  if (!data || data.code !== 0) {
    const err = new Error(`获取飞书用户信息失败: ${data?.msg || '未知错误'} (code=${data?.code})`);
    err.code = 'FEISHU_API_ERROR';
    err.apiCode = data?.code;
    err.apiMsg = data?.msg;
    throw err;
  }

  const u = data.data?.user;
  return {
    openId: u?.open_id,
    unionId: u?.union_id,
    userId: u?.user_id,
    name: u?.name,
    avatarUrl: u?.avatar?.avatar_72,
    email: u?.email,
    mobile: u?.mobile,
    employeeNo: u?.employee_no,
  };
}

/**
 * 发送消息到飞书
 * @param {Object} params
 * @param {string} params.receiveIdType - open_id / user_id / union_id / email / chat_id
 * @param {string} params.receiveId - 接收者 ID
 * @param {string} [params.msgType] - text / post / image / interactive / share_chat / share_user / file / ...
 * @param {Object|string} [params.content] - 消息内容；对象会自动 JSON 序列化
 * @param {Object} [options] - 凭证选项
 * @returns {Promise<Object>} 飞书返回的 message_id / receiver_id 等
 */
async function sendMessage(params, options = {}) {
  const { receiveIdType, receiveId, msgType = 'text', content } = params;
  if (!receiveIdType || !receiveId) {
    const err = new Error('发送飞书消息缺少 receiveIdType / receiveId');
    err.code = 'FEISHU_PARAM_MISSING';
    throw err;
  }

  const tenantAccessToken = await getTenantAccessToken(options);
  // 多租户支持：每租户可独立配置飞书 API host（如自建飞书服务器）
  const host = options.host || FEISHU_HOST;
  const url = `${host}${FEISHU_API_PREFIX}/im/v1/messages?receive_id_type=${receiveIdType}`;

  // 规范化 content：text 类型接受 { text: "..." }，其他类型接受对象
  let normalizedContent;
  if (typeof content === 'string') {
    // 字符串默认作为 text 类型的文本
    normalizedContent = msgType === 'text' ? { text: content } : (() => {
      try {
        return JSON.parse(content);
      } catch (e) {
        const err = new Error('content 为字符串但非合法 JSON（msgType != text）');
        err.code = 'FEISHU_PARAM_INVALID';
        throw err;
      }
    })();
  } else {
    normalizedContent = content || {};
  }

  let response;
  try {
    response = await axios.post(
      url,
      {
        receive_id: receiveId,
        msg_type: msgType,
        content: JSON.stringify(normalizedContent),
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${tenantAccessToken}`,
        },
      },
    );
  } catch (e) {
    const err = new Error(`发送飞书消息网络错误: ${e.message}`);
    err.code = 'FEISHU_NETWORK_ERROR';
    err.cause = e;
    throw err;
  }

  const data = response.data;
  if (!data || data.code !== 0) {
    const err = new Error(`发送飞书消息失败: ${data?.msg || '未知错误'} (code=${data?.code})`);
    err.code = 'FEISHU_API_ERROR';
    err.apiCode = data?.code;
    err.apiMsg = data?.msg;
    throw err;
  }

  return {
    messageId: data.data?.message_id,
    receiverId: data.data?.receiver_id,
    chatId: data.data?.chat_id,
  };
}

/**
 * 发送文本消息（便捷方法）
 */
async function sendText(receiveIdType, receiveId, text, options = {}) {
  return sendMessage(
    { receiveIdType, receiveId, msgType: 'text', content: { text } },
    options,
  );
}

/**
 * 发送交互式卡片消息
 * @param {Object} card - 飞书卡片 JSON Schema
 */
async function sendCard(receiveIdType, receiveId, card, options = {}) {
  return sendMessage(
    { receiveIdType, receiveId, msgType: 'interactive', content: card },
    options,
  );
}

/**
 * 测试飞书应用连通性（获取 tenant_access_token 即视为成功）
 */
async function testConnection(options = {}) {
  try {
    const token = await getTenantAccessToken({ ...options, forceRefresh: true });
    return {
      success: true,
      message: '飞书连接测试成功：tenant_access_token 已获取',
      tokenPreview: token ? `${token.slice(0, 8)}...` : null,
    };
  } catch (e) {
    return {
      success: false,
      message: e.message,
      code: e.code,
      apiCode: e.apiCode,
      apiMsg: e.apiMsg,
    };
  }
}

/**
 * 通过手机号或邮箱获取用户信息（批量查询接口）
 * @param {string[]} mobiles - 手机号数组
 * @param {string[]} [emails] - 邮箱数组
 * @param {Object} [options]
 * @returns {Promise<Object>} { users: [{ openId, mobile, email, userId, name }], failed }
 */
async function getUserIdByPhoneOrEmail(mobiles = [], emails = [], options = {}) {
  const tenantAccessToken = await getTenantAccessToken(options);
  const url = `${(options.host || FEISHU_HOST)}${FEISHU_API_PREFIX}/contact/v3/users/batch_get_id`;

  let response;
  try {
    response = await axios.post(
      url,
      {
        mobiles: mobiles.length ? mobiles : undefined,
        emails: emails.length ? emails : undefined,
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${tenantAccessToken}`,
        },
      },
    );
  } catch (e) {
    const err = new Error(`通过手机号/邮箱获取用户ID网络错误: ${e.message}`);
    err.code = 'FEISHU_NETWORK_ERROR';
    err.cause = e;
    throw err;
  }

  const data = response.data;
  if (!data || data.code !== 0) {
    const err = new Error(`通过手机号/邮箱获取用户ID失败: ${data?.msg || '未知错误'} (code=${data?.code})`);
    err.code = 'FEISHU_API_ERROR';
    err.apiCode = data?.code;
    err.apiMsg = data?.msg;
    throw err;
  }

  const userList = data.data?.user_list || [];
  const users = [];
  const failed = [];
  for (const item of userList) {
    if (item.user_id) {
      users.push({
        openId: item.user_id, // 该接口在 user_id_type 默认时返回 open_id
        mobile: item.mobile,
        email: item.email,
      });
    } else {
      failed.push({ mobile: item.mobile, email: item.email });
    }
  }

  return { users, failed };
}

module.exports = {
  getTenantAccessToken,
  buildAuthUrl,
  getUserAccessToken,
  getUserInfoByUserToken,
  getUserByUserId,
  getUserIdByPhoneOrEmail,
  sendMessage,
  sendText,
  sendCard,
  testConnection,
  resolveCredentials,
};
