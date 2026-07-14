/**
 * 巡检问题跟踪（异常问题整改闭环）
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Input, Select, message,
  Modal, Form, DatePicker, Descriptions, Row, Col, Statistic, Empty,
} from 'antd';
import {
  AlertOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined,
  WarningOutlined, ClockCircleOutlined, ToolOutlined, HistoryOutlined,
} from '@ant-design/icons';
import { inspectionAPI } from '../../utils/api';
import dayjs from 'dayjs';
import useIsMobile from '../../hooks/useIsMobile';

const { Option } = Select;
const { TextArea } = Input;

const issueStatusMap = {
  open: { label: '待处理', color: 'error' },
  in_progress: { label: '整改中', color: 'processing' },
  resolved: { label: '已整改', color: 'warning' },
  verified: { label: '已验证', color: 'success' },
  deferred: { label: '暂缓', color: 'default' },
};

const riskLevelMap = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'blue' },
};

const problemCategoryMap = {
  function: '功能故障',
  appearance: '外观损坏',
  safety: '安全隐患',
  environment: '环境问题',
  other: '其他',
};

const InspectionIssues = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({});
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [handleForm] = Form.useForm();
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0, high: 0 });

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inspectionAPI.getIssues({ page, pageSize, ...filters });
      if (res?.success) {
        setIssues(res.data || []);
        setTotal(res.pagination?.total || 0);
      }
    } catch (_e) {
      message.error('加载问题列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await inspectionAPI.getStatistics();
      if (res?.success) {
        const i = res.data?.issues || {};
        setStats({
          total: i.total_issues || 0,
          open: i.open_issues || 0,
          resolved: (i.resolved_issues || 0) + (i.verified_issues || 0),
          high: i.high_risk_issues || 0,
        });
      }
    } catch (_e) { /* ignore */ }
  }, []);

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleOpenHandle = (record) => {
    setEditingIssue(record);
    handleForm.setFieldsValue({
      ...record,
      rectification_deadline: record.rectification_deadline ? dayjs(record.rectification_deadline) : null,
      rectification_date: record.rectification_date ? dayjs(record.rectification_date) : null,
    });
    setDetailVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await handleForm.validateFields();
      const payload = {
        ...values,
        rectification_deadline: values.rectification_deadline ? values.rectification_deadline.format('YYYY-MM-DD') : null,
        rectification_date: values.rectification_date ? values.rectification_date.format('YYYY-MM-DD') : null,
      };
      await inspectionAPI.updateIssue(editingIssue.id, payload);
      message.success('更新成功');
      setDetailVisible(false);
      void fetchIssues();
      void fetchStats();
    } catch (error) {
      if (error?.errorFields) return;
      message.error('更新失败');
    }
  };

  const handleConvertToWorkOrder = async (id) => {
    try {
      const r = await inspectionAPI.convertIssueToWorkOrder(id);
      if (r?.data?.work_order_code) {
        message.success(`已生成工单: ${r.data.work_order_code}`);
      } else {
        message.success('转工单请求已提交');
      }
      void fetchIssues();
    } catch (e) {
      message.error(e.message || '转工单失败');
    }
  };

  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyIssue, setHistoryIssue] = useState(null);

  const handleShowHistory = async (record) => {
    setHistoryIssue(record);
    setHistoryVisible(true);
    const r = await inspectionAPI.getIssueHistory(record.id);
    setHistoryList(r?.data || []);
  };

  const actionLabel = {
    created: '创建', assigned: '指派', in_progress: '整改中', resolved: '已整改',
    verified: '已验证', deferred: '暂缓', open: '重新打开',
  };

  const columns = [
    { title: '问题编号', dataIndex: 'issue_code', width: 180, fixed: 'left' },
    { title: '问题标题', dataIndex: 'problem_title', width: 200, ellipsis: true },
    { title: '问题描述', dataIndex: 'problem_desc', width: 250, ellipsis: true },
    {
      title: '类别', dataIndex: 'problem_category', width: 100,
      render: v => problemCategoryMap[v] || v || '-',
    },
    {
      title: '风险等级', dataIndex: 'risk_level', width: 90,
      render: v => <Tag color={riskLevelMap[v]?.color}>{riskLevelMap[v]?.label}</Tag>,
    },
    { title: '关联资产', dataIndex: 'asset_name', width: 150, ellipsis: true, render: v => v || '-' },
    { title: '记录单', dataIndex: 'record_code', width: 160, ellipsis: true },
    {
      title: '整改人', dataIndex: 'rectification_assignee_name', width: 100,
      render: v => v || '-',
    },
    {
      title: '整改期限', dataIndex: 'rectification_deadline', width: 110,
      render: v => v || '-',
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: v => <Tag color={issueStatusMap[v]?.color}>{issueStatusMap[v]?.label}</Tag>,
    },
    {
      title: '关联工单', dataIndex: 'work_order_code', width: 140,
      render: v => v ? <Tag color="purple">{v}</Tag> : '-',
    },
    {
      title: '操作', width: 220, fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />}
            onClick={() => handleOpenHandle(record)}>
            处理
          </Button>
          <Button type="link" size="small" icon={<HistoryOutlined />}
            onClick={() => handleShowHistory(record)}>
            历史
          </Button>
          {!record.work_order_id && (
            <Button type="link" size="small" icon={<ToolOutlined />}
              onClick={() => handleConvertToWorkOrder(record.id)}>
              转工单
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? '8px' : '24px' }}>
      <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size={isMobile ? 'small' : 'default'}>
            <Statistic title="问题总数" value={stats.total} prefix={<AlertOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size={isMobile ? 'small' : 'default'}>
            <Statistic title="待处理" value={stats.open} styles={{ content: { color: '#ff4d4f' } }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size={isMobile ? 'small' : 'default'}>
            <Statistic title="已闭环" value={stats.resolved} styles={{ content: { color: '#52c41a' } }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size={isMobile ? 'small' : 'default'}>
            <Statistic title="高风险" value={stats.high} styles={{ content: { color: '#ff4d4f' } }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card title={<span><AlertOutlined /> 巡检问题跟踪</span>}>
        <Space wrap orientation={isMobile ? 'vertical' : 'horizontal'} style={{ marginBottom: 16, width: isMobile ? '100%' : 'auto' }}>
          <Input.Search
            allowClear
            placeholder="问题编号/标题"
            style={{ width: isMobile ? '100%' : 220 }}
            onSearch={v => { setPage(1); setFilters({ ...filters, keyword: v }); }}
          />
          <Select
            allowClear
            style={{ width: isMobile ? '100%' : 120 }}
            placeholder="状态"
            onChange={v => { setPage(1); setFilters({ ...filters, status: v }); }}
          >
            {Object.entries(issueStatusMap).map(([k, v]) => (
              <Option key={k} value={k}>{v.label}</Option>
            ))}
          </Select>
          <Select
            allowClear
            style={{ width: isMobile ? '100%' : 120 }}
            placeholder="风险等级"
            onChange={v => { setPage(1); setFilters({ ...filters, risk_level: v }); }}
          >
            {Object.entries(riskLevelMap).map(([k, v]) => (
              <Option key={k} value={k}>{v.label}</Option>
            ))}
          </Select>
        </Space>

        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={issues}
            scroll={{ x: 1500 }}
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
          ) : Array.isArray(issues) && issues.length > 0 ? (
            <>
              {issues.map(record => {
                const s = issueStatusMap[record.status] || issueStatusMap.open;
                const r = riskLevelMap[record.risk_level];
                return (
                  <div key={record.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{record.issue_code || record.problem_title || '-'}</span>
                      <Tag color={s.color}>{s.label}</Tag>
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">问题标题</span>
                        <span className="mobile-card-value">{record.problem_title || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">类别</span>
                        <span className="mobile-card-value">{problemCategoryMap[record.problem_category] || record.problem_category || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">风险等级</span>
                        <span className="mobile-card-value">{r ? <Tag color={r.color}>{r.label}</Tag> : '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">关联资产</span>
                        <span className="mobile-card-value">{record.asset_name || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">记录单</span>
                        <span className="mobile-card-value">{record.record_code || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">整改人</span>
                        <span className="mobile-card-value">{record.rectification_assignee_name || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">整改期限</span>
                        <span className="mobile-card-value">{record.rectification_deadline || '-'}</span>
                      </div>
                    </div>
                    <div className="mobile-card-actions">
                      <Button
                        type="primary"
                        size="small"
                        icon={<EditOutlined />}
                        block
                        onClick={() => handleOpenHandle(record)}
                      >
                        处理
                      </Button>
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

      <Modal
        title={`处理巡检问题 - ${editingIssue?.issue_code || ''}`}
        open={detailVisible}
        onOk={handleSave}
        onCancel={() => setDetailVisible(false)}
        width={isMobile ? '95vw' : 800}
        destroyOnHidden
      >
        {editingIssue && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="问题标题">{editingIssue.problem_title}</Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={riskLevelMap[editingIssue.risk_level]?.color}>{riskLevelMap[editingIssue.risk_level]?.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="问题类别">{problemCategoryMap[editingIssue.problem_category] || '-'}</Descriptions.Item>
              <Descriptions.Item label="关联资产">{editingIssue.asset_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="问题描述" span={2}>{editingIssue.problem_desc}</Descriptions.Item>
            </Descriptions>

            <Form form={handleForm} layout="vertical">
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item name="status" label="状态">
                    <Select>
                      {Object.entries(issueStatusMap).map(([k, v]) => (
                        <Option key={k} value={k}>{v.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="rectification_assignee_name" label="整改责任人">
                    <Input placeholder="责任人姓名" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="rectification_deadline" label="整改期限">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="rectification_measures" label="整改措施">
                <TextArea rows={2} placeholder="采取的整改措施" />
              </Form.Item>
              <Form.Item name="rectification_result" label="整改结果">
                <TextArea rows={2} placeholder="整改结果说明" />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="rectification_date" label="整改完成日期">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="verifier_name" label="验证人">
                    <Input placeholder="验证人姓名" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="verify_remark" label="验证说明">
                <TextArea rows={2} placeholder="整改验证说明" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <Modal
        title={`问题操作历史 - ${historyIssue?.issue_code || ''}`}
        open={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        footer={null}
        width={isMobile ? '95vw' : 600}
      >
        {historyList.length === 0 ? (
          <Empty description="暂无历史" />
        ) : (
          <div>
            {historyList.map((h, idx) => (
              <div key={h.id} style={{ padding: '8px 0', borderBottom: idx < historyList.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <div>
                  <Tag color="blue">{actionLabel[h.action] || h.action}</Tag>
                  {h.from_status && h.to_status && h.from_status !== h.to_status && (
                    <span style={{ color: '#999' }}>{h.from_status} → {h.to_status}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  {h.operator_name || '系统'} · {h.created_at}
                </div>
                {h.remark && <div style={{ fontSize: 12, marginTop: 4 }}>{h.remark}</div>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InspectionIssues;
