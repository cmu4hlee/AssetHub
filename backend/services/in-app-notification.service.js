/**
 * 站内消息服务
 *
 * 职责：
 *   1. 订阅 EventBus 业务事件（与飞书通知一致的事件集）
 *   2. 解析接收人 → 写入 in_app_notifications 表（持久化）
 *   3. 通过 Socket.IO 实时推送给在线用户（app:notification 事件）
 *   4. 接收人离线时，下次登录通过 REST API 拉取历史
 *
 * 设计原则：
 *   - 与飞书通知并列订阅：飞书发飞书，站内发站内，互不干扰
 *   - 复用 core/socket.js 的 pushToUser/pushToRole，避免重复实现
 *   - 复用 feishu-notification.service.js 的 resolveOpenIds 接收人解析逻辑
 *     （但 socket 没有 open_id 概念，这里重写一个返回 userId 列表的版本）
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { subscribe, SYSTEM_EVENTS } = require('../core/EventBus');
const { pushToUser, pushToRole, pushToUsers } = require('../core/socket');
const recipientStrategy = require('./recipient-strategy.service');
const preferenceService = require('./notification-preference.service');

const NOTIFICATION_ENABLED = process.env.IN_APP_NOTIFICATION_ENABLED !== 'false';
const DEFAULT_EXPIRES_DAYS = parseInt(process.env.IN_APP_NOTIFICATION_EXPIRES_DAYS || '30', 10);

let _initialized = false;

/* ===================== 接收人解析 ===================== */

/**
 * 解析事件 payload 中的接收人 userId 列表
 * 优先级：toUserIds / applicantId+approverId+assigneeId+createdBy+request_person_id
 *        > 角色兜底（租户审批/管理员）
 *
 * @param {Object} payload - 事件数据
 * @returns {Promise<number[]>} - 去重后的 userId 数组
 */
async function resolveUserIds(payload = {}) {
  const userIds = new Set();
  ['toUserIds', 'applicantId', 'approverId', 'assigneeId', 'createdBy',
    'request_person_id', 'repair_person_id', 'completedBy', 'cancelledBy',
    'operatorId', 'reviewedBy', 'admins',
  ].forEach(k => {
    const v = payload[k];
    if (Array.isArray(v)) v.forEach(id => id && userIds.add(Number(id)));
    else if (v) userIds.add(Number(v));
  });

  // 兜底：当没有显式接收人时，查租户管理员/审批角色
  if (!userIds.size && payload.tenantId) {
    const approverIds = await getTenantApproverIds(payload.tenantId);
    approverIds.forEach(id => userIds.add(Number(id)));
    if (approverIds.length) {
      logger.info(`[InAppNotify] 使用租户${payload.tenantId}审批/管理员兜底接收人，共 ${approverIds.length} 人`);
    }
  }
  return [...userIds].filter(Boolean);
}

/**
 * 查询租户内的审批/管理员角色用户ID
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
    return rows.map(r => Number(r.id));
  } catch (e) {
    logger.warn('[InAppNotify] 查询租户审批人失败:', e.message);
    return [];
  }
}

/**
 * 查询指定租户下所有维修工程师
 */
async function getEngineersByTenant(tenantId) {
  if (!tenantId) return [];
  try {
    const ENGINEER_ROLES = ['maintenance_admin', 'maintenance_engineer'];
    const [rows] = await db.execute(
      `SELECT u.id FROM users u
       INNER JOIN user_tenant_roles utr ON u.id = utr.user_id
       WHERE utr.tenant_id = ? AND utr.role IN (${ENGINEER_ROLES.map(() => '?').join(',')})
         AND u.status = 'active'
       GROUP BY u.id`,
      [tenantId, ...ENGINEER_ROLES],
    );
    return rows.map(r => Number(r.id));
  } catch (e) {
    return [];
  }
}

/* ===================== 持久化 + 推送 ===================== */

/**
 * 写入站内消息 + Socket 推送
 * @param {Object} params
 * @param {number[]} params.userIds - 接收人 userId 列表
 * @param {number}   params.tenantId - 租户ID
 * @param {string}   params.eventCode - 事件编码
 * @param {string}   params.category - 分类（用于前端分组展示）
 * @param {string}   params.title - 标题
 * @param {string}   [params.content] - 内容
 * @param {string}   [params.urgency] - 紧急度 high/medium/low
 * @param {Object}   [params.payload] - 原始事件数据（落库用于排查/回放）
 * @param {string}   [params.actionUrl] - 跳转链接（相对路径）
 * @param {string}   [params.actionText] - 按钮文案
 * @returns {Promise<{inserted: number, pushed: number, userIds: number[]}>}
 */
