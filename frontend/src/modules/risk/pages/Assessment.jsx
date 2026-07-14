/**
 * 风险评估管理页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../../hooks';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  DatePicker, Slider, message, Popconfirm, Row, Col, Statistic,
  Progress, Alert, Descriptions, Divider, Empty
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined,
  WarningOutlined, FileSearchOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, BarChartOutlined, FileTextOutlined
} from '@ant-design/icons';
import { riskAPI } from '../../../utils/api';
import useIsMobile from '../../../hooks/useIsMobile';
import dayjs from 'dayjs';

const { TextArea } = Input;

const RiskAssessment = () => {
  const isMobile = useIsMobile();
  const canDelete = useCan('risk', 'delete');
  const canEdit = useCan('risk', 'edit');
  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [mobilePage, setMobilePage] = useState(1);

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
    avgScore: 0
  });

  const riskLevels = [
    { value: 'high', label: '高风险', color: 'red', scoreRange: [70, 100], desc: '需立即采取措施' },
    { value: 'medium', label: '中风险', color: 'orange', scoreRange: [40, 69], desc: '需持续关注' },
    { value: 'low', label: '低风险', color: 'green', scoreRange: [0, 39], desc: '可接受范围' }
  ];

  const assessmentItems = [
    { key: 'importance', label: '设备重要性', maxScore: 20 },
    { key: 'usage_frequency', label: '使用频率', maxScore: 15 },
    { key: 'failure_history', label: '故障历史', maxScore: 20 },
    { key: 'age', label: '设备年限', maxScore: 15 },
    { key: 'safety_risk', label: '安全风险', maxScore: 20 },
    { key: 'maintenance_cost', label: '维护成本', maxScore: 10 }
  ];

  const updateStats = useCallback((data) => {
    const totalScore = data.reduce((sum, item) => sum + (item.risk_score || 0), 0);
    setStats({
      total: data.length,
      high: data.filter(a => a.risk_level === 'high').length,
      medium: data.filter(a => a.risk_level === 'medium').length,
      low: data.filter(a => a.risk_level === 'low').length,
      avgScore: data.length > 0 ? Math.round(totalScore / data.length) : 0
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await riskAPI.getRiskAssessments({ pageSize: 100 });
      if (response?.success) {
        const data = response.data || [];
        setAssessments(data);
        updateStats(data);
      }
    } catch (_error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [updateStats]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      assessment_items: {},
      risk_score: 0,
      risk_level: 'low'
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      assessment_date: record.assessment_date ? dayjs(record.assessment_date) : dayjs(),
      assessment_items: record.assessment_items ? JSON.parse(record.assessment_items) : {}
    });
    setModalVisible(true);
  };

  const handleView = (record) => {
    setViewingRecord(record);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await riskAPI.deleteRiskAssessment(id);
      message.success('删除成功');
      fetchData();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const calculateRiskLevel = (score) => {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 计算风险评分
      const items = values.assessment_items || {};
      const totalScore = Object.values(items).reduce((sum, score) => sum + (score || 0), 0);
      values.risk_score = totalScore;
      values.risk_level = calculateRiskLevel(totalScore);

      if (values.assessment_date) {
        values.assessment_date = values.assessment_date.format('YYYY-MM-DD');
      }
      values.assessment_items = JSON.stringify(items);

      if (editingRecord) {
        await riskAPI.updateRiskAssessment(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await riskAPI.createRiskAssessment(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (_error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '评估编号', dataIndex: 'assessment_code', key: 'assessment_code', width: 120 },
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code' },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name' },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      render: (v) => {
        const level = riskLevels.find(l => l.value === v);
        return (
          <Tag color={level?.color} icon={<WarningOutlined />}>
            {level?.label}
          </Tag>
        );
      }
    },
    {
      title: '风险评分',
      dataIndex: 'risk_score',
      key: 'risk_score',
      render: (v) => (
        <Progress
          percent={v}
          size="small"
          status={v >= 70 ? 'exception' : v >= 40 ? 'normal' : 'success'}
          style={{ width: 80 }}
        />
      )
    },
    { title: '评估日期', dataIndex: 'assessment_date', key: 'assessment_date' },
    { title: '评估人', dataIndex: 'assessor_name', key: 'assessor_name' },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<FileTextOutlined />} onClick={() => handleView(record)}>详情</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={4}>
          <Card>
            <Statistic title="评估总数" value={stats.total} prefix={<FileSearchOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={5}>
          <Card>
            <Statistic title="高风险" value={stats.high} prefix={<WarningOutlined />} styles={{ content: { color: '#f5222d' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={5}>
          <Card>
            <Statistic title="中风险" value={stats.medium} prefix={<ExclamationCircleOutlined />} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={5}>
          <Card>
            <Statistic title="低风险" value={stats.low} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={5}>
          <Card>
            <Statistic title="平均评分" value={stats.avgScore} prefix={<BarChartOutlined />} />
          </Card>
        </Col>
      </Row>

      {stats.high > 0 && (
        <Alert
          message={`警告：有 ${stats.high} 项资产被评估为高风险，请立即制定风险控制措施！`}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card
        title={<span><SafetyOutlined /> 风险评估管理</span>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} block={isMobile}>
            新增评估
          </Button>
        }
      >
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={assessments}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(assessments) && assessments.length > 0 ? (
            <>
              {assessments.slice((mobilePage - 1) * 10, mobilePage * 10).map(record => {
                const level = riskLevels.find(l => l.value === record.risk_level);
                return (
                  <div key={record.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{record.asset_name || '-'}</span>
                      <Tag color={level?.color} icon={<WarningOutlined />}>{level?.label}</Tag>
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">评估编号</span>
                        <span className="mobile-card-value">{record.assessment_code || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">资产编号</span>
                        <span className="mobile-card-value">{record.asset_code || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">风险评分</span>
                        <span className="mobile-card-value"><Progress percent={record.risk_score || 0} size="small" status={record.risk_score >= 70 ? 'exception' : record.risk_score >= 40 ? 'normal' : 'success'} /></span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">评估日期</span>
                        <span className="mobile-card-value">{record.assessment_date || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">评估人</span>
                        <span className="mobile-card-value">{record.assessor_name || '-'}</span>
                      </div>
                    </div>
                    <div className="mobile-card-actions">
                      <Button type="primary" size="small" block icon={<FileTextOutlined />} onClick={() => handleView(record)}>详情</Button>
                      <Button size="small" block icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
                      <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
                        <Button type="primary" danger size="small" block icon={<DeleteOutlined />}>删除</Button>
                      </Popconfirm>
                    </div>
                  </div>
                );
              })}
              {/* 移动端分页 */}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Space>
                  <Button disabled={mobilePage === 1} onClick={() => setMobilePage(p => p - 1)}>上一页</Button>
                  <span>第 {mobilePage} / {Math.ceil(assessments.length / 10) || 1} 页</span>
                  <Button disabled={mobilePage >= Math.ceil(assessments.length / 10)} onClick={() => setMobilePage(p => p + 1)}>下一页</Button>
                </Space>
              </div>
            </>
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>

      {/* 评估弹窗 */}
      <Modal
        title={editingRecord ? '编辑风险评估' : '新增风险评估'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={isMobile ? '95vw' : 800}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="assessment_code" label="评估编号" rules={[{ required: true }]}>
                <Input placeholder="请输入评估编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="asset_id" label="选择资产" rules={[{ required: true }]}>
                <Select placeholder="请选择资产" showSearch>
                  {/* 这里应该从API加载资产列表 */}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="assessment_date" label="评估日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assessor_name" label="评估人">
                <Input placeholder="请输入评估人" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left">评估项目（请为每个项目打分）</Divider>

          {assessmentItems.map(item => (
            <Form.Item
              key={item.key}
              label={`${item.label} (满分${item.maxScore}分)`}
              name={['assessment_items', item.key]}
            >
              <Slider
                min={0}
                max={item.maxScore}
                marks={{ 0: '0', [item.maxScore/2]: `${item.maxScore/2}`, [item.maxScore]: `${item.maxScore}` }}
              />
            </Form.Item>
          ))}

          <Form.Item name="remarks" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="风险评估详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[<Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>]}
        width={isMobile ? '95vw' : 700}
      >
        {viewingRecord && (
          <>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="评估编号">{viewingRecord.assessment_code}</Descriptions.Item>
              <Descriptions.Item label="评估日期">{viewingRecord.assessment_date}</Descriptions.Item>
              <Descriptions.Item label="资产编号">{viewingRecord.asset_code}</Descriptions.Item>
              <Descriptions.Item label="资产名称">{viewingRecord.asset_name}</Descriptions.Item>
              <Descriptions.Item label="评估人">{viewingRecord.assessor_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={riskLevels.find(l => l.value === viewingRecord.risk_level)?.color}>
                  {riskLevels.find(l => l.value === viewingRecord.risk_level)?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="风险评分" span={2}>
                <Progress
                  percent={viewingRecord.risk_score}
                  status={viewingRecord.risk_score >= 70 ? 'exception' : viewingRecord.risk_score >= 40 ? 'normal' : 'success'}
                />
              </Descriptions.Item>
            </Descriptions>

            <Divider titlePlacement="left">评估明细</Divider>

            {viewingRecord.assessment_items && (
              <div style={{ padding: '0 16px' }}>
                {Object.entries(JSON.parse(viewingRecord.assessment_items)).map(([key, score]) => {
                  const item = assessmentItems.find(i => i.key === key);
                  return item ? (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{item.label}</span>
                        <span>{score}/{item.maxScore}分</span>
                      </div>
                      <Progress percent={(score / item.maxScore) * 100} showInfo={false} size="small" />
                    </div>
                  ) : null;
                })}
              </div>
            )}

            <Descriptions bordered column={1} style={{ marginTop: 16 }}>
              <Descriptions.Item label="备注">{viewingRecord.remarks || '-'}</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>
    </div>
  );
};

export default RiskAssessment;
