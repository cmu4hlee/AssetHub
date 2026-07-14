/**
 * React 错误边界组件
 * 捕获子组件渲染错误，防止整个应用崩溃
 */

import React from 'react';
const DYNAMIC_IMPORT_RETRY_STORAGE_KEY = '__ASSETHUB_DYNAMIC_IMPORT_RETRY__';
const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk [\d]+ failed/i,
  /ChunkLoadError/i,
];

const isDynamicImportError = error => {
  const message = String(error?.message || error || '');
  return DYNAMIC_IMPORT_ERROR_PATTERNS.some(pattern => pattern.test(message));
};

const overlayStyle = {
  padding: 24,
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f5f5f5',
};

const panelStyle = {
  maxWidth: 800,
  width: '100%',
  background: '#fff',
  border: '1px solid #d9d9d9',
  borderRadius: 12,
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
  padding: 24,
};

const buttonRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 16,
};

const primaryButtonStyle = {
  appearance: 'none',
  border: '1px solid #1677ff',
  background: '#1677ff',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 16px',
  cursor: 'pointer',
  fontSize: 14,
};

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  border: '1px solid #d9d9d9',
  background: '#fff',
  color: '#1f1f1f',
};

const detailPanelStyle = {
  marginTop: 24,
  padding: 16,
  background: '#f6ffed',
  border: '1px solid #b7eb8f',
  borderRadius: 8,
  textAlign: 'left',
};

const preStyle = {
  margin: 0,
  padding: 12,
  background: '#f0f0f0',
  borderRadius: 8,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      isRecovering: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const isRecovering = this.tryRecoverFromDynamicImportError(error);

    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
      isRecovering,
    }));

    // 记录错误日志
    console.error('ErrorBoundary caught error:', error, errorInfo);
    
    // 可以发送到错误监控服务
    if (window.Sentry) {
      window.Sentry.captureException(error, { extra: errorInfo });
    }

    // 自定义错误处理回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  tryRecoverFromDynamicImportError = error => {
    if (!isDynamicImportError(error) || typeof window === 'undefined') {
      return false;
    }

    try {
      const retryKey = `${DYNAMIC_IMPORT_RETRY_STORAGE_KEY}:${window.location.pathname}`;
      if (window.sessionStorage.getItem(retryKey) === '1') {
        return false;
      }

      window.sessionStorage.setItem(retryKey, '1');
      const retryUrl = new URL(window.location.href);
      retryUrl.searchParams.set('_module_retry', String(Date.now()));
      window.location.replace(retryUrl.toString());
      return true;
    } catch (storageError) {
      console.warn('模块加载自动恢复失败，降级为手动处理:', storageError);
      return false;
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    const { hasError, error, errorInfo, errorCount, isRecovering } = this.state;
    const {
      fallback,
      showDetails = import.meta.env.DEV,
      maxErrors = 3,
      children,
    } = this.props;

    if (hasError) {
      if (isRecovering) {
        return (
          <div style={overlayStyle}>
            <div style={{ ...panelStyle, maxWidth: 560 }}>
              <h2 style={{ marginTop: 0, marginBottom: 8 }}>模块加载异常，正在自动恢复</h2>
              <p style={{ margin: 0, color: '#595959', lineHeight: 1.6 }}>
                检测到动态模块加载失败，系统正在尝试自动刷新页面。
              </p>
            </div>
          </div>
        );
      }

      // 如果错误次数超过阈值，显示更严重的错误提示
      const isCritical = errorCount >= maxErrors;

      if (fallback) {
        return fallback(error, errorInfo, this.handleReset);
      }

      return (
        <div style={overlayStyle}>
          <div style={panelStyle}>
            <div style={{ marginBottom: 12, color: isCritical ? '#cf1322' : '#d48806' }}>
              {isCritical ? '严重错误' : '页面错误'}
            </div>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>
              {isCritical ? '页面发生严重错误' : '页面出现错误'}
            </h2>
            <p style={{ margin: 0, color: '#595959', lineHeight: 1.6 }}>
              抱歉，页面加载过程中出现了问题。
            </p>

            <div style={buttonRowStyle}>
              <button type="button" style={primaryButtonStyle} onClick={this.handleReset}>
                重试
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={this.handleReload}>
                刷新页面
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={this.handleGoHome}>
                返回首页
              </button>
            </div>

            {showDetails && error && (
              <div style={detailPanelStyle}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>错误详情（仅开发人员可见）</div>
                <pre style={{ ...preStyle, maxHeight: 200 }}>{error.toString()}</pre>
                {errorInfo && (
                  <pre style={{ ...preStyle, maxHeight: 320, marginTop: 12, fontSize: 12 }}>
                    {errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {isCritical && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: '#fff2f0',
                  border: '1px solid #ffccc7',
                  borderRadius: 8,
                  color: '#a8071a',
                  lineHeight: 1.6,
                }}
              >
                页面错误次数已超过阈值，建议刷新页面或联系技术支持。
              </div>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

// 高阶组件包装器
// eslint-disable-next-line react-refresh/only-export-components
export const withErrorBoundary = (Component, options = {}) => {
  return function WithErrorBoundaryWrapper(props) {
    return (
      <ErrorBoundary {...options}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
};

// 页面级错误边界
export const PageErrorBoundary = ({ children }) => (
  <ErrorBoundary 
    showDetails={true}
    onError={(error, errorInfo) => {
      console.error('Page Error:', error, errorInfo);
    }}
  >
    {children}
  </ErrorBoundary>
);

// 组件级错误边界（小型）
export const ComponentErrorBoundary = ({ children, fallback }) => (
  <ErrorBoundary 
    showDetails={false}
    fallback={fallback}
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;
