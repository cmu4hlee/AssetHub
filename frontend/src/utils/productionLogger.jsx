/**
 * 生产环境日志管理工具
 * 在生产环境中自动禁用调试日志，并支持错误上报
 */

const isProduction = import.meta.env.PROD;

class ProductionLogger {
  constructor() {
    this.enabled = !isProduction;
    this.errorReporter = null;
  }

  setErrorReporter(reporter) {
    this.errorReporter = reporter;
  }

  log(...args) {
    if (this.enabled) {
      console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
  }

  info(...args) {
    if (this.enabled) {
      console.info('[INFO]', new Date().toISOString(), ...args);
    }
  }

  warn(...args) {
    if (this.enabled) {
      console.warn('[WARN]', new Date().toISOString(), ...args);
    }
    // 警告信息也应该记录到监控系统
    if (this.errorReporter) {
      this.errorReporter.warn(...args);
    }
  }

  error(...args) {
    // 错误信息总是记录
    console.error('[ERROR]', new Date().toISOString(), ...args);
    
    // 生产环境上报到监控系统
    if (this.errorReporter) {
      this.errorReporter.error(...args);
    }
  }

  debug(...args) {
    if (this.enabled) {
      console.debug('[DEBUG]', new Date().toISOString(), ...args);
    }
  }

  group(label) {
    if (this.enabled) {
      console.group(label);
    }
  }

  groupEnd() {
    if (this.enabled) {
      console.groupEnd();
    }
  }

  table(data) {
    if (this.enabled) {
      console.table(data);
    }
  }

  time(label) {
    if (this.enabled) {
      console.time(label);
    }
  }

  timeEnd(label) {
    if (this.enabled) {
      console.timeEnd(label);
    }
  }

  trace(...args) {
    if (this.enabled) {
      console.trace('[TRACE]', ...args);
    }
  }

  assert(condition, ...args) {
    if (!condition) {
      this.error('Assertion failed:', ...args);
    }
  }

  clear() {
    if (this.enabled) {
      console.clear();
    }
  }

  dir(obj) {
    if (this.enabled) {
      console.dir(obj);
    }
  }

  dirxml(obj) {
    if (this.enabled) {
      console.dirxml(obj);
    }
  }
}

class SimpleErrorReporter {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.maxErrors = 100;
    this.maxWarnings = 50;
  }

  error(...args) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '),
      stack: new Error().stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };
    
    this.errors.push(errorEntry);
    
    // 保持错误数量在限制内
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
    
    // 可以在这里发送到服务器
    this.sendToServer(errorEntry);
  }

  warn(...args) {
    const warningEntry = {
      timestamp: new Date().toISOString(),
      level: 'warning',
      message: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '),
      url: window.location.href,
    };
    
    this.warnings.push(warningEntry);
    
    if (this.warnings.length > this.maxWarnings) {
      this.warnings.shift();
    }
    
    this.sendToServer(warningEntry);
  }

  sendToServer(entry) {
    // 生产环境发送到错误收集服务
    if (isProduction) {
      try {
        // 这里可以集成到 Sentry、Bugsnag 等服务
        // 或者发送到自己的错误收集 API
        // fetch('/api/client-errors', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(entry),
        //   keepalive: true,
        // });
      } catch (e) {
        // 避免错误上报本身导致更多错误
      }
    }
  }

  getErrors() {
    return this.errors;
  }

  getWarnings() {
    return this.warnings;
  }

  clearErrors() {
    this.errors = [];
  }

  clearWarnings() {
    this.warnings = [];
  }

  getReport() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      summary: {
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        firstError: this.errors[0]?.timestamp,
        lastError: this.errors[this.errors.length - 1]?.timestamp,
      },
    };
  }
}

// 创建全局单例
const productionLogger = new ProductionLogger();
const errorReporter = new SimpleErrorReporter();

// 设置错误上报器
productionLogger.setErrorReporter(errorReporter);

// 导出
export const logger = productionLogger;
export const reporter = errorReporter;

// 设置全局错误处理器
if (isProduction) {
  window.onerror = (message, source, lineno, colno, error) => {
    productionLogger.error('全局错误:', {
      message,
      source,
      lineno,
      colno,
      stack: error?.stack,
    });
  };

  window.onunhandledrejection = (event) => {
    productionLogger.error('未处理的Promise拒绝:', {
      reason: event.reason,
    });
  };
}

// Vue/React 组件错误边界（React示例）
export const withErrorBoundary = (Component, fallback) => {
  return class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
      productionLogger.error('组件渲染错误:', error);
      return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
      productionLogger.error('组件错误:', error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        return fallback || <div>组件加载失败</div>;
      }
      return <Component {...this.props} />;
    }
  };
};

export default productionLogger;