async function deliver({
  userIds,
  tenantId,
  eventCode,
  category,
  title,
  content = '',
  urgency = 'medium',
  payload = null,
  actionUrl = null,
  actionText = '查看详情',
}) {
  if (!userIds || !userIds.length) {
    return { inserted: 0, pushed: 0, userIds: [] };
  }
  if (!title) {
    logger.warn('[InAppNotify] 缺少 title，跳过');
    return { inserted: 0, pushed: 0, userIds: [] };
  }

  // 去重 userId 并转换为数字
  const uniqUserIds = [...new Set(userIds.map(Number).filter(Boolean))];

  // 0. 通知偏好过滤（DND / 紧急度阈值 / 启用开关）
  // 注意：即使被过滤，**仍然会落库**（保证历史可查、不丢消息），
  //       只是不通过 Socket 实时推送 + 不发桌面通知 / 顶部气泡
  const { allowed: pushableUserIds, filtered } = await preferenceService.filterUsersByPreferences(
    uniqUserIds, eventCode, urgency,
  );
  if (filtered.length) {
    logger.debug(
      `[InAppNotify] event=${eventCode} 过滤 ${filtered.length} 个用户:`,
      filtered.map(f => `${f.userId}(${f.reason})`).join(', '),
    );
  }

  // 1. 持久化（全部落库，包含被偏好过滤的）
  let inserted = 0;
  try {
    const expiresAt = DEFAULT_EXPIRES_DAYS > 0
      ? new Date(Date.now() + DEFAULT_EXPIRES_DAYS * 24 * 60 * 60 * 1000)
      : null;
    const sourcePayloadJson = payload ? safeJsonStringify(payload) : null;

    // 批量插入（VALUES 多行）
    const placeholders = uniqUserIds.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
    const params = [];
    for (const uid of uniqUserIds) {
      params.push(
        tenantId || 0,
        uid,
        eventCode,
        category || 'system',
        title,
        content || '',
        urgency,
        sourcePayloadJson,
        actionUrl || null,
        actionText || '查看详情',
        0,
        expiresAt,
      );
    }
    const [result] = await db.execute(
      `INSERT INTO in_app_notifications
       (tenant_id, user_id, event_code, category, title, content, urgency,
        source_payload, action_url, action_text, is_read, expires_at)
       VALUES ${placeholders}`,
      params,
    );
    inserted = result.affectedRows || 0;
  } catch (e) {
    logger.error(`[InAppNotify] 持久化失败 (event=${eventCode}):`, e.message);
    // 持久化失败不阻断推送
  }

  // 2. Socket 实时推送（只推未过滤的用户）
  let pushed = 0;
  try {
    if (pushableUserIds.length) {
      // 拿首条未过滤用户的偏好，用于决定桌面通知 / 顶部气泡
      // （混合用户的偏好可能不同，这里用最宽松的判断）
      const socketData = {
        type: 'in_app_notification',
        eventCode,
        category: category || 'system',
        title,
        content,
        urgency,
        actionUrl,
        actionText,
        timestamp: new Date().toISOString(),
      };
      pushToUsers(pushableUserIds, 'app:notification', socketData);
      pushed = pushableUserIds.length;
    }
  } catch (e) {
    logger.error(`[InAppNotify] Socket 推送失败 (event=${eventCode}):`, e.message);
  }

  logger.info(
    `[InAppNotify] event=${eventCode} category=${category} tenant=${tenantId} ` +
    `urgency=${urgency} recipients=${uniqUserIds.length} filtered=${filtered.length} ` +
    `persisted=${inserted} pushed=${pushed}`,
  );

  return { inserted, pushed, userIds: uniqUserIds, filteredCount: filtered.length };
}

function safeJsonStringify(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (_e) {
    return null;
  }
}

/* ===================== 事件处理器 ===================== */

