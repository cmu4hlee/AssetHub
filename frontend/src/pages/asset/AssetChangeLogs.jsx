/**
 * 资产详情 - 变更日志模块
 */
import React, { useState, useEffect } from 'react';
import { Card, Timeline, Spin, Tag, Empty } from 'antd';
import {
  HistoryOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SwapOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { assetAPI } from '../../utils/api';

const ACTION_COLORS = {
  'create': 'green',
  'update': 'blue',
  'delete': 'red',
  'status_change': 'orange',
  'transfer': 'purple',
  'maintenance': 'cyan',
  'upload': 'geekblue',
};

const ACTION_LABELS = {
  'create': '创建资产',
  'update': '修改信息',
  'delete': '删除资产',
  'status_change': '状态变更',
  'transfer': '资产调配',
  'maintenance': '维修记录',
  'upload': '上传资料',
};

const AssetChangeLogs = ({ assetId, asset }) => {
  const [changeLogs, setChangeLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadChangeLogs = async () => {
    if (!assetId) return;
    try {
      setLoading(true);
      const result = await assetAPI.getAssetChangeLogs(assetId);
      if (result.success) {
        setChangeLogs(result.data || []);
      }
    } catch (error) {
      console.error('加载变更日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (assetId) {
      loadChangeLogs();
    }
  }, [assetId]);

  const getActionIcon = action => {
    switch (action) {
      case 'create': return <PlusOutlined style={{ color: '#52c41a' }} />;
      case 'update': return <EditOutlined style={{ color: '#1890ff' }} />;
      case 'delete': return <DeleteOutlined style={{ color: '#ff4d4f' }} />;
      case 'status_change': return <SwapOutlined style={{ color: '#fa8c16' }} />;
      case 'maintenance': return <EditOutlined style={{ color: '#13c2c2' }} />;
      case 'upload': return <UploadOutlined style={{ color: '#722ed1' }} />;
      default: return <HistoryOutlined />;
    }
  };

  const getLogAction = log => log.action || 'update';

  const getLogTime = log => log.created_at || log.changed_at;

  const getOperatorName = log => log.operator_name || log.changed_by;

  const formatValue = value => {
    if (value === null || value === undefined || value === '') return '(空)';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getChanges = log => {
    if (log.changes && Object.keys(log.changes).length > 0) {
      return Object.entries(log.changes).map(([field, change]) => ({
        field,
        from: change.from,
        to: change.to,
      }));
    }
    if (log.field_name) {
      return [{
        field: log.field_name,
        from: log.old_value,
        to: log.new_value,
      }];
    }
    return [];
  };

  return (
    <Card
      title={
        <span>
          <HistoryOutlined style={{ marginRight: 8 }} />
          变更日志
        </span>
      }
      style={{ marginBottom: 16 }}
    >
      <Spin spinning={loading}>
        {changeLogs.length > 0 ? (
          <Timeline
            items={changeLogs.map(log => {
              const action = getLogAction(log);
              const logTime = getLogTime(log);
              const operatorName = getOperatorName(log);
              const changes = getChanges(log);
              return {
                color: ACTION_COLORS[action] || 'blue',
                dot: getActionIcon(action),
                children: (
                  <div style={{ paddingBottom: 8 }}>
                    <div style={{ marginBottom: 4 }}>
                      <Tag color={ACTION_COLORS[action] || 'blue'}>
                        {ACTION_LABELS[action] || action}
                      </Tag>
                      {logTime && (
                        <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
                          {dayjs(logTime).format('YYYY-MM-DD HH:mm:ss')}
                        </span>
                      )}
                    </div>
                    {operatorName && (
                      <div style={{ color: '#666', fontSize: 13, marginBottom: 4 }}>
                        操作人: {operatorName}
                      </div>
                    )}
                    {log.description && (
                      <div style={{ color: '#333', fontSize: 13 }}>{log.description}</div>
                    )}
                    {changes.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                        {changes.map(change => (
                          <div key={change.field}>
                            <strong>{change.field}:</strong>{' '}
                            <span style={{ textDecoration: 'line-through', color: '#ff4d4f' }}>
                              {formatValue(change.from)}
                            </span>
                            {' → '}
                            <span style={{ color: '#52c41a' }}>{formatValue(change.to)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              };
            })}
          />
        ) : (
          <Empty description="暂无变更日志" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Spin>
    </Card>
  );
};

export default AssetChangeLogs;
