import React from 'react';
import { Tag, Space, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import './PageHeader.css';

/**
 * 统一风格的页面头部
 *
 * @param {string} title - 页面标题
 * @param {string|number} count - 列表数量徽标
 * @param {string} countLabel - 徽标颜色（继承 Tag color）
 * @param {ReactNode} extra - 右上角操作区
 * @param {string} description - 标题下方的描述文字
 * @param {function} onBack - 返回按钮（提供时显示）
 * @param {ReactNode} breadcrumb - 自定义面包屑
 *
 * @example
 * <PageHeader
 *   title="采购申请"
 *   count={128}
 *   extra={<Button type="primary">新建</Button>}
 *   onBack={() => navigate(-1)}
 * />
 */
const PageHeader = ({
  title,
  count,
  countLabel = 'count',
  extra,
  description,
  onBack,
  breadcrumb,
  statusTag, // 已批准/草稿 等状态标签直接放标题旁
}) => {
  return (
    <div className="page-header">
      <div className="page-header-main">
        <div className="page-header-left">
          <div className="page-header-title-row">
            {onBack ? (
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={onBack}
                className="page-header-back"
              />
            ) : null}
            <h2 className="page-header-title">{title}</h2>
            {count != null ? (
              <Tag
                color={countLabel === 'count' ? 'blue' : countLabel}
                className="page-header-count"
              >
                {count}
              </Tag>
            ) : null}
            {statusTag ? <span className="page-header-status">{statusTag}</span> : null}
          </div>
          {description ? <p className="page-header-desc">{description}</p> : null}
          {breadcrumb ? <div className="page-header-breadcrumb">{breadcrumb}</div> : null}
        </div>
        {extra ? <div className="page-header-right">{extra}</div> : null}
      </div>
    </div>
  );
};

export default PageHeader;
