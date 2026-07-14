/**
 * 风险分级管理页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../../hooks';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  Slider, message, Popconfirm, Row, Col, Statistic,
  Progress, Empty
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined,
  WarningOutlined, FileSearchOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, SettingOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { riskAPI } from '../../../utils/api';
import useIsMobile from '../../../hooks/useIsMobile';

const { Option } = Select;
const { TextArea } = Input;

const RiskClassification = () => {
  const isMobile = useIsMobile();
  const canDelete = useCan('risk', 'delete');
  const canEdit = useCan('risk', 'edit');
  const [loading, setLoading] = useState(false);
  const [classifications, setClassifications] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingRecord, setEditingRecord] = useState(null);
  const [mobilePage, setMobilePage] = useState(1);

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    high: 0,
    medium: 0,
    low: 0
  });

  // 风险分级标准
  const classificationRules = [
    { level: 'high', minScore: 70, maxScore: 100, color: 'red', label: '高风险', priority: 1 },
    { level: 'medium', minScore: 40, maxScore: 69, color: 'orange', label: '中风险', priority: 2 },
    { level: 'low', minScore: 0, maxScore: 39, color: 'green', label: '低风险', priority: 3 }
  ];

  const riskFactors = [
    { key: 'usage', label: '使用频率', weight: 0.3, desc: '高频使用设备更容易发生故障与磨损' },
    { key: 'maintenance', label: '维护状态', weight: 0.25, desc: '维护不及时会显著提升运行风险' },
    { key: 'age', label: '设备年限', weight: 0.2, desc: '设备老化会导致稳定性与安全性下降' },
    { key: 'environment', label: '运行环境', weight: 0.15, desc: '环境温湿度与污染程度会影响故障率' },
    { key: 'criticality', label: '业务关键性', weight: 0.1, desc: '关键设备故障会造成更大业务影响' }
  ];

  const updateStats = useCallback((data) => {
    setStats({
      total: data.length,
      high: data.filter(a => a.risk_level === 'high').length,
      medium: data.filter(a => a.risk_level === 'medium').length,
      low: data.filter(a => a.risk_level === 'low').length
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await riskAPI.getRiskClassifications({ pageSize: 100 });
      if (response?.success) {
        const data = response.data || [];
        setClassifications(data);
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
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await riskAPI.deleteRiskClassification(id);
      message.success('删除成功');
      fetchData();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await riskAPI.updateRiskClassification(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await riskAPI.createRiskClassification(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (_error) {
      message.error('操作失败');
    }
  };

  const getRiskLevelInfo = (level) => {
    return classificationRules.find(r => r.level === level) || { label: level, color: 'default' };
  };

  const columns = [
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code' },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name' },
    { title: '所属科室', dataIndex: 'department', key: 'department' },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      render: (v) => {
        const info = getRiskLevelInfo(v);
        return (
          <Tag color={info.color} icon={<WarningOutlined />}>
            {info.label}
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
          style={{ width: 100 }}
        />
      ),
      sorter: (a, b) => a.risk_score - b.risk_score
    },
    {
      title: '分级依据',
      key: 'basis',
      render: (_, record) => {
        const rule = classificationRules.find(r => r.level === record.risk_level);
        return rule ? `${rule.minScore}-${rule.maxScore}分` : '-';
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
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
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="分级总数" value={stats.total} prefix={<FileSearchOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="高风险" value={stats.high} prefix={<WarningOutlined />} styles={{ content: { color: '#f5222d' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="中风险" value={stats.medium} prefix={<ExclamationCircleOutlined />} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="低风险" value={stats.low} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card
            title={<span><SafetyOutlined /> 风险分级列表</span>}
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} block={isMobile}>
                新增分级
              </Button>
            }
          >
            <div className="hide-on-mobile">
              <Table
                columns={columns}
                dataSource={classifications}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            </div>
            <div className="mobile-table-cards show-on-mobile">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
              ) : Array.isArray(classifications) && classifications.length > 0 ? (
                <>
                  {classifications.slice((mobilePage - 1) * 10, mobilePage * 10).map(record => {
                    const info = getRiskLevelInfo(record.risk_level);
                    const rule = classificationRules.find(r => r.level === record.risk_level);
                    return (
                      <div key={record.id} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">{record.asset_name || '-'}</span>
                          <Tag color={info.color} icon={<WarningOutlined />}>{info.label}</Tag>
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">资产编号</span>
                            <span className="mobile-card-value">{record.asset_code || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">所属科室</span>
                            <span className="mobile-card-value">{record.department || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">风险评分</span>
                            <span className="mobile-card-value"><Progress percent={record.risk_score || 0} size="small" status={record.risk_score >= 70 ? 'exception' : record.risk_score >= 40 ? 'normal' : 'success'} /></span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">分级依据</span>
                            <span className="mobile-card-value">{rule ? `${rule.minScore}-${rule.maxScore}分` : '-'}</span>
                          </div>
                        </div>
                        <div className="mobile-card-actions">
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
                      <span>第 {mobilePage} / {Math.ceil(classifications.length / 10) || 1} 页</span>
                      <Button disabled={mobilePage >= Math.ceil(classifications.length / 10)} onClick={() => setMobilePage(p => p + 1)}>下一页</Button>
                    </Space>
                  </div>
                </>
              ) : (
                <Empty description="暂无数据" />
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<span><SettingOutlined /> 分级标准</span>}>
            <div>
              {classificationRules.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    width: '100%',
                    padding: '8px 0',
                    borderBottom: idx < classificationRules.length - 1 ? '1px solid #f0f0f0' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Tag color={item.color} style={{ fontSize: 14, padding: '4px 12px' }}>
                      {item.label}
                    </Tag>
                    <span style={{ color: '#8c8c8c' }}>{item.minScore}-{item.maxScore}分</span>
                  </div>
                  <Progress
                    percent={100}
                    strokeColor={item.color}
                    showInfo={false}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card title={<span><InfoCircleOutlined /> 风险因子权重</span>} style={{ marginTop: 16 }}>
            <div>
              {riskFactors.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    width: '100%',
                    padding: '8px 0',
                    borderBottom: idx < riskFactors.length - 1 ? '1px solid #f0f0f0' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.label}</span>
                    <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{(item.weight * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>{item.desc}</div>
                  <Progress percent={item.weight * 100} showInfo={false} size="small" />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑风险分级' : '新增风险分级'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={isMobile ? '95vw' : 700}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="asset_id" label="选择资产" rules={[{ required: true }]}>
                <Select placeholder="请选择资产" showSearch>
                  {/* 这里应该从API加载资产列表 */}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="risk_level" label="风险等级" rules={[{ required: true }]}>
                <Select placeholder="请选择风险等级">
                  {classificationRules.map(r => (
                    <Option key={r.level} value={r.level}>
                      <Tag color={r.color}>{r.label}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="risk_score" label="风险评分" rules={[{ required: true }]}>
            <Slider
              min={0}
              max={100}
              marks={{ 0: '0', 40: '40', 70: '70', 100: '100' }}
            />
          </Form.Item>

          <Form.Item name="classification_basis" label="分级依据">
            <TextArea rows={3} placeholder="请输入分级依据" />
          </Form.Item>

          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RiskClassification;
