/**
 * 巡检模板列表
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import {
  Card, Table, Button, Tag, Space, Input, Select, message,
  Popconfirm, Empty,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  ProfileOutlined, CopyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { inspectionAPI } from '../../utils/api';
import useIsMobile from '../../hooks/useIsMobile';

const { Option } = Select;

const inspectionTypeMap = {
  daily: '日常巡检', weekly: '周巡检', monthly: '月巡检',
  quarterly: '季巡检', special: '专项巡检',
};

const InspectionTemplateList = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const canDelete = useCan('inspection', 'delete');
  const canEdit = useCan('inspection', 'edit');
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({});

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inspectionAPI.getTemplates({ page, pageSize, ...filters });
      if (res?.success) {
        setTemplates(res.data || []);
        setTotal(res.pagination?.total || 0);
      }
    } catch (_e) {
      message.error('加载模板失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = async id => {
    try {
      await inspectionAPI.deleteTemplate(id);
      message.success('删除成功');
      void fetchTemplates();
    } catch (_e) {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '模板编号', dataIndex: 'template_code', width: 150 },
    { title: '模板名称', dataIndex: 'template_name', width: 250, ellipsis: true },
    {
      title: '巡检类型', dataIndex: 'inspection_type', width: 100,
      render: v => inspectionTypeMap[v] || v,
    },
    { title: '适用范围', dataIndex: 'applicable_scope', width: 200, ellipsis: true, render: v => v || '-' },
    { title: '巡检周期(天)', dataIndex: 'cycle_days', width: 110 },
    {
      title: '检查项数', dataIndex: 'item_count', width: 100,
      render: v => <Tag color="blue">{v || 0}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: v => <Tag color={v === 'active' ? 'success' : 'default'}>{v === 'active' ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作', width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />}
            onClick={() => navigate(`/inspection/templates/${record.id}`)} />
          <Button type="link" size="small" icon={<EditOutlined />}
            onClick={() => navigate(`/inspection/templates/${record.id}/edit`)} />
          <Popconfirm title="确认删除该模板？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? '8px' : '24px' }}>
      <Card
        title={<span><ProfileOutlined /> 巡检模板管理</span>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} block={isMobile}
            onClick={() => navigate('/inspection/templates/new')}>
            新建巡检模板
          </Button>
        }
      >
        <Space wrap orientation={isMobile ? 'vertical' : 'horizontal'} style={{ marginBottom: 16, width: isMobile ? '100%' : 'auto' }}>
          <Input.Search
            allowClear
            placeholder="模板名称/编号"
            style={{ width: isMobile ? '100%' : 250 }}
            onSearch={v => { setPage(1); setFilters({ ...filters, keyword: v }); }}
          />
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
          <Select
            allowClear
            style={{ width: isMobile ? '100%' : 120 }}
            placeholder="状态"
            onChange={v => { setPage(1); setFilters({ ...filters, status: v }); }}
          >
            <Option value="active">启用</Option>
            <Option value="inactive">停用</Option>
          </Select>
        </Space>

        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={templates}
            scroll={{ x: 1200 }}
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
          ) : Array.isArray(templates) && templates.length > 0 ? (
            <>
              {templates.map(record => {
                const active = record.status === 'active';
                return (
                  <div key={record.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{record.template_name || record.template_code || '-'}</span>
                      <Tag color={active ? 'success' : 'default'}>{active ? '启用' : '停用'}</Tag>
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">模板编号</span>
                        <span className="mobile-card-value">{record.template_code || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">巡检类型</span>
                        <span className="mobile-card-value">{inspectionTypeMap[record.inspection_type] || record.inspection_type || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">适用范围</span>
                        <span className="mobile-card-value">{record.applicable_scope || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">巡检周期(天)</span>
                        <span className="mobile-card-value">{record.cycle_days ?? '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">检查项数</span>
                        <span className="mobile-card-value"><Tag color="blue">{record.item_count || 0}</Tag></span>
                      </div>
                    </div>
                    <div className="mobile-card-actions">
                      <Button
                        type="primary"
                        size="small"
                        icon={<EyeOutlined />}
                        block
                        onClick={() => navigate(`/inspection/templates/${record.id}`)}
                      >
                        查看
                      </Button>
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        block
                        onClick={() => navigate(`/inspection/templates/${record.id}/edit`)}
                      >
                        编辑
                      </Button>
                      <Popconfirm title="确认删除该模板？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
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

export default InspectionTemplateList;
