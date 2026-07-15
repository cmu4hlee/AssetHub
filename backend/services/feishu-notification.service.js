/**
 * 飞书业务通知服务
 * 订阅 EventBus 业务事件，渲染飞书交互卡片并发送给相关接收人
 *
 * 覆盖场景：
 *   - 资产报废：申请创建 / 审批通过 / 审批驳回 / 完成
 *   - 资产调配：申请创建 / 审批通过 / 审批驳回 / 完成
 *   - 维修申请：审批通过（复用 MAINTENANCE_APPROVED）
 *   - 盘点：创建 / 启动 / 完成
 *
 * 接收人策略：
 *   1. 事件 payload 中显式传 toUserIds（本系统用户ID数组）→ 查 feishu_bindings 得 open_id
 *   2. 事件 payload 中传 applicantId / approverId / assigneeId → 同上
 *   3. 兜底：查租户管理员
 */
const db = require('../config/database');
const logger = require('../config/logger');
const { subscribe, SYSTEM_EVENTS } = require('../core/EventBus');
const feishuClient = require('../modules/feishu-binding/services/feishu-client');
const emailService = require('./email.service');
const tenantConfig = require('./tenant-config.service');
const requestContext = require('../middleware/requestContext');
const { ROLE_DISPLAY_NAMES } = require('../config/roles.config');
const recipientStrategy = require('./recipient-strategy.service');
const preferenceService = require('./notification-preference.service');

// 全局开关：可通过环境变量 FEISHU_NOTIFICATION_ENABLED=false 关闭
const NOTIFICATION_ENABLED = process.env.FEISHU_NOTIFICATION_ENABLED !== 'false';

// 统一获取生产环境可访问的前端 Base URL（去掉尾部斜杠，避免拼出 //）
// 优先级：process.env.FRONTEND_URL > config.frontend.url > ''
const DEFAULT_FRONTEND_BASE_URL = String(
  process.env.FRONTEND_URL
    || (() => {
      try {
        const cfg = require('../config/app.config');
        return (cfg && cfg.frontend && cfg.frontend.url) || '';
      } catch (_e) {
        return '';
      }
    })()
).replace(/\/+$/, '');

if (!DEFAULT_FRONTEND_BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    '[feishu-notification] FRONTEND_URL 未配置。如果不指定租户上下文，部分飞书卡片链接可能缺失域名。',
  );
}

// 标准化 URL：去除尾部斜杠、空字符串返回 null
const normalizeBaseUrl = url => {
  const trimmed = String(url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  // 拒绝 localhost/127.0.0.1（飞书客户端无法访问本机地址）
  try {
    const u = new URL(trimmed);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return '';
    }
    return `${u.protocol}//${u.host}`;
  } catch (_e) {
    // 不是合法 URL（例如「相对路径」），返回 null
    return '';
  }
};

// 从 HTTP 请求上下文推断外网可访问的 base URL
// 优先级：
//   1. X-Forwarded-Proto + X-Forwarded-Host（Nginx 反代场景）
//   2. req.protocol + req.get('host')（直连场景）
//   3. process.env.FRONTEND_URL（兜底）
// 注意：host 形如 "example.com:443" 或 "example.com"，需要正确处理协议与端口
function deriveBaseUrlFromRequest(req) {
  if (!req) return '';

  // 1. Nginx 反代头
  const forwardedHost = req.get?.('x-forwarded-host') || req.headers?.['x-forwarded-host'];
  const forwardedProto = req.get?.('x-forwarded-proto') || req.headers?.['x-forwarded-proto'];
  if (forwardedHost) {
    const proto = (forwardedProto || 'https').split(',')[0].trim();
    // forwardedHost 形如 "example.com:443"，new URL 会正确解析
    const candidate = `${proto}://${forwardedHost.split(',')[0].trim()}`;
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
  }

  // 2. 直连：req.protocol + req.get('host')
  if (req.protocol && (req.get?.('host') || req.headers?.host)) {
    const host = (req.get?.('host') || req.headers?.host || '').split(',')[0].trim();
    const candidate = `${req.protocol}://${host}`;
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
  }

  return '';
}

// 解析租户级的前端访问域名（多租户独立部署场景）
// 优先级：
//   1. tenant_configs.config_key='access_url'（租户级显式配置）
//   2. tenant_configs.config_key='frontend_url'（租户级前端地址）
//   3. tenants.contact_email 域名前缀（兜底，仅供参考）
//   4. DEFAULT_FRONTEND_BASE_URL（全局默认）
//   5. req 上下文（当前请求外网地址，未配置时兜底）
// 使用内存缓存（5分钟）避免每次发卡片都查数据库
const _tenantUrlCache = new Map();
const TENANT_URL_CACHE_TTL = 5 * 60 * 1000;

async function resolveTenantBaseUrl(tenantId, req) {
  if (!tenantId) {
    // 无租户上下文：优先从 req 推断，其次用环境变量
    if (req) {
      const fromReq = deriveBaseUrlFromRequest(req);
      if (fromReq) return fromReq;
    }
    return normalizeBaseUrl(DEFAULT_FRONTEND_BASE_URL) || '';
  }

  const cached = _tenantUrlCache.get(tenantId);
  if (cached && Date.now() - cached.ts < TENANT_URL_CACHE_TTL) {
    // 如果缓存了 req 派生 URL 且未配置其他 URL，每次都用当前 req（动态主机场景）
    if (cached.fromReq && req) {
      const fresh = deriveBaseUrlFromRequest(req);
      if (fresh) return fresh;
    }
    return cached.url;
  }

  let resolved = '';
  let fromReq = false;
  try {
    // 优先读租户级配置（key: access_url / frontend_url）
    const [rows] = await db.execute(
      `SELECT config_key, config FROM tenant_configs
       WHERE tenant_id = ? AND config_key IN ('access_url', 'frontend_url') AND enabled = 1`,
      [tenantId],
    );
    for (const r of rows || []) {
      try {
        const parsed = typeof r.config === 'string' ? JSON.parse(r.config) : r.config;
        const candidate = parsed && (parsed.url || parsed.value || parsed);
        const normalized = normalizeBaseUrl(candidate);
        if (normalized) {
          resolved = normalized;
          break;
        }
      } catch (_e) { /* ignore invalid json */ }
    }
  } catch (e) {
    logger.warn(`[FeishuNotify] 读取租户 ${tenantId} 域名配置失败:`, e.message);
  }

  // 兜底1：环境变量 FRONTEND_URL（仅当它是合法外网地址时才使用）
  if (!resolved) {
    const envNormalized = normalizeBaseUrl(DEFAULT_FRONTEND_BASE_URL);
    if (envNormalized) {
      resolved = envNormalized;
    }
  }

  // 兜底2：从请求上下文推导（最贴近真实外网访问地址）
  // 如果 DEFAULT_FRONTEND_BASE_URL 是 localhost/127.0.0.1，会被 normalizeBaseUrl 过滤为空，
  // 此时如果 req 可用，就从 req 推导真实外网地址（解决"暂无域名"场景）
  if (!resolved && req) {
    resolved = deriveBaseUrlFromRequest(req);
    if (resolved) fromReq = true;
  }

  _tenantUrlCache.set(tenantId, { url: resolved, ts: Date.now(), fromReq });
  return resolved;
}

// 清除租户域名缓存（租户配置变更时调用）
function clearTenantUrlCache(tenantId) {
  if (tenantId) {
    _tenantUrlCache.delete(tenantId);
  } else {
    _tenantUrlCache.clear();
  }
}

// 拼接前端页面 URL 的工具函数（异步版本，多租户场景下从数据库读取）
// 飞书卡片 url/multi_url 必须是绝对 URL，否则客户端无法跳转。
// 优先级：租户级域名 > FRONTEND_URL > req 上下文（外网 IP+端口）
// 若都不可用，返回 null，调用方应跳过发送卡片（或发送纯文本降级消息）
// @param {string} relativePath 页面相对路径，如 '/scrapping'
// @param {number|string} [tenantId] 租户 ID
// @param {object} [req] Express 请求对象，用于推断当前外网访问地址
async function buildPageUrl(relativePath, tenantId, req) {
  const path = String(relativePath || '').replace(/^\/+/, '');
  const baseUrl = await resolveTenantBaseUrl(tenantId, req);
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    return null;
  }
  return path ? `${normalized}/${path}` : normalized;
}

// 辅助：从 payload 中提取 req 对象（兼容多种传参方式）
// 业务路由调用时：emit('xxx', { ...payload, _req: req }) 或 emit('xxx', payload) 且 payload.req = req
// 兜底：从 AsyncLocalStorage 中读取当前活跃的请求（最常用）
function extractReq(payload) {
  let req = null;
  if (payload) {
    req = payload._req || payload.req;
  }
  if (!req) {
    // 兜底：通过 AsyncLocalStorage 获取当前活跃请求
    try {
      req = requestContext.getRequest();
    } catch (_e) { /* ignore */ }
  }
  return req;
}

