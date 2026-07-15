/**
 * 资产详情 - 质量管理记录
 *
 * 聚合当前资产的计量管理与质控管理记录，分两类展示：
 *  - 计量管理：计量检定 / 校准记录（type = 'metrology'，来自 metrology_records）
 *  - 质控管理：质量控制记录（type = 'quality_control'，来自 quality_control_records）
 *
 * 数据统一来自后端聚合接口 GET /quality-control/asset/:assetCode/history
 * （qualityControlAPI.getAssetQualityHistory），一次性返回该资产下的全部质量记录，
 * 前端按 type 拆分。即「在资产详情即可查看对应资产的计量与质控轨迹」。
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Tabs, Tag, Drawer, Descriptions, Empty, Spin,
  Button, Space, message, Divider,
} from 'antd';
import { SafetyCertificateOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { qualityControlAPI } from '../../api/domains/maintenance';
import { ResponsiveTable } from '../../components';

const resultColor = {
  合格: 'green',
  不合格: 'red',
  限用: 'orange',
  待检: 'default',
  整改中: 'orange',
};

const statusColor = {
  待检: 'default',
  进行中: 'processing',
  已完成: 'success',
  已取消: 'error',
  整改中: 'warning',
};

const fmtDate = v => (v ? dayjs(v).format('YYYY-MM-DD') : '-');

const AssetQualityManagement = ({ assetId, asset }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [all, setAll] = useState([]);
  const [activeTab, setActiveTab] = useState('metrology');

  const [detail, setDetail] = useState(null);
  const [detailType, setDetailType] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    if (!assetId) return;
    try {
      setLoading(true);
      const res = await qualityControlAPI.getAssetQualityHistory(assetId);
      if (res && res.success) {
        setAll(Array.isArray(res.data) ? res.data : []);
      } else {
        message.error((res && res.message) || '加载质量管理记录失败');
      }
    } catch (e) {
      console.error('加载资产质量管理记录失败:', e);
      message.error('加载质量管理记录失败');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

  const metrologyRecords = all.filter(r => r.type === 'metrology');
  const qcRecords = all.filter(r => r.type === 'quality_control');

  const openDetail = async record => {
    setDetailVisible(true);
    setDetailLoading(true);
    setDetailType(record.type);
    setDetail(record);
    try {
      // 拉取完整明细（含附件）；无对应权限时退化为历史基础记录，不阻断查看
      const res = record.type === 'metrology'
        ? await qualityControlAPI.getMetrologyRecord(record.id)
        : await qualityControlAPI.getQualityControlRecord(record.id);
      if (res && res.success && res.data) {
        setDetail(res.data);
      }
    } catch (e) {
      // 保留基础记录，不阻断查看
    } finally {
      setDetailLoading(false);
    }
  };

  const renderResult = v => <Tag color={resultColor[v] || 'default'}>{v || '-'}</Tag>;
  const renderStatus = v => <Tag color={statusColor[v] || 'default'}>{v || '-'}</Tag>;

  const metrologyColumns = [
    {
      title: '计量单号',
      dataIndex: 'record_no',
      key: 'record_no',
      width: 150,
      render: (text, r) => <a onClick={() => openDetail(r)}>{text}</a>,
    },
    { title: '计量类型', dataIndex: 'metrology_type', key: 'metrology_type', width: 110 },
    { title: '计量日期', dataIndex: 'metrology_date', key: 'metrology_date', width: 120, render: fmtDate },
    { title: '下次计量', dataIndex: 'next_metrology_date', key: 'next_metrology_date', width: 120, render: fmtDate },
    { title: '计量机构', dataIndex: 'metrology_agency', key: 'metrology_agency', width: 140, ellipsis: true },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 90,
      render: renderResult,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: renderStatus,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, r) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)}>
          查看
        </Button>
      ),
    },
  ];

  const qcColumns = [
    {
      title: '质控单号',
      dataIndex: 'record_no',
      key: 'record_no',
      width: 150,
      render: (text, r) => <a onClick={() => openDetail(r)}>{text}</a>,
    },
    { title: '质控类型', dataIndex: 'qc_type', key: 'qc_type', width: 110 },
    { title: '质控日期', dataIndex: 'qc_date', key: 'qc_date', width: 120, render: fmtDate },
    { title: '质控项目', dataIndex: 'qc_item', key: 'qc_item', width: 140, ellipsis: true },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 90,
      render: renderResult,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: renderStatus,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, r) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)}>
          查看
        </Button>
      ),
    },
  ];

  const metrologyMobileFields = [
    { label: '计量类型', key: 'metrology_type' },
    { label: '计量日期', key: 'metrology_date', render: fmtDate },
    { label: '下次计量', key: 'next_metrology_date', render: fmtDate },
    { label: '计量机构', key: 'metrology_agency' },
  ];
  const metrologyMobileActions = [
    { key: 'view', text: '查看', icon: <EyeOutlined />, onClick: openDetail },
  ];
  const qcMobileFields = [
    { label: '质控类型', key: 'qc_type' },
    { label: '质控日期', key: 'qc_date', render: fmtDate },
    { label: '质控项目', key: 'qc_item' },
  ];
  const qcMobileActions = [
    { key: 'view', text: '查看', icon: <EyeOutlined />, onClick: openDetail },
  ];

  const renderTable = (records, columns, mobileKind) => {
    const mobileFields = mobileKind === 'metrology' ? metrologyMobileFields : qcMobileFields;
    const mobileActions = mobileKind === 'metrology' ? metrologyMobileActions : qcMobileActions;
    return (
      <ResponsiveTable
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={records}
        columns={columns}
        pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }}
        mobileTitleKey="record_no"
        mobileStatusRender={r => <Tag color={statusColor[r.status] || 'default'}>{r.status || '-'}</Tag>}
        mobileFields={mobileFields}
        mobileActions={mobileActions}
      />
    );
  };

  const renderDetailBody = () => {
    if (!detail) return null;
    const isMetrology = detailType === 'metrology';
    const items = [
      <Descriptions.Item label={isMetrology ? '计量单号' : '质控单号'} key="no">
        {detail.record_no}
      </Descriptions.Item>,
      <Descriptions.Item label="关联资产" key="asset">
        {detail.asset_code}
        {detail.asset_name ? `（${detail.asset_name}）` : ''}
      </Descriptions.Item>,
      <Descriptions.Item label={isMetrology ? '计量类型' : '质控类型'} key="type">
        {isMetrology ? detail.metrology_type : detail.qc_type}
      </Descriptions.Item>,
      <Descriptions.Item label={isMetrology ? '计量日期' : '质控日期'} key="date">
        {fmtDate(isMetrology ? detail.metrology_date : detail.qc_date)}
      </Descriptions.Item>,
      isMetrology ? (
        <Descriptions.Item label="下次计量日期" key="next">
          {fmtDate(detail.next_metrology_date)}
        </Descriptions.Item>
      ) : (
        <Descriptions.Item label="质控项目" key="item">
          {detail.qc_item || '-'}
        </Descriptions.Item>
      ),
      isMetrology ? (
        <Descriptions.Item label="计量机构" key="agency">
          {detail.metrology_agency || '-'}
        </Descriptions.Item>
      ) : null,
      <Descriptions.Item label="结果" key="result">
        {renderResult(detail.result)}
      </Descriptions.Item>,
      <Descriptions.Item label="状态" key="status">
        {renderStatus(detail.status)}
      </Descriptions.Item>,
      detail.remark ? (
        <Descriptions.Item label="备注" key="remark">
          {detail.remark}
        </Descriptions.Item>
      ) : null,
    ].filter(Boolean);

    return (
      <>
        <Descriptions column={1} size="small" bordered>
          {items}
        </Descriptions>

        {Array.isArray(detail.attachments) && detail.attachments.length > 0 && (
          <>
            <Divider>附件</Divider>
            <Space orientation="vertical">
              {detail.attachments.map((att, i) => (
                <a key={i} href={att.file_path || att.url} target="_blank" rel="noopener noreferrer">
                  {att.file_name || att.original_file_name || `附件${i + 1}`}
                </a>
              ))}
            </Space>
          </>
        )}
      </>
    );
  };

  return (
    <Card
      title={
        <Space>
          <SafetyCertificateOutlined />
          <span>质量管理记录</span>
        </Space>
      }
      extra={
        <Button
          size="small"
          onClick={() => navigate(activeTab === 'metrology' ? '/quality-control/metrology' : '/quality-control/qc')}
        >
          查看全部
        </Button>
      }
      style={{ marginTop: 16 }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'metrology',
            label: `计量管理 (${metrologyRecords.length})`,
            children: renderTable(metrologyRecords, metrologyColumns, 'metrology'),
          },
          {
            key: 'quality_control',
            label: `质控管理 (${qcRecords.length})`,
            children: renderTable(qcRecords, qcColumns, 'qc'),
          },
        ]}
      />

      <Drawer
        title="质量管理详情"
        width={560}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        destroyOnHidden
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin />
          </div>
        ) : (
          renderDetailBody()
        )}
      </Drawer>
    </Card>
  );
};

export default AssetQualityManagement;
