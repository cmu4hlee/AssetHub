const Redis = require('ioredis');
const { database: databaseConfig } = require('../config/app.config');

// 配置Redis连接（无 Redis 时快速失败，避免反复重试刷屏）
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.REDIS_DB) || 0,
  connectTimeout: 5000,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 1) return null;
    return Math.min(times * 50, 500);
  },
  lazyConnect: true,
};

// 创建Redis客户端
const redis = new Redis(redisConfig);

// 连接Redis
redis.connect().catch(err => {
  console.error('⚠️ 异步任务队列Redis连接失败:', err.message);
  console.error('⚠️ 异步任务队列将降级为内存模式');
});

// 内存模式下的任务队列
const memoryQueue = {
  tasks: [],
  processing: false,

  async add(task) {
    this.tasks.push(task);
    await this.process();
  },

  async process() {
    if (this.processing || this.tasks.length === 0) {
      return;
    }

    this.processing = true;

    while (this.tasks.length > 0) {
      const task = this.tasks.shift();
      try {
        await task.handler(task.data);
        if (task.callback) {
          await task.callback(null, { taskId: task.taskId, success: true });
        }
      } catch (error) {
        console.error(`❌ 内存队列任务执行失败 - ${task.taskId}:`, error.message);
        if (task.callback) {
          await task.callback(error, { taskId: task.taskId, success: false });
        }
      }
    }

    this.processing = false;
  },
};

// 异步任务队列类
class AsyncQueue {
  constructor(queueName = 'default') {
    this.queueName = queueName;
    this.taskHandlers = new Map();
    this.useMemoryMode = false;
    this.running = false;

    // 检查Redis连接状态
    redis.on('error', () => {
      this.useMemoryMode = true;
    });
  }

  /**
   * 注册任务处理函数
   * @param {string} taskType - 任务类型
   * @param {Function} handler - 任务处理函数
   */
  registerHandler(taskType, handler) {
    this.taskHandlers.set(taskType, handler);
  }

  /**
   * 添加任务到队列
   * @param {string} taskType - 任务类型
   * @param {Object} data - 任务数据
   * @param {Object} options - 任务选项
   * @returns {Promise<string>} - 任务ID
   */
  async addTask(taskType, data, options = {}) {
    const taskId = `task:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

    const task = {
      taskId,
      taskType,
      data,
      createdAt: new Date().toISOString(),
      options,
    };

    try {
      if (this.useMemoryMode || !redis.status || redis.status !== 'ready') {
        // Redis不可用，使用内存模式
        await memoryQueue.add({
          ...task,
          handler: async () => {
            const handler = this.taskHandlers.get(taskType);
            if (handler) {
              await handler(task.data, task.taskId);
            }
          },
        });
      } else {
        // 使用Redis队列
        await redis.lpush(this.queueName, JSON.stringify(task));
      }

      console.log(`📝 任务已添加到队列 - ${taskId} (${taskType})`);
      return taskId;
    } catch (error) {
      console.error('❌ 添加任务到队列失败:', error.message);
      throw error;
    }
  }

  /**
   * 启动任务处理器
   * @param {number} concurrency - 并发处理数
   */
  async start(concurrency = 3) {
    if (this.useMemoryMode) {
      console.warn('⚠️ 异步任务队列使用内存模式，不支持并发处理');
      return;
    }
    const status = redis && redis.status;
    if (status !== 'ready') {
      this.useMemoryMode = true;
      console.warn(`⚠️ Redis 未就绪 (status: ${  status || 'null'  })，异步任务队列使用内存模式`);
      return;
    }

    this.running = true;
    for (let i = 0; i < concurrency; i++) {
      this._processQueue(i);
    }

    console.log(`✅ 异步任务队列已启动，并发数: ${concurrency}`);
  }

  /**
   * 处理队列任务
   * @param {number} workerId - 工作进程ID
   */
  async _processQueue(workerId) {
    while (this.running) {
      try {
        if (this.useMemoryMode || !redis || redis.status !== 'ready') {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        // 从队列中获取任务（阻塞模式，超时10秒）
        const taskJson = await redis.brpop(this.queueName, 10);

        if (!taskJson) {
          continue;
        }

        const task = JSON.parse(taskJson[1]);
        console.log(`👷 工作进程 ${workerId} 开始处理任务 - ${task.taskId} (${task.taskType})`);

        const handler = this.taskHandlers.get(task.taskType);
        if (!handler) {
          console.error(`❌ 任务处理器未注册 - ${task.taskType}`);
          continue;
        }

        await handler(task.data, task.taskId);
        console.log(`✅ 工作进程 ${workerId} 完成任务 - ${task.taskId}`);
      } catch (error) {
        const isConnectionError = !error.message || /connection|closed|ECONNREFUSED/i.test(error.message);
        if (isConnectionError) {
          this.useMemoryMode = true;
          console.warn(`⚠️ 工作进程 ${workerId} Redis 连接不可用，已切换为内存模式并停止该 worker`);
          return;
        }
        console.error(`❌ 工作进程 ${workerId} 处理任务失败:`, error.message);
      }
    }
  }

  /**
   * 获取队列长度
   * @returns {Promise<number>} - 队列长度
   */
  async getQueueLength() {
    if (this.useMemoryMode) {
      return memoryQueue.tasks.length;
    }

    try {
      return await redis.llen(this.queueName);
    } catch (error) {
      console.error('❌ 获取队列长度失败:', error.message);
      return 0;
    }
  }

  /**
   * 关闭队列
   */
  async close() {
    this.running = false;
    try {
      if (redis && redis.status === 'ready') {
        await redis.quit();
      }
      console.log('✅ 异步任务队列已关闭');
    } catch (error) {
      console.error('❌ 关闭队列失败:', error.message);
    }
  }
}

// 创建默认队列实例
const defaultQueue = new AsyncQueue();

// 导出
module.exports = {
  AsyncQueue,
  defaultQueue,
  memoryQueue,
};
