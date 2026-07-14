import React from 'react';
import { Button, Space, Tag, Popconfirm } from 'antd';
import { EyeOutlined, EditOutlined, LinkOutlined, DisconnectOutlined } from '@ant-design/icons';

const DeviceCard = ({
  device,
  onViewDetail,
  onEdit,
  onLink,
  onUnlink,
  getStatusTag,
  getDeviceTypeTag,
  unlinkLoading,
}) => {
  return (
    <div
      className="mobile-card-item"
      style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.3s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      onClick={() => onViewDetail(device)}
    >
      <div
        className="mobile-card-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <span
          className="mobile-card-title"
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#333',
          }}
        >
          {device.device_name || device.device_id}
        </span>
        {getStatusTag(device.status)}
      </div>
      <div
        className="mobile-card-body"
        style={{
          marginBottom: '16px',
        }}
      >
        <div
          className="mobile-card-field"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
            fontSize: '14px',
          }}
        >
          <span className="mobile-card-label" style={{ color: '#666' }}>
            设备ID
          </span>
          <span className="mobile-card-value" style={{ color: '#333', fontWeight: '500' }}>
            {device.device_id}
          </span>
        </div>
        <div
          className="mobile-card-field"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
            fontSize: '14px',
          }}
        >
          <span className="mobile-card-label" style={{ color: '#666' }}>
            设备类型
          </span>
          <span className="mobile-card-value">{getDeviceTypeTag(device.device_type)}</span>
        </div>
        <div
          className="mobile-card-field"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
            fontSize: '14px',
          }}
        >
          <span className="mobile-card-label" style={{ color: '#666' }}>
            制造商
          </span>
          <span className="mobile-card-value" style={{ color: '#333' }}>
            {device.manufacturer || '-'}
          </span>
        </div>
        <div
          className="mobile-card-field"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
            fontSize: '14px',
          }}
        >
          <span className="mobile-card-label" style={{ color: '#666' }}>
            型号
          </span>
          <span className="mobile-card-value" style={{ color: '#333' }}>
            {device.model || '-'}
          </span>
        </div>
        <div
          className="mobile-card-field"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
            fontSize: '14px',
          }}
        >
          <span className="mobile-card-label" style={{ color: '#666' }}>
            最后在线
          </span>
          <span className="mobile-card-value" style={{ color: '#333' }}>
            {device.last_online_time ? new Date(device.last_online_time).toLocaleString() : '-'}
          </span>
        </div>
      </div>
      <div
        className="mobile-card-actions"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={e => {
            e.stopPropagation();
            onViewDetail(device);
          }}
          block
          style={{
            borderRadius: '4px',
            transition: 'all 0.2s ease',
          }}
        >
          详情
        </Button>
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={e => {
            e.stopPropagation();
            onEdit(device);
          }}
          block
          style={{
            borderRadius: '4px',
            transition: 'all 0.2s ease',
          }}
        >
          编辑
        </Button>
        {!device.linked_asset_id && (
          <Button
            size="small"
            icon={<LinkOutlined />}
            onClick={e => {
              e.stopPropagation();
              onLink(device);
            }}
            block
            style={{
              borderRadius: '4px',
              transition: 'all 0.2s ease',
            }}
          >
            关联资产
          </Button>
        )}
        {device.linked_asset_id && (
          <Popconfirm
            title="确定要解绑该设备吗？"
            onConfirm={() => onUnlink(device)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="primary"
              danger
              size="small"
              icon={<DisconnectOutlined />}
              onClick={e => {
                e.stopPropagation();
              }}
              block
              loading={unlinkLoading}
              style={{
                borderRadius: '4px',
                transition: 'all 0.2s ease',
              }}
            >
              解绑
            </Button>
          </Popconfirm>
        )}
      </div>
    </div>
  );
};

export default DeviceCard;
