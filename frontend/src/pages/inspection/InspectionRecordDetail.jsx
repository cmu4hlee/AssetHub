/**
 * 巡检记录单详情（规范记录单展示与打印）
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Descriptions, Table, Tag, Button, Space, message, Spin, Divider,
  Row, Col, Statistic, Empty, Alert, Modal, Form, Input, Select,
} from 'antd';
import {
  ArrowLeftOutlined, PrinterOutlined, CheckCircleOutlined, WarningOutlined,
  EditOutlined, FileTextOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { inspectionAPI } from '../../utils/api';
import dayjs from 'dayjs';
import useIsMobile from '../../hooks/useIsMobile';
import SignatureField from '../../components/SignatureField';

const { TextArea } = Input;
const { Option } = Select;

const inspectionTypeMap = {
  daily: '日常巡检', weekly: '周巡检', monthly: '月巡检',
  quarterly: '季巡检', special: '专项巡检',
};

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

const checkResultMap = {
  normal: { label: '正常', color: 'success' },
  abnormal: { label: '异常', color: 'error' },
  na: { label: '不适用', color: 'default' },
};

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

const InspectionRecordDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewForm] = Form.useForm();

  const fetchRecord = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inspectionAPI.getRecord(id);
      if (res?.success) {
        setRecord(res.data);
      }
    } catch (_e) {
      message.error('加载记录单失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchRecord();
  }, [fetchRecord]);

  const handlePrint = () => {
    window.print();
  };

  const handleReview = async () => {
    try {
      const values = await reviewForm.validateFields();
      await inspectionAPI.reviewRecord(id, {
        decision: values.decision || 'approve',
        remark: values.reviewed_remark,
        signature_reviewer: values.signature_reviewer,
        overall_result: values.overall_result,
      });
      message.success('复核成功');
      setReviewModalVisible(false);
      reviewForm.resetFields();
      void fetchRecord();
    } catch (error) {
      if (error?.errorFields) return;
      message.error('复核失败');
    }
  };

  const handleExportPdf = async () => {
    try {
      message.info('正在生成 PDF...');
      const blob = await inspectionAPI.exportRecordPdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inspection-record-${record?.record_code || id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('PDF 已下载');
    } catch (e) {
      message.error('PDF 导出失败');
    }
  };

  const handleArchive = async () => {
    Modal.confirm({
      title: '确认归档',
      content: '归档后记录单将不可修改，确认归档？',
      onOk: async () => {
        await inspectionAPI.updateRecord(id, { status: 'archived' });
        message.success('归档成功');
        void fetchRecord();
      },
    });
  };

  const itemColumns = [
    { title: '序号', width: 60, render: (_, __, idx) => idx + 1 },
    { title: '检查项', dataIndex: 'item_name', width: 180 },
    {
      title: '类别', dataIndex: 'item_category', width: 100,
      render: v => ({ appearance: '外观', function: '功能', safety: '安全', environment: '环境', performance: '性能' }[v] || v || '-'),
    },
    { title: '检查标准', dataIndex: 'check_standard', width: 200, ellipsis: true },
    {
      title: '结果', dataIndex: 'check_result', width: 100,
      render: v => {
        const m = checkResultMap[v] || checkResultMap.normal;
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    { title: '实测值', dataIndex: 'actual_value', width: 180, ellipsis: true },
    { title: '问题描述', dataIndex: 'problem_desc', width: 200, ellipsis: true },
    {
      title: '风险', dataIndex: 'risk_level', width: 80,
      render: v => v ? <Tag color={riskLevelMap[v]?.color}>{riskLevelMap[v]?.label}</Tag> : '-',
    },
  ];

  const issueColumns = [
    { title: '问题编号', dataIndex: 'issue_code', width: 180 },
    { title: '问题标题', dataIndex: 'problem_title', width: 200, ellipsis: true },
    { title: '问题描述', dataIndex: 'problem_desc', width: 250, ellipsis: true },
    {
      title: '风险等级', dataIndex: 'risk_level', width: 100,
      render: v => <Tag color={riskLevelMap[v]?.color}>{riskLevelMap[v]?.label}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: v => <Tag color={issueStatusMap[v]?.color}>{issueStatusMap[v]?.label}</Tag>,
    },
    {
      title: '操作', width: 100,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => navigate('/inspection/issues')}>
          处理
        </Button>
      ),
    },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  if (!record) {
    return <Empty description="记录单不存在" />;
  }

  return (
    <div style={{ padding: isMobile ? '8px' : '24px' }}>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: isMobile ? 'flex-start' : 'space-between',
          gap: 8,
        }}
        className="no-print"
      >
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inspection/records')}>
            返回列表
          </Button>
          <h2 style={{ margin: 0 }}>
            <FileTextOutlined /> 巡检记录单详情
          </h2>
        </Space>
        <Space wrap>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>打印</Button>
          <Button icon={<FilePdfOutlined />} onClick={handleExportPdf}>导出 PDF</Button>
          {record.status === 'submitted' && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setReviewModalVisible(true)}>
              复核
            </Button>
          )}
          {record.status === 'reviewed' && (
            <Button type="primary" onClick={handleArchive}>归档</Button>
          )}
        </Space>
      </div>

      {/* 记录单标题 */}
      <Card size="small" style={{ marginBottom: 16, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>巡检记录单</h1>
        <p style={{ margin: '8px 0 0', color: '#999' }}>编号：{record.record_code}</p>
      </Card>

      {/* 基本信息 */}
      <Card title="一、巡检基本信息" size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={isMobile ? 1 : 3} size="small" bordered>
          <Descriptions.Item label="巡检标题">{record.inspection_title}</Descriptions.Item>
          <Descriptions.Item label="巡检类型">{inspectionTypeMap[record.inspection_type]}</Descriptions.Item>
          <Descriptions.Item label="巡检区域">{record.inspection_area || '-'}</Descriptions.Item>
          <Descriptions.Item label="关联资产">{record.asset_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="资产编码">{record.asset_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="关联任务">{record.task_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="巡检日期">{record.inspection_date ? dayjs(record.inspection_date).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
          <Descriptions.Item label="开始时间">{record.start_time ? dayjs(record.start_time).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="结束时间">{record.end_time ? dayjs(record.end_time).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="巡检人">{record.inspector_name}</Descriptions.Item>
          <Descriptions.Item label="复核人">{record.reviewer_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="复核时间">{record.reviewed_at ? dayjs(record.reviewed_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          {record.reviewed_at && (
            <Descriptions.Item label="复核结论">
              <Tag color={overallResultMap[record.overall_result]?.color}>
                {overallResultMap[record.overall_result]?.label || '-'}
              </Tag>
            </Descriptions.Item>
          )}
          {record.reviewed_remark && (
            <Descriptions.Item label="复核意见" span={2}>
              {record.reviewed_remark}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* 检查项明细 */}
      <Card title="二、巡检检查项明细" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col xs={24} sm={8}>
            <Statistic title="总检查项" value={record.total_items || 0} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic title="正常项" value={record.normal_items || 0} styles={{ content: { color: '#52c41a' } }} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic title="异常项" value={record.abnormal_items || 0} styles={{ content: { color: '#ff4d4f' } }} />
          </Col>
        </Row>
        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            size="small"
            columns={itemColumns}
            dataSource={record.items || []}
            pagination={false}
            scroll={{ x: 1100 }}
            bordered
          />
        </div>
        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {Array.isArray(record.items) && record.items.length > 0 ? (
            record.items.map((r, idx) => {
              const m = checkResultMap[r.check_result] || checkResultMap.normal;
              const catMap = { appearance: '外观', function: '功能', safety: '安全', environment: '环境', performance: '性能' };
              return (
                <div key={r.id || idx} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{r.item_name || `检查项 ${idx + 1}`}</span>
                    <Tag color={m.color}>{m.label}</Tag>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">序号</span>
                      <span className="mobile-card-value">{idx + 1}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">类别</span>
                      <span className="mobile-card-value">{catMap[r.item_category] || r.item_category || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">检查标准</span>
                      <span className="mobile-card-value">{r.check_standard || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">实测值</span>
                      <span className="mobile-card-value">{r.actual_value || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">问题描述</span>
                      <span className="mobile-card-value">{r.problem_desc || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">风险</span>
                      <span className="mobile-card-value">
                        {r.risk_level ? <Tag color={riskLevelMap[r.risk_level]?.color}>{riskLevelMap[r.risk_level]?.label}</Tag> : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>

      {/* 巡检结论 */}
      <Card title="三、巡检结论与建议" size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="总体结论">
            <Tag color={overallResultMap[record.overall_result]?.color}>
              {overallResultMap[record.overall_result]?.label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="巡检总结">{record.summary || '-'}</Descriptions.Item>
          <Descriptions.Item label="改进建议">{record.suggestions || '-'}</Descriptions.Item>
          <Descriptions.Item label="备注">{record.remark || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 异常问题 */}
      {record.issues && record.issues.length > 0 && (
        <Card title="四、异常问题清单" size="small" style={{ marginBottom: 16 }}>
          <Alert title={`本次巡检共发现 ${record.issues.length} 个异常问题，请及时跟踪整改`}
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
          />
          <div className="hide-on-mobile">
            <Table
              rowKey="id"
              size="small"
              columns={issueColumns}
              dataSource={record.issues}
              pagination={false}
              scroll={{ x: 900 }}
            />
          </div>
          {/* 移动端卡片列表 */}
          <div className="mobile-table-cards show-on-mobile">
            {record.issues.map(r => {
              const s = issueStatusMap[r.status] || issueStatusMap.open;
              const risk = riskLevelMap[r.risk_level];
              return (
                <div key={r.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{r.issue_code || r.problem_title || '-'}</span>
                    <Tag color={s.color}>{s.label}</Tag>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">问题标题</span>
                      <span className="mobile-card-value">{r.problem_title || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">问题描述</span>
                      <span className="mobile-card-value">{r.problem_desc || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">风险等级</span>
                      <span className="mobile-card-value">{risk ? <Tag color={risk.color}>{risk.label}</Tag> : '-'}</span>
                    </div>
                  </div>
                  <div className="mobile-card-actions">
                    <Button
                      type="primary"
                      size="small"
                      block
                      onClick={() => navigate('/inspection/issues')}
                    >
                      处理
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 签字确认 */}
      <Card title="五、签字确认" size="small">
        <Row gutter={16}>
          <Col xs={24} sm={8} style={{ textAlign: 'center' }}>
            <p>巡检人签字：</p>
            <div className="signature-box">
              {record.signature_inspector ? (
                <img src={record.signature_inspector} alt="巡检人签字" className="signature-img" />
              ) : (
                <span style={{ lineHeight: '40px', color: '#999' }}>{record.inspector_name || '（无）'}</span>
              )}
            </div>
            <p style={{ color: '#999', fontSize: 12 }}>日期：{record.inspection_date ? dayjs(record.inspection_date).format('YYYY-MM-DD') : ''}</p>
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'center' }}>
            <p>复核人签字：</p>
            <div className="signature-box">
              {record.signature_reviewer ? (
                <img src={record.signature_reviewer} alt="复核人签字" className="signature-img" />
              ) : (
                <span style={{ lineHeight: '40px', color: '#999' }}>{record.reviewer_name || '（待复核）'}</span>
              )}
            </div>
            <p style={{ color: '#999', fontSize: 12 }}>日期：{record.reviewed_at ? dayjs(record.reviewed_at).format('YYYY-MM-DD') : ''}</p>
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'center' }}>
            <p>归档：</p>
            <div style={{ borderBottom: '1px solid #000', height: 40, marginBottom: 8 }}>
              {record.status === 'archived' && <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a', lineHeight: '40px' }} />}
            </div>
            <p style={{ color: '#999', fontSize: 12 }}>
              状态：<Tag color={recordStatusMap[record.status]?.color}>{recordStatusMap[record.status]?.label}</Tag>
            </p>
          </Col>
        </Row>
      </Card>

      {/* 复核弹窗 */}
      <Modal
        title="巡检记录单复核"
        open={reviewModalVisible}
        onOk={handleReview}
        onCancel={() => setReviewModalVisible(false)}
        width={isMobile ? '95vw' : 560}
      >
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="overall_result" label="复核结论" rules={[{ required: true, message: '请选择' }]}>
            <Select>
              <Option value="normal">正常</Option>
              <Option value="abnormal">异常</Option>
              <Option value="need_attention">需关注</Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="复核意见">
            <TextArea rows={3} placeholder="复核意见" />
          </Form.Item>
          <SignatureField
            name="signature_reviewer"
            label="复核人手写签名"
            required
            requiredMessage="请复核人完成手写签名"
            width="100%"
            height={150}
            placeholder="复核人现场签字确认"
          />
        </Form>
      </Modal>

      <style>{`
        .signature-box {
          border-bottom: 1px solid #000;
          height: 60px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .signature-img {
          max-width: 100%;
          max-height: 60px;
          object-fit: contain;
        }
        @media print {
          .no-print { display: none !important; }
          .ant-card { box-shadow: none !important; border: 1px solid #000 !important; }
          .signature-box { border-bottom: 1px solid #000 !important; }
          .signature-img { max-height: 60px !important; }
        }
      `}</style>
    </div>
  );
};

export default InspectionRecordDetail;
