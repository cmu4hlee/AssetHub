/**
 * 统一的加载状态组件
 * 支持多种加载展示方式：Spinner、骨架屏、进度条
 */

import React from 'react';
import { Spin, Skeleton, Progress, Result, Button } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

/**
 * 加载 Spinner 组件
 */
export const LoadingSpinner = ({
  tip = '加载中...',
  size = 'default',
  fullScreen = false,
  indicator = <LoadingOutlined spin />,
}) => {
  const spinStyle = fullScreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        zIndex: 9999,
      }
    : {};

  return (
    <div style={spinStyle}>
      <Spin indicator={indicator} size={size} description={tip} />
    </div>
  );
};

/**
 * 骨架屏组件
 */
export const LoadingSkeleton = ({
  active = true,
  avatar = false,
  title = true,
  paragraph = true,
  rows = 3,
  width,
  height,
}) => {
  return (
    <Skeleton
      active={active}
      avatar={avatar}
      title={title}
      paragraph={paragraph ? { rows } : false}
      width={width}
      height={height}
    />
  );
};

/**
 * 区块骨架屏（用于内容区域）
 */
export const ContentSkeleton = ({ count = 1, type = 'card', rows = 5 }) => {
  const items = Array.from({ length: count }, (_, i) => i);

  if (type === 'list') {
    return (
      <div style={{ padding: '16px' }}>
        {items.map((i) => (
          <Skeleton key={i} active avatar paragraph={{ rows: 1 }} style={{ marginBottom: '16px' }} />
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <Skeleton
        active
        paragraph={{ rows }}
        title={{ width: '60%' }}
        style={{ padding: '16px' }}
      />
    );
  }

  // Default: card
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '16px' }}>
      {items.map((i) => (
        <Skeleton key={i} active avatar title={{ width: '80%' }} paragraph={{ rows: 2 }} style={{ width: '200px' }} />
      ))}
    </div>
  );
};

/**
 * 进度条加载组件
 */
export const LoadingProgress = ({ percent = 0, status = 'active', format }) => {
  return <Progress percent={percent} status={status} format={format || ((p) => `${p}%`)} />;
};

/**
 * 页面级加载状态
 */
export const PageLoading = ({ tip = '页面加载中...' }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        gap: '16px',
      }}
    >
      <Spin size="large" indicator={<LoadingOutlined spin />} />
      <span style={{ color: '#999', fontSize: '14px' }}>{tip}</span>
    </div>
  );
};

/**
 * 错误重试组件
 */
export const ErrorRetry = ({
  message = '加载失败',
  description = '请稍后重试',
  onRetry,
  error,
}) => {
  return (
    <Result
      status="error"
      title={message}
      subTitle={description}
      extra={
        onRetry && (
          <Button type="primary" onClick={onRetry}>
            重试
          </Button>
        )
      }
    >
      {error && process.env.NODE_ENV === 'development' && (
        <pre
          style={{
            maxWidth: '500px',
            padding: '12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '12px',
          }}
        >
          {typeof error === 'string' ? error : error?.message || JSON.stringify(error)}
        </pre>
      )}
    </Result>
  );
};

/**
 * 空状态组件
 */
export const EmptyState = ({
  image,
  title = '暂无数据',
  description,
  action,
  actionText,
}) => {
  return (
    <Result
      image={image || Result.PRESENTED_IMAGE_SIMPLE}
      title={title}
      subTitle={description}
      extra={
        action ? (
          action
        ) : actionText ? (
          <Button type="primary" onClick={action}>
            {actionText}
          </Button>
        ) : null
      }
    />
  );
};

/**
 * 统一的数据加载状态管理
 * 根据 loading、error、data 状态自动渲染对应 UI
 */
export const DataLoader = ({
  loading,
  error,
  data,
  children,
  spinnerTip = '加载中...',
  errorMessage = '加载失败',
  errorDescription = '请稍后重试',
  onRetry,
  emptyMessage = '暂无数据',
  showEmptyForNull = false,
  renderContent,
  skeletonCount,
}) => {
  if (loading) {
    if (skeletonCount !== undefined) {
      return <ContentSkeleton count={skeletonCount} />;
    }
    return <LoadingSpinner tip={spinnerTip} />;
  }

  if (error) {
    return (
      <ErrorRetry
        message={errorMessage}
        description={errorDescription}
        error={error}
        onRetry={onRetry}
      />
    );
  }

  if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) {
    if (showEmptyForNull) {
      return children || <EmptyState title={emptyMessage} />;
    }
    return <EmptyState title={emptyMessage} />;
  }

  if (renderContent) {
    return renderContent(data);
  }

  return children || null;
};

export default {
  LoadingSpinner,
  LoadingSkeleton,
  ContentSkeleton,
  LoadingProgress,
  PageLoading,
  ErrorRetry,
  EmptyState,
  DataLoader,
};
