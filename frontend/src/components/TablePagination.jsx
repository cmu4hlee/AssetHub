import React from 'react';
import { Pagination } from 'antd';
import { PAGINATION } from '../constants';

/**
 * 统一的分页组件
 * 封装 antd Pagination，提供默认配置和事件处理
 *
 * @param {Object} props
 * @param {Object} props.pagination - 分页状态 { current, pageSize, total }
 * @param {Function} props.onChange - 页码或pageSize变化时的回调
 * @param {boolean} props.showSizeChanger - 是否显示 pageSize 切换器
 * @param {boolean} props.showTotal - 是否显示总计
 * @param {Object} props.pageSizeOptions - pageSize 选项
 */
const TablePagination = ({
  pagination = {},
  onChange,
  showSizeChanger = true,
  showTotal = true,
  pageSizeOptions = PAGINATION.PAGE_SIZE_OPTIONS,
  ...restProps
}) => {
  const { current = 1, pageSize = 10, total = 0 } = pagination;

  const handleChange = (newPage, newPageSize) => {
    if (onChange) {
      onChange(newPage, newPageSize);
    }
  };

  const renderTotal = (total, range) => {
    if (!showTotal) return null;
    return `共 ${total} 条`;
  };

  return (
    <Pagination
      current={current}
      pageSize={pageSize}
      total={total}
      onChange={handleChange}
      showSizeChanger={showSizeChanger}
      showQuickJumper
      pageSizeOptions={pageSizeOptions}
      showTotal={renderTotal}
      {...restProps}
    />
  );
};

export default TablePagination;