/**
 * 查询本系统用户绑定的飞书 open_id（支持批量）
 * @param {number[]} userIds
 * @returns {Promise<Array<{userId:number, openId:string, name:string}>>}
 */
async function getOpenIdsByUserIds(userIds = []) {
  if (!userIds.length) return [];
  const placeholders = userIds.map(() => '?').join(',');
  try {
    const [rows] = await db.execute(
      `SELECT user_id, open_id, name FROM feishu_bindings WHERE user_id IN (${placeholders})`,
      userIds,
    );
    return (rows || []).map(r => ({ userId: r.user_id, openId: r.open_id, name: r.name }));
  } catch (e) {
    logger.error('[FeishuNotify] 查询用户飞书绑定失败:', e.message);
    return [];
  }
}

/**
 * 通过手机号反查 open_id（用于未在 feishu_bindings 表绑定的用户）
 * @param {string[]} mobiles
 * @returns {Promise<Array<{openId:string, mobile:string}>>}
 */
async function getOpenIdsByMobiles(mobiles = []) {
  if (!mobiles.length) return [];
  try {
    const r = await feishuClient.getUserIdByPhoneOrEmail(mobiles, []);
    return r.users.map(u => ({ openId: u.openId, mobile: u.mobile }));
  } catch (e) {
    logger.warn('[FeishuNotify] 通过手机号反查 open_id 失败:', e.message);
    return [];
  }
}

/**
 * 查询用户手机号（用于反查 open_id）
 * @param {number[]} userIds
 * @returns {Promise<Array<{userId:number, phone:string}>>}
 */
async function getUserPhones(userIds = []) {
  if (!userIds.length) return [];
  const placeholders = userIds.map(() => '?').join(',');
  try {
    const [rows] = await db.execute(
      `SELECT id, phone FROM users WHERE id IN (${placeholders}) AND phone IS NOT NULL AND phone <> ''`,
      userIds,
    );
    return (rows || []).map(r => ({ userId: r.id, phone: r.phone }));
  } catch (e) {
    logger.error('[FeishuNotify] 查询用户手机号失败:', e.message);
    return [];
  }
}

/**
 * 查询租户内的审批/管理员角色用户ID（兜底接收人）
 * 包含：管理员、维修工程师、维修管理员、资产管理员
 * @param {number} tenantId
 * @returns {Promise<number[]>}
 */
async function getTenantApproverIds(tenantId) {
  if (!tenantId) return [];
  try {
    const [rows] = await db.execute(
      `SELECT DISTINCT u.id FROM users u
       INNER JOIN user_tenant_roles utr ON u.id = utr.user_id
       WHERE utr.tenant_id = ?
         AND utr.role IN (
           'super_admin', 'system_admin', 'admin',
           'maintenance_admin', 'maintenance_engineer',
           'asset_admin', 'department_admin'
         )
         AND u.status = 'active'`,
      [tenantId],
    );
    return rows.map(r => r.id);
  } catch (e) {
    logger.warn('[FeishuNotify] 查询租户审批人失败:', e.message);
    return [];
  }
}

/**
 * 通过已知的 userId 列表查 open_id
 * 1. feishu_bindings 表 > 2. 手机号反查
 * @returns {Promise<string[]>} - open_id 数组
 */
async function lookupOpenIdsByUserIds(userIds, tenantId) {
  if (!userIds || !userIds.length) return [];
  const idArr = [...new Set(userIds.map(Number).filter(Boolean))];
  // 1. 已绑定
  const bound = await getOpenIdsByUserIds(idArr);
  const found = new Set(bound.map(b => Number(b.userId)));
  // 2. 未绑定 → 查手机号反查
  const missing = idArr.filter(id => !found.has(id));
  let byPhone = [];
  if (missing.length) {
    const phones = await getUserPhones(missing);
    if (phones.length) {
      const openByPhone = await getOpenIdsByMobiles(phones.map(p => p.phone));
      byPhone = openByPhone;
    }
  }
  return [...bound.map(b => b.openId), ...byPhone.map(b => b.openId)];
}

/**
 * 解析事件接收人 userId 列表（不考虑飞书绑定、不考虑勿扰）
 * 解析优先级：
 *   1. recipient_strategies 表中配置的策略（payload._eventCode 标识事件）
 *   2. payload 中的 toUserIds / applicantId / approverId / assigneeId / createdBy
 *   3. 兜底：租户审批/管理员
 * @returns {Promise<{userIds: number[], source: string}>}
 */
async function resolveRecipients(payload = {}) {
  const tenantId = payload.tenantId || payload.tenant_id || null;
  const eventCode = payload._eventCode || null;

  // 1. 优先查 recipient_strategies 配置
  if (eventCode && tenantId) {
    const userIdsFromStrategy = await recipientStrategy.resolveRecipients(tenantId, eventCode, payload);
    if (userIdsFromStrategy !== null && userIdsFromStrategy.length > 0) {
      return { userIds: userIdsFromStrategy, source: 'strategy' };
    }
    // null 表示无配置，继续原逻辑
  }

  // 2. 原逻辑：从 payload 字段收集
  const userIds = new Set();
  ['toUserIds', 'applicantId', 'approverId', 'assigneeId', 'createdBy'].forEach(k => {
    const v = payload[k];
    if (Array.isArray(v)) v.forEach(id => id && userIds.add(id));
    else if (v) userIds.add(v);
  });

  // 3. 兜底：当没有显式接收人时，查租户管理员/维修审批角色
  let fallbackUsed = false;
  if (!userIds.size && payload.tenantId) {
    const approverIds = await getTenantApproverIds(payload.tenantId);
    approverIds.forEach(id => userIds.add(id));
    fallbackUsed = approverIds.length > 0;
    if (fallbackUsed) {
      logger.info(`[FeishuNotify] 使用租户${payload.tenantId}审批/管理员兜底接收人，共 ${approverIds.length} 人`);
    }
  }

  if (!userIds.size) return { userIds: [], source: fallbackUsed ? 'fallback' : 'empty' };

  return { userIds: [...userIds], source: fallbackUsed ? 'fallback' : 'payload' };
}

/**
 * 解析事件接收人，返回 open_id 列表
 * 流程：解析 userId → 应用用户偏好过滤（DND / 紧急度阈值）→ 查 open_id
 * @returns {Promise<string[]>}
 */
async function resolveOpenIds(payload = {}) {
  const tenantId = payload.tenantId || payload.tenant_id || null;
  const eventCode = payload._eventCode || null;
  const urgency = payload._urgency || 'low';

  const { userIds: candidateIds, source } = await resolveRecipients(payload);
  if (!candidateIds.length) return [];

  // 应用用户偏好过滤（DND / 紧急度阈值 / 启用开关）
  const { allowed, filtered } = await preferenceService.filterUsersByPreferences(
    candidateIds, eventCode, urgency,
  );
  if (filtered.length) {
    logger.debug(
      `[FeishuNotify] event=${eventCode} 过滤 ${filtered.length} 个用户（勿扰/紧急度/关闭）:`,
      filtered.map(f => `${f.userId}(${f.reason})`).join(', '),
    );
  }

  if (!allowed.length) {
    if (source === 'fallback') {
      logger.warn(`[FeishuNotify] 租户${payload.tenantId}所有兜底接收人都被偏好过滤`);
    }
    return [];
  }

  const openIds = await lookupOpenIdsByUserIds(allowed, tenantId);
  if (eventCode && source === 'strategy') {
    logger.debug(`[FeishuNotify] event=${eventCode} 使用配置策略解析出 ${openIds.length} 个飞书接收人`);
  }
  if (!openIds.length && source === 'fallback') {
    logger.warn(`[FeishuNotify] 租户${payload.tenantId}审批人均未绑定飞书，请先在「集成通道 → 飞书绑定」绑定账号`);
  }
  return openIds;
}

/**
 * 包装 handler：自动注入 _eventCode 到 payload
 * 用于让 resolveOpenIds 知道当前处理的是哪个事件，从而查配置策略
 * 现有 handler 代码无需修改
 */
function wrapHandler(eventCode, handler) {
  return async function wrappedHandler(payload = {}) {
    return handler({ ...payload, _eventCode: eventCode });
  };
}

/**
 * 发送飞书交互卡片给多个接收人
 * @param {string[]} openIds
 * @param {Object} card - 飞书卡片 JSON
 * @param {number} [tenantId] - 租户ID，用于读取租户级飞书凭证（不传则用全局 env）
 */