// 通用处理器工厂：从 payload 自动解析接收人 + 写入 + 推送
// 接收人解析优先级：
//   1. recipient_strategies 表中配置的自定义策略（管理员在 UI 配置）
//   2. handler 自定义 customResolve（业务特殊逻辑）
//   3. 默认 resolveUserIds（从 payload 读字段 + 兜底租户管理员）
function makeHandler({
  eventCode,
  category,
  buildTitle,
  buildContent,
  buildUrgency,
  buildActionUrl,
  customResolve, // 自定义接收人解析（覆盖默认 resolveUserIds）
}) {
  return async function handler(payload = {}) {
    try {
      const tenantId = payload.tenantId || payload.tenant_id || null;

      // 1. 优先查 recipient_strategies 配置
      let userIds = await recipientStrategy.resolveRecipients(tenantId, eventCode, payload);

      // 2. 配置未命中，使用 handler 自定义或默认逻辑
      if (userIds === null) {
        userIds = customResolve
          ? await customResolve(payload, tenantId)
          : await resolveUserIds(payload);
      }

      if (!userIds.length) {
        logger.debug(`[InAppNotify] ${eventCode} 无接收人，跳过`);
        return;
      }

      await deliver({
        userIds,
        tenantId,
        eventCode,
        category,
        title: typeof buildTitle === 'function' ? buildTitle(payload) : buildTitle,
        content: typeof buildContent === 'function' ? buildContent(payload) : (buildContent || ''),
        urgency: typeof buildUrgency === 'function' ? buildUrgency(payload) : (buildUrgency || 'medium'),
        actionUrl: typeof buildActionUrl === 'function' ? buildActionUrl(payload) : (buildActionUrl || null),
        payload,
      });
    } catch (e) {
      logger.error(`[InAppNotify] 处理 ${eventCode} 失败:`, e.message);
    }
  };
}

// 资产报废
const handleScrappingCreated = makeHandler({
  eventCode: 'scrapping:created',
  category: 'scrapping',
  buildTitle: p => '📦 新报废申请待审批',
  buildContent: p => `资产 ${p.asset_code || '-'} (${p.asset_name || '-'}) 申请报废`,
  buildUrgency: () => 'medium',
  buildActionUrl: () => '/scrapping',
});
const handleScrappingApproved = makeHandler({
  eventCode: 'scrapping:approved',
  category: 'scrapping',
  buildTitle: p => '✅ 报废申请已通过',
  buildContent: p => `资产 ${p.asset_code || '-'} 报废申请已通过`,
  buildActionUrl: () => '/scrapping',
});
const handleScrappingRejected = makeHandler({
  eventCode: 'scrapping:rejected',
  category: 'scrapping',
  buildTitle: p => '❌ 报废申请已驳回',
  buildContent: p => `资产 ${p.asset_code || '-'} 报废申请被驳回${p.opinion ? `，原因：${p.opinion}` : ''}`,
  buildUrgency: () => 'high',
});
const handleScrappingCompleted = makeHandler({
  eventCode: 'scrapping:completed',
  category: 'scrapping',
  buildTitle: () => '✔️ 报废流程已完成',
  buildContent: p => `资产 ${p.asset_code || '-'} 已完成报废`,
});

// 资产调配
const handleTransferCreated = makeHandler({
  eventCode: 'transfer:created',
  category: 'transfer',
  buildTitle: () => '🔄 新调配申请待审批',
  buildContent: p => `资产 ${p.asset_code || '-'} 申请调配至 ${p.target_department || '-'}`,
  buildActionUrl: () => '/transfer',
});
const handleTransferApproved = makeHandler({
  eventCode: 'transfer:approved',
  category: 'transfer',
  buildTitle: () => '✅ 调配申请已通过',
  buildContent: p => `资产 ${p.asset_code || '-'} 调配申请已通过`,
  buildActionUrl: () => '/transfer',
});
const handleTransferRejected = makeHandler({
  eventCode: 'transfer:rejected',
  category: 'transfer',
  buildTitle: () => '❌ 调配申请已驳回',
  buildContent: p => `资产 ${p.asset_code || '-'} 调配申请被驳回`,
  buildUrgency: () => 'high',
});
const handleTransferCompleted = makeHandler({
  eventCode: 'transfer:completed',
  category: 'transfer',
  buildTitle: () => '✔️ 资产调配已完成',
  buildContent: p => `资产 ${p.asset_code || '-'} 已完成调配`,
});

