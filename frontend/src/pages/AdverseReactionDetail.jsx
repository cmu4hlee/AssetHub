import React, { useState, useEffect } from 'react';
import { useIsMobile, useCan } from '../hooks';
import {
  Card, Descriptions, Button, message, Space, Tag, Spin, Image,
  Timeline, Modal, Input, Divider, Badge,
} from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, DownloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, StopOutlined, HistoryOutlined,
} from '@ant-design/icons';
import { adverseReactionAPI } from '../utils/api';
import { Popconfirm } from 'antd';
import dayjs from 'dayjs';

const AdverseReactionDetail = () => {
  const canDelete = useCan('adverse', 'delete');
  const canEdit = useCan('adverse', 'edit');
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [workflow, setWorkflow] = useState([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const isMobile = useIsMobile();

  // 审批弹窗
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveComment, setApproveComment] = useState('');
  const [approveAction, setApproveAction] = useState('approve'); // 'approve' | 'reject'
  const [actionLoading, setActionLoading] = useState(false);

  // 关闭弹窗
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  useEffect(() => {
    loadRecord();
    loadWorkflow();
  }, [id]);

  const loadRecord = async () => {
    try {
      setLoading(true);
      const result = await adverseReactionAPI.getRecord(id);
      if (result.success) {
        setRecord(result.data);
        setAttachments(result.data.attachments || []);
      }
    } catch (error) {
      message.error('加载记录失败');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflow = async () => {
    try {
      setWorkflowLoading(true);
      const result = await adverseReactionAPI.getWorkflow(id);
      if (result.success) {
        setWorkflow(result.data || []);
      }
    } catch (error) {
      console.error('加载工作流失败:', error);
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const result = await adverseReactionAPI.deleteRecord(id);
      if (result.success) {
        message.success('删除成功');
        navigate('/adverse-reaction');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      const result = await adverseReactionAPI.approveRecord(id, {
        approved: approveAction === 'approve',
        comment: approveComment,
      });
      if (result.success) {
        message.success(`审批${approveAction === 'approve' ? '通过' : '拒绝'}成功`);
        setApproveModalOpen(false);
        setApproveComment('');
        loadRecord();
        loadWorkflow();
      }
    } catch (error) {
      message.error('审批失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    try {
      setActionLoading(true);
      const result = await adverseReactionAPI.closeRecord(id, { close_reason: closeReason });
      if (result.success) {
        message.success('事件已关闭');
        setCloseModalOpen(false);
        setCloseReason('');
        loadRecord();
        loadWorkflow();
      }
    } catch (error) {
      message.error('关闭失败');
    } finally {
      setActionLoading(false);
    }
  };

  const getSeverityColor = severity => {
    const colorMap = {
      轻微: 'green',
      一般: 'blue',
      严重: 'orange',
      重大: 'red',
    };
    return colorMap[severity] || 'default';
  };

  const getStatusColor = status => {
    const colorMap = {
      待处理: 'default',
      处理中: 'processing',
      已处理: 'success',
      已关闭: 'success',
      已归档: 'default',
    };
    return colorMap[status] || 'default';
  };

  const getEventLevelColor = level => {
    const colorMap = { 'I级': 'red', 'II级': 'orange', 'III级': 'gold', 'IV级': 'green' };
    return colorMap[level] || 'default';
  };

  const getWorkflowStepIcon = stepType => {
    const iconMap = {
      上报: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      处理: <HistoryOutlined style={{ color: '#1890ff' }} />,
      审核: <CheckCircleOutlined style={{ color: '#faad14' }} />,
      关闭: <StopOutlined style={{ color: '#ff4d4f' }} />,
    };
    return iconMap[stepType] || undefined;
  };

  const getWorkflowResultColor = result => {
    const colorMap = { 通过: 'green', 退回: 'orange', 拒绝: 'red', 完成: 'blue' };
    return colorMap[result] || 'default';
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!record) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>记录不存在</div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? '12px' : '24px' }}>
      <Card>
        {/* 顶部操作栏 */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/adverse-reaction')}>
              返回
            </Button>
            {canEdit && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(`/adverse-reaction/edit/${id}`)}
              >
                编辑
              </Button>
            )}
          </Space>
          <Space>
            {/* 审批/处理操作按钮 */}
            {record.status === '待处理' && (
              <>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => { setApproveAction('approve'); setApproveModalOpen(true); }}
                >
                  处理
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => { setApproveAction('reject'); setApproveModalOpen(true); }}
                >
                  退回
                </Button>
              </>
            )}
            {record.status === '处理中' && (
              <>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => { setApproveAction('approve'); setApproveModalOpen(true); }}
                >
                  完成处理
                </Button>
              </>
            )}
            {['已处理', '处理中'].includes(record.status) && (
              <Button
                icon={<StopOutlined />}
                onClick={() => setCloseModalOpen(true)}
              >
                关闭
              </Button>
            )}
            <Popconfirm
              title="确定要删除这条记录吗？"
              onConfirm={handleDelete}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />} disabled={!canDelete}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </div>

        {/* 基本信息 */}
        <Descriptions title="不良事件记录详情" bordered column={isMobile ? 1 : 2}>
          <Descriptions.Item label="报告编号">
            <Space>
              {record.report_no}
              {record.is_overdue === 1 && <Tag color="red">超时</Tag>}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="报告类型">{record.report_type}</Descriptions.Item>
          <Descriptions.Item label="严重程度">
            <Tag color={getSeverityColor(record.severity)}>{record.severity}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="事件等级">
            {record.event_level ? (
              <Tag color={getEventLevelColor(record.event_level)}>{record.event_level}</Tag>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="事件后果">
            {record.event_consequence || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="是否严重事件">
            {record.is_serious === 1 ? <Tag color="red">是</Tag> : <Tag>否</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="事件分类">{record.event_category || '-'}</Descriptions.Item>
          <Descriptions.Item label="处理时限">
            {record.handle_deadline ? `${record.handle_deadline}小时` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="资产编号">{record.asset_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="资产名称">{record.asset_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="发生时间">
            {record.occurrence_date
              ? dayjs(record.occurrence_date).format('YYYY-MM-DD HH:mm:ss')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="发现时间">
            {record.discovery_date
              ? dayjs(record.discovery_date).format('YYYY-MM-DD HH:mm:ss')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="发生地点">{record.location || '-'}</Descriptions.Item>
          <Descriptions.Item label="发生科室">{record.department || '-'}</Descriptions.Item>
          <Descriptions.Item label="上报人">{record.reporter}</Descriptions.Item>
          <Descriptions.Item label="上报人电话">{record.reporter_phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="上报来源">{record.report_source || '-'}</Descriptions.Item>
          <Descriptions.Item label="涉及人员">
            {record.involved_persons
              ? (() => {
                  try {
                    const persons = typeof record.involved_persons === 'string'
                      ? JSON.parse(record.involved_persons)
                      : record.involved_persons;
                    return Array.isArray(persons) ? persons.join('、') : persons;
                  } catch { return record.involved_persons; }
                })()
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="处理状态">
            <Tag color={getStatusColor(record.status)}>{record.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="处理人">{record.handler || '-'}</Descriptions.Item>
          <Descriptions.Item label="处理时间">
            {record.handle_date ? dayjs(record.handle_date).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="审核人">{record.reviewer || '-'}</Descriptions.Item>
          <Descriptions.Item label="审核时间">
            {record.review_date ? dayjs(record.review_date).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="事件描述" span={isMobile ? 1 : 2}>
            {record.description}
          </Descriptions.Item>
          <Descriptions.Item label="原因分析" span={isMobile ? 1 : 2}>
            {record.cause_analysis || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="原因分类" span={isMobile ? 1 : 2}>
            {record.cause_category || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="影响评估" span={isMobile ? 1 : 2}>
            {record.impact_assessment || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="处理措施" span={isMobile ? 1 : 2}>
            {record.handling_measures || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="预防措施" span={isMobile ? 1 : 2}>
            {record.prevention_measures || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="处理结果" span={isMobile ? 1 : 2}>
            {record.handle_result || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="审核意见" span={isMobile ? 1 : 2}>
            {record.review_comment || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={isMobile ? 1 : 2}>
            {record.remark || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建人">{record.created_by || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
        </Descriptions>

        {/* 附件 */}
        {attachments.length > 0 && (
          <Card title="附件" style={{ marginTop: '24px' }}>
            <Space wrap>
              {attachments.map(att => {
                const fileUrl = `${import.meta.env.VITE_BACKEND_URL || window.location.origin}${att.file_path}`;
                const isImage = att.file_type?.startsWith('image/');
                return (
                  <div key={att.id} style={{ marginBottom: '16px', textAlign: 'center' }}>
                    {isImage ? (
                      <div>
                        <Image
                          width={200}
                          height={200}
                          src={fileUrl}
                          style={{
                            objectFit: 'cover',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                          }}
                          preview={{ src: fileUrl }}
                        />
                        <div style={{ marginTop: '8px' }}>{att.file_name}</div>
                      </div>
                    ) : (
                      <div>
                        <Button
                          icon={<DownloadOutlined />}
                          onClick={() => window.open(fileUrl, '_blank')}
                        >
                          下载
                        </Button>
                        <div style={{ marginTop: '8px', fontSize: '12px' }}>{att.file_name}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Space>
          </Card>
        )}

        {record.close_reason && (
          <Card title="关闭信息" size="small" style={{ marginTop: '16px' }}>
            <Descriptions column={1}>
              <Descriptions.Item label="关闭原因">{record.close_reason}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {/* 工作流时间线 */}
        <Card
          title={
            <Space>
              <HistoryOutlined />
              <span>处理流程</span>
              {record.is_overdue === 1 && <Tag color="red">已超时</Tag>}
            </Space>
          }
          style={{ marginTop: '24px' }}
          loading={workflowLoading}
        >
          {workflow.length > 0 ? (
            <Timeline
              items={workflow.map((step, index) => ({
                color:
                  step.operation_result === '通过' || step.operation_result === '完成'
                    ? 'green'
                    : step.operation_result === '拒绝'
                      ? 'red'
                      : 'blue',
                dot: getWorkflowStepIcon(step.step_type),
                children: (
                  <div key={step.id || index}>
                    <div style={{ fontWeight: 500 }}>
                      {step.step_name}
                      <Tag
                        color={getWorkflowResultColor(step.operation_result)}
                        style={{ marginLeft: 8 }}
                      >
                        {step.operation_result}
                      </Tag>
                    </div>
                    <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                      <Space split={<Divider type="vertical" />}>
                        <span>操作人: {step.operator}</span>
                        <span>
                          {step.operation_time
                            ? dayjs(step.operation_time).format('YYYY-MM-DD HH:mm')
                            : '-'}
                        </span>
                      </Space>
                    </div>
                    {step.comment && (
                      <div
                        style={{
                          marginTop: 4,
                          padding: '4px 8px',
                          background: '#f5f5f5',
                          borderRadius: 4,
                          fontSize: 13,
                        }}
                      >
                        {step.comment}
                      </div>
                    )}
                    {step.next_handler && (
                      <div style={{ marginTop: 4, color: '#1890ff', fontSize: 12 }}>
                        下一步处理人: {step.next_handler}
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: '#999' }}>
              暂无处理流程记录
            </div>
          )}
        </Card>
      </Card>

      {/* 审批弹窗 */}
      <Modal
        title={approveAction === 'approve'
          ? (record.status === '待处理' ? '确认处理' : '确认完成处理')
          : '确认退回'}
        open={approveModalOpen}
        onOk={handleApprove}
        onCancel={() => { setApproveModalOpen(false); setApproveComment(''); }}
        confirmLoading={actionLoading}
        okText={approveAction === 'approve' ? '确认' : '确认退回'}
        okButtonProps={{ danger: approveAction === 'reject' }}
      >
        <p>
          {approveAction === 'approve'
            ? (record.status === '待处理'
                ? '确认开始处理此不良事件？'
                : '确认已完成此不良事件的处理？')
            : '确认退回此不良事件？'}
        </p>
        <Input.TextArea
          placeholder="请输入审批意见（可选）"
          rows={3}
          value={approveComment}
          onChange={e => setApproveComment(e.target.value)}
        />
      </Modal>

      {/* 关闭弹窗 */}
      <Modal
        title="关闭不良事件"
        open={closeModalOpen}
        onOk={handleClose}
        onCancel={() => { setCloseModalOpen(false); setCloseReason(''); }}
        confirmLoading={actionLoading}
        okText="确认关闭"
      >
        <p>确认关闭此不良事件？关闭后将不再允许修改。</p>
        <Input.TextArea
          placeholder="请输入关闭原因（可选）"
          rows={3}
          value={closeReason}
          onChange={e => setCloseReason(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default AdverseReactionDetail;
