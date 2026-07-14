/**
 * 飞书绑定模块 - 服务层
 * 处理飞书平台绑定的业务逻辑：OAuth 授权、用户绑定、消息发送
 */
const db = require('../../../config/database');
const logger = require('../../../config/logger');
const feishuClient = require('./feishu-client');

/**
 * 确保绑定表存在
 */
async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS feishu_bindings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NULL COMMENT '租户ID',
      user_id INT NOT NULL COMMENT '本系统用户ID',
      feishu_user_id VARCHAR(64) NULL COMMENT '飞书 user_id',
      open_id VARCHAR(64) NOT NULL COMMENT '飞书 open_id',
      union_id VARCHAR(64) NULL COMMENT '飞书 union_id',
      name VARCHAR(128) NULL COMMENT '飞书用户姓名',
      avatar_url VARCHAR(512) NULL COMMENT '飞书用户头像',
      email VARCHAR(128) NULL COMMENT '飞书用户邮箱',
      mobile VARCHAR(32) NULL COMMENT '飞书用户手机号',
      employee_no VARCHAR(64) NULL COMMENT '飞书员工工号',
      access_token VARCHAR(256) NULL COMMENT 'user_access_token（加密存储建议在生产环境补充）',
      refresh_token VARCHAR(256) NULL COMMENT 'user_refresh_token',
      token_expires_at DATETIME NULL COMMENT 'user_access_token 过期时间',
      bound_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_tenant (user_id, tenant_id),
      UNIQUE KEY uk_open_id (open_id),
      INDEX idx_tenant_user (tenant_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='飞书用户绑定表'
  `);
}

/**
 * 从 user 对象解析租户ID（兼容 null/undefined）
 */
function resolveTenantId(user) {
  return user?.tenant_id ?? null;
}

class BindingService {
  /**
   * 获取当前用户的飞书绑定状态
   */
  async getBindingStatus(user) {
    await ensureTable();
    const [rows] = await db.execute(
      'SELECT open_id, feishu_user_id, name, avatar_url, bound_at FROM feishu_bindings WHERE user_id = ? LIMIT 1',
      [user?.id],
    );
    const row = rows?.[0];
    logger.info('获取飞书绑定状态', { userId: user?.id, bound: !!row });
    return {
      bound: !!row,
      boundAt: row?.bound_at || null,
      feishuUserId: row?.feishu_user_id || null,
      openId: row?.open_id || null,
      name: row?.name || null,
      avatarUrl: row?.avatar_url || null,
    };
  }

  /**
   * 获取飞书 OAuth 授权 URL
   */
  async getAuthUrl(user) {
    const redirectUri = process.env.FEISHU_REDIRECT_URI || '';
    const { authUrl, state } = feishuClient.buildAuthUrl({ redirectUri });
    logger.info('生成飞书授权URL', { userId: user?.id, state });
    return { authUrl, state };
  }

  /**
   * 处理飞书 OAuth 回调
   * 用 code 换取 user_access_token 并获取用户信息，但不直接绑定（绑定由 /bind 接口完成）
   * 返回给前端，前端可选择绑定到当前账号
   */
  async handleCallback(code, user) {
    logger.info('处理飞书回调', { userId: user?.id });

    const tokenResult = await feishuClient.getUserAccessToken(code);
    const userInfo = await feishuClient.getUserInfoByUserToken(tokenResult.accessToken);

    return {
      success: true,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      expiresIn: tokenResult.expiresIn,
      openId: tokenResult.openId,
      unionId: tokenResult.unionId,
      feishuUserId: tokenResult.userId,
      userInfo,
    };
  }

  /**
   * 绑定飞书用户到本系统用户
   * 支持两种模式：
   *   1) 传入 openId + accessToken（刚完成 OAuth 回调）
   *   2) 传入 feishuUserId + employeeNo（管理员手动绑定，无需 OAuth）
   */
  async bindUser(user, bindingData) {
    await ensureTable();
    const tenantId = resolveTenantId(user);
    const { openId, accessToken, refreshToken, expiresIn, feishuUserId, employeeNo, name, avatarUrl, email, mobile, unionId } = bindingData || {};

    if (!openId && !feishuUserId) {
      const err = new Error('绑定飞书需要提供 openId 或 feishuUserId');
      err.code = 'FEISHU_PARAM_MISSING';
      throw err;
    }

    // 如果只传了 feishuUserId 而没 openId，尝试通过飞书通讯录 API 获取 openId
    let resolvedOpenId = openId;
    let resolvedUnionId = unionId;
    let resolvedName = name;
    let resolvedAvatar = avatarUrl;
    let resolvedEmail = email;
    let resolvedMobile = mobile;
    let resolvedEmployeeNo = employeeNo;
    let resolvedAccessToken = accessToken;
    let resolvedRefreshToken = refreshToken;
    let tokenExpiresAt = null;

    if (!resolvedOpenId && feishuUserId) {
      const remote = await feishuClient.getUserByUserId('user_id', feishuUserId);
      resolvedOpenId = remote.openId;
      resolvedUnionId = remote.unionId;
      resolvedName = remote.name;
      resolvedAvatar = remote.avatarUrl;
      resolvedEmail = remote.email;
      resolvedMobile = remote.mobile;
      resolvedEmployeeNo = remote.employeeNo || employeeNo;
    }

    if (expiresIn) {
      tokenExpiresAt = new Date(Date.now() + Number(expiresIn) * 1000);
    }

    // 检查是否已被其他用户绑定
    const [existOpen] = await db.execute(
      'SELECT user_id FROM feishu_bindings WHERE open_id = ? AND user_id <> ? LIMIT 1',
      [resolvedOpenId, user?.id],
    );
    if (existOpen?.length) {
      const err = new Error('该飞书账号已被其他用户绑定');
      err.code = 'FEISHU_ALREADY_BOUND';
      throw err;
    }

    // upsert
    await db.execute(
      `INSERT INTO feishu_bindings
        (tenant_id, user_id, feishu_user_id, open_id, union_id, name, avatar_url, email, mobile, employee_no, access_token, refresh_token, token_expires_at, bound_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
        tenant_id = VALUES(tenant_id),
        feishu_user_id = VALUES(feishu_user_id),
        open_id = VALUES(open_id),
        union_id = VALUES(union_id),
        name = VALUES(name),
        avatar_url = VALUES(avatar_url),
        email = VALUES(email),
        mobile = VALUES(mobile),
        employee_no = VALUES(employee_no),
        access_token = VALUES(access_token),
        refresh_token = VALUES(refresh_token),
        token_expires_at = VALUES(token_expires_at),
        updated_at = NOW()`,
      [
        tenantId,
        user?.id,
        feishuUserId || null,
        resolvedOpenId,
        resolvedUnionId || null,
        resolvedName || null,
        resolvedAvatar || null,
        resolvedEmail || null,
        resolvedMobile || null,
        resolvedEmployeeNo || null,
        resolvedAccessToken || null,
        resolvedRefreshToken || null,
        tokenExpiresAt,
      ],
    );

    logger.info('飞书用户绑定成功', { userId: user?.id, openId: resolvedOpenId });

    return {
      success: true,
      boundAt: new Date().toISOString(),
      openId: resolvedOpenId,
      name: resolvedName,
    };
  }

  /**
   * 解绑当前用户的飞书账号
   */
  async unbindUser(user) {
    await ensureTable();
    const [result] = await db.execute(
      'DELETE FROM feishu_bindings WHERE user_id = ?',
      [user?.id],
    );
    logger.info('飞书解绑', { userId: user?.id, affected: result?.affectedRows });
    return {
      success: true,
      removed: result?.affectedRows || 0,
    };
  }

  /**
   * 获取当前用户绑定的飞书用户信息
   * 默认从本地表读取，refresh=true 时调用飞书 API 刷新
   */
  async getUserInfo(user, options = {}) {
    await ensureTable();
    const [rows] = await db.execute(
      `SELECT feishu_user_id, open_id, union_id, name, avatar_url, email, mobile, employee_no, bound_at
       FROM feishu_bindings WHERE user_id = ? LIMIT 1`,
      [user?.id],
    );
    const row = rows?.[0];
    if (!row) {
      return {
        feishuUserId: null,
        name: null,
        avatar: null,
        bound: false,
      };
    }

    let extra = {};
    if (options.refresh && row.open_id) {
      try {
        const remote = await feishuClient.getUserByUserId('open_id', row.open_id);
        extra = remote;
      } catch (e) {
        logger.warn('刷新飞书用户信息失败，返回本地缓存', { error: e.message });
      }
    }

    return {
      bound: true,
      feishuUserId: row.feishu_user_id,
      openId: row.open_id,
      unionId: row.union_id,
      name: row.name,
      avatar: row.avatar_url,
      email: row.email,
      mobile: row.mobile,
      employeeNo: row.employee_no,
      boundAt: row.bound_at,
      ...extra,
    };
  }

  /**
   * 发送飞书消息
   * @param {Object} user - 发送者（需已绑定飞书）
   * @param {Object} messageData
   * @param {string} [messageData.toUserId] - 接收者的本系统 user_id（查 feishu_bindings 得到 open_id）
   * @param {string} [messageData.openId] - 直接指定 open_id
   * @param {string} [messageData.receiveIdType] - open_id(默认) / user_id / union_id / email / chat_id
   * @param {string} [messageData.messageType] - text(默认) / post / interactive / image...
   * @param {string|Object} [messageData.content] - 消息内容
   */
  async sendMessage(user, messageData) {
    await ensureTable();
    const {
      toUserId,
      openId,
      receiveIdType = 'open_id',
      messageType = 'text',
      content,
    } = messageData || {};

    let receiveId = openId;

    // 通过 toUserId 查 open_id
    if (!receiveId && toUserId) {
      const [rows] = await db.execute(
        'SELECT open_id FROM feishu_bindings WHERE user_id = ? LIMIT 1',
        [toUserId],
      );
      if (!rows?.[0]?.open_id) {
        const err = new Error('目标用户未绑定飞书，无法发送消息');
        err.code = 'FEISHU_USER_NOT_BOUND';
        throw err;
      }
      receiveId = rows[0].open_id;
    }

    if (!receiveId) {
      const err = new Error('缺少接收者：请提供 toUserId 或 openId');
      err.code = 'FEISHU_PARAM_MISSING';
      throw err;
    }

    logger.info('发送飞书消息', { fromUserId: user?.id, receiveIdType, messageType });

    const result = await feishuClient.sendMessage({
      receiveIdType,
      receiveId,
      msgType: messageType,
      content,
    });

    return {
      success: true,
      messageId: result.messageId,
      receiverId: result.receiverId,
    };
  }

  /**
   * 获取飞书绑定列表（管理端）
   */
  async getBindingList(pagination, filters = {}) {
    await ensureTable();
    const { page = 1, pageSize = 20 } = pagination || {};
    const tenantId = filters.tenantId ?? null;
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];
    if (tenantId) {
      where.push('tenant_id = ?');
      params.push(tenantId);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM feishu_bindings ${whereClause}`,
      params,
    );
    const { total } = countRows[0];

    const [rows] = await db.execute(
      `SELECT id, tenant_id, user_id, feishu_user_id, open_id, name, avatar_url, email, mobile, employee_no, bound_at, updated_at
       FROM feishu_bindings ${whereClause}
       ORDER BY bound_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    return {
      items: rows.map(r => ({
        id: r.id,
        tenantId: r.tenant_id,
        userId: r.user_id,
        feishuUserId: r.feishu_user_id,
        openId: r.open_id,
        name: r.name,
        avatarUrl: r.avatar_url,
        email: r.email,
        mobile: r.mobile,
        employeeNo: r.employee_no,
        boundAt: r.bound_at,
        updatedAt: r.updated_at,
      })),
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    };
  }

  /**
   * 获取指定租户的飞书应用凭证（用于事件 webhook 处理）
   * 注意：app_secret 字段当前可能为明文存储，如已加密需在此处解密
   *
   * @param {number} tenantId 租户ID
   * @returns {Promise<{appId, appSecret, host, botOpenId}|null>}
   */
  async getDecryptedAppCredentials(tenantId) {
    try {
      const [rows] = await db.execute(
        `SELECT config FROM tenant_configs
         WHERE tenant_id = ? AND config_key = 'feishu' AND enabled = 1
         LIMIT 1`,
        [tenantId],
      );
      if (rows.length === 0) return null;

      const cfg = typeof rows[0].config === 'string'
        ? JSON.parse(rows[0].config)
        : rows[0].config;

      return {
        appId: cfg.app_id || cfg.appId,
        appSecret: cfg.app_secret || cfg.appSecret,
        host: cfg.host, // 自建飞书服务器场景（可选）
        botOpenId: cfg.bot_open_id || cfg.botOpenId,
      };
    } catch (err) {
      logger.error('[BindingService] 获取飞书应用凭证失败', { tenantId, error: err.message });
      return null;
    }
  }
}

module.exports = new BindingService();
