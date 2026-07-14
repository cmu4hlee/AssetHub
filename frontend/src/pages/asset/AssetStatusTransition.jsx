/**
 * 资产详情 - 状态迁移模块
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  message,
  Divider,
  Empty,
} from 'antd';

import {
  SwapOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { assetAPI } from '../../utils/api';
import useIsMobile from '../../hooks/useIsMobile';

const { Option } = Select;
const { TextArea } = Input;

const ASSET_STATUSES = [
  { value: '在用', label: '在用', color: 'green' },
  { value: '闲置', label: '闲置', color: 'blue' },
  { value: '维修', label: '维修', color: 'orange' },
  { value: '报废', label: '报废', color: 'red' },
  { value: '借出', label: '借出', color: 'purple' },
  { value: '调配中', label: '调配中', color: 'cyan' },
];

const AssetStatusTransition = ({ assetId, asset, onRefresh }) => {
  const isMobile = useIsMobile();
  const [transitions, setTransitions] = useState([]);
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [transitionModalVisible, setTransitionModalVisible] = useState(false);
  const [transitionForm] = Form.useForm();
  const [transitionApplying, setTransitionApplying] = useState(false);

  const loadTransitions = async () => {
    if (!assetId) return;
    try {
      setTransitionLoading(true);
      const result = await assetAPI.getAssetTransitions(assetId);
      if (result.success) {
        setTransitions(result.data || []);
      }
    } catch (error) {
      console.error('加载状态迁移记录失败:', error);
    } finally {
      setTransitionLoading(false);
    }
  };

  useEffect(() => {
    if (assetId) {
      loadTransitions();
    }
  }, [assetId]);

  const handleApplyTransition = async () => {
    try {
      const values = await transitionForm.validateFields();
      if (!assetId || !asset) return;

      setTransitionApplying(true);
      const result = await assetAPI.applyAssetTransition(assetId, {
        transition_id: values.transition_id,
        reason: values.reason || '',
      });

      if (result.success) {
        message.success('状态迁移成功');
        setTransitionModalVisible(false);
        transitionForm.resetFields();
        loadTransitions();
        onRefresh?.();
      }
    } catch (error) {
      console.error('状态迁移失败:', error);
      if (error.errorFields) return;
      if (error.response?.status === 403) {
        message.error('权限不足，只有管理员可以操作');
      } else {
        message.error(error.response?.data?.message || '状态迁移失败');
      }
    } finally {
      setTransitionApplying(false);
    }
  };

  const getStatusColor = status => {
    const found = ASSET_STATUSES.find(s => s.value === status);
    return found?.color || 'default';
  };

  const transitionColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: date => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '迁移名称',
      dataIndex: 'transition_name',
      key: 'transition_name',
      width: 140,
      render: (value, record) => value || record.name || '-',
    },
    {
      title: '状态变更',
      key: 'status_change',
      width: 200,
      render: (_, record) => {
        const fromStatus = record.from_status || record.from_state;
        const toStatus = record.to_status || record.to_state;
        return (
          <Space>
            <Tag color={getStatusColor(fromStatus)}>{fromStatus}</Tag>
            <ArrowRightOutlined />
            <Tag color={getStatusColor(toStatus)}>{toStatus}</Tag>
          </Space>
        );
      },
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '要求原因',
      dataIndex: 'require_reason',
      key: 'require_reason',
      width: 100,
      render: required => <Tag color={required ? 'orange' : 'default'}>{required ? '必填' : '选填'}</Tag>,
    },
  ];

  const canTransition = asset?.status !== '报废';

  return (
    <Card
      title={
        <Space>
          <SwapOutlined />
          状态迁移
        </Space>
      }
      extra={
        canTransition && (
          <Button
            type="primary"
            icon={<SwapOutlined />}
            onClick={() => setTransitionModalVisible(true)}
            block={isMobile}
          >
            申请状态变更
          </Button>
        )
      }
      style={{ marginBottom: 16 }}
    >
      <div className="hide-on-mobile">
        <Table
          columns={transitionColumns}
          dataSource={transitions}
          rowKey="id"
          loading={transitionLoading}
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无状态迁移记录' }}
        />
      </div>
      <div className="mobile-table-cards show-on-mobile">
        {transitionLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
        ) : Array.isArray(transitions) && transitions.length > 0 ? (
          <>
            {transitions.map(record => {
              const fromStatus = record.from_status || record.from_state;
              const toStatus = record.to_status || record.to_state;
              return (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">
                      {record.transition_name || record.name || '-'}
                    </span>
                    <Tag color={record.require_reason ? 'orange' : 'default'}>
                      {record.require_reason ? '必填原因' : '选填原因'}
                    </Tag>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">状态变更</span>
                      <span className="mobile-card-value">
                        <Space>
                          <Tag color={getStatusColor(fromStatus)}>{fromStatus}</Tag>
                          <ArrowRightOutlined />
                          <Tag color={getStatusColor(toStatus)}>{toStatus}</Tag>
                        </Space>
                      </span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">时间</span>
                      <span className="mobile-card-value">{dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}</span>
                    </div>
                    {record.reason && (
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">原因</span>
                        <span className="mobile-card-value">{record.reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <Empty description="暂无状态迁移记录" />
        )}
      </div>

      <Modal
        title="申请状态变更"
        open={transitionModalVisible}
        onCancel={() => {
          setTransitionModalVisible(false);
          transitionForm.resetFields();
        }}
        onOk={handleApplyTransition}
        okText="确认变更"
        cancelText="取消"
        confirmLoading={transitionApplying}
        width={isMobile ? '95vw' : 500}
      >
        <Form form={transitionForm} layout="vertical">
          <Form.Item label="当前状态">
            <Tag color={getStatusColor(asset?.status)} style={{ fontSize: 14, padding: '4px 12px' }}>
              {asset?.status || '-'}
            </Tag>
          </Form.Item>

          <Form.Item
            name="transition_id"
            label="目标状态"
            rules={[{ required: true, message: '请选择目标状态' }]}
          >
            <Select placeholder="请选择目标状态">
              {transitions.map(transition => {
                const targetStatus = transition.to_state || transition.to_status;
                return (
                  <Option key={transition.id} value={transition.id}>
                    <Space>
                      <Tag color={getStatusColor(targetStatus)}>{targetStatus}</Tag>
                      {transition.transition_name || transition.name || ''}
                    </Space>
                  </Option>
                );
              })}
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.transition_id !== currentValues.transition_id}
          >
            {({ getFieldValue }) => {
              const selectedTransition = transitions.find(
                transition => transition.id === getFieldValue('transition_id')
              );
              return (
                <Form.Item
                  name="reason"
                  label="变更原因"
                  rules={selectedTransition?.require_reason ? [{ required: true, message: '请输入变更原因' }] : []}
                >
                  <TextArea
                    rows={3}
                    placeholder={selectedTransition?.require_reason ? '请输入状态变更原因' : '请输入状态变更原因（可选）'}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default AssetStatusTransition;
