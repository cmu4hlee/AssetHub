/**
 * 高风险操作示例组件
 *
 * @author Claude AI Assistant
 * @date 2026-05-01
 */

import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Space,
  Table,
  Modal,
  message,
  Alert,
  Divider,
  Typography,
} from 'antd';

import {
  createMaintenanceLog,
  createMaintenancePlan,
  createMaintenanceRequest,
  createMaintenanceWorkOrder,
  deleteMaintenanceLog,
  deleteMaintenancePlan,
  approveMaintenanceRequest,
} from '../utils/highRiskOperation';
import { useHighRiskOperation } from '../hooks/useHighRiskOperation';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

/**
 * 示例1: 使用工具函数
 */
export const ExampleWithToolFunctions = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const result = await createMaintenanceLog({
        ...values,
        maintenance_date: values.maintenance_date?.format('YYYY-MM-DD'),
      });

      if (result.success) {
        message.success('维修日志创建成功！');
        form.resetFields();
      } else {
        message.error(result.error || '创建失败');
      }
    } catch (error) {
      message.error('操作异常: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="示例1: 使用工具函数创建维修日志">
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="asset_code"
          label="资产编号"
          rules={[{ required: true, message: '请输入资产编号' }]}
        >
          <Input placeholder="例如: 000000555" />
        </Form.Item>

        <Form.Item
          name="maintenance_type"
          label="维修类型"
          rules={[{ required: true, message: '请选择维修类型' }]}
        >
          <Select placeholder="选择维修类型">
            <Option value="故障维修">故障维修</Option>
            <Option value="预防性维护">预防性维护</Option>
            <Option value="定期保养">定期保养</Option>
            <Option value="日常维护">日常维护</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="maintenance_date"
          label="维修日期"
          rules={[{ required: true, message: '请选择维修日期' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="maintenance_person"
          label="维修人员"
          rules={[{ required: true, message: '请输入维修人员' }]}
        >
          <Input placeholder="输入维修人员姓名" />
        </Form.Item>

        <Form.Item
          name="maintenance_content"
          label="维修内容"
          rules={[{ required: true, message: '请输入维修内容' }]}
        >
          <TextArea rows={3} placeholder="详细描述维修内容" />
        </Form.Item>

        <Form.Item name="maintenance_cost" label="维修成本">
          <InputNumber
            min={0}
            step={0.01}
            style={{ width: '100%' }}
            prefix="¥"
            placeholder="0.00"
          />
        </Form.Item>

        <Form.Item name="remark" label="备注">
          <TextArea rows={2} placeholder="其他备注信息" />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              创建维修日志
            </Button>
            <Button onClick={() => form.resetFields()}>重置</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

/**
 * 示例2: 使用React Hook
 */
export const ExampleWithHook = () => {
  const {
    createLog,
    deleteLog,
    loading,
    error,
    lastResult,
    reset,
  } = useHighRiskOperation({
    showConfirm: false,
    onSuccess: (data) => {
      message.success('操作成功！');
      console.log('操作结果:', data);
    },
    onError: (error) => {
      message.error('操作失败: ' + error.message);
    },
  });

  const [form] = Form.useForm();

  const handleCreate = async (values) => {
    const result = await createLog({
      ...values,
      maintenance_date: values.maintenance_date?.format('YYYY-MM-DD'),
    });

    if (result.success) {
      form.resetFields();
    }
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条维修日志吗？',
      onOk: async () => {
        await deleteLog(id, { showConfirm: false });
      },
    });
  };

  return (
    <Card title="示例2: 使用React Hook">
      {error && (
        <Alert title="错误"
          description={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} layout="vertical" onFinish={handleCreate}>
        <Form.Item name="asset_code" label="资产编号" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item name="maintenance_type" label="维修类型" rules={[{ required: true }]}>
          <Select>
            <Option value="故障维修">故障维修</Option>
            <Option value="预防性维护">预防性维护</Option>
          </Select>
        </Form.Item>

        <Form.Item name="maintenance_date" label="维修日期" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="maintenance_person" label="维修人员" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item name="maintenance_content" label="维修内容" rules={[{ required: true }]}>
          <TextArea rows={2} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            创建（Hook方式）
          </Button>
        </Form.Item>
      </Form>

      {lastResult && (
        <Alert title="最近操作结果"
          description={JSON.stringify(lastResult, null, 2)}
          type={lastResult.success ? 'success' : 'error'}
          style={{ marginTop: 16 }}
        />
      )}
    </Card>
  );
};

/**
 * 示例3: 带确认对话框的操作
 */
export const ExampleWithConfirmation = () => {
  const handleDelete = async (id) => {
    const result = await deleteMaintenanceLog(id, {
      showConfirm: true,
      confirmTitle: '危险操作确认',
      confirmContent: '删除操作不可恢复，确定要继续吗？',
    });

    if (result.success) {
      message.success('删除成功');
    } else if (!result.cancelled) {
      message.error(result.error);
    }
  };

  return (
    <Card title="示例3: 带确认对话框的删除操作">
      <Space orientation="vertical">
        <Text>点击删除按钮会显示确认对话框</Text>
        <Button danger onClick={() => handleDelete(123)}>
          删除记录 #123
        </Button>
      </Space>
    </Card>
  );
};

/**
 * 示例4: 批量操作
 */
export const ExampleWithBatchOperations = () => {
  const [selectedIds, setSelectedIds] = useState([]);
  const { execute, loading } = useHighRiskOperation();

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      message.warning('请先选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: `确认删除 ${selectedIds.length} 条记录`,
      content: '此操作不可恢复，确定要继续吗？',
      onOk: async () => {
        let successCount = 0;

        for (const id of selectedIds) {
          const result = await execute({
            method: 'DELETE',
            url: `/maintenance/logs/${id}`,
            showConfirm: false,
          });

          if (result.success) {
            successCount++;
          }
        }

        message.success(`成功删除 ${successCount}/${selectedIds.length} 条记录`);
        setSelectedIds([]);
      },
    });
  };

  return (
    <Card title="示例4: 批量删除操作">
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Text>已选择 {selectedIds.length} 条记录</Text>

        <Space>
          <Button
            type="primary"
            danger
            onClick={handleBatchDelete}
            loading={loading}
            disabled={selectedIds.length === 0}
          >
            批量删除
          </Button>

          <Button onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>
            清空选择
          </Button>
        </Space>

        <Text type="secondary">
          提示: 实际使用时，应该使用 Table 组件的 rowSelection 功能
        </Text>
      </Space>
    </Card>
  );
};

/**
 * 示例5: 完整的工作流
 */
export const ExampleWithWorkflow = () => {
  const { createRequest, approveRequest, loading } = useHighRiskOperation();
  const [requestId, setRequestId] = useState(null);

  const handleCreateRequest = async (values) => {
    const result = await createRequest({
      ...values,
      request_date: values.request_date?.format('YYYY-MM-DD'),
      expected_repair_date: values.expected_repair_date?.format('YYYY-MM-DD'),
    });

    if (result.success) {
      setRequestId(result.data.id);
      message.success('维修申请已创建，等待审批');
    }
  };

  const handleApprove = async () => {
    if (!requestId) return;

    const result = await approveRequest(requestId, true, '同意维修', {
      showConfirm: true,
    });

    if (result.success) {
      message.success('申请已批准');
    }
  };

  const [form] = Form.useForm();

  return (
    <Card title="示例5: 完整的维修申请工作流">
      {!requestId ? (
        <Form form={form} layout="vertical" onFinish={handleCreateRequest}>
          <Form.Item name="asset_code" label="资产编号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="fault_description" label="故障描述" rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item name="fault_level" label="故障等级" rules={[{ required: true }]}>
            <Select>
              <Option value="紧急">紧急</Option>
              <Option value="一般">一般</Option>
              <Option value="轻微">轻微</Option>
            </Select>
          </Form.Item>

          <Form.Item name="request_date" label="申请日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="expected_repair_date" label="期望维修日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              提交申请
            </Button>
          </Form.Item>
        </Form>
      ) : (
        <Space orientation="vertical">
          <Alert title="申请已创建"
            description={`申请ID: ${requestId}`}
            type="success"
            showIcon
          />

          <Button type="primary" onClick={handleApprove} loading={loading}>
            批准申请
          </Button>

          <Button onClick={() => setRequestId(null)}>重新申请</Button>
        </Space>
      )}
    </Card>
  );
};

/**
 * 主组件：展示所有示例
 */
const HighRiskOperationExample = () => {
  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>高风险操作示例</Title>
      <Text type="secondary">
        展示如何使用高风险操作工具和Hook进行维修维护相关操作
      </Text>

      <Divider />

      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <ExampleWithToolFunctions />
        <ExampleWithHook />
        <ExampleWithConfirmation />
        <ExampleWithBatchOperations />
        <ExampleWithWorkflow />
      </Space>
    </div>
  );
};

export default HighRiskOperationExample;