// 维修审批通过
const handleMaintenanceApproved = makeHandler({
  eventCode: 'maintenance:approved',
  category: 'maintenance',
  buildTitle: () => '🔧 新维修工单待处理',
  buildContent: p => {
    const req = p.request || {};
    return `工单 ${p.workOrderNo || req.request_no || '-'} · 资产 ${req.asset_code || '-'} (${req.asset_name || '-'})`;
  },
  buildUrgency: p => {
    const lvl = p.request?.fault_level || p.fault_level;
    return lvl === '紧急' || lvl === '严重' ? 'high' : 'medium';
  },
  buildActionUrl: () => '/maintenance/workorders',
  customResolve: async (payload, tenantId) => {
    // 优先 payload.toUserIds，其次查租户工程师
    const userIds = await resolveUserIds(payload);
    if (userIds.length) return userIds;
    if (tenantId) return getEngineersByTenant(tenantId);
    return [];
  },
});

// 维修申请创建
const handleMaintenanceRequestCreated = makeHandler({
  eventCode: 'maintenance_request:created',
  category: 'maintenance',
  buildTitle: () => '🆕 新维修申请待审批',
  buildContent: p => `申请编号 ${p.requestNo || '-'} · 资产 ${p.asset_code || '-'} (${p.asset_name || '-'}) · 故障等级 ${p.fault_level || '-'}`,
  buildUrgency: p => p.fault_level === '紧急' ? 'high' : (p.fault_level === '严重' ? 'medium' : 'low'),
  buildActionUrl: () => '/maintenance/requests',
  customResolve: async (payload, tenantId) => {
    const userIds = await resolveUserIds(payload);
    if (userIds.length) return userIds;
    // 兜底：通知维修管理员 + 资产管理员
    if (tenantId) {
      try {
        const [rows] = await db.execute(
          `SELECT DISTINCT u.id FROM users u
           INNER JOIN user_tenant_roles utr ON u.id = utr.user_id
           WHERE utr.tenant_id = ? AND utr.role IN ('maintenance_admin', 'asset_admin', 'system_admin', 'admin')
             AND u.status = 'active'`,
          [tenantId],
        );
        return rows.map(r => Number(r.id));
      } catch (_e) { /* ignore */ }
    }
    return [];
  },
});

// 维修申请审批通过
const handleMaintenanceRequestApproved = makeHandler({
  eventCode: 'maintenance_request:approved',
  category: 'maintenance',
  buildTitle: () => '✅ 维修申请已批准',
  buildContent: p => {
    const req = p.request || {};
    return `申请 ${req.request_no || '-'} 已批准${p.approver ? `（审批人：${p.approver}）` : ''}`;
  },
  buildUrgency: () => 'medium',
  buildActionUrl: () => '/maintenance/requests',
});

// 维修申请拒绝
const handleMaintenanceRequestRejected = makeHandler({
  eventCode: 'maintenance_request:rejected',
  category: 'maintenance',
  buildTitle: () => '❌ 维修申请已拒绝',
  buildContent: p => {
    const req = p.request || {};
    return `申请 ${req.request_no || '-'} 已拒绝${p.comment ? `，原因：${p.comment}` : ''}`;
  },
  buildUrgency: () => 'high',
  buildActionUrl: () => '/maintenance/requests',
});

// 维修申请开始
const handleMaintenanceRequestStarted = makeHandler({
  eventCode: 'maintenance_request:started',
  category: 'maintenance',
  buildTitle: () => '🔧 维修已开始',
  buildContent: p => `报修单 ${p.requestNo || '-'} 已开始维修${p.repair_person ? `，工程师：${p.repair_person}` : ''}`,
  buildActionUrl: p => p.id ? `/maintenance/requests/${p.id}` : '/maintenance/requests',
});

// 维修申请完成
const handleMaintenanceRequestCompleted = makeHandler({
  eventCode: 'maintenance_request:completed',
  category: 'maintenance',
  buildTitle: () => '✔️ 维修已完成',
  buildContent: p => {
    const asset = p.asset_name || p.asset_code || '-';
    return `资产 ${asset} 的维修已完成${p.completedBy ? `（完成人：${p.completedBy}）` : ''}`;
  },
});

// 维修申请取消
const handleMaintenanceRequestCancelled = makeHandler({
  eventCode: 'maintenance_request:cancelled',
  category: 'maintenance',
  buildTitle: () => '🚫 维修申请已取消',
  buildContent: p => `报修单 ${p.requestNo || '-'} 已取消`,
});

