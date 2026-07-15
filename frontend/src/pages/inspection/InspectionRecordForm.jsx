/**
 * 巡检记录单填写表单（规范巡检记录单）
 * 包含：基本信息、检查项明细、巡检结论、签字确认
 */

import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Select, DatePicker, Button, Space, message,
  Row, Col, Table, Tag, Divider, Alert, Descriptions, TimePicker,
} from 'antd';
import {
  PlusOutlined, MinusCircleOutlined, SaveOutlined, ArrowLeftOutlined,
  CheckCircleOutlined, WarningOutlined, ProfileOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { inspectionAPI, assetAPI } from '../../utils/api';
import dayjs from 'dayjs';
import SignatureField from '../../components/SignatureField';

const { Option } = Select;
const { TextArea } = Input;

const inspectionTypeMap = {
  daily: '日常巡检',
  weekly: '周巡检',
  monthly: '月巡检',
  quarterly: '季巡检',
  special: '专项巡检',
};

const itemCategoryMap = {
  appearance: '外观',
  function: '功能',
  safety: '安全',
  environment: '环境',
  performance: '性能',
};

const riskLevelMap = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'blue' },
};

const InspectionRecordForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [taskInfo, setTaskInfo] = useState(null);
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);

  // 资产可搜索下拉
  const handleAssetSearch = keyword => {
    if (!keyword || keyword.length < 1) { setAssets([]); return; }
    setAssetLoading(true);
    assetAPI.getAssets({ keyword, page: 1, pageSize: 20 })
      .then(res => setAssets(res?.data || []))
      .catch(err => console.error('搜索资产失败:', err))
      .finally(() => setAssetLoading(false));
  };
  const handleAssetSelect = value => {
    const hit = assets.find(a => a.id === value || a.asset_code === value);
    if (hit) {
      form.setFieldsValue({
        asset_id: hit.id,
        asset_code: hit.asset_code,
        asset_name: hit.asset_name,
      });
    }
  };

  // 加载关联任务信息
  useEffect(() => {
    if (taskId) {
      inspectionAPI.getTask(taskId).then(res => {
        if (res?.success && res.data) {
          const task = res.data;
          setTaskInfo(task);
          form.setFieldsValue({
            inspection_title: task.task_name,
            inspection_type: task.inspection_type,
            inspection_area: task.inspection_area,
            asset_id: task.asset_id,
            task_id: task.id,
            template_id: task.template_id,
            inspection_date: dayjs(),
            start_time: dayjs(),
            inspector_name: task.assignee_name,
            status: 'submitted',
          });
          // 自动加载模板检查项
          if (task.template_id) {
            void handleLoadTemplate(task.template_id);
          }
        }
      }).catch(() => { /* ignore */ });
    } else {
      form.setFieldsValue({
        inspection_type: 'daily',
        inspection_date: dayjs(),
        start_time: dayjs(),
        status: 'submitted',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // 加载模板检查项
  const handleLoadTemplate = async templateId => {
    if (!templateId) return;
    try {
      const res = await inspectionAPI.getTemplate(templateId);
      if (res?.success && res.data?.items) {
        const items = res.data.items.map((item, idx) => ({
          key: idx,
          template_item_id: item.id,
          item_code: item.item_code,
          item_name: item.item_name,
          item_category: item.item_category,
          check_method: item.check_method,
          check_standard: item.check_standard,
          expected_value: item.expected_value,
          unit: item.unit,
          check_result: 'normal',
          actual_value: '',
          problem_desc: '',
          risk_level: 'low',
          remark: '',
        }));
        form.setFieldsValue({ items });
        message.success(`已加载模板「${res.data.template_name}」的 ${items.length} 个检查项`);
      }
    } catch (_e) {
      message.error('加载模板失败');
    }
  };

  const handleSubmit = async (status = 'submitted') => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const items = (values.items || []).map((item, idx) => ({
        ...item,
        sort_order: idx,
      }));

      const payload = {
        ...values,
        task_id: values.task_id || (taskId ? parseInt(taskId) : null),
        template_id: values.template_id || null,
        asset_id: values.asset_id ? parseInt(values.asset_id) : null,
        inspection_date: values.inspection_date ? values.inspection_date.format('YYYY-MM-DD') : null,
        start_time: values.start_time ? values.start_time.format('YYYY-MM-DD HH:mm:ss') : null,
        end_time: values.end_time ? values.end_time.format('YYYY-MM-DD HH:mm:ss') : null,
        status,
        items,
      };

      const res = await inspectionAPI.createRecord(payload);
      if (res?.success) {
        message.success(status === 'draft' ? '草稿已保存' : '巡检记录单已提交');
        navigate(`/inspection/records/${res.data.id}`);
      }
    } catch (error) {
      if (error?.errorFields) {
        message.error('请完善必填项');
        return;
      }
      message.error(error.message || '提交失败');
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
        check_result: 'normal',
        actual_value: '',
        risk_level: 'low',
      }],
    });
  };

  const itemColumns = [
    {
      title: '序号',
      width: 60,
      render: (_, __, idx) => idx + 1,
    },
    {
      title: '检查项名称',
      dataIndex: 'item_name',
      width: 200,
      render: (val, record, idx) => (
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
      title: '类别',
      dataIndex: 'item_category',
      width: 120,
      render: (val, record, idx) => (
        <Form.Item name={['items', idx, 'item_category']} style={{ marginBottom: 0 }}>
          <Select allowClear placeholder="选择类别">
            {Object.entries(itemCategoryMap).map(([k, v]) => (
              <Option key={k} value={k}>{v}</Option>
            ))}
          </Select>
        </Form.Item>
      ),
    },
    {
      title: '检查标准',
      dataIndex: 'check_standard',
      width: 200,
      render: (val, record, idx) => (
        <Form.Item name={['items', idx, 'check_standard']} style={{ marginBottom: 0 }}>
          <Input placeholder="判定依据" />
        </Form.Item>
      ),
    },
    {
      title: '检查结果',
      dataIndex: 'check_result',
      width: 120,
      render: (val, record, idx) => (
        <Form.Item name={['items', idx, 'check_result']} style={{ marginBottom: 0 }}>
          <Select>
            <Option value="normal"><Tag color="success">正常</Tag></Option>
            <Option value="abnormal"><Tag color="error">异常</Tag></Option>
            <Option value="na"><Tag>不适用</Tag></Option>
          </Select>
        </Form.Item>
      ),
    },
    {
      title: '实测值/描述',
      dataIndex: 'actual_value',
      width: 180,
      render: (val, record, idx) => (
        <Form.Item name={['items', idx, 'actual_value']} style={{ marginBottom: 0 }}>
          <Input placeholder="实测值或检查描述" />
        </Form.Item>
      ),
    },
    {
      title: '问题描述',
      dataIndex: 'problem_desc',
      width: 180,
      render: (val, record, idx) => (
        <Form.Item name={['items', idx, 'problem_desc']} style={{ marginBottom: 0 }}>
          <Input placeholder="异常时描述问题" />
        </Form.Item>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      width: 100,
      render: (val, record, idx) => (
        <Form.Item name={['items', idx, 'risk_level']} style={{ marginBottom: 0 }}>
          <Select>
            {Object.entries(riskLevelMap).map(([k, v]) => (
              <Option key={k} value={k}>{v.label}</Option>
            ))}
          </Select>
        </Form.Item>
      ),
    },
    {
      title: '操作',
      width: 60,
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inspection/records')}>
            返回
          </Button>
          <h2 style={{ margin: 0 }}>
            <ProfileOutlined /> 填写巡检记录单
          </h2>
          {taskInfo && (
            <Tag color="blue">关联任务：{taskInfo.task_code}</Tag>
          )}
        </Space>
      </div>

      <Form form={form} layout="vertical">
        {/* 第一部分：基本信息 */}
        <Card title="一、巡检基本信息" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="inspection_title" label="巡检标题" rules={[{ required: true, message: '请输入巡检标题' }]}>
                <Input placeholder="如：ICU设备日常巡检" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="inspection_type" label="巡检类型" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(inspectionTypeMap).map(([k, v]) => (
                    <Option key={k} value={k}>{v}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="inspection_area" label="巡检区域/位置">
                <Input placeholder="如：放射科、ICU等" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="asset_id" label="关联资产ID">
                <Select
                  showSearch
                  allowClear
                  placeholder="输入资产编号或名称（可选）"
                  loading={assetLoading}
                  filterOption={false}
                  onSearch={handleAssetSearch}
                  onChange={handleAssetSelect}
                  notFoundContent={assetLoading ? '加载中...' : '未找到匹配资产'}
                  optionLabelProp="label"
                >
                  {assets.map(a => (
                    <Select.Option
                      key={a.id}
                      value={a.id}
                      label={`${a.asset_code} - ${a.asset_name}`}
                    >
                      <div>
                        <div>{a.asset_code} - {a.asset_name}</div>
                        <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                          {a.department || a.department_new || ''}
                        </div>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="template_id" label="巡检模板">
                <Input.Search
                  placeholder="输入模板ID加载检查项"
                  enterButton="加载"
                  onSearch={handleLoadTemplate}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="task_id" label="关联任务ID">
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="inspection_date" label="巡检日期" rules={[{ required: true, message: '请选择' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="start_time" label="开始时间">
                <TimePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="end_time" label="结束时间">
                <TimePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="inspector_name" label="巡检人" rules={[{ required: true, message: '请输入巡检人' }]}>
                <Input placeholder="巡检人姓名" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 第二部分：检查项明细 */}
        <Card
          title="二、巡检检查项明细"
          size="small"
          style={{ marginBottom: 16 }}
          extra={
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddItem}>
              添加检查项
            </Button>
          }
        >
          <Alert title="规范填写说明：逐项检查并记录结果，异常项请详细描述问题并评定风险等级。异常项将自动生成整改问题单。"
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
          />
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <Table
                rowKey="id"
                size="small"
                columns={itemColumns}
                dataSource={fields.map((field, idx) => ({ ...form.getFieldValue(['items', idx]), key: idx }))}
                pagination={false}
                scroll={{ x: 1200 }}
                bordered
              />
            )}
          </Form.List>
        </Card>

        {/* 第三部分：巡检结论 */}
        <Card title="三、巡检结论与建议" size="small" style={{ marginBottom: 16 }}>
          <Form.Item name="summary" label="巡检总结">
            <TextArea rows={3} placeholder="本次巡检总体情况说明" />
          </Form.Item>
          <Form.Item name="suggestions" label="改进建议">
            <TextArea rows={3} placeholder="针对发现问题的改进建议" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="其他需要说明的事项" />
          </Form.Item>
        </Card>

        {/* 第四部分：签字确认 */}
        <Card title="四、签字确认" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <SignatureField
                name="signature_inspector"
                label="巡检人签字"
                required
                requiredMessage="请巡检人完成手写签名"
                width="100%"
                height={160}
                placeholder="巡检人现场签字确认"
              />
            </Col>
            <Col span={12}>
              <Form.Item label="复核人" name="reviewer_name">
                <Input placeholder="复核人姓名(可选,提交后由复核人审核)" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Space size="large">
            <Button
              size="large"
              icon={<SaveOutlined />}
              onClick={() => handleSubmit('draft')}
              loading={loading}
            >
              保存草稿
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              onClick={() => handleSubmit('submitted')}
              loading={loading}
            >
              提交巡检记录单
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

export default InspectionRecordForm;
