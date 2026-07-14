// 日志配置文件
const fs = require('fs');
const path = require('path');

const LOGGER_INFO_LOG_ENABLED = process.env.LOGGER_INFO_LOG_ENABLED === 'true';
const LOG_DIR = process.env.LOG_DIR || './logs';
const ENABLE_FILE_LOG = process.env.ENABLE_FILE_LOG === 'true';
const MAX_LOG_FILES = parseInt(process.env.MAX_LOG_FILES) || 10;

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// 生产环境默认info级别，开发环境默认debug级别
const getDefaultLogLevel = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL] : LOG_LEVELS.info;
  }
  return process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL] : LOG_LEVELS.debug;
};

const CURRENT_LEVEL = getDefaultLogLevel();

const LOG_FILE_PATTERN = {
  error: 'error.log',
  warn: 'warn.log',
  info: 'info.log',
  combined: 'combined.log',
};

class Logger {
  constructor() {
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (ENABLE_FILE_LOG && !fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  formatMessage(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      level,
      message,
      service: 'AssetHub-Backend',
      ...metadata,
    };
  }

  formatStack(stack) {
    if (!stack) return '';
    return stack.split('\n').map(line => line.trim()).join(' | ');
  }

  shouldLog(level) {
    return LOG_LEVELS[level] <= CURRENT_LEVEL;
  }

  writeToFile(level, formattedMessage) {
    if (!ENABLE_FILE_LOG) return;

    try {
      const fileName = LOG_FILE_PATTERN[level] || LOG_FILE_PATTERN.combined;
      const filePath = path.join(LOG_DIR, fileName);
      const line = `${JSON.stringify(formattedMessage)  }\n`;
      fs.appendFileSync(filePath, line);

      this.rotateLogIfNeeded(fileName);
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }

  rotateLogIfNeeded(fileName) {
    try {
      const filePath = path.join(LOG_DIR, fileName);
      const stats = fs.statSync(filePath);
      const maxSize = parseInt(process.env.MAX_LOG_FILE_SIZE) || 10 * 1024 * 1024;

      if (stats.size >= maxSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archivePath = path.join(LOG_DIR, `${fileName}.${timestamp}`);
        fs.renameSync(filePath, archivePath);
        this.cleanOldLogs();
      }
    } catch (error) {
      console.error('Log rotation failed:', error);
    }
  }

  cleanOldLogs() {
    try {
      const files = fs.readdirSync(LOG_DIR)
        .filter(f => f.endsWith('.log') && f !== 'combined.log')
        .map(f => ({
          name: f,
          time: fs.statSync(path.join(LOG_DIR, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      const maxFiles = MAX_LOG_FILES;
      if (files.length > maxFiles) {
        files.slice(maxFiles).forEach(f => {
          fs.unlinkSync(path.join(LOG_DIR, f.name));
        });
      }
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  log(level, message, metadata = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, metadata);
    const isProduction = process.env.NODE_ENV === 'production';
    const {timestamp} = formattedMessage;

    switch (level) {
      case 'error':
        console.error(isProduction ? `[${timestamp}] ${message}` : `❌ [${timestamp}] ${message}`, metadata);
        break;
      case 'warn':
        console.warn(isProduction ? `[${timestamp}] ${message}` : `⚠️ [${timestamp}] ${message}`, metadata);
        break;
      case 'info':
        if (LOGGER_INFO_LOG_ENABLED) {
          console.log(isProduction ? `[${timestamp}] ${message}` : `📋 [${timestamp}] ${message}`, metadata);
        }
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(`🔍 [${timestamp}] ${message}`, metadata);
        }
        break;
    }

    this.writeToFile(level, formattedMessage);

    if (level === 'error' && metadata.stack) {
      this.writeToFile('error', {
        ...formattedMessage,
        stack: this.formatStack(metadata.stack),
      });
    }
  }

  info(message, metadata = {}) {
    this.log('info', message, metadata);
  }

  warn(message, metadata = {}) {
    this.log('warn', message, metadata);
  }

  error(message, metadata = {}) {
    this.log('error', message, metadata);
  }

  debug(message, metadata = {}) {
    this.log('debug', message, metadata);
  }

  request(req, responseTime) {
    this.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: responseTime,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  audit(userId, action, resource, details = {}) {
    this.info('Audit Log', {
      userId,
      action,
      resource,
      ...details,
      type: 'audit',
    });
  }
}

module.exports = new Logger();