async function sendCardToOpenIds(openIds, card, tenantId) {
  if (!openIds || !openIds.length) {
    logger.info('[FeishuNotify] 无接收人，跳过发送');
    return { sent: 0 };
  }
  // 按租户读取飞书应用凭证（未配置则回退 env，feishuClient 内部会读 process.env）
  let options = {};
  if (tenantId) {
    try {
      const cfg = await tenantConfig.getFeishuConfig(tenantId);
      if (cfg && cfg.app_id) {
        options.appId = cfg.app_id;
        options.appSecret = cfg.app_secret;
        if (cfg.host) options.host = cfg.host;
      }
    } catch (e) {
      logger.warn(`[FeishuNotify] 读取租户 ${tenantId} 飞书配置失败，回退 env:`, e.message);
    }
  }
  let sent = 0;
  for (const openId of openIds) {
    try {
      await feishuClient.sendCard('open_id', openId, card, options);
      sent++;
    } catch (e) {
      // 详细记录飞书 API 返回的错误码，便于排查（例如 99992361 "open_id cross app" 表示 open_id 跨应用失效）
      const apiCode = e.apiCode ? ` (apiCode=${e.apiCode}, apiMsg=${e.apiMsg || ''})` : '';
      logger.error(`[FeishuNotify] 发送给 ${openId} 失败: ${e.message}${apiCode}`);
    }
  }
  logger.info(`[FeishuNotify] 飞书卡片发送完成: 成功 ${sent}/${openIds.length} (租户 ${tenantId || '默认'})`);
  return { sent };
}

/**
 * 构造通用通知卡片
 * @param {Object} params
 * @param {string} params.title - 卡片标题
 * @param {string} params.color - 标题栏颜色 blue/green/orange/red
 * @param {Array<{label:string, value:string}>} [params.fields] - 字段列表
 * @param {string} [params.content] - 正文（纯文本，支持换行）
 * @param {string} [params.actionUrl] - 跳转链接
 * @param {string} [params.actionText] - 按钮文案
 */
function buildCard({ title, color = 'blue', fields = [], content = '', actionUrl = '', actionText = '查看详情' }) {
  const elements = [];

  if (content) {
    elements.push({
      tag: 'div',
      text: { tag: 'lark_md', content },
    });
  }

  if (fields.length) {
    elements.push({
      tag: 'div',
      fields: fields.map(f => ({
        is_short: true,
        text: { tag: 'lark_md', content: `**${f.label}**\n${f.value || '-'}` },
      })),
    });
  }

  if (actionUrl) {
    elements.push({
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: actionText },
          // 飞书卡片 url 必须是绝对 URL，相对路径无法跳转
          url: actionUrl,
          type: 'primary',
        },
      ],
    });
  } else {
    // 未生成绝对 URL（FRONTEND_URL 未配置且无租户域名），添加提示行
    logger.warn('[FeishuNotify] 卡片未配置可访问的域名，跳过「查看详情」按钮');
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: title },
      template: color,
    },
    elements,
  };
}

/* ===================== 事件处理器 ===================== */