// 工单派发
const handleWorkOrderAssigned = makeHandler({
  eventCode: 'workorder:assigned',
  category: 'maintenance',
  buildTitle: () => '🔧 新工单已派发给您',
  buildContent: p => `工单 ${p.workOrderNo || '-'} · 资产 ${p.asset_code || '-'} (${p.asset_name || '-'})`,
  buildUrgency: () => 'medium',
  buildActionUrl: () => '/maintenance/workorders',
});

// 工单完成
const handleWorkOrderCompleted = makeHandler({
  eventCode: 'workorder:completed',
  category: 'maintenance',
  buildTitle: () => '✔️ 维修工单已完成',
  buildContent: p => `工单 ${p.workOrderNo || '-'} 已完成`,
});

// 资产状态工作流迁移
const handleAssetWorkflowTransition = makeHandler({
  eventCode: 'asset_workflow:transition',
  category: 'asset',
  buildTitle: () => '🔄 资产状态变更',
  buildContent: p => `资产 ${p.assetCode || p.asset_code || '-'}：${p.fromState || '-'} → ${p.toState || '-'}`,
});

// 资产领用
const handleAssetCheckout = makeHandler({
  eventCode: 'asset_usage:checkout',
  category: 'asset_usage',
  buildTitle: () => '📤 资产领用通知',
  buildContent: p => `资产 ${p.asset_code || '-'} 已被 ${p.user_name || '-'} 领用`,
  buildActionUrl: () => '/asset-usage',
});

// 资产归还
const handleAssetReturn = makeHandler({
  eventCode: 'asset_usage:return',
  category: 'asset_usage',
  buildTitle: () => '📥 资产归还通知',
  buildContent: p => `资产 ${p.asset_code || '-'} 已由 ${p.user_name || '-'} 归还`,
});

// 盘点创建
const handleInventoryCreated = makeHandler({
  eventCode: 'inventory:created',
  category: 'inventory',
  buildTitle: () => '📋 新盘点任务已创建',
  buildContent: p => `盘点名称：${p.inventory_name || p.name || '-'}`,
  buildActionUrl: () => '/inventory',
});

// 盘点完成
const handleInventoryCompleted = makeHandler({
  eventCode: 'inventory:completed',
  category: 'inventory',
  buildTitle: () => '✔️ 盘点已完成',
  buildContent: p => `盘点：${p.inventory_name || p.name || '-'}`,
});

// 盘点任务创建
const handleInventoryTaskCreated = makeHandler({
  eventCode: 'inventory_task:created',
  category: 'inventory',
  buildTitle: () => '📋 新盘点任务已分配',
  buildContent: p => `任务 ${p.task_name || '-'} 已分配给您${p.assignee_name ? `（负责人：${p.assignee_name}）` : ''}`,
  buildActionUrl: () => '/inventory/tasks',
});

// 盘点任务完成
const handleInventoryTaskCompleted = makeHandler({
  eventCode: 'inventory_task:completed',
  category: 'inventory',
  buildTitle: () => '✔️ 盘点任务已完成',
  buildContent: p => `任务 ${p.task_name || '-'} 已完成`,
});

// 盘点任务取消
const handleInventoryTaskCancelled = makeHandler({
  eventCode: 'inventory_task:cancelled',
  category: 'inventory',
  buildTitle: () => '🚫 盘点任务已取消',
  buildContent: p => `任务 ${p.task_name || '-'} 已取消`,
});

// 招标
const handleTenderCreated = makeHandler({
  eventCode: 'tender:created',
  category: 'tendering',
  buildTitle: () => '📋 新招标项目已创建',
  buildContent: p => `项目 ${p.tender_code || '-'} ${p.title || '-'}`,
  buildActionUrl: () => '/tendering',
});
const handleTenderPublished = makeHandler({
  eventCode: 'tender:published',
  category: 'tendering',
  buildTitle: () => '📢 招标项目已发布',
  buildContent: p => `项目 ${p.tender_code || '-'} ${p.title || '-'} 已发布`,
  buildActionUrl: () => '/tendering',
});
const handleTenderAwarded = makeHandler({
  eventCode: 'tender:awarded',
  category: 'tendering',
  buildTitle: () => '🏆 招标项目已定标',
  buildContent: p => `项目 ${p.tender_code || '-'} ${p.title || '-'} 已定标`,
  buildUrgency: () => 'high',
  buildActionUrl: () => '/tendering',
});
const handleTenderCompleted = makeHandler({
  eventCode: 'tender:completed',
  category: 'tendering',
  buildTitle: () => '✔️ 招标项目已完成',
  buildContent: p => `项目 ${p.tender_code || '-'} ${p.title || '-'} 已完成`,
});
const handleTenderCancelled = makeHandler({
  eventCode: 'tender:cancelled',
  category: 'tendering',
  buildTitle: () => '🚫 招标项目已取消',
  buildContent: p => `项目 ${p.tender_code || '-'} ${p.title || '-'} 已取消`,
});

