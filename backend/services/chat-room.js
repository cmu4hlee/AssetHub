const { redis } = require('./redis');

// 聊天室相关Redis键名常量
const CHAT_ROOM_PREFIX = 'chat:room';
const CHAT_MESSAGE_PREFIX = 'chat:messages';
const CHAT_USER_PREFIX = 'chat:user';
const CHAT_ONLINE_PREFIX = 'chat:online';
const CHAT_CHANNEL_PREFIX = 'chat:channel';

/**
 * 聊天室服务类
 */
class ChatRoomService {
  /**
   * 检查Redis连接状态
   * @returns {boolean} - Redis是否可用
   */
  isRedisAvailable() {
    return !!redis && redis.status === 'ready';
  }

  /**
   * 创建聊天室
   * @param {string} roomName - 聊天室名称
   * @param {string} creatorId - 创建者ID
   * @param {string} creatorName - 创建者名称
   * @returns {Promise<string>} - 房间ID
   */
  async createRoom(roomName, creatorId, creatorName) {
    if (!this.isRedisAvailable()) {
      // 优雅降级：当Redis不可用时，返回一个临时房间ID，不进行持久化
      const roomId = `room:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      console.warn('⚠️ Redis服务不可用，创建了临时聊天室:', roomId);
      return roomId;
    }

    const roomId = `room:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const roomKey = `${CHAT_ROOM_PREFIX}:${roomId}`;
    const roomListKey = `${CHAT_ROOM_PREFIX}:list`;

    // 创建房间信息
    await redis.hset(roomKey, {
      id: roomId,
      name: roomName,
      creatorId,
      creatorName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userCount: 0,
    });

    // 添加到房间列表
    await redis.sadd(roomListKey, roomId);

    return roomId;
  }

  /**
   * 获取房间列表
   * @returns {Promise<Array>} - 房间列表
   */
  async getRoomList() {
    if (!this.isRedisAvailable()) {
      return [];
    }

    const roomListKey = `${CHAT_ROOM_PREFIX}:list`;
    const roomIds = await redis.smembers(roomListKey);

    const rooms = [];
    for (const roomId of roomIds) {
      const roomKey = `${CHAT_ROOM_PREFIX}:${roomId}`;
      const roomInfo = await redis.hgetall(roomKey);
      if (roomInfo) {
        rooms.push(roomInfo);
      }
    }

    return rooms;
  }

  /**
   * 获取房间详情
   * @param {string} roomId - 房间ID
   * @returns {Promise<Object|null>} - 房间详情
   */
  async getRoomDetails(roomId) {
    if (!this.isRedisAvailable()) {
      return null;
    }

    const roomKey = `${CHAT_ROOM_PREFIX}:${roomId}`;
    return await redis.hgetall(roomKey);
  }

  /**
   * 加入聊天室
   * @param {string} roomId - 房间ID
   * @param {string} userId - 用户ID
   * @param {string} userName - 用户名
   * @returns {Promise<boolean>} - 是否加入成功
   */
  async joinRoom(roomId, userId, userName) {
    if (!this.isRedisAvailable()) {
      // 优雅降级：当Redis不可用时，直接返回加入成功，不进行持久化
      return true;
    }

    const roomKey = `${CHAT_ROOM_PREFIX}:${roomId}`;
    const roomUserKey = `${CHAT_ROOM_PREFIX}:${roomId}:users`;
    const userKey = `${CHAT_USER_PREFIX}:${userId}`;
    const onlineKey = `${CHAT_ONLINE_PREFIX}`;

    // 检查房间是否存在
    const roomExists = await redis.exists(roomKey);
    if (!roomExists) {
      return false;
    }

    // 加入房间
    await redis.sadd(roomUserKey, userId);
    await redis.hset(userKey, {
      id: userId,
      name: userName,
      roomId,
      joinedAt: new Date().toISOString(),
    });
    await redis.sadd(onlineKey, userId);

    // 更新房间用户数量
    const userCount = await redis.scard(roomUserKey);
    await redis.hset(roomKey, 'userCount', userCount);
    await redis.hset(roomKey, 'updatedAt', new Date().toISOString());

    return true;
  }

  /**
   * 离开聊天室
   * @param {string} roomId - 房间ID
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} - 是否离开成功
   */
  async leaveRoom(roomId, userId) {
    if (!this.isRedisAvailable()) {
      return false;
    }

    const roomKey = `${CHAT_ROOM_PREFIX}:${roomId}`;
    const roomUserKey = `${CHAT_ROOM_PREFIX}:${roomId}:users`;
    const userKey = `${CHAT_USER_PREFIX}:${userId}`;
    const onlineKey = `${CHAT_ONLINE_PREFIX}`;

    // 离开房间
    await redis.srem(roomUserKey, userId);
    await redis.hdel(userKey, 'roomId', 'joinedAt');

    // 更新房间用户数量
    const userCount = await redis.scard(roomUserKey);
    await redis.hset(roomKey, 'userCount', userCount);
    await redis.hset(roomKey, 'updatedAt', new Date().toISOString());

    return true;
  }

  /**
   * 获取房间内用户列表
   * @param {string} roomId - 房间ID
   * @returns {Promise<Array>} - 用户列表
   */
  async getRoomUsers(roomId) {
    if (!this.isRedisAvailable()) {
      return [];
    }

    const roomUserKey = `${CHAT_ROOM_PREFIX}:${roomId}:users`;
    const userIds = await redis.smembers(roomUserKey);

    const users = [];
    for (const userId of userIds) {
      const userKey = `${CHAT_USER_PREFIX}:${userId}`;
      const userInfo = await redis.hgetall(userKey);
      if (userInfo) {
        users.push(userInfo);
      }
    }

    return users;
  }

  /**
   * 发送消息
   * @param {string} roomId - 房间ID
   * @param {string} userId - 发送者ID
   * @param {string} userName - 发送者名称
   * @param {string} content - 消息内容
   * @returns {Promise<Object>} - 消息对象
   */
  async sendMessage(roomId, userId, userName, content) {
    if (!this.isRedisAvailable()) {
      throw new Error('Redis服务不可用');
    }

    const messageId = `msg:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const messageKey = `${CHAT_MESSAGE_PREFIX}:${roomId}`;

    const message = {
      id: messageId,
      roomId,
      userId,
      userName,
      content,
      timestamp: new Date().toISOString(),
    };

    const messageStr = JSON.stringify(message);

    // 存储消息到Redis列表（保留最近1000条）
    await redis.lpush(messageKey, messageStr);
    await redis.ltrim(messageKey, 0, 999);

    return message;
  }

  /**
   * 获取历史消息
   * @param {string} roomId - 房间ID
   * @param {number} limit - 消息数量限制
   * @param {number} offset - 消息偏移量
   * @returns {Promise<Array>} - 消息列表
   */
  async getHistoryMessages(roomId, limit = 50, offset = 0) {
    if (!this.isRedisAvailable()) {
      return [];
    }

    const messageKey = `${CHAT_MESSAGE_PREFIX}:${roomId}`;

    // 获取消息列表
    const messages = await redis.lrange(messageKey, offset, offset + limit - 1);

    // 解析消息并反转顺序（最新消息在后）
    return messages.map(msg => JSON.parse(msg)).reverse();
  }

  /**
   * 获取在线用户列表
   * @returns {Promise<Array>} - 在线用户列表
   */
  async getOnlineUsers() {
    if (!this.isRedisAvailable()) {
      return [];
    }

    const onlineKey = `${CHAT_ONLINE_PREFIX}`;
    const userIds = await redis.smembers(onlineKey);

    const users = [];
    for (const userId of userIds) {
      const userKey = `${CHAT_USER_PREFIX}:${userId}`;
      const userInfo = await redis.hgetall(userKey);
      if (userInfo) {
        users.push(userInfo);
      }
    }

    return users;
  }

  /**
   * 用户下线
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} - 是否下线成功
   */
  async userOffline(userId) {
    if (!this.isRedisAvailable()) {
      return false;
    }

    // 获取用户当前所在房间
    const userKey = `${CHAT_USER_PREFIX}:${userId}`;
    const userInfo = await redis.hgetall(userKey);

    if (userInfo && userInfo.roomId) {
      // 从房间中移除用户
      await this.leaveRoom(userInfo.roomId, userId);
    }

    // 从在线列表中移除
    const onlineKey = `${CHAT_ONLINE_PREFIX}`;
    await redis.srem(onlineKey, userId);

    // 清除用户信息
    await redis.del(userKey);

    return true;
  }

  /**
   * 订阅房间消息
   * @param {string} roomId - 房间ID
   * @param {Function} callback - 消息回调函数
   * @returns {Promise<Function>} - 取消订阅函数
   */
  async subscribeRoom(roomId, callback) {
    if (!this.isRedisAvailable()) {
      throw new Error('Redis服务不可用');
    }

    const channelKey = `${CHAT_CHANNEL_PREFIX}:${roomId}`;
    const subscriber = redis.duplicate();

    await subscriber.connect();
    await subscriber.subscribe(channelKey, message => {
      try {
        const parsedMessage = JSON.parse(message);
        callback(parsedMessage);
      } catch (error) {
        console.error('解析消息失败:', error.message);
      }
    });

    return async () => {
      await subscriber.unsubscribe(channelKey);
      await subscriber.quit();
    };
  }

  /**
   * 获取房间数量
   * @returns {Promise<number>} - 房间数量
   */
  async getRoomCount() {
    if (!this.isRedisAvailable()) {
      return 0;
    }

    const roomListKey = `${CHAT_ROOM_PREFIX}:list`;
    return await redis.scard(roomListKey);
  }

  /**
   * 获取在线用户数量
   * @returns {Promise<number>} - 在线用户数量
   */
  async getOnlineUserCount() {
    if (!this.isRedisAvailable()) {
      return 0;
    }

    const onlineKey = `${CHAT_ONLINE_PREFIX}`;
    return await redis.scard(onlineKey);
  }
}

// 导出聊天室服务实例
const chatRoomService = new ChatRoomService();

module.exports = {
  ChatRoomService,
  chatRoomService,
};
