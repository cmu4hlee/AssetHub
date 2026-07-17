/**
 * 结构化日志 (基于 pino)
 *
 * 设计目标:
 * 1. 接口兼容原 Logger (info/warn/error/debug/request/audit)
 * 2. 输出 JSON 结构化日志 (level/time/traceId/userId) 便于 ELK/Loki 接入
 * 3. 生产环境自动切到 stdout JSON, 关闭文件 IO
 * 4. 开发环境保留 pretty 打印
 *
 * 调用方: `const logger = require('../config/logger')`
 *   - logger.info(msg, meta)
 *   - logger.audit(userId, action, resource, details)
 *   - logger.request(req, responseTime)
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || './logs';
const ENABLE_FILE_LOG = process.env.ENABLE_FILE_LOG === 'true';
const MAX_LOG_FILES = parseInt(process.env.MAX_LOG_FILES) || 10;
const IS_PROD = process.env.NODE_ENV === 'production';

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
const getDefaultLogLevel = () => {
  if (IS_PROD) return process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL] : LOG_LEVELS.info;
  return process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL] : LOG_LEVELS.debug;
};
const CURRENT_LEVEL_NAME = Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === getDefaultLogLevel());

// ===== pino lazy load (避免 jest 测试时硬性依赖) =====
let pino;
try {
  pino = require('pino');
} catch (err) {
  // pino 不可用时, fallback 到 console
  console.warn('[logger] pino 不可用, 降级到 console:', err.message);
}

// ===== 文件流 (生产用 pino-rotate 可选) =====
const fileStreams = [];
if (ENABLE_FILE_LOG && !IS_PROD) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    // 简化版: 不做 rotate, 由运维/部署负责
    ['error', 'warn', 'info'].forEach(level => {
      const stream = fs.createWriteStream(path.join(LOG_DIR, `${level}.log`), { flags: 'a' });
      fileStreams.push({ level, stream });
    });
  } catch (err) {
    console.error('[logger] 创建日志文件失败:', err.message);
  }
}

// ===== pino 实例 =====
let pinoInstance = null;
if (pino) {
  try {
    const multistream = fileStreams.length > 0
      ? pino.multistream([
          { stream: process.stdout, level: CURRENT_LEVEL_NAME },
          ...fileStreams.map(({ level, stream }) => ({ level, stream })),
        ])
      : undefined;

    pinoInstance = pino({
      level: CURRENT_LEVEL_NAME,
      base: {
        service: process.env.SERVICE_NAME || 'assethub-backend',
        env: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: label => ({ level: label }),
      },
      ...(multistream ? { stream: multistream } : {}),
    });
  } catch (err) {
    console.error('[logger] pino 初始化失败:', err.message);
  }
}

// ===== 兼容接口 (info/warn/error/debug/request/audit) =====
class Logger {
  info(message, meta = {}) { this._log('info', message, meta); }
  warn(message, meta = {}) { this._log('warn', message, meta); }
  error(message, meta = {}) { this._log('error', message, meta); }
  debug(message, meta = {}) { this._log('debug', message, meta); }
  trace(message, meta = {}) { this._log('trace', message, meta); }
  fatal(message, meta = {}) { this._log('fatal', message, meta); }

  _log(level, message, meta) {
    if (!pinoInstance) {
      // fallback: console
      const tag = `[${level.toUpperCase()}]`;
      if (level === 'error' || level === 'fatal') console.error(tag, message, meta);
      else if (level === 'warn') console.warn(tag, message, meta);
      else console.log(tag, message, meta);
      return;
    }
    // pino 接受 (obj, msg) 或 (msg, ...args), 我们统一用 (obj, msg)
    if (typeof message === 'object' && message !== null) {
      pinoInstance[level](message);
    } else {
      pinoInstance[level](meta, message);
    }
  }

  /** HTTP 请求日志 (兼容旧接口) */
  request(req, responseTime, extra = {}) {
    this.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: req.statusCode,
      duration_ms: responseTime,
      ip: req.ip || req.ipAddress,
      userAgent: req.get?.('user-agent'),
      userId: req.user?.id,
      tenantId: req.user?.tenant_id,
      traceId: req.headers?.['x-trace-id'] || req.traceId,
      ...extra,
    });
  }

  /** 审计日志 (兼容旧接口) */
  audit(userId, action, resource, details = {}) {
    this.info('Audit Log', {
      type: 'audit',
      userId,
      action,
      resource,
      ...details,
    });
  }

  /** 创建子 logger (绑定固定字段, 如 traceId) */
  child(bindings) {
    if (!pinoInstance) return this;
    const childPino = pinoInstance.child(bindings);
    return {
      info: (m, meta) => childPino.info(meta || {}, m),
      warn: (m, meta) => childPino.warn(meta || {}, m),
      error: (m, meta) => childPino.error(meta || {}, m),
      debug: (m, meta) => childPino.debug(meta || {}, m),
      trace: (m, meta) => childPino.trace(meta || {}, m),
      fatal: (m, meta) => childPino.fatal(meta || {}, m),
      child: (b) => this.child(b),
    };
  }
}

module.exports = new Logger();