// 投标
const handleBidSubmitted = makeHandler({
  eventCode: 'bid:submitted',
  category: 'tendering',
  buildTitle: () => '📥 收到新投标',
  buildContent: p => `项目 ${p.tender_code || '-'} 收到供应商 ${p.supplierName || '-'} 的投标${p.bidAmount != null ? `，报价 ¥${p.bidAmount}` : ''}`,
  buildActionUrl: () => '/tendering',
});
const handleBidAwarded = makeHandler({
  eventCode: 'bid:awarded',
  category: 'tendering',
  buildTitle: () => '🎉 中标结果通知',
  buildContent: p => `项目 ${p.tender_code || '-'} 已定标`,
  buildUrgency: () => 'high',
});

// 资质审核
const handleQualificationReviewed = makeHandler({
  eventCode: 'qualification:reviewed',
  category: 'tendering',
  buildTitle: p => `📝 资质审核${p.reviewStatus === 'approved' ? '通过' : (p.reviewStatus === 'rejected' ? '未通过' : '完成')}`,
  buildContent: p => `供应商 ${p.supplierName || p.supplierId || '-'} 审核结果：${p.reviewStatus === 'approved' ? '通过' : (p.reviewStatus === 'rejected' ? '未通过' : '待审')}`,
});

// 招标邀请
const handleTenderInvitationSent = makeHandler({
  eventCode: 'tender:invitation-sent',
  category: 'tendering',
  buildTitle: () => '📨 招标邀请已发出',
  buildContent: p => `项目 ${p.tender_code || '-'} 邀请供应商 ${p.supplierName || '-'}`,
});

// 发票
const handleInvoiceCreated = makeHandler({
  eventCode: 'tender:invoice:created',
  category: 'finance',
  buildTitle: () => '📄 新发票待审核',
  buildContent: p => {
    const inv = p.invoice || {};
    return `发票 ${inv.invoice_code || p.invoice_code || '-'}${inv.amount != null ? `，金额 ¥${inv.amount}` : ''}`;
  },
  buildActionUrl: () => '/tendering/invoices',
});
const handleInvoiceVerified = makeHandler({
  eventCode: 'tender:invoice:verified',
  category: 'finance',
  buildTitle: () => '✅ 发票已审核通过',
  buildContent: p => {
    const inv = p.invoice || {};
    return `发票 ${inv.invoice_code || '-'} 已审核通过`;
  },
  buildActionUrl: () => '/tendering/invoices',
});
const handleInvoiceClaimed = makeHandler({
  eventCode: 'tender:invoice:claimed',
  category: 'finance',
  buildTitle: () => '📋 发票已认领',
  buildContent: p => {
    const inv = p.invoice || {};
    return `发票 ${inv.invoice_code || '-'} 已认领`;
  },
});
const handleInvoicePaid = makeHandler({
  eventCode: 'tender:invoice:paid',
  category: 'finance',
  buildTitle: () => '💰 发票已付款',
  buildContent: p => {
    const inv = p.invoice || {};
    return `发票 ${inv.invoice_code || '-'} 已付款${inv.amount != null ? `（金额 ¥${inv.amount}）` : ''}`;
  },
  buildActionUrl: () => '/tendering/invoices',
});
const handleInvoiceArchived = makeHandler({
  eventCode: 'tender:invoice:archived',
  category: 'finance',
  buildTitle: () => '📦 发票已归档',
  buildContent: p => {
    const inv = p.invoice || {};
    return `发票 ${inv.invoice_code || '-'} 已归档`;
  },
});
const handleInvoiceCancelled = makeHandler({
  eventCode: 'tender:invoice:cancelled',
  category: 'finance',
  buildTitle: () => '🚫 发票已取消',
  buildContent: p => {
    const inv = p.invoice || {};
    return `发票 ${inv.invoice_code || '-'} 已取消`;
  },
  buildUrgency: () => 'high',
});

