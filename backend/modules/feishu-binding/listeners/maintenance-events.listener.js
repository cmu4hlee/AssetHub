/**
 * 飞书绑定模块 - 维修事件监听器
 *
 * 监听 core/EventBus 上的维修事件，通过 bindingService.sendMessage
 * 给相关人员（申请人 / 审批人 / 维修工）发送飞书交互式卡片通知。
 *
 * 设计原则：
 *  - fail-soft：监听器内部所有异常都被捕获并 log，绝不向上抛
 *  - 单一职责：监听器只做"通知"，不做业务逻辑、不修改 DB
 *  - 解耦：通过 EventBus 与维修模块通信，不直接 require 维修模块
 *
 * 注册方式：
 *  - 由 feishu-binding/routes/index.js 在路由加载时调用 register()
 *  - 也可由外部用 module.config.js 的 eventHandlers 字段挂载（导出 handleCreated/handleApproved/handleCompleted）
 */

const eventBus = require('../../../core/EventBus').getEventBus();
const bindingService = require('../services/binding.service');
const db = require('../../../config/database');
const logger = require('../../../config/logger');

// 事件展示标签
const EVENT_LABELS = {
  'maintenance.request.created': '新维修申请',
  'maintenance.request.approved': '维修申请已审批',
  'maintenance.request.completed': '维修已完成',
};

// 卡片 header 颜色（飞书支持 blue/green/red/orange/purple/grey/turquoise 等）
const EVENT_TEMPLATES = {
  'maintenance.request.created': 'blue',
  'maintenance.request.approved': 'green',
  'maintenance.request.completed': 'turquoise',
};

let _registered = false;

/**
 * 通过姓名查 user_id（兼容 real_name 和 username）
 * @param {string} name
 * @returns {Promise<number|null>}
 */
async function resolveUserIdByName(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  try {
    const [rows] = await db.execute(
      'SELECT id FROM users WHERE real_name = ? OR username = ? LIMIT 1',
      [trimmed, trimmed],
    );
    return rows?.[0]?.id ? Number(rows[0].id) : null;
  } catch (err) {
    logger.warn('resolveUserIdByName failed', { name: trimmed, error: err.message });
    return null;
  }
}

/**
 * 构建飞书交互式卡片
 * @param {string} eventName
 * @param {Object} request - maintenance_requests 整行
 * @param {Object} [extras] - 额外信息（如 approved:true/false, repair_person_name）
 */
function buildMaintenanceCard(eventName, request, extras = {}) {
  const label = EVENT_LABELS[eventName] || '维修通知';
  const template = EVENT_TEMPLATES[eventName] || 'blue';

  const lines = [
    `**工单号**：${request.request_no || 'N/A'}`,
    `**资产名称**：${request.asset_name || 'N/A'}`,
    `**资产编号**：${request.asset_code || 'N/A'}`,
    `**故障等级**：${request.fault_level || '一般'}`,
    `**申请人**：${request.request_person || 'N/A'}`,
    `**申请部门**：${request.request_department || 'N/A'}`,
    `**当前状态**：${request.status || 'N/A'}`,
  ];

  if (eventName === 'maintenance.request.approved') {
    lines.push(`**审批结果**：${extras.approved === false ? '已拒绝' : '已批准'}`);
    if (request.approver) lines.push(`**审批人**：${request.approver}`);
    if (request.approve_comment) lines.push(`**审批意见**：${request.approve_comment}`);
  }
  if (eventName === 'maintenance.request.completed') {
    if (request.repair_person) lines.push(`**维修人**：${request.repair_person}`);
    if (request.repair_end_date) lines.push(`**完成日期**：${request.repair_end_date}`);
    if (request.repair_cost) lines.push(`**维修费用**：¥${request.repair_cost}`);
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `🔧 ${label}` },
      template,
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: lines.filter(Boolean).join('\n'),
        },
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: `申请时间：${request.created_at ? new Date(request.created_at).toLocaleString('zh-CN') : 'N/A'}`,
          },
        ],
      },
    ],
  };
}

/**
 * 维修事件通用处理器（fail-soft）
 * @param {string} eventName - maintenance.request.created / approved / completed
 * @param {Object} payload - { requestId, tenantId, actorUserId, ...extras }
 */
