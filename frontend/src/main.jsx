import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { message } from 'antd';
import 'antd/dist/reset.css';
import './index.css';
import App from './App.jsx';
import ErrorBoundary, { PageErrorBoundary } from './components/ErrorBoundary';
import crypto from './utils/crypto';

if (import.meta.env.DEV) {
  const suppressedPatterns = [
    'The final argument passed to useEffect changed size between renders',
    '[antd: compatible]',
    '[getThemeColors]',
    'Unable to load preload script',
    'ENOENT: no such file or directory, open \'/Applications/TRAE',
  ];
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const shouldSuppress = (args) => {
    const first = args[0];
    let text = '';
    if (typeof first === 'string') {
      text = first;
    } else if (first instanceof Error) {
      text = first.message;
    } else if (first && typeof first === 'object') {
      try {
        text = JSON.stringify(first);
      } catch (_e) {
        text = String(first);
      }
    }
    if (!text) return false;
    return suppressedPatterns.some((pattern) => text.includes(pattern));
  };
  console.warn = (...args) => {
    if (shouldSuppress(args)) return;
    originalWarn(...args);
  };
  console.error = (...args) => {
    if (shouldSuppress(args)) return;
    originalError(...args);
  };
}

message.config({
  getContainer: () => document.body,
  top: 24,
  duration: 3,
  maxCount: 5,
});

const initWithTimeout = () => {
  const TIMEOUT_MS = 5000;
  return Promise.race([
    crypto.initCache(),
    new Promise((resolve) => {
      setTimeout(() => {
        console.warn('[启动] 缓存初始化超时，继续渲染');
        resolve();
      }, TIMEOUT_MS);
    }),
  ]);
};

initWithTimeout().then(() => {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary
        showDetails={true}
        onError={(error, errorInfo) => {
          console.error('Global Error:', error, errorInfo);
        }}
      >
        <PageErrorBoundary>
          <App />
        </PageErrorBoundary>
      </ErrorBoundary>
    </React.StrictMode>
  );
}).catch((err) => {
  console.error('[启动] 初始化失败:', err);
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary
        showDetails={true}
        onError={(error, errorInfo) => {
          console.error('Global Error:', error, errorInfo);
        }}
      >
        <PageErrorBoundary>
          <App />
        </PageErrorBoundary>
      </ErrorBoundary>
    </React.StrictMode>
  );
});