// 付款
const handlePaymentCreated = makeHandler({
  eventCode: 'tender:payment:created',
  category: 'finance',
  buildTitle: () => '💳 新付款单待处理',
  buildContent: p => {
    const pay = p.payment || {};
    return `付款单 ${pay.payment_code || p.payment_code || '-'} 已创建${pay.amount != null ? `，金额 ¥${pay.amount}` : ''}`;
  },
  buildActionUrl: () => '/tendering/payments',
});
const handlePaymentSubmitted = makeHandler({
  eventCode: 'tender:payment:submitted',
  category: 'finance',
  buildTitle: () => '📤 付款单已提交',
  buildContent: p => `付款单 ${p.payment?.payment_code || p.payment_code || '-'} 已提交审批`,
});
const handlePaymentPaying = makeHandler({
  eventCode: 'tender:payment:paying',
  category: 'finance',
  buildTitle: () => '⏳ 付款中',
  buildContent: p => `付款单 ${p.payment?.payment_code || p.payment_code || '-'} 正在付款`,
});
const handlePaymentPaid = makeHandler({
  eventCode: 'tender:payment:paid',
  category: 'finance',
  buildTitle: () => '✅ 付款成功',
  buildContent: p => `付款单 ${p.payment?.payment_code || p.payment_code || '-'} 已付款成功`,
});
const handlePaymentFailed = makeHandler({
  eventCode: 'tender:payment:failed',
  category: 'finance',
  buildTitle: () => '❌ 付款失败',
  buildContent: p => `付款单 ${p.payment?.payment_code || p.payment_code || '-'} 付款失败`,
  buildUrgency: () => 'high',
});
const handlePaymentCancelled = makeHandler({
  eventCode: 'tender:payment:cancelled',
  category: 'finance',
  buildTitle: () => '🚫 付款已取消',
  buildContent: p => `付款单 ${p.payment?.payment_code || p.payment_code || '-'} 已取消`,
});

// 验收提醒
const handleAcceptanceReminder = makeHandler({
  eventCode: 'acceptance:reminder',
  category: 'acceptance',
  buildTitle: p => `🔔 验收${p.reminder_type || '提醒'}`,
  buildContent: p => {
    const days = p.days_until;
    let due = '';
    if (days != null) {
      if (days < 0) due = `（已超期 ${Math.abs(days)} 天）`;
      else if (days <= 3) due = `（仅剩 ${days} 天）`;
    }
    return `${p.asset_name || p.asset_code || '-'}${due}`;
  },
  buildUrgency: p => {
    if (p.days_until == null) return 'medium';
    if (p.days_until < 0) return 'high';
    if (p.days_until <= 3) return 'high';
    return 'medium';
  },
  buildActionUrl: p => p.link_path || '/acceptance/reminders',
  customResolve: async (payload) => {
    if (payload.target_user_id) return [Number(payload.target_user_id)];
    return resolveUserIds(payload);
  },
});

// 预防性维护提醒
const handlePreventiveMaintenanceReminder = makeHandler({
  eventCode: 'maintenance_plan:reminder',
  category: 'maintenance',
  buildTitle: () => '🛠️ 预防性维护提醒',
  buildContent: p => {
    const plan = p.plan || {};
    return `计划 ${plan.plan_name || p.plan_name || '-'} 即将到期，请及时处理`;
  },
  buildUrgency: () => 'medium',
  buildActionUrl: () => '/preventive-maintenance',
});

// 用户加入企业
const handleUserJoinRequest = makeHandler({
  eventCode: 'notification:role_request',
  category: 'user',
  buildTitle: () => '👤 新用户加入企业',
  buildContent: p => `${p.message || '有新用户申请加入企业，请及时设置角色'}`,
  buildUrgency: () => 'high',
  buildActionUrl: p => p.user_id ? `/users/edit/${p.user_id}` : '/users',
  customResolve: async (payload) => {
    if (Array.isArray(payload.admins) && payload.admins.length) {
      return payload.admins.map(Number).filter(Boolean);
    }
    return resolveUserIds(payload);
  },
});

/* ===================== 初始化订阅 ===================== */

