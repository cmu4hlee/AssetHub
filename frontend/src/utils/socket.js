/**
 * Socket.IO 客户端工具
 * 用于接收后端实时推送（维修审批通知等）
 */

import { io } from 'socket.io-client';
import auth from './auth';

let socket = null;
let reconnectTimer = null;
const eventHandlers = new Map();

/**
 * 获取后端 WebSocket 地址
 * 开发环境：与 Vite 代理配置一致，连接当前 origin
 */
function getSocketUrl() {
  const { origin } = window.location;
  // 开发环境通过 Vite proxy 代理 /socket.io/ 到后端
  // 生产环境通过 nginx 代理
  return origin;
}

/**
 * 连接 Socket.IO 服务器
 */
function connect() {
  if (socket && socket.connected) {
    return socket;
  }

  const user = auth.getUser();
  if (!user) {
    console.warn('[Socket] 用户未登录，跳过连接');
    return null;
  }

  const url = getSocketUrl();
  socket = io(url, {
    path: '/socket.io/',
    // 使用 polling 优先：Vite 6 http-proxy 转发 /socket.io WebSocket upgrade 时
    // 偶发 ECONNRESET，会导致浏览器报 "WebSocket is closed before the connection
    // is established"。polling 走 HTTP 代理链路稳定，避免 ws 握手失败污染 console。
    // 待生产环境用 nginx 代理后，可改回 ['polling', 'websocket'] 享受 ws 低延迟。
    transports: ['polling'],
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionAttempts: 10,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('[Socket] 已连接:', socket.id);

    // 注册用户身份
    socket.emit('register', {
      userId: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenant_id || user.tenantId,
    });
  });

  socket.on('disconnect', reason => {
    console.log('[Socket] 已断开:', reason);
  });

  socket.on('connect_error', error => {
    console.warn('[Socket] 连接错误:', error.message);
  });

  // 重新注册所有事件处理器
  for (const [event, handlers] of eventHandlers.entries()) {
    handlers.forEach(handler => {
      socket.on(event, handler);
    });
  }

  return socket;
}

/**
 * 断开连接
 */
function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.close();
    socket = null;
  }
}

/**
 * 监听服务器推送事件
 * @param {string} event - 事件名称
 * @param {Function} handler - 处理函数
 * @returns {Function} 取消监听函数
 */
function on(event, handler) {
  if (!eventHandlers.has(event)) {
    eventHandlers.set(event, new Set());
  }
  eventHandlers.get(event).add(handler);

  if (socket) {
    socket.on(event, handler);
  }

  // 返回取消监听函数
  return () => {
    eventHandlers.get(event)?.delete(handler);
    if (socket) {
      socket.off(event, handler);
    }
  };
}

/**
 * 获取连接状态
 */
function isConnected() {
  return socket?.connected || false;
}

/**
 * 确保已连接（延迟自动连接）
 */
function ensureConnected() {
  if (!socket || !socket.connected) {
    connect();
  }
}

export default {
  connect,
  disconnect,
  on,
  isConnected,
  ensureConnected,
};
