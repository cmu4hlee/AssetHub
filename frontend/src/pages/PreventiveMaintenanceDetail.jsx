import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Button,
  Descriptions,
  Tag,
  message,
  Modal,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Select,
  Table,
  Progress,
  Alert,
  Space,
  Divider,
  Empty,
} from 'antd';
import {
  CheckCircleOutlined,
  ThunderboltOutlined,
  SwapOutlined,
  ArrowLeftOutlined,
  WarningOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { maintenanceAPI } from '../utils/api';
import { printPreventiveMaintenanceDetailReport } from '../utils/printReport';
import dayjs from 'dayjs';
import useIsMobile from '../hooks/useIsMobile';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const triggerTypeTag = type => {
  switch (type) {
    case 'time':
      return <Tag color="blue">按时间</Tag>;
    case 'usage':
      return <Tag color="orange">按使用量</Tag>;
    case 'condition':
      return <Tag color="purple">按条件</Tag>;
    default:
      return type ? <Tag>{type}</Tag> : '-';
  }
};

const statusTag = status => {
  switch (status) {
    case '启用':
      return <Tag color="green">启用</Tag>;
    case '禁用':
      return <Tag color="red">禁用</Tag>;
    default:
      return <Tag>{status}</Tag>;
  }
};

const PreventiveMaintenanceDetail = ({ record, onCancel }) => {
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState(record || {});
  const [loading, setLoading] = useState(false);
  const [templateInfo, setTemplateInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isCompleteModalVisible, setIsCompleteModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [completeForm] = Form.useForm();
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 10;

  useEffect(() => {
    setHistoryPage(1);
  }, [history]);

  // 加载详情数据
  useEffect(() => {
    if (record?.id) {
      const loadDetail = async () => {
        setLoading(true);
        try {
          const response = await maintenanceAPI.getMaintenancePlan(record.id);
          if (response.success !== false && response.data) {
            setDetail(response.data || {});
          } else if (response.success) {
            setDetail(response.data || {});
          } else {
            message.error('加载详情失败');
          }
        } catch (error) {
          console.error('加载详情失败:', error);
          message.error('网络错误，加载失败');
        } finally {
          setLoading(false);
        }
      };
      loadDetail();
    }
  }, [record?.id]);

  // 加载模板信息
  useEffect(() => {
    if (detail.template_id) {
      const loadTemplate = async () => {
        try {
          const response = await maintenanceAPI.getMaintenanceTemplate(detail.template_id);
          if (response.success !== false && response.data) {
            setTemplateInfo(response.data);
          } else if (response.data) {
            setTemplateInfo(response.data);
          }
        } catch (error) {
          console.error('加载模板信息失败:', error);
        }
      };
      loadTemplate();
    }
  }, [detail.template_id]);

  // 加载维护历史
  useEffect(() => {
    if (record?.id) {
      const loadHistory = async () => {
        setHistoryLoading(true);
        try {
          const response = await maintenanceAPI.getMaintenancePlanHistory(record.id);
          if (response.success !== false) {
            const data = response.data || response.items || response || [];
            setHistory(Array.isArray(data) ? data : []);
          } else {
            setHistory([]);
          }
        } catch (error) {
          console.error('加载维护历史失败:', error);
          setHistory([]);
        } finally {
          setHistoryLoading(false);
        }
      };
      loadHistory();
    }
  }, [record?.id]);

  // 判断是否逾期
  const isOverdue =
    detail.next_maintenance_date &&
    dayjs(detail.next_maintenance_date).isBefore(dayjs(), 'day');

  // 使用量进度百分比
  const usagePercent = () => {
    if (
      detail.trigger_type === 'usage' &&
      detail.usage_threshold &&
      Number(detail.usage_threshold) > 0
    ) {
      const current = Number(detail.current_usage) || 0;
      const threshold = Number(detail.usage_threshold);
      return Math.min(Math.round((current / threshold) * 100), 100);
    }
    return 0;
  };

  // 处理完成维护
  const handleComplete = () => {
    completeForm.resetFields();
    completeForm.setFieldsValue({
      maintenance_date: dayjs(),
      maintenance_person: detail.responsible_person || '',
    });
    setIsCompleteModalVisible(true);
  };

  // 处理完成提交
  const handleCompleteSubmit = async values => {
    setActionLoading(true);
    try {
      const submitData = {
        ...values,
        maintenance_date: values.maintenance_date
          ? dayjs(values.maintenance_date).format('YYYY-MM-DD')
          : undefined,
      };
      const response = await maintenanceAPI.completeMaintenancePlan(detail.id, submitData);
      if (response.success !== false) {
        message.success('维护完成成功');
        setIsCompleteModalVisible(false);
        // 重新加载详情
        const detailResponse = await maintenanceAPI.getMaintenancePlan(detail.id);
        if (detailResponse.data) {
          setDetail(detailResponse.data);
        }
        // 重新加载历史
        const historyResponse = await maintenanceAPI.getMaintenancePlanHistory(detail.id);
        if (historyResponse.data || historyResponse.items) {
          const data = historyResponse.data || historyResponse.items || [];
          setHistory(Array.isArray(data) ? data : []);
        }
      } else {
        message.error(response.message || '维护完成失败');
      }
    } catch (error) {
      console.error('维护完成失败:', error);
      message.error('网络错误，操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 立即执行
  const handleTrigger = async () => {
    setActionLoading(true);
    try {
      const response = await maintenanceAPI.triggerMaintenancePlan(detail.id, {
        trigger_type: detail.trigger_type || 'manual',
      });
      if (response.success !== false) {
        message.success('已触发执行');
        const detailResponse = await maintenanceAPI.getMaintenancePlan(detail.id);
        if (detailResponse.data) {
          setDetail(detailResponse.data);
        }
      } else {
        message.error(response.message || '触发执行失败');
      }
    } catch (error) {
      console.error('触发执行失败:', error);
      message.error('网络错误，操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 启用/禁用切换
  const handleToggleStatus = async () => {
    setActionLoading(true);
    const newStatus = detail.status === '启用' ? '禁用' : '启用';
    try {
      const response = await maintenanceAPI.updateMaintenancePlan(detail.id, {
        status: newStatus,
      });
      if (response.success !== false) {
        message.success(`已${newStatus}`);
        const detailResponse = await maintenanceAPI.getMaintenancePlan(detail.id);
        if (detailResponse.data) {
          setDetail(detailResponse.data);
        }
      } else {
        message.error(response.message || `${newStatus}失败`);
      }
    } catch (error) {
      console.error(`${newStatus}失败:`, error);
      message.error('网络错误，操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 打印报表
  const handlePrintReport = () => {
    if (!detail) {
      message.warning('暂无数据可打印');
      return;
    }
    printPreventiveMaintenanceDetailReport(detail, history, templateInfo);
  };

  // 历史表格列
  const historyColumns = [
    {
      title: '维护日期',
      dataIndex: 'maintenance_date',
      key: 'maintenance_date',
      width: 120,
      render: val => (val ? dayjs(val).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '维护人员',
      dataIndex: 'maintenance_person',
      key: 'maintenance_person',
      width: 100,
    },
    {
      title: '实际工时',
      dataIndex: 'actual_hours',
      key: 'actual_hours',
      width: 90,
      render: val => (val != null ? `${val} 小时` : '-'),
    },
    {
      title: '维护结果',
      dataIndex: 'maintenance_result',
      key: 'maintenance_result',
      width: 100,
      render: val => {
        if (!val) return '-';
        const colorMap = { 正常: 'green', 异常: 'red', 需跟进: 'orange' };
        return <Tag color={colorMap[val] || 'default'}>{val}</Tag>;
      },
    },
    {
      title: '维护费用',
      dataIndex: 'maintenance_cost',
      key: 'maintenance_cost',
      width: 100,
      render: val => (val != null ? `¥${Number(val).toLocaleString()}` : '-'),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
  ];

  const formatDate = val => (val ? dayjs(val).format('YYYY-MM-DD') : '-');
  const formatDateTime = val => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-');

  return (
    <div style={{ padding: '20px' }}>
      {/* 逾期警告 */}
      {isOverdue && (
        <Alert
          message="维护已逾期"
          description={`下次维护日期 ${formatDate(detail.next_maintenance_date)} 已过，请尽快安排维护！`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 操作按钮 */}
      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          {detail.status === '启用' && (
            <>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleComplete}
                loading={actionLoading}
              >
                完成维护
              </Button>
              <Button
                icon={<ThunderboltOutlined />}
                onClick={handleTrigger}
                loading={actionLoading}
              >
                立即执行
              </Button>
            </>
          )}
          <Button
            icon={<SwapOutlined />}
            onClick={handleToggleStatus}
            loading={actionLoading}
          >
            {detail.status === '启用' ? '禁用' : '启用'}
          </Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrintReport}>
            打印报表
          </Button>
          <Button icon={<ArrowLeftOutlined />} onClick={onCancel}>
            返回
          </Button>
        </Space>
      </Card>

      {/* 基本信息 */}
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={isMobile ? 1 : 2}>
          <Descriptions.Item label="计划名称">{detail.plan_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">{statusTag(detail.status)}</Descriptions.Item>
          <Descriptions.Item label="资产编号">{detail.asset_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="资产名称">{detail.asset_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="维护类型">{detail.maintenance_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="触发类型">{triggerTypeTag(detail.trigger_type)}</Descriptions.Item>
          <Descriptions.Item label="维护周期">
            {detail.cycle_value && detail.cycle_type
              ? `${detail.cycle_value} ${detail.cycle_type}`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="自动生成工单">
            {detail.auto_generate_workorder === true || detail.auto_generate_workorder === 'true' ? (
              <Tag color="green">是</Tag>
            ) : (
              <Tag color="default">否</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="下次维护日期">
            {isOverdue ? (
              <Text type="danger">{formatDate(detail.next_maintenance_date)}</Text>
            ) : (
              formatDate(detail.next_maintenance_date)
            )}
          </Descriptions.Item>
          <Descriptions.Item label="上次维护日期">
            {formatDate(detail.last_maintenance_date)}
          </Descriptions.Item>
          <Descriptions.Item label="责任人">{detail.responsible_person || '-'}</Descriptions.Item>
          <Descriptions.Item label="预计工时">
            {detail.estimated_hours ? `${detail.estimated_hours} 小时` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="维护内容" span={2}>
            <Paragraph style={{ margin: 0 }}>{detail.maintenance_content || '-'}</Paragraph>
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>
            <Paragraph style={{ margin: 0 }}>{detail.remark || '-'}</Paragraph>
          </Descriptions.Item>
          <Descriptions.Item label="创建人">{detail.created_by || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatDateTime(detail.created_at)}</Descriptions.Item>
          <Descriptions.Item label="更新时间" span={2}>{formatDateTime(detail.updated_at)}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 使用量进度（仅 trigger_type=usage 时显示） */}
      {detail.trigger_type === 'usage' && (
        <Card title="使用量信息" style={{ marginBottom: 16 }}>
          <Descriptions bordered column={isMobile ? 1 : 2}>
            <Descriptions.Item label="当前使用量">
              {detail.current_usage != null ? Number(detail.current_usage).toLocaleString() : '0'}
            </Descriptions.Item>
            <Descriptions.Item label="使用量阈值">
              {detail.usage_threshold != null
                ? Number(detail.usage_threshold).toLocaleString()
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="使用量进度" span={2}>
              <Progress
                percent={usagePercent()}
                status={usagePercent() >= 100 ? 'exception' : usagePercent() >= 80 ? 'active' : 'normal'}
                format={() =>
                  `${detail.current_usage || 0} / ${detail.usage_threshold || 0}`
                }
              />
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 模板信息 */}
      {templateInfo && (
        <Card title="关联模板" style={{ marginBottom: 16 }}>
          <Descriptions bordered column={isMobile ? 1 : 2}>
            <Descriptions.Item label="模板名称">
              {templateInfo.template_name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="资产类型">
              {templateInfo.asset_type || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="品牌">
              {templateInfo.brand || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="型号">
              {templateInfo.model || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 维护历史 */}
      <Card title="维护历史">
        <div className="hide-on-mobile">
          <Table
            columns={historyColumns}
            dataSource={history}
            rowKey="id"
            loading={historyLoading}
            size="middle"
            pagination={history.length > 10 ? { pageSize: 10 } : false}
            locale={{ emptyText: '暂无维护历史记录' }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
              加载中...
            </div>
          ) : Array.isArray(history) && history.length > 0 ? (
            <>
              {history
                .slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize)
                .map((record, index) => (
                  <div key={record.id || index} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">
                        {record.maintenance_date
                          ? dayjs(record.maintenance_date).format('YYYY-MM-DD')
                          : '-'}
                      </span>
                      {record.maintenance_result ? (
                        <Tag
                          color={
                            {
                              正常: 'green',
                              异常: 'red',
                              需跟进: 'orange',
                            }[record.maintenance_result] || 'default'
                          }
                        >
                          {record.maintenance_result}
                        </Tag>
                      ) : null}
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">维护人员</span>
                        <span className="mobile-card-value">
                          {record.maintenance_person || '-'}
                        </span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">实际工时</span>
                        <span className="mobile-card-value">
                          {record.actual_hours != null
                            ? `${record.actual_hours} 小时`
                            : '-'}
                        </span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">维护费用</span>
                        <span className="mobile-card-value">
                          {record.maintenance_cost != null
                            ? `¥${Number(record.maintenance_cost).toLocaleString()}`
                            : '-'}
                        </span>
                      </div>
                      {record.remark && (
                        <div
                          className="mobile-card-field"
                          style={{ gridColumn: '1 / -1' }}
                        >
                          <span className="mobile-card-label">备注</span>
                          <span className="mobile-card-value">{record.remark}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              {/* 移动端分页 */}
              {history.length > historyPageSize && (
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <Space>
                    <Button
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage(historyPage - 1)}
                    >
                      上一页
                    </Button>
                    <span>
                      第 {historyPage} /{' '}
                      {Math.ceil(history.length / historyPageSize) || 1} 页
                    </span>
                    <Button
                      disabled={
                        historyPage >= Math.ceil(history.length / historyPageSize)
                      }
                      onClick={() => setHistoryPage(historyPage + 1)}
                    >
                      下一页
                    </Button>
                  </Space>
                  <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                    共 {history.length} 条
                  </div>
                </div>
              )}
            </>
          ) : (
            <Empty description="暂无维护历史记录" />
          )}
        </div>
      </Card>

      {/* 完成维护模态框 */}
      <Modal
        title="完成维护"
        open={isCompleteModalVisible}
        onOk={() => completeForm.submit()}
        onCancel={() => setIsCompleteModalVisible(false)}
        confirmLoading={actionLoading}
        width={isMobile ? '95vw' : 640}
        destroyOnHidden
      >
        <Form
          form={completeForm}
          layout="vertical"
          initialValues={{
            maintenance_date: dayjs(),
            maintenance_person: detail.responsible_person || '',
          }}
          onFinish={handleCompleteSubmit}
        >
          <Form.Item
            name="maintenance_date"
            label="维护日期"
            rules={[{ required: true, message: '请选择维护日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="请选择维护日期" />
          </Form.Item>
          <Form.Item
            name="maintenance_person"
            label="维护人员"
            rules={[{ required: true, message: '请输入维护人员' }]}
          >
            <Input placeholder="请输入维护人员" />
          </Form.Item>
          <Form.Item name="maintenance_content" label="维护内容">
            <TextArea rows={4} placeholder="请输入维护内容" />
          </Form.Item>
          <Form.Item name="maintenance_result" label="维护结果">
            <Select placeholder="请选择维护结果" allowClear>
              <Select.Option value="正常">正常</Select.Option>
              <Select.Option value="异常">异常</Select.Option>
              <Select.Option value="需跟进">需跟进</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="maintenance_cost" label="维护费用（元）">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入维护费用"
            />
          </Form.Item>
          <Form.Item name="parts_replaced" label="更换零件">
            <TextArea rows={2} placeholder="请输入更换零件信息" />
          </Form.Item>
          <Form.Item name="actual_hours" label="实际工时（小时）">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={1}
              placeholder="请输入实际工时"
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PreventiveMaintenanceDetail;
