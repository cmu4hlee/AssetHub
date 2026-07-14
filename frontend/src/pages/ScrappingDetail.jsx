import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Descriptions, Tag, Button, Space, Spin, message, Modal,
  Form, Input, Timeline, Divider,
  Empty, Tabs, Typography, Popconfirm, Result
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, FileTextOutlined,
  InboxOutlined, PrinterOutlined, ContainerOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { scrappingAPI } from '../utils/api';
import { printScrappingReport } from '../utils/printReport';

const { TextArea } = Input;
const { Text } = Typography;

const statusMap = {
  pending: { text: '待处理', color: 'default', icon: <ClockCircleOutlined /> },
  appraising: { text: '鉴定中', color: 'processing', icon: <FileTextOutlined /> },
  approved: { text: '已批准', color: 'success', icon: <CheckCircleOutlined /> },
  rejected: { text: '已拒绝', color: 'error', icon: <CloseCircleOutlined /> },
  disposing: { text: '处置中', color: 'warning', icon: <InboxOutlined /> },
  completed: { text: '已完成', color: 'success', icon: <CheckCircleOutlined /> },
  archived: { text: '已归档', color: 'blue', icon: <ContainerOutlined /> },
  cancelled: { text: '已取消', color: 'default', icon: <CloseCircleOutlined /> },
};

const ScrappingDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // 弹窗状态
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [archiveForm] = Form.useForm();

  // 获取当前用户信息
  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
      }
    } catch (_e) {
      // 忽略解析错误
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await scrappingAPI.getScrappingRecord(id);
      if (result.success) {
        setRecord(result.data);
      } else {
        message.error(result.message || '获取数据失败');
      }
    } catch (error) {
      message.error('获取报废记录详情失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 审批通过
  const handleApprove = async () => {
    try {
      const values = await approveForm.validateFields();
      setActionLoading(true);
      const result = await scrappingAPI.approveScrapping(id, {
        ...values,
        approver: currentUser?.username || currentUser?.name,
        approver_id: currentUser?.id,
        approval_status: 'approved',
      });
      if (result.success) {
        message.success('审批通过');
        setApproveModalVisible(false);
        approveForm.resetFields();
        fetchData();
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      if (error?.errorFields) return; // 表单校验错误
      message.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 驳回
  const handleReject = async () => {
    try {
      const values = await rejectForm.validateFields();
      setActionLoading(true);
      const result = await scrappingAPI.rejectScrapping(id, {
        ...values,
        approver: currentUser?.username || currentUser?.name,
        approver_id: currentUser?.id,
      });
      if (result.success) {
        message.success('已驳回');
        setRejectModalVisible(false);
        rejectForm.resetFields();
        fetchData();
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      if (error?.errorFields) return;
      message.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 归档
  const handleArchive = async () => {
    try {
      const values = await archiveForm.validateFields();
      setActionLoading(true);
      const result = await scrappingAPI.archiveScrapping(id, {
        ...values,
        archived_by: currentUser?.username || currentUser?.name,
        archived_by_id: currentUser?.id,
      });
      if (result.success) {
        message.success('归档成功');
        setArchiveModalVisible(false);
        archiveForm.resetFields();
        fetchData();
      } else {
        message.error(result.message || '归档失败');
      }
    } catch (error) {
      if (error?.errorFields) return;
      message.error('归档失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 完成处置
  const handleComplete = async () => {
    try {
      setActionLoading(true);
      const result = await scrappingAPI.completeScrapping(id);
      if (result.success) {
        message.success('已完成处置');
        fetchData();
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 构建流程时间线
  const buildTimeline = () => {
    if (!record) return [];
    const items = [];

    // 申请阶段
    items.push({
      color: 'green',
      icon: <FileTextOutlined />,
      children: (
        <div>
          <Text strong>提交报废申请</Text>
          <br />
          <Text type="secondary">申请人: {record.applicant || '-'}</Text>
          <br />
          <Text type="secondary">申请日期: {record.apply_date ? dayjs(record.apply_date).format('YYYY-MM-DD HH:mm') : '-'}</Text>
          <br />
          <Text type="secondary">报废原因: {record.scrapping_reason || '-'}</Text>
        </div>
      ),
    });

    // 鉴定阶段
    if (record.appraisals && record.appraisals.length > 0) {
      record.appraisals.forEach((appraisal) => {
        items.push({
          color: 'blue',
          icon: <FileTextOutlined />,
          children: (
            <div>
              <Text strong>技术鉴定</Text>
              <br />
              <Text type="secondary">鉴定人: {appraisal.appraiser || '-'}</Text>
              <br />
              <Text type="secondary">鉴定日期: {appraisal.appraisal_date ? dayjs(appraisal.appraisal_date).format('YYYY-MM-DD HH:mm') : '-'}</Text>
              <br />
              <Text type="secondary">技术状况: {appraisal.technical_condition || '-'}</Text>
              <br />
              <Text type="secondary">鉴定结果: {appraisal.appraisal_result || '-'}</Text>
            </div>
          ),
        });
      });
    }

    // 审批阶段
    if (record.approvals && record.approvals.length > 0) {
      record.approvals.forEach((approval) => {
        const isApproved = approval.approval_status === 'approved';
        items.push({
          color: isApproved ? 'green' : 'red',
          icon: isApproved ? <CheckCircleOutlined /> : <CloseCircleOutlined />,
          children: (
            <div>
              <Text strong>{isApproved ? '审批通过' : '审批驳回'}</Text>
              <br />
              <Text type="secondary">审批人: {approval.approver || '-'}</Text>
              <br />
              <Text type="secondary">审批日期: {approval.approval_date ? dayjs(approval.approval_date).format('YYYY-MM-DD HH:mm') : '-'}</Text>
              {approval.approval_comment && (
                <>
                  <br />
                  <Text type="secondary">审批意见: {approval.approval_comment}</Text>
                </>
              )}
            </div>
          ),
        });
      });
    } else if (record.current_status === 'pending' || record.current_status === 'appraising') {
      items.push({
        color: 'gray',
        icon: <ClockCircleOutlined />,
        children: <Text type="secondary">等待审批</Text>,
      });
    }

    // 处置阶段
    if (record.disposals && record.disposals.length > 0) {
      record.disposals.forEach((disposal) => {
        items.push({
          color: 'orange',
          icon: <InboxOutlined />,
          children: (
            <div>
              <Text strong>资产处置</Text>
              <br />
              <Text type="secondary">处置人: {disposal.disposer || '-'}</Text>
              <br />
              <Text type="secondary">处置日期: {disposal.disposal_date ? dayjs(disposal.disposal_date).format('YYYY-MM-DD HH:mm') : '-'}</Text>
              <br />
              <Text type="secondary">处置方式: {disposal.disposal_method || '-'}</Text>
              <br />
              <Text type="secondary">处置结果: {disposal.disposal_result || '-'}</Text>
              {disposal.actual_value != null && (
                <>
                  <br />
                  <Text type="secondary">实际残值: ¥{disposal.actual_value}</Text>
                </>
              )}
            </div>
          ),
        });
      });
    }

    // 完成阶段
    if (['completed', 'archived'].includes(record.current_status)) {
      items.push({
        color: 'green',
        icon: <CheckCircleOutlined />,
        children: (
          <div>
            <Text strong>处置完成</Text>
            <br />
            <Text type="secondary">资产状态已更新为"报废"</Text>
          </div>
        ),
      });
    }

    // 归档阶段
    if (record.current_status === 'archived') {
      items.push({
        color: 'blue',
        icon: <ContainerOutlined />,
        children: (
          <div>
            <Text strong>归档</Text>
            <br />
            <Text type="secondary">归档编号: {record.archive_no || '-'}</Text>
            <br />
            <Text type="secondary">归档人: {record.archived_by || '-'}</Text>
            <br />
            <Text type="secondary">归档时间: {record.archived_at ? dayjs(record.archived_at).format('YYYY-MM-DD HH:mm') : '-'}</Text>
            {record.archive_location && (
              <>
                <br />
                <Text type="secondary">归档位置: {record.archive_location}</Text>
              </>
            )}
            {record.archive_remark && (
              <>
                <br />
                <Text type="secondary">归档备注: {record.archive_remark}</Text>
              </>
            )}
          </div>
        ),
      });
    } else if (record.current_status === 'completed') {
      items.push({
        color: 'gray',
        icon: <ClockCircleOutlined />,
        children: <Text type="secondary">待归档</Text>,
      });
    }

    return items;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!record) {
    return (
      <Result
        status="404"
        title="记录不存在"
        subTitle="该报废记录可能已被删除或不存在"
        extra={<Button type="primary" onClick={() => navigate('/scrapping')}>返回列表</Button>}
      />
    );
  }

  const statusInfo = statusMap[record.current_status] || { text: record.current_status, color: 'default' };

  // 判断可执行的操作
  const canApprove = ['pending', 'appraising'].includes(record.current_status);
  const canComplete = record.current_status === 'disposing';
  const canArchive = record.current_status === 'completed';

  return (
    <div style={{ padding: '0' }}>
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/scrapping')}>返回</Button>
            <span>报废申请详情</span>
            <Tag color={statusInfo.color} icon={statusInfo.icon}>{statusInfo.text}</Tag>
          </Space>
        }
        extra={
          <Button icon={<PrinterOutlined />} onClick={() => printScrappingReport([record])}>
            打印
          </Button>
        }
      >
        <Tabs
          items={[
            {
              key: 'info',
              label: '基本信息',
              children: (
                <>
                  <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="资产编号">{record.asset_code || '-'}</Descriptions.Item>
                    <Descriptions.Item label="资产名称">{record.asset_name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="资产型号">{record.asset_model || '-'}</Descriptions.Item>
                    <Descriptions.Item label="使用部门">{record.department || '-'}</Descriptions.Item>
                    <Descriptions.Item label="申请人">{record.applicant || '-'}</Descriptions.Item>
                    <Descriptions.Item label="申请日期">
                      {record.apply_date ? dayjs(record.apply_date).format('YYYY-MM-DD') : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="预估残值">
                      {record.estimated_value != null ? `¥${record.estimated_value}` : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="当前状态">
                      <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="报废原因" span={2}>
                      {record.scrapping_reason || '-'}
                    </Descriptions.Item>
                    {record.remark && (
                      <Descriptions.Item label="备注" span={2}>{record.remark}</Descriptions.Item>
                    )}
                  </Descriptions>

                  {/* 审批信息 */}
                  {(record.approver || record.approval_date) && (
                    <>
                      <Divider titlePlacement="left">审批信息</Divider>
                      <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="审批人">{record.approver || '-'}</Descriptions.Item>
                        <Descriptions.Item label="审批日期">
                          {record.approval_date ? dayjs(record.approval_date).format('YYYY-MM-DD HH:mm') : '-'}
                        </Descriptions.Item>
                        {record.approval_comment && (
                          <Descriptions.Item label="审批意见" span={2}>{record.approval_comment}</Descriptions.Item>
                        )}
                      </Descriptions>
                    </>
                  )}

                  {/* 归档信息 */}
                  {record.current_status === 'archived' && (
                    <>
                      <Divider titlePlacement="left">归档信息</Divider>
                      <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="归档编号">{record.archive_no || '-'}</Descriptions.Item>
                        <Descriptions.Item label="归档人">{record.archived_by || '-'}</Descriptions.Item>
                        <Descriptions.Item label="归档时间">
                          {record.archived_at ? dayjs(record.archived_at).format('YYYY-MM-DD HH:mm') : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="归档位置">{record.archive_location || '-'}</Descriptions.Item>
                        {record.archive_remark && (
                          <Descriptions.Item label="归档备注" span={2}>{record.archive_remark}</Descriptions.Item>
                        )}
                      </Descriptions>
                    </>
                  )}

                  {/* 附件列表 */}
                  {record.files && record.files.length > 0 && (
                    <>
                      <Divider titlePlacement="left">相关文件</Divider>
                      <Space orientation="vertical" style={{ width: '100%' }}>
                        {record.files.map(file => (
                          <div key={file.id} style={{ padding: '8px 12px', background: '#fafafa', borderRadius: 4 }}>
                            <Space>
                              <FileTextOutlined />
                              <span>{file.file_name}</span>
                              <Tag>{file.file_type}</Tag>
                              <Text type="secondary">
                                {file.uploaded_at ? dayjs(file.uploaded_at).format('YYYY-MM-DD') : '-'}
                              </Text>
                            </Space>
                          </div>
                        ))}
                      </Space>
                    </>
                  )}

                  {/* 操作按钮区 */}
                  <Divider titlePlacement="left">操作</Divider>
                  <Space wrap>
                    {canApprove && (
                      <>
                        <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setApproveModalVisible(true)}>
                          审批通过
                        </Button>
                        <Button danger icon={<CloseCircleOutlined />} onClick={() => setRejectModalVisible(true)}>
                          驳回
                        </Button>
                      </>
                    )}
                    {canComplete && (
                      <Popconfirm title="确认完成处置？完成后资产状态将更新为报废。" onConfirm={handleComplete}>
                        <Button type="primary" icon={<CheckCircleOutlined />} loading={actionLoading}>
                          完成处置
                        </Button>
                      </Popconfirm>
                    )}
                    {canArchive && (
                      <Button type="primary" icon={<ContainerOutlined />} onClick={() => setArchiveModalVisible(true)}>
                        归档
                      </Button>
                    )}
                    {!canApprove && !canComplete && !canArchive && (
                      <Text type="secondary">当前状态无可用操作</Text>
                    )}
                  </Space>
                </>
              ),
            },
            {
              key: 'timeline',
              label: '流程时间线',
              children: (
                <Card>
                  {buildTimeline().length > 0 ? (
                    <Timeline items={buildTimeline()} />
                  ) : (
                    <Empty description="暂无流程记录" />
                  )}
                </Card>
              ),
            },
          ]}
        />
      </Card>

      {/* 审批通过弹窗 */}
      <Modal
        title="审批通过"
        open={approveModalVisible}
        onOk={handleApprove}
        onCancel={() => { setApproveModalVisible(false); approveForm.resetFields(); }}
        confirmLoading={actionLoading}
        okText="确认通过"
        cancelText="取消"
      >
        <Form form={approveForm} layout="vertical">
          <Form.Item name="approval_comment" label="审批意见">
            <TextArea rows={3} placeholder="请输入审批意见（可选）" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 驳回弹窗 */}
      <Modal
        title="驳回申请"
        open={rejectModalVisible}
        onOk={handleReject}
        onCancel={() => { setRejectModalVisible(false); rejectForm.resetFields(); }}
        confirmLoading={actionLoading}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="approval_comment"
            label="驳回原因"
            rules={[{ required: true, message: '请输入驳回原因' }]}
          >
            <TextArea rows={3} placeholder="请输入驳回原因" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 归档弹窗 */}
      <Modal
        title="归档"
        open={archiveModalVisible}
        onOk={handleArchive}
        onCancel={() => { setArchiveModalVisible(false); archiveForm.resetFields(); }}
        confirmLoading={actionLoading}
        okText="确认归档"
        cancelText="取消"
      >
        <Form form={archiveForm} layout="vertical">
          <Form.Item name="archive_location" label="归档位置">
            <Input placeholder="请输入归档位置（如：档案柜A-01）" maxLength={255} />
          </Form.Item>
          <Form.Item name="archive_remark" label="归档备注">
            <TextArea rows={3} placeholder="请输入归档备注（可选）" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ScrappingDetail;