async function handleMaintenanceEvent(eventName, payload) {
  const safePayload = payload || {};
  const { requestId, actorUserId } = safePayload;

  if (!requestId) {
    logger.warn('maintenance event: missing requestId', { eventName });
    return;
  }

  let request;
  try {
    const [rows] = await db.execute(
      'SELECT * FROM maintenance_requests WHERE id = ? LIMIT 1',
      [requestId],
    );
    request = rows?.[0];
  } catch (err) {
    logger.error('maintenance event: fetch request failed', {
      eventName, requestId, error: err.message,
    });
    return;
  }
  if (!request) {
    logger.warn('maintenance event: request not found', { eventName, requestId });
    return;
  }

  // 目标用户集合：actor + 申请人 + 审批人 + 维修人
  const targetUserIds = new Set();

  if (actorUserId) targetUserIds.add(Number(actorUserId));

  // 申请人
  if (request.request_person) {
    const uid = await resolveUserIdByName(request.request_person);
    if (uid) targetUserIds.add(uid);
  }
  // 审批人（已存在的）
  if (request.approver && (eventName === 'maintenance.request.approved' || eventName === 'maintenance.request.completed')) {
    const uid = await resolveUserIdByName(request.approver);
    if (uid) targetUserIds.add(uid);
  }
  // 维修人
  if (request.repair_person && (eventName === 'maintenance.request.completed' || eventName === 'maintenance.request.approved')) {
    const uid = await resolveUserIdByName(request.repair_person);
    if (uid) targetUserIds.add(uid);
  }

  if (targetUserIds.size === 0) {
    logger.info('maintenance event: no resolvable users to notify', { eventName, requestId });
    return;
  }

  // 构造卡片
  const content = buildMaintenanceCard(eventName, request, { approved: safePayload.approved });

  // 逐个发送（每个用户的失败不影响其他用户）
  for (const userId of targetUserIds) {
    try {
      const result = await bindingService.sendMessage(
        { id: userId },
        {
          toUserId: userId,
          messageType: 'interactive',
          content,
        },
      );
      logger.info('feishu maintenance notify sent', {
        eventName,
        requestId,
        requestNo: request.request_no,
        userId,
        messageId: result?.messageId,
      });
    } catch (err) {
      // 用户未绑定飞书是正常情况，仅 info 级日志
      if (err.code === 'FEISHU_USER_NOT_BOUND') {
        logger.info('feishu maintenance notify skipped (user not bound)', {
          eventName, requestId, userId,
        });
      } else {
        logger.warn('feishu maintenance notify failed', {
          eventName, requestId, userId, code: err.code, error: err.message,
        });
      }
    }
  }
}

// 导出三个具体 handler，方便 module.config.js 的 eventHandlers 字段直接引用
async function handleCreated(payload) {
  return handleMaintenanceEvent('maintenance.request.created', payload);
}
async function handleApproved(payload) {
  return handleMaintenanceEvent('maintenance.request.approved', payload);
}
async function handleCompleted(payload) {
  return handleMaintenanceEvent('maintenance.request.completed', payload);
}

/**
 * 注册到全局 EventBus（幂等）
 *  - 由 feishu-binding/routes/index.js 在启动时调用
 *  - 也可手动调用
 */
function register() {
  if (_registered) {
    logger.debug('maintenance-events listener already registered, skip');
    return;
  }
  _registered = true;

  eventBus.on('maintenance.request.created', (payload) => {
    // 同步触发异步任务；EventBus 已 try/catch 保护，我们内部也 catch
    Promise.resolve()
      .then(() => handleCreated(payload))
      .catch((err) => {
        logger.error('maintenance.request.created handler crashed', {
          error: err.message, stack: err.stack,
        });
      });
  });

  eventBus.on('maintenance.request.approved', (payload) => {
    Promise.resolve()
      .then(() => handleApproved(payload))
      .catch((err) => {
        logger.error('maintenance.request.approved handler crashed', {
          error: err.message, stack: err.stack,
        });
      });
  });

  eventBus.on('maintenance.request.completed', (payload) => {
    Promise.resolve()
      .then(() => handleCompleted(payload))
      .catch((err) => {
        logger.error('maintenance.request.completed handler crashed', {
          error: err.message, stack: err.stack,
        });
      });
  });

  logger.info('maintenance-events listener registered', {
    events: [
      'maintenance.request.created',
      'maintenance.request.approved',
      'maintenance.request.completed',
    ],
  });
}

module.exports = {
  register,
  handleCreated,
  handleApproved,
  handleCompleted,
  // 暴露给测试
  handleMaintenanceEvent,
  buildMaintenanceCard,
  resolveUserIdByName,
};
