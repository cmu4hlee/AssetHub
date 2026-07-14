/**
 * 资产详情 - 基础信息模块
 */
import React from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Space,
  Button,
  Row,
  Col,
  Divider,
} from 'antd';

import {
  ArrowLeftOutlined,
  EditOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { printAssetDetailReport } from '../../utils/printReport';

const ASSET_STATUS_COLORS = {
  '在用': 'green',
  '闲置': 'blue',
  '维修': 'orange',
  '报废': 'red',
  '借出': 'purple',
  '调配中': 'cyan',
};

const ASSET_TYPE_COLORS = {
  '医疗设备': 'blue',
  '普通设备': 'default',
  '房产建筑': 'orange',
  '办公家具': 'green',
  '其他': 'default',
};

const AssetOverview = ({ asset, onBack, onEdit }) => {
  if (!asset) return null;

  const getStatusColor = status => ASSET_STATUS_COLORS[status] || 'default';
  const getTypeColor = type => ASSET_TYPE_COLORS[type] || 'default';

  return (
    <Card
      title={
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
          />
          {asset.asset_name || '资产详情'}
        </Space>
      }
      extra={
        <Space>
          <Button icon={<PrinterOutlined />} onClick={() => printAssetDetailReport(asset)}>
            打印
          </Button>
          <Button type="primary" icon={<EditOutlined />} onClick={onEdit}>
            编辑
          </Button>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Descriptions column={3} bordered size="small">
        <Descriptions.Item label="资产编号">
          <strong>{asset.asset_code}</strong>
        </Descriptions.Item>
        <Descriptions.Item label="资产名称">{asset.asset_name}</Descriptions.Item>
        <Descriptions.Item label="资产类型">
          <Tag color={getTypeColor(asset.asset_type)}>{asset.asset_type || '-'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="资产状态">
          <Tag color={getStatusColor(asset.status)} style={{ fontSize: 14 }}>
            {asset.status || '-'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="品牌">{asset.brand || '-'}</Descriptions.Item>
        <Descriptions.Item label="型号">{asset.model || '-'}</Descriptions.Item>
        <Descriptions.Item label="分类">{asset.category_name || '-'}</Descriptions.Item>
        <Descriptions.Item label="管理部门">
          {asset.department_name || asset.department || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="负责人">
          {asset.responsible_person || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="使用人">{asset.user_name || '-'}</Descriptions.Item>
        <Descriptions.Item label="购置日期">
          {asset.purchase_date ? dayjs(asset.purchase_date).format('YYYY-MM-DD') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="使用期限(月)">
          {asset.service_life_months || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="购置价格(元)">
          {asset.purchase_price != null ? `¥${Number(asset.purchase_price).toLocaleString()}` : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="当前净值(元)">
          {asset.current_value != null ? `¥${Number(asset.current_value).toLocaleString()}` : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="供应商">{asset.supplier || '-'}</Descriptions.Item>
        <Descriptions.Item label="序列号">{asset.serial_number || '-'}</Descriptions.Item>
        <Descriptions.Item label="保修期至">
          {asset.warranty_expiry_date
            ? dayjs(asset.warranty_expiry_date).format('YYYY-MM-DD')
            : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {asset.created_at ? dayjs(asset.created_at).format('YYYY-MM-DD HH:mm') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="最后更新">
          {asset.updated_at ? dayjs(asset.updated_at).format('YYYY-MM-DD HH:mm') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="备注" span={1}>
          {asset.remark || '-'}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
};

export default AssetOverview;
