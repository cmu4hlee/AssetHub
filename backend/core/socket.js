/**
 * Socket.IO 实时推送服务
 * 用于维修审批等业务事件的实时通知推送
 */

const socketIO = require('socket.io');
const logger = require('../config/logger');

let io = null;

/**
 * 初始化 Socket.IO 服务
 * @param {http.Server} server - HTTP 服务器实例
 * @param {Object} corsConfig - CORS 配置
 */
function initSocket(server, corsConfig) {
  if (io) {
    logger.warn('[Socket.IO] 已初始化，跳过重复创建');
    return io;
  }

  io = socketIO(server, {
    cors: {
      origin: corsConfig?.origin || true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
  });

  // 存储用户ID -> socketId 映射
  const userSocketMap = new Map();
  // 存储角色 -> Set<socketId> 映射
  const roleSocketMap = new Map();

  io.on('connection', socket => {
    logger.info(`[Socket.IO] 客户端已连接: ${socket.id}`);

    // 客户端注册身份（userId + role）
    socket.on('register', ({ userId, username, role, tenantId }) => {
      try {
        if (userId) {
          userSocketMap.set(String(userId), socket.id);
          socket.data.userId = String(userId);
          socket.data.username = username;
          socket.data.role = role;
          socket.data.tenantId = tenantId;
          logger.debug(`[Socket.IO] 用户注册: ${username}(ID:${userId}, 角色:${role})`);

          // 加入用户房间（用于 pushToUser 定向推送）
          socket.join(`user:${userId}`);

          // 加入角色房间
          if (role) {
            const roomName = `role:${role}`;
            socket.join(roomName);
            if (!roleSocketMap.has(role)) {
              roleSocketMap.set(role, new Set());
            }
            roleSocketMap.get(role).add(socket.id);
          }
          // 加入租户房间
          if (tenantId) {
            socket.join(`tenant:${tenantId}`);
          }
        }
      } catch (err) {
        logger.error(`[Socket.IO] register 处理失败 (${socket.id}):`, err.message);
      }
    });

    socket.on('disconnect', reason => {
      try {
        const userId = socket.data.userId;
        const role = socket.data.role;
        if (userId) userSocketMap.delete(userId);
        if (role && roleSocketMap.has(role)) {
          roleSocketMap.get(role).delete(socket.id);
          if (roleSocketMap.get(role).size === 0) {
            roleSocketMap.delete(role);
          }
        }
        // reason: 'transport close' / 'client disconnect' / 'ping timeout' / 'server shutting down'
        logger.info(`[Socket.IO] 客户端已断开: ${socket.id} reason=${reason}`);
      } catch (err) {
        logger.error(`[Socket.IO] disconnect 清理失败 (${socket.id}):`, err.message);
      }
    });

    // 兜底: socket 自身错误（如底层 transport 错误）
    socket.on('error', err => {
      logger.error(`[Socket.IO] socket 错误 (${socket.id}):`, err.message);
    });

    // 心跳
    socket.on('ping', () => {
      try {
        socket.emit('pong');
      } catch (e) {
        // 静默, 心跳失败常见
      }
    });
  });

  // 服务级兜底错误
  io.engine.on('connection_error', err => {
    logger.warn('[Socket.IO] engine connection_error:', err.message);
  });

  logger.info('[Socket.IO] 服务已启动，路径: /socket.io/');
  return io;
}

/**
 * 获取 Socket.IO 实例
 * @returns {socketIO.Server|null}
 */
function getIO() {
  return io;
}

/**
 * 向指定用户推送消息
 * @param {string} userId - 用户ID
 * @param {string} event - 事件名称
 * @param {Object} data - 消息数据
 */
function pushToUser(userId, event, data) {
  if (!io) {
    logger.warn('[Socket.IO] 未初始化，无法推送消息');
    return false;
  }
  io.to(`user:${userId}`).emit(event, data);
  logger.debug(`[Socket.IO] 推送消息给用户 ${userId}: ${event}`);
  return true;
}

/**
 * 向指定角色的所有用户推送消息
 * @param {string|string[]} roles - 角色或角色数组
 * @param {string} event - 事件名称
 * @param {Object} data - 消息数据
 */
function pushToRole(roles, event, data) {
  if (!io) {
    logger.warn('[Socket.IO] 未初始化，无法推送消息');
    return false;
  }
  const roleList = Array.isArray(roles) ? roles : [roles];
  for (const role of roleList) {
    io.to(`role:${role}`).emit(event, data);
  }
  logger.debug(`[Socket.IO] 推送消息给角色 [${roleList.join(', ')}]: ${event}`);
  return true;
}

/**
 * 向所有已连接客户端广播消息
 * @param {string} event - 事件名称
 * @param {Object} data - 消息数据
 */
function broadcast(event, data) {
  if (!io) {
    logger.warn('[Socket.IO] 未初始化，无法广播');
    return false;
  }
  io.emit(event, data);
  logger.debug(`[Socket.IO] 广播消息: ${event}`);
  return true;
}

/**
 * 向指定租户的所有用户推送消息
 * @param {string} tenantId - 租户ID
 * @param {string} event - 事件名称
 * @param {Object} data - 消息数据
 */
function pushToTenant(tenantId, event, data) {
  if (!io) {
    logger.warn('[Socket.IO] 未初始化，无法推送消息');
    return false;
  }
  io.to(`tenant:${tenantId}`).emit(event, data);
  logger.debug(`[Socket.IO] 推送消息给租户 ${tenantId}: ${event}`);
  return true;
}

/**
 * 获取在线连接数
 * @returns {number}
 */
function getConnectionCount() {
  return io ? io.engine.clientsCount : 0;
}

/**
 * 向指定用户列表推送消息
 * @param {string[]} userIds - 用户ID数组
 * @param {string} event - 事件名称
 * @param {Object} data - 消息数据
 */
function pushToUsers(userIds, event, data) {
  if (!io) {
    logger.warn('[Socket.IO] 未初始化，无法推送消息');
    return false;
  }
  const list = Array.isArray(userIds) ? userIds : [userIds];
  for (const userId of list) {
    io.to(`user:${userId}`).emit(event, data);
  }
  logger.debug(`[Socket.IO] 推送消息给用户 [${list.join(', ')}]: ${event}`);
  return true;
}

module.exports = {
  initSocket,
  getIO,
  pushToUser,
  pushToUsers,
  pushToRole,
  broadcast,
  pushToTenant,
  getConnectionCount,
};
