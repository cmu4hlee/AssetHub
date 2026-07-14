/**
 * 资产详情 - 位置信息模块
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Table,
  Tag,
  Space,
  Button,
  Timeline,
  message,
  Spin,
  Tooltip,
  Empty,
} from 'antd';

import {
  EnvironmentOutlined,
  HistoryOutlined,
  EnvironmentFilled,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { assetLocationAPI } from '../../utils/api';
import useIsMobile from '../../hooks/useIsMobile';

const AssetLocation = ({ assetId, asset }) => {
  const isMobile = useIsMobile();
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadLocation = async () => {
    if (!asset) return;
    try {
      setLocationLoading(true);
      const result = await assetLocationAPI.getAssetLocation(asset.asset_code);
      if (result.success) {
        setLocation(result.data);
      }
    } catch (error) {
      console.error('加载位置信息失败:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!asset) return;
    try {
      setHistoryLoading(true);
      const result = await assetLocationAPI.getAssetLocationHistory(asset.asset_code);
      if (result.success) {
        setHistory(result.data || []);
      }
    } catch (error) {
      console.error('加载位置历史失败:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (asset) {
      loadLocation();
      loadHistory();
    }
  }, [asset]);

  const historyColumns = [
    {
      title: '时间',
      dataIndex: 'changed_at',
      key: 'changed_at',
      width: 150,
      render: date => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '变更类型',
      dataIndex: 'change_type',
      key: 'change_type',
      width: 100,
      render: type => <Tag color="blue">{type}</Tag>,
    },
    {
      title: '变更前位置',
      dataIndex: 'from_location',
      key: 'from_location',
      ellipsis: true,
    },
    {
      title: '变更后位置',
      dataIndex: 'to_location',
      key: 'to_location',
      ellipsis: true,
    },
    {
      title: '操作人',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 100,
    },
  ];

  return (
    <Card
      title={
        <Space>
          <EnvironmentOutlined />
          位置信息
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Spin spinning={locationLoading}>
        {location ? (
          <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
            <Descriptions.Item label="当前位置">
              <Space>
                <EnvironmentFilled style={{ color: '#1890ff' }} />
                {location.current_location || '-'}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="所在楼层">
              {location.floor || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="房间号">
              {location.room_number || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="GPS坐标">
              {location.gps_latitude && location.gps_longitude
                ? `${location.gps_latitude}, ${location.gps_longitude}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Beacon ID">
              {location.beacon_id || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="最后更新时间">
              {location.last_updated
                ? dayjs(location.last_updated).format('YYYY-MM-DD HH:mm')
                : '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
            暂无位置信息
          </div>
        )}
      </Spin>

      <div style={{ marginTop: 24 }}>
        <div style={{ marginBottom: 12, fontWeight: 500 }}>
          <HistoryOutlined style={{ marginRight: 8 }} />
          位置变更历史
        </div>
        <Spin spinning={historyLoading}>
          {history.length > 0 ? (
            <>
              <div className="hide-on-mobile">
                <Table
                  columns={historyColumns}
                  dataSource={history}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: 700 }}
                />
              </div>
              <div className="mobile-table-cards show-on-mobile">
                {history.map(record => (
                  <div key={record.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{dayjs(record.changed_at).format('YYYY-MM-DD HH:mm')}</span>
                      {record.change_type && <Tag color="blue">{record.change_type}</Tag>}
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">变更前位置</span>
                        <span className="mobile-card-value">{record.from_location || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">变更后位置</span>
                        <span className="mobile-card-value">{record.to_location || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">操作人</span>
                        <span className="mobile-card-value">{record.operator_name || '-'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
              暂无位置变更历史
            </div>
          )}
        </Spin>
      </div>
    </Card>
  );
};

export default AssetLocation;
