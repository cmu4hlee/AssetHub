/**
 * 移动端卡片列表组件
 * 用于在移动端显示数据，替代表格
 *
 * 支持两种用法：
 * 1. 声明式（推荐）：传入 fields + actions，自动渲染结构化卡片
 * 2. 自定义渲染：传入 renderCard 函数，完全控制卡片内容
 */

import React from 'react';
import { Button, Empty, Skeleton, Popconfirm } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

const resolveBool = (value, item) => {
  if (typeof value === 'function') return !!value(item);
  return !!value;
};

const MobileCardList = ({
  data,
  loading,
  renderCard,
  emptyText = '暂无数据',
  // 声明式字段配置：[{ label, key, render?, span? }]
  fields,
  // 标题字段 key 或渲染函数
  titleKey,
  titleRender,
  // 状态标签：{ key, render } 或 render(item)
  statusRender,
  // 操作按钮：
  //   支持 row-level 显隐 / 禁用：
  //   - hidden: boolean | (item) => boolean
  //   - disabled: boolean | (item) => boolean
  //   - confirm: 字符串，点击时弹 Popconfirm
  actions,
  // 骨架屏数量
  skeletonCount = 4,
  // 是否使用 Popconfirm 二次确认
  popconfirmProps,
}) => {
  // 加载态：骨架屏
  if (loading) {
    return (
      <div className="mobile-table-cards show-on-mobile" aria-busy="true">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <div key={`skeleton-${i}`} className="mobile-card-item">
            <Skeleton
              active
              title={{ width: '65%' }}
              paragraph={{ rows: 3, width: ['90%', '70%', '50%'] }}
            />
          </div>
        ))}
      </div>
    );
  }

  // 空状态
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="mobile-table-cards show-on-mobile">
        <Empty
          image={<InboxOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
          description={<span style={{ color: '#8c8c8c' }}>{emptyText}</span>}
        />
      </div>
    );
  }

  // 自定义渲染模式
  if (renderCard) {
    return (
      <div className="mobile-table-cards show-on-mobile">
        {data.map((item, index) => {
          const uniqueKey = item.id
            ? `mobile-card-${item.id}`
            : `mobile-card-index-${index}`;
          return (
            <div key={uniqueKey} className="mobile-card-item">
              {renderCard(item, index)}
            </div>
          );
        })}
      </div>
    );
  }

  // 声明式渲染模式
  return (
    <div className="mobile-table-cards show-on-mobile">
      {data.map((item, index) => {
        const uniqueKey = item.id
          ? `mobile-card-${item.id}`
          : `mobile-card-index-${index}`;

        const title =
          typeof titleRender === 'function'
            ? titleRender(item)
            : item[titleKey] || '-';

        const statusNode =
          typeof statusRender === 'function'
            ? statusRender(item)
            : null;

        return (
          <div key={uniqueKey} className="mobile-card-item">
            {/* 卡片头部：标题 + 状态标签 */}
            {(title || statusNode) && (
              <div className="mobile-card-header">
                <span className="mobile-card-title">{title}</span>
                {statusNode && (
                  <span className="mobile-card-badge">{statusNode}</span>
                )}
              </div>
            )}

            {/* 卡片字段区：双列网格 */}
            {Array.isArray(fields) && fields.length > 0 && (
              <div className="mobile-card-body">
                {fields.map((field, fIdx) => {
                  const value =
                    typeof field.render === 'function'
                      ? field.render(item)
                      : item[field.key];
                  // 跳过空值字段（除非 forceShow）
                  if (
                    value === null ||
                    value === undefined ||
                    value === '' ||
                    value === false
                  ) {
                    if (!field.forceShow) return null;
                  }
                  return (
                    <div
                      key={field.key || fIdx}
                      className={`mobile-card-field ${
                        field.span === 2 ? 'mobile-card-field--full' : ''
                      }`}
                    >
                      <span className="mobile-card-label">{field.label}</span>
                      <span className="mobile-card-value">
                        {value === null || value === undefined || value === ''
                          ? '-'
                          : value}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 卡片操作区 */}
            {(() => {
              const resolvedActions =
                typeof actions === 'function' ? actions(item) : actions;
              if (!Array.isArray(resolvedActions)) return null;
              const visible = resolvedActions.filter(
                a => !resolveBool(a.hidden, item),
              );
              if (visible.length === 0) return null;
              return (
                <div className="mobile-card-actions">
                  {visible.map((action, aIdx) => {
                    const isDisabled = resolveBool(action.disabled, item);
                    const btn = (
                      <Button
                        key={action.key || aIdx}
                        type={action.type || 'default'}
                        danger={action.danger}
                        size="small"
                        icon={action.icon}
                        block={action.block !== false}
                        disabled={isDisabled}
                        onClick={() => !isDisabled && action.onClick && action.onClick(item)}
                      >
                        {action.text}
                      </Button>
                    );
                    if (action.confirm && !isDisabled) {
                      return (
                        <Popconfirm
                          key={action.key || aIdx}
                          title={action.confirm}
                          okText="确定"
                          cancelText="取消"
                          onConfirm={() => action.onClick && action.onClick(item)}
                        >
                          <span style={{ display: 'block' }}>{btn}</span>
                        </Popconfirm>
                      );
                    }
                    return btn;
                  })}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
};

export default MobileCardList;
