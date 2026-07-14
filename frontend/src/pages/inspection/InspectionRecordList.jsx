/**
 * 巡检记录单列表
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import {
  Card, Table, Button, Tag, Space, Input, Select, DatePicker, message,
  Popconfirm, Row, Col, Statistic, Empty,
} from 'antd';
import {
  PlusOutlined, EyeOutlined, DeleteOutlined, FileTextOutlined,
  CheckCircleOutlined, WarningOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { inspectionAPI } from '../../utils/api';
import dayjs from 'dayjs';
import useIsMobile from '../../hooks/useIsMobile';

const { Option } = Select;

const recordStatusMap = {
  draft: { label: '草稿', color: 'default' },
  submitted: { label: '已提交', color: 'processing' },
  reviewed: { label: '已复核', color: 'success' },
  archived: { label: '已归档', color: 'purple' },
};

const overallResultMap = {
  normal: { label: '正常', color: 'success' },
  abnormal: { label: '异常', color: 'error' },
  need_attention: { label: '需关注', color: 'warning' },
};

const inspectionTypeMap = {
  daily: '日常巡检',
  weekly: '周巡检',
  monthly: '月巡检',
  quarterly: '季巡检',
  special: '专项巡检',
};

const InspectionRecordList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const canDelete = useCan('inspection', 'delete');
  const canEdit = useCan('inspection', 'edit');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({});
  const [stats, setStats] = useState({ total: 0, normal: 0, abnormal: 0 });

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await inspectionAPI.getRecords({ page, pageSize, ...filters });
      if (response?.success) {
        setRecords(response.data || []);
        setTotal(response.pagination?.total || 0);
      }
    } catch (_e) {
      message.error('加载巡检记录单失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await inspectionAPI.getStatistics();
      if (response?.success) {
        const r = response.data?.records || {};
        setStats({
          total: r.total_records || 0,
          normal: r.normal_records || 0,
          abnormal: r.abnormal_records || 0,
        });
      }
    } catch (_e) { /* ignore */ }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleDelete = async id => {
    try {
      await inspectionAPI.deleteRecord(id);
      message.success('删除成功');
      void fetchRecords();
      void fetchStats();
    } catch (_e) {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '记录单编号', dataIndex: 'record_code', width: 180, fixed: 'left' },
    { title: '巡检标题', dataIndex: 'inspection_title', width: 200, ellipsis: true },
    {
      title: '巡检类型',
      dataIndex: 'inspection_type',
      width: 100,
      render: v => inspectionTypeMap[v] || v,
    },
    { title: '关联资产', dataIndex: 'asset_name', width: 160, ellipsis: true, render: v => v || '-' },
    { title: '巡检人', dataIndex: 'inspector_name', width: 100 },
    { title: '巡检日期', dataIndex: 'inspection_date', width: 110, sorter: true },
    {
      title: '检查项',
      width: 120,
      render: (_, r) => `${r.normal_items || 0}正常 / ${r.abnormal_items || 0}异常`,
    },
    {
      title: '总体结论',
      dataIndex: 'overall_result',
      width: 100,
      render: v => {
        const m = overallResultMap[v] || overallResultMap.normal;
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: v => {
        const m = recordStatusMap[v] || recordStatusMap.draft;
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/inspection/records/${record.id}`)}
          />
          <Popconfirm title="确认删除该记录单？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="巡检记录单总数" value={stats.total} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="正常" value={stats.normal} styles={{ content: { color: '#52c41a' } }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="异常" value={stats.abnormal} styles={{ content: { color: '#ff4d4f' } }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card
        title="巡检记录单"
        extra={
          <Button type="primary" icon={<PlusOutlined />} block={isMobile} onClick={() => navigate('/inspection/records/new')}>
            填写巡检记录单
          </Button>
        }
      >
        <Space wrap orientation={isMobile ? 'vertical' : 'horizontal'} style={{ marginBottom: 16, width: isMobile ? '100%' : 'auto' }}>
          <Input.Search
            allowClear
            placeholder="记录单编号/标题/巡检人"
            style={{ width: isMobile ? '100%' : 250 }}
            onSearch={v => { setPage(1); setFilters({ ...filters, keyword: v }); }}
          />
          <Select
            allowClear
            style={{ width: isMobile ? '100%' : 120 }}
            placeholder="状态"
            onChange={v => { setPage(1); setFilters({ ...filters, status: v }); }}
          >
            {Object.entries(recordStatusMap).map(([k, v]) => (
              <Option key={k} value={k}>{v.label}</Option>
            ))}
          </Select>
          <Select
            allowClear
            style={{ width: isMobile ? '100%' : 120 }}
            placeholder="总体结论"
            onChange={v => { setPage(1); setFilters({ ...filters, overall_result: v }); }}
          >
            {Object.entries(overallResultMap).map(([k, v]) => (
              <Option key={k} value={k}>{v.label}</Option>
            ))}
          </Select>
          <Select
            allowClear
            style={{ width: isMobile ? '100%' : 120 }}
            placeholder="巡检类型"
            onChange={v => { setPage(1); setFilters({ ...filters, inspection_type: v }); }}
          >
            {Object.entries(inspectionTypeMap).map(([k, v]) => (
              <Option key={k} value={k}>{v}</Option>
            ))}
          </Select>
        </Space>

        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={records}
            scroll={{ x: 1300 }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: t => `共 ${t} 条`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            }}
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(records) && records.length > 0 ? (
            <>
              {records.map(record => {
                const s = recordStatusMap[record.status] || recordStatusMap.draft;
                const r = overallResultMap[record.overall_result] || overallResultMap.normal;
                return (
                  <div key={record.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{record.record_code || '-'}</span>
                      <Tag color={s.color}>{s.label}</Tag>
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">巡检标题</span>
                        <span className="mobile-card-value">{record.inspection_title || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">巡检类型</span>
                        <span className="mobile-card-value">{inspectionTypeMap[record.inspection_type] || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">关联资产</span>
                        <span className="mobile-card-value">{record.asset_name || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">巡检人</span>
                        <span className="mobile-card-value">{record.inspector_name || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">巡检日期</span>
                        <span className="mobile-card-value">{record.inspection_date || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">检查项</span>
                        <span className="mobile-card-value">{`${record.normal_items || 0}正常 / ${record.abnormal_items || 0}异常`}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">总体结论</span>
                        <span className="mobile-card-value"><Tag color={r.color}>{r.label}</Tag></span>
                      </div>
                    </div>
                    <div className="mobile-card-actions">
                      <Button
                        type="primary"
                        size="small"
                        icon={<EyeOutlined />}
                        block
                        onClick={() => navigate(`/inspection/records/${record.id}`)}
                      >
                        查看
                      </Button>
                      <Popconfirm title="确认删除该记录单？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
                        <Button type="primary" danger size="small" icon={<DeleteOutlined />} block disabled={!canDelete}>
                          删除
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                );
              })}
              {/* 移动端分页 */}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Space>
                  <Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    上一页
                  </Button>
                  <span>
                    第 {page} / {Math.ceil(total / pageSize) || 1} 页
                  </span>
                  <Button
                    disabled={page >= Math.ceil(total / pageSize)}
                    onClick={() => setPage(p => p + 1)}
                  >
                    下一页
                  </Button>
                </Space>
                <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                  共 {total} 条
                </div>
              </div>
            </>
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>
    </div>
  );
};

export default InspectionRecordList;
