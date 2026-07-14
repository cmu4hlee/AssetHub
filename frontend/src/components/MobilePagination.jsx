/**
 * 移动端分页组件
 * 提供大触摸目标的上一页/下一页导航，替代桌面端分页器
 *
 * @param {Object} pagination - 分页状态 { current, pageSize, total }
 * @param {Function} onChange - 页码变化回调 (newPage) => void
 */

import React from 'react';
import { Button } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';

const MobilePagination = ({ pagination = {}, onChange }) => {
  const { current = 1, pageSize = 20, total = 0 } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handlePrev = () => {
    if (current > 1 && onChange) {
      onChange(current - 1);
    }
  };

  const handleNext = () => {
    if (current < totalPages && onChange) {
      onChange(current + 1);
    }
  };

  return (
    <div className="mobile-pagination">
      <Button
        icon={<LeftOutlined />}
        disabled={current <= 1}
        onClick={handlePrev}
        className="mobile-pagination-btn"
        aria-label="上一页"
      >
        上一页
      </Button>
      <span className="mobile-pagination-info">
        <span className="mobile-pagination-current">{current}</span>
        <span className="mobile-pagination-sep">/</span>
        <span className="mobile-pagination-total-pages">{totalPages}</span>
      </span>
      <Button
        disabled={current >= totalPages}
        onClick={handleNext}
        className="mobile-pagination-btn"
        aria-label="下一页"
      >
        下一页
        <RightOutlined />
      </Button>
      <div className="mobile-pagination-count">共 {total} 条</div>
    </div>
  );
};

export default MobilePagination;
