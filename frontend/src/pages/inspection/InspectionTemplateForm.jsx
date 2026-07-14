/**
 * 巡检模板表单（含检查项配置）
 */

import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Select, InputNumber, Button, Space, message,
  Row, Col, Table, Tag, Divider, Switch,
} from 'antd';
import {
  PlusOutlined, MinusCircleOutlined, SaveOutlined, ArrowLeftOutlined,
  ProfileOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { inspectionAPI } from '../../utils/api';

const { Option } = Select;
const { TextArea } = Input;

const inspectionTypeMap = {
  daily: '日常巡检', weekly: '周巡检', monthly: '月巡检',
  quarterly: '季巡检', special: '专项巡检',
};

const itemCategoryMap = {
  appearance: '外观', function: '功能', safety: '安全',
  environment: '环境', performance: '性能',
};

const InspectionTemplateForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit) {
      inspectionAPI.getTemplate(id).then(res => {
        if (res?.success && res.data) {
          form.setFieldsValue({
            ...res.data,
            items: (res.data.items || []).map((item, idx) => ({ ...item, key: idx })),
          });
        }
      }).catch(() => message.error('加载模板失败'));
    } else {
      form.setFieldsValue({
        inspection_type: 'daily',
        cycle_days: 30,
        status: 'active',
        items: [],
      });
    }
  }, [id, isEdit, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const payload = {
        ...values,
        items: (values.items || []).map((item, idx) => ({
          ...item,
          item_code: item.item_code || `ITEM-${String(idx + 1).padStart(3, '0')}`,
          sort_order: idx,
        })),
      };
      if (isEdit) {
        await inspectionAPI.updateTemplate(id, payload);
        message.success('更新成功');
      } else {
        await inspectionAPI.createTemplate(payload);
        message.success('创建成功');
      }
      navigate('/inspection/templates');
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    const items = form.getFieldValue('items') || [];
    form.setFieldsValue({
      items: [...items, {
        key: Date.now(),
        item_name: '',
        item_category: 'appearance',
        is_required: true,
        sort_order: items.length,
      }],
    });
  };

  const itemColumns = [
    {
      title: '序号', width: 60,
      render: (_, __, idx) => idx + 1,
    },
    {
      title: '检查项名称', width: 200,
      render: (_, record, idx) => (
        <Form.Item
          name={['items', idx, 'item_name']}
          rules={[{ required: true, message: '请输入' }]}
          style={{ marginBottom: 0 }}
        >
          <Input placeholder="检查项名称" />
        </Form.Item>
      ),
    },
    {
      title: '类别', width: 120,
      render: (_, record, idx) => (
        <Form.Item name={['items', idx, 'item_category']} style={{ marginBottom: 0 }}>
          <Select>
            {Object.entries(itemCategoryMap).map(([k, v]) => (
              <Option key={k} value={k}>{v}</Option>
            ))}
          </Select>
        </Form.Item>
      ),
    },
    {
      title: '检查方法', width: 180,
      render: (_, record, idx) => (
        <Form.Item name={['items', idx, 'check_method']} style={{ marginBottom: 0 }}>
          <Input placeholder="如：目视检查、仪器测量" />
        </Form.Item>
      ),
    },
    {
      title: '检查标准', width: 200,
      render: (_, record, idx) => (
        <Form.Item name={['items', idx, 'check_standard']} style={{ marginBottom: 0 }}>
          <Input placeholder="判定依据" />
        </Form.Item>
      ),
    },
    {
      title: '期望值', width: 150,
      render: (_, record, idx) => (
        <Form.Item name={['items', idx, 'expected_value']} style={{ marginBottom: 0 }}>
          <Input placeholder="参考范围" />
        </Form.Item>
      ),
    },
    {
      title: '单位', width: 80,
      render: (_, record, idx) => (
        <Form.Item name={['items', idx, 'unit']} style={{ marginBottom: 0 }}>
          <Input placeholder="单位" />
        </Form.Item>
      ),
    },
    {
      title: '必检', width: 60,
      render: (_, record, idx) => (
        <Form.Item name={['items', idx, 'is_required']} valuePropName="checked" style={{ marginBottom: 0 }}>
          <Switch size="small" />
        </Form.Item>
      ),
    },
    {
      title: '操作', width: 60,
      render: (_, record, idx) => (
        <Button
          type="link"
          danger
          icon={<MinusCircleOutlined />}
          onClick={() => {
            const items = form.getFieldValue('items') || [];
            items.splice(idx, 1);
            form.setFieldsValue({ items });
          }}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inspection/templates')}>
            返回
          </Button>
          <h2 style={{ margin: 0 }}>
            <ProfileOutlined /> {isEdit ? '编辑巡检模板' : '新建巡检模板'}
          </h2>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Card title="模板基本信息" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="template_code" label="模板编号" rules={[{ required: true, message: '请输入' }]}>
                <Input placeholder="如：TPL-DAILY-001" disabled={isEdit} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="template_name" label="模板名称" rules={[{ required: true, message: '请输入' }]}>
                <Input placeholder="如：ICU设备日常巡检模板" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="inspection_type" label="巡检类型" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(inspectionTypeMap).map(([k, v]) => (
                    <Option key={k} value={k}>{v}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="cycle_days" label="巡检周期(天)">
                <InputNumber min={1} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="applicable_scope" label="适用范围">
                <Input placeholder="如：所有ICU设备、放射科设备等" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="状态">
                <Select>
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="模板说明">
            <TextArea rows={2} placeholder="模板用途及使用说明" />
          </Form.Item>
        </Card>

        <Card
          title="检查项配置"
          size="small"
          style={{ marginBottom: 16 }}
          extra={
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddItem}>
              添加检查项
            </Button>
          }
        >
          <Form.List name="items">
            {(fields) => (
              <Table
                rowKey="id"
                size="small"
                columns={itemColumns}
                dataSource={fields.map((field, idx) => ({ ...form.getFieldValue(['items', idx]), key: idx }))}
                pagination={false}
                scroll={{ x: 1100 }}
                bordered
              />
            )}
          </Form.List>
        </Card>

        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Space size="large">
            <Button size="large" onClick={() => navigate('/inspection/templates')}>
              取消
            </Button>
            <Button type="primary" size="large" icon={<SaveOutlined />} loading={loading} onClick={handleSubmit}>
              {isEdit ? '保存修改' : '创建模板'}
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

export default InspectionTemplateForm;