function initInAppNotification() {
  if (_initialized) {
    logger.warn('[InAppNotify] 已初始化，跳过重复注册');
    return;
  }
  if (!NOTIFICATION_ENABLED) {
    logger.info('[InAppNotify] 站内通知已通过环境变量关闭');
    return;
  }

  // 资产报废
  subscribe('scrapping:created', handleScrappingCreated);
  subscribe('scrapping:approved', handleScrappingApproved);
  subscribe('scrapping:rejected', handleScrappingRejected);
  subscribe('scrapping:completed', handleScrappingCompleted);

  // 资产调配
  subscribe('transfer:created', handleTransferCreated);
  subscribe('transfer:approved', handleTransferApproved);
  subscribe('transfer:rejected', handleTransferRejected);
  subscribe('transfer:completed', handleTransferCompleted);

  // 维修（兼容 maintenance:approved + maintenance_request:*）
  subscribe(SYSTEM_EVENTS.MAINTENANCE_APPROVED, handleMaintenanceApproved);
  subscribe('maintenance_request:created', handleMaintenanceRequestCreated);
  subscribe('maintenance_request:approved', handleMaintenanceRequestApproved);
  subscribe('maintenance_request:rejected', handleMaintenanceRequestRejected);
  subscribe('maintenance_request:completed', handleMaintenanceRequestCompleted);
  subscribe('maintenance_request:started', handleMaintenanceRequestStarted);
  subscribe('maintenance_request:cancelled', handleMaintenanceRequestCancelled);

  // 工单派发/完成
  subscribe('workorder:assigned', handleWorkOrderAssigned);
  subscribe('workorder:completed', handleWorkOrderCompleted);

  // 资产状态
  subscribe('asset_workflow:transition', handleAssetWorkflowTransition);

  // 资产领用/归还
  subscribe('asset_usage:checkout', handleAssetCheckout);
  subscribe('asset_usage:return', handleAssetReturn);

  // 盘点
  subscribe('inventory:created', handleInventoryCreated);
  subscribe('inventory:completed', handleInventoryCompleted);
  subscribe('inventory_task:created', handleInventoryTaskCreated);
  subscribe('inventory_task:completed', handleInventoryTaskCompleted);
  subscribe('inventory_task:cancelled', handleInventoryTaskCancelled);

  // 招标
  subscribe('tender:created', handleTenderCreated);
  subscribe('tender:published', handleTenderPublished);
  subscribe('tender:awarded', handleTenderAwarded);
  subscribe('tender:completed', handleTenderCompleted);
  subscribe('tender:cancelled', handleTenderCancelled);
  subscribe('bid:submitted', handleBidSubmitted);
  subscribe('bid:awarded', handleBidAwarded);
  subscribe('qualification:reviewed', handleQualificationReviewed);
  subscribe('tender:invitation-sent', handleTenderInvitationSent);

  // 发票
  subscribe('tender:invoice:created', handleInvoiceCreated);
  subscribe('tender:invoice:verified', handleInvoiceVerified);
  subscribe('tender:invoice:claimed', handleInvoiceClaimed);
  subscribe('tender:invoice:paid', handleInvoicePaid);
  subscribe('tender:invoice:archived', handleInvoiceArchived);
  subscribe('tender:invoice:cancelled', handleInvoiceCancelled);

  // 付款
  subscribe('tender:payment:created', handlePaymentCreated);
  subscribe('tender:payment:submitted', handlePaymentSubmitted);
  subscribe('tender:payment:paying', handlePaymentPaying);
  subscribe('tender:payment:paid', handlePaymentPaid);
  subscribe('tender:payment:failed', handlePaymentFailed);
  subscribe('tender:payment:cancelled', handlePaymentCancelled);

  // 验收
  subscribe('acceptance:reminder', handleAcceptanceReminder);

  // 预防性维护
  subscribe(SYSTEM_EVENTS.MAINTENANCE_PLAN_REMINDER, handlePreventiveMaintenanceReminder);

  // 用户
  subscribe('notification:role_request', handleUserJoinRequest);

  _initialized = true;
  logger.info('[InAppNotify] 站内通知订阅已注册（与飞书通知并列）');
}

module.exports = {
  initInAppNotification,
  // 暴露核心方法，便于测试
  deliver,
  resolveUserIds,
  getTenantApproverIds,
  getEngineersByTenant,
};