// 资产报废
async function handleScrappingCreated(payload) {
  const card = buildCard({
    title: '📦 新报废申请待审批',
    color: 'orange',
    fields: [
      { label: '资产编码', value: payload.asset_code },
      { label: '资产名称', value: payload.asset_name || '-' },
      { label: '申请人', value: payload.applicant || '-' },
      { label: '申请时间', value: new Date().toLocaleString('zh-CN') },
    ],
    content: `**报废原因**\n${payload.scrapping_reason || '-'}`,
    actionUrl: await buildPageUrl('/scrapping', payload.tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

async function handleScrappingApproved(payload) {
  const card = buildCard({
    title: '✅ 报废申请已通过',
    color: 'green',
    fields: [
      { label: '资产编码', value: payload.asset_code || '-' },
      { label: '审批人', value: payload.approver || '-' },
    ],
    actionUrl: await buildPageUrl('/scrapping', payload.tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

async function handleScrappingRejected(payload) {
  const card = buildCard({
    title: '❌ 报废申请已驳回',
    color: 'red',
    fields: [
      { label: '资产编码', value: payload.asset_code || '-' },
      { label: '审批人', value: payload.approver || '-' },
      { label: '驳回意见', value: payload.opinion || '-' },
    ],
    actionUrl: await buildPageUrl('/scrapping', payload.tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

async function handleScrappingCompleted(payload) {
  const card = buildCard({
    title: '✔️ 报废流程已完成',
    color: 'grey',
    fields: [
      { label: '资产编码', value: payload.asset_code || '-' },
      { label: '完成时间', value: new Date().toLocaleString('zh-CN') },
    ],
    content: '资产状态已更新为"已报废"。',
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 资产调配
async function handleTransferCreated(payload) {
  const card = buildCard({
    title: '🔄 新调配申请待审批',
    color: 'orange',
    fields: [
      { label: '资产编码', value: payload.asset_code },
      { label: '资产名称', value: payload.asset_name || '-' },
      { label: '目标科室', value: payload.target_department || '-' },
      { label: '申请人', value: payload.applicant || '-' },
    ],
    content: `**调配原因**\n${payload.transfer_reason || '-'}`,
    actionUrl: await buildPageUrl('/transfer', payload.tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

async function handleTransferApproved(payload) {
  const card = buildCard({
    title: '✅ 调配申请已通过',
    color: 'green',
    fields: [
      { label: '资产编码', value: payload.asset_code || '-' },
      { label: '审批人', value: payload.approver || '-' },
    ],
    actionUrl: await buildPageUrl('/transfer', payload.tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

async function handleTransferRejected(payload) {
  const card = buildCard({
    title: '❌ 调配申请已驳回',
    color: 'red',
    fields: [
      { label: '资产编码', value: payload.asset_code || '-' },
      { label: '审批人', value: payload.approver || '-' },
      { label: '驳回意见', value: payload.opinion || '-' },
    ],
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

async function handleTransferCompleted(payload) {
  const card = buildCard({
    title: '✔️ 调配已完成',
    color: 'grey',
    fields: [
      { label: '资产编码', value: payload.asset_code || '-' },
      { label: '完成时间', value: new Date().toLocaleString('zh-CN') },
    ],
    content: '资产所属科室已更新。',
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 维修申请审批通过
async function handleMaintenanceApproved(payload) {
  const { request, workOrderNo, approver, tenantId } = payload;
  if (!request) return;
  const card = buildCard({
    title: '🔧 新维修工单待处理',
    color: 'orange',
    fields: [
      { label: '工单编号', value: workOrderNo || '-' },
      { label: '资产编码', value: request.asset_code || '-' },
      { label: '资产名称', value: request.asset_name || '-' },
      { label: '审批人', value: approver || '-' },
    ],
    content: `**故障描述**\n${(request.fault_description || '-').substring(0, 200)}`,
    actionUrl: await buildPageUrl('/maintenance/workorders', payload.tenantId, extractReq(payload)),
  });
  // 维修工单通知工程师：优先用 payload.toUserIds，否则查工程师角色
  let openIds = await resolveOpenIds(payload);
  if (!openIds.length && tenantId) {
    const engineers = await getEngineersByTenant(tenantId);
    if (engineers.length) {
      const phones = engineers.map(e => e.phone).filter(Boolean);
      const byPhone = await getOpenIdsByMobiles(phones);
      openIds = byPhone.map(b => b.openId);
    }
  }
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 盘点
async function handleInventoryCreated(payload) {
  const card = buildCard({
    title: '📋 新盘点任务已创建',
    color: 'blue',
    fields: [
      { label: '盘点名称', value: payload.inventory_name || payload.name || '-' },
      { label: '创建人', value: payload.creator || '-' },
    ],
    actionUrl: await buildPageUrl('/inventory', payload.tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

async function handleInventoryCompleted(payload) {
  const card = buildCard({
    title: '✔️ 盘点已完成',
    color: 'green',
    fields: [
      { label: '盘点名称', value: payload.inventory_name || payload.name || '-' },
      { label: '完成时间', value: new Date().toLocaleString('zh-CN') },
    ],
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

/**
 * 查询指定租户下所有具有工程师角色的用户
 * （从 maintenance/notification.service 复制，避免循环依赖）
 */
async function getEngineersByTenant(tenantId) {
  try {
    const ENGINEER_ROLES = ['maintenance_admin', 'maintenance_engineer'];
    const [rows] = await db.execute(
      `SELECT u.id, u.username, u.real_name, u.phone
       FROM users u
       INNER JOIN user_tenant_roles utr ON u.id = utr.user_id
       WHERE utr.tenant_id = ? AND utr.role IN (${ENGINEER_ROLES.map(() => '?').join(',')})
         AND u.status = 'active'
       GROUP BY u.id, u.username, u.real_name, u.phone`,
      [tenantId, ...ENGINEER_ROLES],
    );
    return rows;
  } catch (e) {
    logger.error('[FeishuNotify] 查询工程师失败:', e.message);
    return [];
  }
}

// 资产领用
async function handleAssetCheckout(payload) {
  const card = buildCard({
    title: '📤 资产领用通知',
    color: 'blue',
    fields: [
      { label: '资产编码', value: payload.asset_code || '-' },
      { label: '领用人', value: payload.user_name || '-' },
      { label: '领用科室', value: payload.department || '-' },
      { label: '预计归还', value: payload.expected_return_date || '-' },
    ],
    content: payload.purpose ? `**用途**\n${payload.purpose}` : '',
    actionUrl: await buildPageUrl('/asset-usage', payload.tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 资产归还
async function handleAssetReturn(payload) {
  const card = buildCard({
    title: '📥 资产归还通知',
    color: 'green',
    fields: [
      { label: '资产编码', value: payload.asset_code || '-' },
      { label: '归还人', value: payload.user_name || '-' },
      { label: '归还状态', value: payload.actual_condition || '正常' },
      { label: '归还时间', value: new Date().toLocaleString('zh-CN') },
    ],
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 工单派单
async function handleWorkOrderAssigned(payload) {
  const card = buildCard({
    title: '🔧 新工单已派发给您',
    color: 'orange',
    fields: [
      { label: '工单编号', value: payload.workOrderNo || '-' },
      { label: '资产编码', value: payload.asset_code || '-' },
      { label: '资产名称', value: payload.asset_name || '-' },
      { label: '派发人', value: payload.assignedBy || '-' },
    ],
    content: payload.fault_description ? `**故障描述**\n${String(payload.fault_description).substring(0, 200)}` : '',
    actionUrl: await buildPageUrl('/maintenance/workorders', payload.tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 工单完成
async function handleWorkOrderCompleted(payload) {
  const card = buildCard({
    title: '✔️ 维修工单已完成',
    color: 'green',
    fields: [
      { label: '工单编号', value: payload.workOrderNo || '-' },
      { label: '资产编码', value: payload.asset_code || '-' },
      { label: '完成人', value: payload.completedBy || '-' },
      { label: '完成时间', value: new Date().toLocaleString('zh-CN') },
    ],
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 资产状态工作流迁移
async function handleAssetWorkflowTransition(payload) {
  const card = buildCard({
    title: '🔄 资产状态变更通知',
    color: 'blue',
    fields: [
      { label: '资产编码', value: payload.assetCode || '-' },
      { label: '资产名称', value: payload.assetName || '-' },
      { label: '原状态', value: payload.fromState || '-' },
      { label: '新状态', value: payload.toState || '-' },
      { label: '操作人', value: payload.operatorName || '-' },
      { label: '操作时间', value: new Date().toLocaleString('zh-CN') },
    ],
    content: payload.reason ? `**变更原因**\n${payload.reason}` : '',
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.operatorId ? [payload.operatorId] : [] });
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 维修申请创建（待审批）
async function handleMaintenanceRequestCreated(payload) {
  const colorMap = { 紧急: 'red', 严重: 'orange', 一般: 'blue' };
  const card = buildCard({
    title: '🆕 新维修申请待审批',
    color: colorMap[payload.fault_level] || 'blue',
    fields: [
      { label: '申请编号', value: payload.requestNo || '-' },
      { label: '资产编码', value: payload.asset_code || '-' },
      { label: '资产名称', value: payload.asset_name || '-' },
      { label: '故障等级', value: payload.fault_level || '-' },
      { label: '申请人', value: payload.request_person || '-' },
    ],
    content: `**故障描述**\n${(payload.fault_description || '-').substring(0, 200)}`,
    actionUrl: await buildPageUrl('/maintenance/requests', payload.tenantId, extractReq(payload)),
  });
  // 通知审批人：这里没有显式接收人，留空（实际可扩展为查租户管理员）
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 维修申请完成
async function handleMaintenanceRequestCompleted(payload) {
  const card = buildCard({
    title: '✔️ 维修已完成',
    color: 'green',
    fields: [
      { label: '申请编号', value: payload.requestNo || '-' },
      { label: '资产编码', value: payload.asset_code || '-' },
      { label: '资产名称', value: payload.asset_name || '-' },
      { label: '完成人', value: payload.completedBy || '-' },
    ],
    content: payload.repair_content ? `**维修内容**\n${String(payload.repair_content).substring(0, 200)}` : '',
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 维修申请审批通过 - 通知发起者
async function handleMaintenanceRequestApproved(payload) {
  const { request, workOrderNo, approver, comment, tenantId } = payload;
  if (!request) return;

  const card = buildCard({
    title: '✅ 维修申请已批准',
    color: 'green',
    fields: [
      { label: '申请编号', value: request.request_no || '-' },
      { label: '资产编码', value: request.asset_code || '-' },
      { label: '资产名称', value: request.asset_name || '-' },
      { label: '故障等级', value: request.fault_level || '-' },
      { label: '审批人', value: approver || '-' },
      { label: '审批日期', value: new Date().toLocaleString('zh-CN') },
    ],
    content: `**故障描述**\n${(request.fault_description || '-').substring(0, 200)}`,
    actionUrl: await buildPageUrl('/maintenance/requests', tenantId, extractReq(payload)),
  });

  const openIds = await resolveOpenIds({
    toUserIds: request.request_person_id ? [request.request_person_id] : [],
    tenantId,
  });
  await sendCardToOpenIds(openIds, card, tenantId);

  if (workOrderNo) {
    logger.info(`[FeishuNotify] 维修申请已批准通知已发送 (工单: ${workOrderNo})`);
  }
}

// 维修申请审批拒绝 - 通知发起者
async function handleMaintenanceRequestRejected(payload) {
  const { request, approver, comment, tenantId } = payload;
  if (!request) return;

  const card = buildCard({
    title: '❌ 维修申请已拒绝',
    color: 'red',
    fields: [
      { label: '申请编号', value: request.request_no || '-' },
      { label: '资产编码', value: request.asset_code || '-' },
      { label: '资产名称', value: request.asset_name || '-' },
      { label: '故障等级', value: request.fault_level || '-' },
      { label: '审批人', value: approver || '-' },
      { label: '拒绝日期', value: new Date().toLocaleString('zh-CN') },
    ],
    content: comment ? `**拒绝原因**\n${comment}` : '',
    actionUrl: await buildPageUrl('/maintenance/requests', tenantId, extractReq(payload)),
  });

  const openIds = await resolveOpenIds({
    toUserIds: request.request_person_id ? [request.request_person_id] : [],
    tenantId,
  });
  await sendCardToOpenIds(openIds, card, tenantId);

  logger.info(`[FeishuNotify] 维修申请已拒绝通知已发送`);
}

// 维修申请取消
async function handleMaintenanceRequestCancelled(payload) {
  const card = buildCard({
    title: '🚫 维修申请已取消',
    color: 'grey',
    fields: [
      { label: '资产编码', value: payload.asset_code || '-' },
      { label: '取消人', value: payload.cancelledBy || '-' },
      { label: '取消时间', value: new Date().toLocaleString('zh-CN') },
    ],
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 维修开始 - 通知报修人
async function handleMaintenanceRequestStarted(payload = {}) {
  const {
    id,
    requestNo,
    asset_code,
    asset_name,
    request_person,
    request_person_id,
    repair_person,
    repair_person_id,
    repair_person_phone,
    repair_person_email,
    tenantId,
  } = payload;

  if (!id || !tenantId) {
    logger.warn('[FeishuNotify] maintenance_request:started 缺少 id 或 tenantId');
    return;
  }

  const engineerContact = [];
  if (repair_person) engineerContact.push(`姓名: ${repair_person}`);
  if (repair_person_phone) engineerContact.push(`电话: ${repair_person_phone}`);
  if (repair_person_email) engineerContact.push(`邮箱: ${repair_person_email}`);

  const card = buildCard({
    title: '🔧 维修已开始',
    color: 'green',
    fields: [
      { label: '报修单号', value: requestNo || '-' },
      { label: '资产', value: asset_name || asset_code || '-' },
      { label: '维修工程师', value: repair_person || '-' },
    ],
    content: engineerContact.length > 0 ? `工程师联系方式:\n${engineerContact.join('\n')}` : undefined,
    actionUrl: await buildPageUrl(`/maintenance/requests/${id}`, tenantId, extractReq(payload)),
    actionText: '查看详情',
  });

  // 通知报修人（使用 request_person_id 作为接收人）
  const openIds = await resolveOpenIds({
    toUserIds: request_person_id ? [request_person_id] : [],
    tenantId,
  });
  await sendCardToOpenIds(openIds, card, tenantId);

  // 通知被派工的工程师
  if (repair_person_id) {
    const engineerCard = buildCard({
      title: '🔧 维修工单已分配',
      color: 'blue',
      fields: [
        { label: '报修单号', value: requestNo || '-' },
        { label: '资产', value: asset_name || asset_code || '-' },
        { label: '报修人', value: request_person || '-' },
      ],
      content: `请及时开始维修工作。`,
      actionUrl: await buildPageUrl(`/maintenance/requests/${id}`, tenantId, extractReq(payload)),
      actionText: '查看详情',
    });
    const engineerOpenIds = await resolveOpenIds({
      toUserIds: [repair_person_id],
      tenantId,
    });
    await sendCardToOpenIds(engineerOpenIds, engineerCard, tenantId);
  }
}

// ========== 用户加入企业场景 ==========

/**
 * 新用户加入企业 - 通知系统管理员设置角色
 * 事件 payload: { tenant_id, user_id, requested_role, admins, message }
 */
async function handleUserJoinRequest(payload = {}) {
  const { tenant_id, user_id, requested_role, admins, message } = payload;
  if (!user_id || !tenant_id) {
    logger.warn('[FeishuNotify] user_join_request 缺少 user_id 或 tenant_id');
    return;
  }

  // 查询用户信息
  let userInfo = null;
  try {
    const [rows] = await db.execute(
      'SELECT username, real_name, phone FROM users WHERE id = ?',
      [user_id],
    );
    if (rows.length) userInfo = rows[0];
  } catch (e) {
    logger.warn('[FeishuNotify] 查询用户信息失败:', e.message);
  }

  const displayName = userInfo?.real_name || userInfo?.username || `用户#${user_id}`;
  const roleLabel = ROLE_DISPLAY_NAMES[requested_role] || requested_role || '-';

  const card = buildCard({
    title: '👤 新用户加入企业',
    color: 'orange',
    fields: [
      { label: '姓名', value: displayName },
      { label: '用户名', value: userInfo?.username || '-' },
      { label: '申请角色', value: roleLabel },
      { label: '手机号', value: userInfo?.phone || '-' },
    ],
    content: message || '有新用户加入企业，请及时设置角色',
    actionUrl: await buildPageUrl(`users/edit/${user_id}`, tenant_id, extractReq(payload)),
    actionText: '设置角色',
  });

  // 通知系统管理员（payload.admins 为显式接收人）
  const openIds = await resolveOpenIds({
    toUserIds: admins || [],
    tenantId: tenant_id,
  });
  await sendCardToOpenIds(openIds, card, tenant_id);
}

// ========== 招标采购场景 ==========

// 招标项目创建
async function handleTenderCreated(payload) {
  const card = buildCard({
    title: '📋 新招标项目已创建',
    color: 'blue',
    fields: [
      { label: '项目编号', value: payload.tender_code || '-' },
      { label: '项目名称', value: payload.title || '-' },
      { label: '招标类型', value: payload.tenderType || '-' },
      { label: '招标方式', value: payload.tenderMethod || '-' },
      { label: '预算金额', value: payload.budgetAmount != null ? `¥${payload.budgetAmount}` : '-' },
    ],
    content: '项目已创建，当前为草稿状态，发布后将通知相关方。',
    actionUrl: await buildPageUrl('/tendering', payload.tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.createdBy ? [payload.createdBy] : [] });
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 招标发布
async function handleTenderPublished(payload) {
  const card = buildCard({
    title: '📢 招标项目已发布',
    color: 'green',
    fields: [
      { label: '项目编号', value: payload.tender_code || '-' },
      { label: '项目名称', value: payload.title || '-' },
      { label: '原状态', value: payload.fromStatus || '-' },
      { label: '新状态', value: '已发布' },
    ],
    content: '招标项目已发布，供应商可开始投标。',
    actionUrl: await buildPageUrl('/tendering', payload.tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.createdBy ? [payload.createdBy] : [] });
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 招标定标（awarded）
async function handleTenderAwarded(payload) {
  const card = buildCard({
    title: '🏆 招标项目已定标',
    color: 'orange',
    fields: [
      { label: '项目编号', value: payload.tender_code || '-' },
      { label: '项目名称', value: payload.title || '-' },
      { label: '原状态', value: payload.fromStatus || '-' },
      { label: '新状态', value: '已定标' },
    ],
    content: '招标项目已完成定标，请尽快推进合同签订与后续流程。',
    actionUrl: await buildPageUrl('/tendering', payload.tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.createdBy ? [payload.createdBy] : [] });
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 招标完成
async function handleTenderCompleted(payload) {
  const card = buildCard({
    title: '✔️ 招标项目已完成',
    color: 'green',
    fields: [
      { label: '项目编号', value: payload.tender_code || '-' },
      { label: '项目名称', value: payload.title || '-' },
      { label: '完成时间', value: new Date().toLocaleString('zh-CN') },
    ],
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.createdBy ? [payload.createdBy] : [] });
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 招标取消
async function handleTenderCancelled(payload) {
  const card = buildCard({
    title: '🚫 招标项目已取消',
    color: 'red',
    fields: [
      { label: '项目编号', value: payload.tender_code || '-' },
      { label: '项目名称', value: payload.title || '-' },
      { label: '取消时间', value: new Date().toLocaleString('zh-CN') },
    ],
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.createdBy ? [payload.createdBy] : [] });
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 新投标提交（通知招标方）
async function handleBidSubmitted(payload) {
  const card = buildCard({
    title: '📥 收到新投标',
    color: 'orange',
    fields: [
      { label: '项目编号', value: payload.tender_code || '-' },
      { label: '项目名称', value: payload.tender_title || '-' },
      { label: '供应商', value: payload.supplierName || '-' },
      { label: '投标报价', value: payload.bidAmount != null ? `¥${payload.bidAmount}` : '-' },
    ],
    content: '有供应商提交了投标，请及时查看并安排评标。',
    actionUrl: await buildPageUrl('/tendering', payload.tenantId, extractReq(payload)),
  });
  // 通知招标方（createdBy 字段缺失时无法定向，留空跳过）
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 中标定标结果（通知招标方 + 邮件通知中标供应商）
async function handleBidAwarded(payload) {
  const card = buildCard({
    title: '🎉 中标结果通知',
    color: 'green',
    fields: [
      { label: '项目编号', value: payload.tender_code || '-' },
      { label: '项目名称', value: payload.tender_title || '-' },
      { label: '中标供应商ID', value: payload.supplierId || '-' },
      { label: '定标时间', value: new Date().toLocaleString('zh-CN') },
    ],
    content: '已确定中标供应商，请推进后续合同流程。',
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);

  // 邮件通知中标供应商
  notifySupplierByEmail(
    payload.supplierId,
    `【中标通知】${payload.tender_title || ''}`,
    `<h2>恭喜您中标！</h2>
     <p>项目编号：<strong>${payload.tender_code || ''}</strong></p>
     <p>项目名称：<strong>${payload.tender_title || ''}</strong></p>
     <p>您已成功中标，请尽快与招标方联系推进合同签订。</p>
     <p>定标时间：${new Date().toLocaleString('zh-CN')}</p>`,
    payload.tenantId,
  ).catch(e => logger.warn('[FeishuNotify] 中标邮件通知失败:', e.message));
}

// 资质审核结果（通知招标方有审核完成；供应商一般无飞书账号）
async function handleQualificationReviewed(payload) {
  const statusText = { approved: '通过', rejected: '驳回', pending: '待审' }[payload.reviewStatus] || payload.reviewStatus;
  const colorMap = { approved: 'green', rejected: 'red', pending: 'grey' };
  const card = buildCard({
    title: '📝 供应商资质审核完成',
    color: colorMap[payload.reviewStatus] || 'blue',
    fields: [
      { label: '供应商ID', value: payload.supplierId || '-' },
      { label: '审核结果', value: statusText },
      { label: '审核人', value: payload.reviewedBy || '-' },
    ],
    content: payload.reviewComment ? `**审核意见**\n${payload.reviewComment}` : '',
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.reviewedBy ? [payload.reviewedBy] : [] });
  await sendCardToOpenIds(openIds, card, payload.tenantId);

  // 邮件通知供应商审核结果（通过/驳回才发，待审不发）
  if (payload.reviewStatus === 'approved' || payload.reviewStatus === 'rejected') {
    const resultLabel = payload.reviewStatus === 'approved' ? '审核通过' : '审核未通过';
    const resultColor = payload.reviewStatus === 'approved' ? 'green' : 'red';
    notifySupplierByEmail(
      payload.supplierId,
      `【资质审核${resultLabel}】${payload.supplierName || ''}`,
      `<h2 style="color:${resultColor}">资质审核${resultLabel}</h2>
       <p>尊敬的供应商：</p>
       <p>您提交的资质审核材料已审核完成，结果为：<strong style="color:${resultColor}">${resultLabel}</strong></p>
       ${payload.reviewComment ? `<p><strong>审核意见：</strong>${payload.reviewComment}</p>` : ''}
       ${payload.reviewStatus === 'approved'
         ? '<p>您的资质已通过审核，可参与后续招标项目。</p>'
         : '<p>您的资质未通过审核，请根据审核意见补充材料后重新提交。</p>'}
       <p>审核时间：${new Date().toLocaleString('zh-CN')}</p>`,
      payload.tenantId,
    ).catch(e => logger.warn('[FeishuNotify] 资质审核邮件通知失败:', e.message));
  }
}

// 招标邀请发出（通知招标方记录；供应商无飞书账号时跳过）
async function handleTenderInvitationSent(payload) {
  const card = buildCard({
    title: '📨 招标邀请已发出',
    color: 'blue',
    fields: [
      { label: '项目编号', value: payload.tender_code || '-' },
      { label: '项目名称', value: payload.tender_title || '-' },
      { label: '供应商', value: payload.supplierName || '-' },
      { label: '联系人', value: `${payload.contactPerson || '-'} ${payload.contactPhone || ''}`.trim() },
    ],
    content: '已向供应商发出招标邀请。',
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);

  // 邮件通知受邀供应商
  notifySupplierByEmail(
    payload.supplierId,
    `【招标邀请】${payload.tender_title || ''}`,
    `<h2>招标邀请函</h2>
     <p>尊敬的<strong>${payload.supplierName || '供应商'}</strong>：</p>
     <p>诚邀贵司参加我方组织的招标项目，具体信息如下：</p>
     <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
       <tr><td>项目编号</td><td><strong>${payload.tender_code || '-'}</strong></td></tr>
       <tr><td>项目名称</td><td><strong>${payload.tender_title || '-'}</strong></td></tr>
       ${payload.deadline ? `<tr><td>投标截止</td><td><strong>${payload.deadline}</strong></td></tr>` : ''}
       ${payload.bidOpenTime ? `<tr><td>开标时间</td><td>${payload.bidOpenTime}</td></tr>` : ''}
     </table>
     <p>请贵司在投标截止时间前完成投标，详细要求请查阅招标文件。</p>
     <p>邀请发出时间：${new Date().toLocaleString('zh-CN')}</p>
     <p>如有疑问，请联系：${payload.contactPerson || '-'} ${payload.contactPhone || ''}</p>`,
    payload.tenantId,
  ).catch(e => logger.warn('[FeishuNotify] 招标邀请邮件通知失败:', e.message));
}

// ========== 盘点任务场景 ==========

// 盘点任务创建
async function handleInventoryTaskCreated(payload) {
  const card = buildCard({
    title: '📋 新盘点任务已分配',
    color: 'blue',
    fields: [
      { label: '任务名称', value: payload.task_name || '-' },
      { label: '负责人', value: payload.assignee_name || payload.assignee || '-' },
      { label: '盘点ID', value: String(payload.inventory_id || '-') },
    ],
    content: '您有一个新的盘点任务待执行，请尽快开始盘点工作。',
    actionUrl: await buildPageUrl('/inventory/tasks', payload.tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 盘点任务完成
async function handleInventoryTaskCompleted(payload) {
  const card = buildCard({
    title: '✔️ 盘点任务已完成',
    color: 'green',
    fields: [
      { label: '任务名称', value: payload.task_name || '-' },
      { label: '负责人', value: payload.assignee || '-' },
      { label: '实际盘点数', value: String(payload.actual_count ?? '-') },
    ],
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// 盘点任务取消
async function handleInventoryTaskCancelled(payload) {
  const card = buildCard({
    title: '🚫 盘点任务已取消',
    color: 'grey',
    fields: [
      { label: '任务名称', value: payload.task_name || '-' },
      { label: '负责人', value: payload.assignee || '-' },
      { label: '取消时间', value: new Date().toLocaleString('zh-CN') },
    ],
  });
  const openIds = await resolveOpenIds(payload);
  await sendCardToOpenIds(openIds, card, payload.tenantId);
}

// ========== 发票场景 ==========

async function handleInvoiceCreated(payload) {
  const { invoice, invoice_code, id, tenantId } = payload;
  const card = buildCard({
    title: '📄 新发票待审核',
    color: 'orange',
    fields: [
      { label: '发票编号', value: invoice_code || invoice?.invoice_code || '-' },
      { label: '金额', value: invoice?.amount != null ? `¥${invoice.amount}` : '-' },
      { label: '发票类型', value: invoice?.invoice_kind ? { vat_special: '增值税专用', vat_general: '增值税普通', receipt: '收据', e_invoice: '电子发票', other: '其他' }[invoice.invoice_kind] : '-' },
      { label: '状态', value: '待审核' },
    ],
    content: invoice?.remark ? `**备注**\n${invoice.remark}` : '',
    actionUrl: await buildPageUrl('/tendering/invoices', tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

async function handleInvoiceVerified(payload) {
  const { invoice, tenantId } = payload;
  const card = buildCard({
    title: '✅ 发票已审核通过',
    color: 'green',
    fields: [
      { label: '发票编号', value: invoice?.invoice_code || '-' },
      { label: '金额', value: invoice?.amount != null ? `¥${invoice.amount}` : '-' },
      { label: '原状态', value: payload.from || '-' },
      { label: '新状态', value: '已审核' },
    ],
    actionUrl: await buildPageUrl('/tendering/invoices', tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

async function handleInvoiceClaimed(payload) {
  const { invoice, tenantId } = payload;
  const card = buildCard({
    title: '📋 发票已认领',
    color: 'blue',
    fields: [
      { label: '发票编号', value: invoice?.invoice_code || '-' },
      { label: '金额', value: invoice?.amount != null ? `¥${invoice.amount}` : '-' },
      { label: '新状态', value: '已认领' },
    ],
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

async function handleInvoicePaid(payload) {
  const { invoice, tenantId } = payload;
  const card = buildCard({
    title: '💰 发票已付款',
    color: 'green',
    fields: [
      { label: '发票编号', value: invoice?.invoice_code || '-' },
      { label: '金额', value: invoice?.amount != null ? `¥${invoice.amount}` : '-' },
      { label: '付款时间', value: new Date().toLocaleString('zh-CN') },
    ],
    actionUrl: await buildPageUrl('/tendering/invoices', tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

async function handleInvoiceArchived(payload) {
  const { invoice, tenantId } = payload;
  const card = buildCard({
    title: '📦 发票已归档',
    color: 'grey',
    fields: [
      { label: '发票编号', value: invoice?.invoice_code || '-' },
      { label: '金额', value: invoice?.amount != null ? `¥${invoice.amount}` : '-' },
      { label: '归档时间', value: new Date().toLocaleString('zh-CN') },
    ],
    content: '发票已完成入账流程，资产状态已更新。',
    actionUrl: await buildPageUrl('/tendering/invoices', tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

async function handleInvoiceCancelled(payload) {
  const { invoice, tenantId } = payload;
  const card = buildCard({
    title: '🚫 发票已取消',
    color: 'red',
    fields: [
      { label: '发票编号', value: invoice?.invoice_code || '-' },
      { label: '金额', value: invoice?.amount != null ? `¥${invoice.amount}` : '-' },
      { label: '取消时间', value: new Date().toLocaleString('zh-CN') },
    ],
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

async function handleInvoiceApprovalPending(payload) {
  const { record_id, flow_code, tenantId } = payload;
  const card = buildCard({
    title: '🔔 发票付款审批待办',
    color: 'orange',
    fields: [
      { label: '审批记录', value: String(record_id || '-') },
      { label: '审批流程', value: flow_code || '-' },
      { label: '待办时间', value: new Date().toLocaleString('zh-CN') },
    ],
    content: '请尽快处理发票付款审批。',
    actionUrl: await buildPageUrl('/tendering/approvals', tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

// ========== 付款场景 ==========

async function handlePaymentCreated(payload) {
  const { payment, payment_code, id, tenantId } = payload;
  const card = buildCard({
    title: '💳 新付款单已创建',
    color: 'blue',
    fields: [
      { label: '付款单号', value: payment_code || payment?.payment_code || '-' },
      { label: '金额', value: payment?.amount != null ? `¥${payment.amount}` : '-' },
      { label: '收款人', value: payment?.payee_name || '-' },
      { label: '状态', value: '草稿' },
    ],
    actionUrl: await buildPageUrl('/tendering/payments', tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

async function handlePaymentSubmitted(payload) {
  const { payment, tenantId } = payload;
  const card = buildCard({
    title: '📤 付款单已提交',
    color: 'orange',
    fields: [
      { label: '付款单号', value: payment?.payment_code || '-' },
      { label: '金额', value: payment?.amount != null ? `¥${payment.amount}` : '-' },
      { label: '收款人', value: payment?.payee_name || '-' },
      { label: '状态', value: '已提交' },
    ],
    actionUrl: await buildPageUrl('/tendering/payments', tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

async function handlePaymentPaying(payload) {
  const { payment, tenantId } = payload;
  const card = buildCard({
    title: '⏳ 付款处理中',
    color: 'orange',
    fields: [
      { label: '付款单号', value: payment?.payment_code || '-' },
      { label: '金额', value: payment?.amount != null ? `¥${payment.amount}` : '-' },
      { label: '状态', value: '付款中' },
    ],
    content: '付款请求已提交，请等待银行处理结果。',
    actionUrl: await buildPageUrl('/tendering/payments', tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

async function handlePaymentPaid(payload) {
  const { payment, tenantId } = payload;
  const card = buildCard({
    title: '✅ 付款已完成',
    color: 'green',
    fields: [
      { label: '付款单号', value: payment?.payment_code || '-' },
      { label: '金额', value: payment?.amount != null ? `¥${payment.amount}` : '-' },
      { label: '收款人', value: payment?.payee_name || '-' },
      { label: '付款时间', value: new Date().toLocaleString('zh-CN') },
    ],
    actionUrl: await buildPageUrl('/tendering/payments', tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

async function handlePaymentFailed(payload) {
  const { payment, tenantId } = payload;
  const card = buildCard({
    title: '❌ 付款失败',
    color: 'red',
    fields: [
      { label: '付款单号', value: payment?.payment_code || '-' },
      { label: '金额', value: payment?.amount != null ? `¥${payment.amount}` : '-' },
      { label: '失败原因', value: payment?.failure_reason || '-' },
    ],
    content: '付款处理失败，请检查账户余额或重新提交。',
    actionUrl: await buildPageUrl('/tendering/payments', tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

async function handlePaymentCancelled(payload) {
  const { payment, tenantId } = payload;
  const card = buildCard({
    title: '🚫 付款单已取消',
    color: 'grey',
    fields: [
      { label: '付款单号', value: payment?.payment_code || '-' },
      { label: '金额', value: payment?.amount != null ? `¥${payment.amount}` : '-' },
      { label: '取消时间', value: new Date().toLocaleString('zh-CN') },
    ],
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

async function handlePaymentApprovalPending(payload) {
  const { record_id, flow_code, tenantId } = payload;
  const card = buildCard({
    title: '🔔 付款审批待办',
    color: 'orange',
    fields: [
      { label: '审批记录', value: String(record_id || '-') },
      { label: '审批流程', value: flow_code || '-' },
      { label: '待办时间', value: new Date().toLocaleString('zh-CN') },
    ],
    content: '请尽快处理付款审批。',
    actionUrl: await buildPageUrl('/tendering/approvals', tenantId, extractReq(payload)),
  });
  const openIds = await resolveOpenIds({ toUserIds: payload.userId ? [payload.userId] : [], tenantId });
  await sendCardToOpenIds(openIds, card, tenantId);
}

// ========== 预防性维护提醒 ==========

/**
 * 解析负责人姓名为本系统 user_id
 * 兼容：真实姓名（real_name）、用户名（username）、工号
 * 返回所有匹配到的 user_id 列表（同名多人会去重）
 */
async function resolveResponsibleUserIds(responsibleName, tenantId) {
  if (!responsibleName || !tenantId) return [];
  const name = String(responsibleName).trim();
  if (!name) return [];
  try {
    const [rows] = await db.execute(
      `SELECT DISTINCT u.id
       FROM users u
       INNER JOIN user_tenant_roles utr ON u.id = utr.user_id
       WHERE utr.tenant_id = ?
         AND u.status = 'active'
         AND (u.real_name = ? OR u.username = ? OR u.phone = ?)`,
      [tenantId, name, name, name],
    );
    return rows.map(r => r.id);
  } catch (e) {
    logger.warn(`[FeishuNotify] 解析负责人"${name}"为用户失败:`, e.message);
    return [];
  }
}

// 预防性维护计划提醒 - 飞书通知
async function handlePreventiveMaintenanceReminder(payload = {}) {
  const {
    plan_id,
    asset_code,
    asset_name,
    plan_name,
    next_maintenance_date,
    responsible_person,
    days_until,
    tenantId,
  } = payload;

  if (!plan_id || !tenantId) {
    logger.warn('[FeishuNotify] maintenance_plan:reminder 缺少 plan_id 或 tenantId');
    return;
  }

  // 颜色：已过期红色，即将到期（≤3天）橙色，普通蓝色
  let color = 'blue';
  let dueText = `距下次维护 ${days_until != null ? days_until : '?'} 天`;
  if (days_until != null) {
    if (days_until < 0) {
      color = 'red';
      dueText = `已逾期 ${Math.abs(days_until)} 天，请尽快处理`;
    } else if (days_until <= 3) {
      color = 'orange';
      dueText = `⚠️ 距下次维护仅 ${days_until} 天`;
    }
  }

  const card = buildCard({
    title: '🔔 预防性维护提醒',
    color,
    fields: [
      { label: '计划名称', value: plan_name || '-' },
      { label: '资产编号', value: asset_code || '-' },
      { label: '资产名称', value: asset_name || '-' },
      { label: '下次维护', value: next_maintenance_date ? String(next_maintenance_date).split('T')[0] : '-' },
      { label: '负责人', value: responsible_person || '-' },
      { label: '状态', value: dueText },
    ],
    content: '请按计划执行预防性维护，确保设备可靠运行。',
    actionUrl: await buildPageUrl('/maintenance/plans', tenantId, extractReq(payload)),
    actionText: '查看计划',
  });

  // 接收人：负责人 → 工程师兜底
  let openIds = [];
  const userIds = await resolveResponsibleUserIds(responsible_person, tenantId);
  if (userIds.length) {
    openIds = await resolveOpenIds({ toUserIds: userIds, tenantId });
  }

  if (!openIds.length) {
    // 兜底：租户内所有工程师
    const engineers = await getEngineersByTenant(tenantId);
    if (engineers.length) {
      const phones = engineers.map(e => e.phone).filter(Boolean);
      const byPhone = await getOpenIdsByMobiles(phones);
      openIds = byPhone.map(b => b.openId);
    }
  }

  if (!openIds.length) {
    logger.warn(
      `[FeishuNotify] 预防性维护提醒无接收人 (plan_id=${plan_id}, responsible=${responsible_person}, tenant=${tenantId})`,
    );
    return;
  }

  await sendCardToOpenIds(openIds, card, tenantId);
  logger.info(
    `[FeishuNotify] 预防性维护提醒已发送 (plan_id=${plan_id}, 接收人 ${openIds.length} 人)`,
  );
}

// ========== 供应商邮件通知辅助 ==========

/**
 * 查询供应商邮箱
 * @param {number} supplierId
 * @param {number} [tenantId] - 租户ID（用于租户隔离校验，可选）
 * @returns {Promise<string|null>}
 */
async function getSupplierEmail(supplierId, tenantId) {
  if (!supplierId) return null;
  try {
    // 多租户隔离：有 tenantId 时按租户过滤；超级管理员跨租户场景允许传 null 查任意租户
    const sql = tenantId
      ? 'SELECT contact_email FROM tender_suppliers WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1'
      : 'SELECT contact_email FROM tender_suppliers WHERE id = ? AND deleted_at IS NULL LIMIT 1';
    const params = tenantId ? [supplierId, tenantId] : [supplierId];
    const [rows] = await db.execute(sql, params);
    return rows[0]?.contact_email || null;
  } catch (e) {
    return null;
  }
}

/**
 * 向供应商发送邮件通知（如果配置了 SMTP 且供应商有邮箱）
 * @param {number} supplierId
 * @param {string} subject
 * @param {string} html
 * @param {number} [tenantId] - 租户ID，用于读取租户级 SMTP 配置
 */
async function notifySupplierByEmail(supplierId, subject, html, tenantId) {
  const email = await getSupplierEmail(supplierId, tenantId);
  if (!email) {
    logger.info(`[FeishuNotify] 供应商${supplierId}无邮箱，跳过邮件通知`);
    return { sent: 0, reason: 'no_email' };
  }
  const result = await emailService.sendMail({ to: email, subject, html, tenantId });
  logger.info(`[FeishuNotify] 供应商邮件通知 -> ${email} (租户 ${tenantId || '默认'}):`, result);
  return result;
}

/* ===================== 验收提醒 ===================== */

/**
 * 处理验收提醒事件（acceptance:reminder）
 * 由 acceptance-management 模块的定时扫描 / 手动创建触发，渲染飞书卡片并推送。
 * payload 字段见 acceptance.service.js 的 persistAndNotify。
 */
async function handleAcceptanceReminder(payload = {}) {
  const {
    reminder_id,
    tenantId,
    reminder_type,
    title,
    content,
    remind_date,
    asset_code,
    asset_name,
    application_code,
    link_path,
    target_user_id,
    target_name,
    target_department,
    days_until,
  } = payload;

  if (!tenantId) {
    logger.warn('[FeishuNotify] acceptance:reminder 缺少 tenantId，跳过');
    return;
  }

  // 颜色：超期红色，临近（≤3天）橙色，待办/其它蓝色
  let color = 'blue';
  let dueText = '-';
  if (days_until != null) {
    if (days_until < 0) {
      color = 'red';
      dueText = `已超期 ${Math.abs(days_until)} 天，请尽快处理`;
    } else if (days_until <= 3) {
      color = 'orange';
      dueText = `仅剩 ${days_until} 天`;
    } else {
      dueText = `还有 ${days_until} 天`;
    }
  }

  const card = buildCard({
    title: `🔔 验收${reminder_type || '提醒'}`,
    color,
    fields: [
      { label: '提醒类型', value: reminder_type || '-' },
      { label: '资产编号', value: asset_code || '-' },
      { label: '资产名称', value: asset_name || '-' },
      { label: '关联申请', value: application_code || '-' },
      { label: '日期', value: remind_date ? String(remind_date).split('T')[0] : '-' },
      { label: '接收对象', value: target_name || target_department || '-' },
      ...(days_until != null ? [{ label: '时效', value: dueText }] : []),
    ],
    content: content || title || '',
    actionUrl: await buildPageUrl(link_path || '/acceptance/reminders', tenantId, extractReq(payload)),
    actionText: '查看详情',
  });

  // 接收人：优先按目标用户，缺失时回退租户审批/管理员
  let openIds = [];
  if (target_user_id) {
    openIds = await resolveOpenIds({ toUserIds: [target_user_id], tenantId });
  } else {
    openIds = await resolveOpenIds({ tenantId });
  }

  if (!openIds.length) {
    logger.warn(`[FeishuNotify] 验收提醒无接收人 (tenant=${tenantId}, reminder=${reminder_id})`);
    return;
  }

  await sendCardToOpenIds(openIds, card, tenantId);
  logger.info(`[FeishuNotify] 验收提醒已发送 (tenant=${tenantId}, reminder=${reminder_id}, 接收人 ${openIds.length} 人)`);
}

/* ===================== 初始化订阅 ===================== */

/**
 * 初始化飞书业务通知订阅
 * 在服务器启动时调用
 */
function initFeishuNotification() {
  if (!NOTIFICATION_ENABLED) {
    logger.info('[FeishuNotify] 飞书通知已通过环境变量关闭');
    return;
  }

  // 资产报废
  subscribe('scrapping:created', wrapHandler('scrapping:created', handleScrappingCreated));
  subscribe('scrapping:approved', wrapHandler('scrapping:approved', handleScrappingApproved));
  subscribe('scrapping:rejected', wrapHandler('scrapping:rejected', handleScrappingRejected));
  subscribe('scrapping:completed', wrapHandler('scrapping:completed', handleScrappingCompleted));

  // 资产调配
  subscribe('transfer:created', wrapHandler('transfer:created', handleTransferCreated));
  subscribe('transfer:approved', wrapHandler('transfer:approved', handleTransferApproved));
  subscribe('transfer:rejected', wrapHandler('transfer:rejected', handleTransferRejected));
  subscribe('transfer:completed', wrapHandler('transfer:completed', handleTransferCompleted));

  // 维修审批通过（复用现有事件）
  subscribe(SYSTEM_EVENTS.MAINTENANCE_APPROVED, wrapHandler('maintenance:approved', handleMaintenanceApproved));

  // 盘点
  subscribe('inventory:created', wrapHandler('inventory:created', handleInventoryCreated));
  subscribe('inventory:completed', wrapHandler('inventory:completed', handleInventoryCompleted));

  // 资产领用 / 归还
  subscribe('asset_usage:checkout', wrapHandler('asset_usage:checkout', handleAssetCheckout));
  subscribe('asset_usage:return', wrapHandler('asset_usage:return', handleAssetReturn));

  // 工单派单 / 完成
  subscribe('workorder:assigned', wrapHandler('workorder:assigned', handleWorkOrderAssigned));
  subscribe('workorder:completed', wrapHandler('workorder:completed', handleWorkOrderCompleted));

  // 资产状态工作流迁移
  subscribe('asset_workflow:transition', wrapHandler('asset_workflow:transition', handleAssetWorkflowTransition));

  // 维修申请 创建 / 审批 / 完成 / 取消
  subscribe('maintenance_request:created', wrapHandler('maintenance_request:created', handleMaintenanceRequestCreated));
  subscribe('maintenance_request:approved', wrapHandler('maintenance_request:approved', handleMaintenanceRequestApproved));
  subscribe('maintenance_request:rejected', wrapHandler('maintenance_request:rejected', handleMaintenanceRequestRejected));
  subscribe('maintenance_request:completed', wrapHandler('maintenance_request:completed', handleMaintenanceRequestCompleted));
  subscribe('maintenance_request:started', wrapHandler('maintenance_request:started', handleMaintenanceRequestStarted));
  subscribe('maintenance_request:cancelled', wrapHandler('maintenance_request:cancelled', handleMaintenanceRequestCancelled));

  // 新用户加入企业 - 通知管理员设置角色
  subscribe('notification:role_request', wrapHandler('notification:role_request', handleUserJoinRequest));

  // 招标采购
  subscribe('tender:created', wrapHandler('tender:created', handleTenderCreated));
  subscribe('tender:published', wrapHandler('tender:published', handleTenderPublished));
  subscribe('tender:awarded', wrapHandler('tender:awarded', handleTenderAwarded));
  subscribe('tender:completed', wrapHandler('tender:completed', handleTenderCompleted));
  subscribe('tender:cancelled', wrapHandler('tender:cancelled', handleTenderCancelled));
  subscribe('bid:submitted', wrapHandler('bid:submitted', handleBidSubmitted));
  subscribe('bid:awarded', wrapHandler('bid:awarded', handleBidAwarded));
  subscribe('qualification:reviewed', wrapHandler('qualification:reviewed', handleQualificationReviewed));
  subscribe('tender:invitation-sent', handleTenderInvitationSent);

  // 发票
  subscribe('tender:invoice:created', wrapHandler('tender:invoice:created', handleInvoiceCreated));
  subscribe('tender:invoice:verified', wrapHandler('tender:invoice:verified', handleInvoiceVerified));
  subscribe('tender:invoice:claimed', wrapHandler('tender:invoice:claimed', handleInvoiceClaimed));
  subscribe('tender:invoice:paid', wrapHandler('tender:invoice:paid', handleInvoicePaid));
  subscribe('tender:invoice:archived', wrapHandler('tender:invoice:archived', handleInvoiceArchived));
  subscribe('tender:invoice:cancelled', wrapHandler('tender:invoice:cancelled', handleInvoiceCancelled));
  subscribe('tender:invoice:approval_pending', wrapHandler('tender:invoice:approval_pending', handleInvoiceApprovalPending));

  // 付款
  subscribe('tender:payment:created', wrapHandler('tender:payment:created', handlePaymentCreated));
  subscribe('tender:payment:submitted', wrapHandler('tender:payment:submitted', handlePaymentSubmitted));
  subscribe('tender:payment:paying', wrapHandler('tender:payment:paying', handlePaymentPaying));
  subscribe('tender:payment:paid', wrapHandler('tender:payment:paid', handlePaymentPaid));
  subscribe('tender:payment:failed', wrapHandler('tender:payment:failed', handlePaymentFailed));
  subscribe('tender:payment:cancelled', wrapHandler('tender:payment:cancelled', handlePaymentCancelled));
  subscribe('tender:payment:approval_pending', wrapHandler('tender:payment:approval_pending', handlePaymentApprovalPending));

  // 验收提醒（到期 / 超期 / 审批待办 / 整改通知）
  subscribe('acceptance:reminder', wrapHandler('acceptance:reminder', handleAcceptanceReminder));

  // 盘点任务
  subscribe('inventory_task:created', wrapHandler('inventory_task:created', handleInventoryTaskCreated));
  subscribe('inventory_task:completed', wrapHandler('inventory_task:completed', handleInventoryTaskCompleted));
  subscribe('inventory_task:cancelled', wrapHandler('inventory_task:cancelled', handleInventoryTaskCancelled));

  // 预防性维护提醒
  subscribe(SYSTEM_EVENTS.MAINTENANCE_PLAN_REMINDER, wrapHandler('maintenance_plan:reminder', handlePreventiveMaintenanceReminder));

  logger.info('[FeishuNotify] 飞书业务通知订阅已注册');
}

module.exports = {
  initFeishuNotification,
  buildCard,
  resolveOpenIds,
  sendCardToOpenIds,
  getOpenIdsByUserIds,
  getOpenIdsByMobiles,
  getUserPhones,
  buildPageUrl,
  resolveTenantBaseUrl,
  clearTenantUrlCache,
  // 暴露处理器便于测试
  handleScrappingCreated,
  handleTransferCreated,
  handleMaintenanceApproved,
  handleMaintenanceRequestApproved,
  handleMaintenanceRequestRejected,
  handleInventoryCreated,
  handleUserJoinRequest,
  handlePreventiveMaintenanceReminder,
  // 发票处理器
  handleInvoiceCreated,
  handleInvoiceVerified,
  handleInvoiceClaimed,
  handleInvoicePaid,
  handleInvoiceArchived,
  handleInvoiceCancelled,
  handleInvoiceApprovalPending,
  // 付款处理器
  handlePaymentCreated,
  handlePaymentSubmitted,
  handlePaymentPaying,
  handlePaymentPaid,
  handlePaymentFailed,
  handlePaymentCancelled,
  handlePaymentApprovalPending,
};
