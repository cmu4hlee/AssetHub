import React, { useMemo, useRef, useCallback, memo } from 'react';
import { Table } from 'antd';

const VirtualizedTable = memo(({
  dataSource = [],
  columns = [],
  rowKey = 'id',
  pageSize = 50,
  scrollHeight = 500,
  loading = false,
  onTableChange,
  pagination = false,
  ...tableProps
}) => {
  const containerRef = useRef(null);
  const totalHeight = useMemo(() => dataSource.length * 54, [dataSource.length]);
  const visibleRange = useRef({ start: 0, end: pageSize });

  const getVisibleRange = useCallback((scrollTop) => {
    const rowHeight = 54;
    const bufferSize = 5;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferSize);
    const visibleCount = Math.ceil(scrollHeight / rowHeight) + 2 * bufferSize;
    const end = Math.min(dataSource.length, start + visibleCount);
    return { start, end };
  }, [dataSource.length, scrollHeight]);

  const handleScroll = useCallback((e) => {
    const { scrollTop } = e.target;
    const range = getVisibleRange(scrollTop);
    if (
      range.start !== visibleRange.current.start ||
      range.end !== visibleRange.current.end
    ) {
      visibleRange.current = range;
    }
  }, [getVisibleRange]);

  const virtualDataSource = useMemo(() => {
    if (dataSource.length <= 100) {
      return dataSource;
    }
    const { start, end } = visibleRange.current;
    return dataSource.slice(start, end).map((item, index) => ({
      ...item,
      virtualIndex: start + index,
    }));
  }, [dataSource]);

  const virtualColumns = useMemo(() => {
    if (dataSource.length <= 100) {
      return columns;
    }
    return columns.map(col => {
      if (col.render) {
        return {
          ...col,
          render: (text, record, index) => {
            return col.render(text, record, record.virtualIndex ?? index);
          },
        };
      }
      return col;
    });
  }, [columns, dataSource]);

  const tableStyle = useMemo(() => {
    if (dataSource.length <= 100) {
      return {};
    }
    return {
      height: scrollHeight,
      overflow: 'auto',
    };
  }, [dataSource.length, scrollHeight]);

  return (
    <div
      ref={containerRef}
      style={{
        height: dataSource.length <= 100 ? 'auto' : scrollHeight,
        overflow: 'auto',
        position: 'relative',
      }}
      onScroll={dataSource.length > 100 ? handleScroll : undefined}
    >
      {dataSource.length > 100 && (
        <div style={{ height: totalHeight, position: 'relative' }}>
          <Table
            dataSource={virtualDataSource}
            columns={virtualColumns}
            rowKey={rowKey}
            loading={loading}
            onTableChange={onTableChange}
            pagination={pagination}
            style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
            scroll={{ x: 'max-content', y: scrollHeight }}
            size="small"
            {...tableProps}
          />
        </div>
      )}
      {dataSource.length <= 100 && (
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey={rowKey}
          loading={loading}
          onTableChange={onTableChange}
          pagination={pagination}
          scroll={{ x: 'max-content' }}
          {...tableProps}
        />
      )}
    </div>
  );
});

VirtualizedTable.displayName = 'VirtualizedTable';

export default VirtualizedTable;
