import React from 'react';
import { Tag, Tooltip } from 'antd';

/**
 * 统一的状态标签组件
 *
 * @param {string} status - 状态 key
 * @param {object} statusMap - 状态映射表，如 REQUEST_STATUS
 * @param {string} fallback - 找不到时显示的文本
 * @param {string} size - 'default' | 'small'
 * @param {boolean} bordered - 是否带边框 (true → outlined, false → filled) — antd 6
 * @param {string} extra - 额外展示文本（如 "已审批 · 张三"）
 *
 * @example
 * <StatusTag status="applying" statusMap={REQUEST_STATUS} />
 * <StatusTag status="draft" statusMap={TENDER_STATUS} size="small" />
 */
const StatusTag = ({
  status,
  statusMap,
  fallback = status || '-',
  size = 'default',
  bordered = false,
  extra,
}) => {
  const info = statusMap?.[status];
  // antd 6: bordered={true} → variant="outlined" (default)
  //         bordered={false} → variant="filled"
  const variant = bordered ? 'outlined' : 'filled';
  // 防御性 patch: 如果 status/extra/fallback 不知何故变成 object, 转 string 避免 React 崩
  const safeStatus = typeof status === 'string' ? status : '';
  const safeFallback = typeof fallback === 'string' ? fallback : '-';
  const safeExtra = typeof extra === 'string' || typeof extra === 'number' ? extra : null;
  if (!info) {
    return <Tag variant={variant}>{safeFallback}</Tag>;
  }
  const node = (
    <Tag
      color={info.color}
      variant={variant}
      style={
        size === 'small'
          ? { fontSize: 12, padding: '0 6px', lineHeight: '18px', margin: 0 }
          : undefined
      }
    >
      {info.text}
      {safeExtra ? <span style={{ marginLeft: 4, opacity: 0.85 }}>· {safeExtra}</span> : null}
    </Tag>
  );
  if (info.description) {
    return <Tooltip title={info.description}>{node}</Tooltip>;
  }
  return node;
};

export default StatusTag;
