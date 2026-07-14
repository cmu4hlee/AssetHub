import React from 'react';
import { Table, Pagination } from 'antd';
import MobileCardList from '../MobileCardList';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import './ResponsiveTable.css';

/**
 * 响应式表格：桌面端用 AntD Table，移动端用 MobileCardList
 *
 * 用法：
 * <ResponsiveTable
 *   dataSource={data}
 *   columns={columns}            // 桌面列
 *   rowKey="id"
 *   loading={loading}
 *   mobileTitleKey="title"       // 移动卡片标题
 *   mobileStatusRender={r => <StatusTag .../>}  // 移动卡片右上
 *   mobileFields={[              // 移动卡片字段
 *     { label: '编号', key: 'code' },
 *     { label: '金额', key: 'amount', render: v => formatMoney(v) },
 *   ]}
 *   mobileActions={[             // 移动卡片操作
 *     { key: 'view', text: '详情', icon: <EyeOutlined/>, onClick: r => navigate(...) },
 *   ]}
 *   pagination={...}
 * />
 */
const ResponsiveTable = ({
  dataSource = [],
  columns = [],
  rowKey = 'id',
  loading = false,
  scroll,
  pagination,
  size = 'middle',
  emptyText = '暂无数据',
  rowSelection, // 新增：支持批量选择
  expandable,   // 新增：支持展开行

  // 移动端配置
  mobileTitleKey,
  mobileTitleRender,
  mobileStatusRender,
  mobileFields,
  mobileActions,
  mobileSkeletonCount = 4,
}) => {
  return (
    <>
      {/* 桌面端表格 */}
      <div className="hide-on-mobile responsive-table-desktop">
        <Table
          rowKey={rowKey}
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          scroll={scroll}
          size={size}
          pagination={pagination}
          rowSelection={rowSelection}
          expandable={expandable}
        />
      </div>

      {/* 移动端卡片列表 */}
      <div className="show-on-mobile responsive-table-mobile">
        <MobileCardList
          data={dataSource}
          loading={loading}
          emptyText={emptyText}
          titleKey={mobileTitleKey}
          titleRender={mobileTitleRender}
          statusRender={mobileStatusRender}
          fields={mobileFields}
          actions={mobileActions}
          skeletonCount={mobileSkeletonCount}
        />
        {pagination && dataSource.length > 0 ? (
          <div className="responsive-table-mobile-pagination">
            <Pagination
              simple
              current={pagination.current}
              total={pagination.total}
              pageSize={pagination.pageSize}
              onChange={pagination.onChange}
              showTotal={pagination.showTotal}
            />
          </div>
        ) : null}
      </div>
    </>
  );
};

export default ResponsiveTable;
