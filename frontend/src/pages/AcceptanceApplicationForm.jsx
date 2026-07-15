import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  DatePicker,
  Select,
  message,
  Space,
  Spin,
  Card,
  Row,
  Col,
  Alert,
  Typography,
} from 'antd';

import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, assetAPI } from '../utils/api';
import { useCurrentUser } from '../hooks';

const { Title } = Typography;
const { Option } = Select;

const departments = [
  '骨科', '内科', '外科', '儿科', '妇产科', 'ICU',
  '手术室', '急诊科', '康复科', '检验科', '影像科',
];
const functionalDepts = ['医务科', '护理部', '设备科', '后勤科', '信息科'];
const priorities = ['低', '中', '高'];

const AcceptanceApplicationForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [record, setRecord] = useState(null);
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const { user: currentUser } = useCurrentUser();

  // 资产可搜索下拉
  const handleAssetSearch = keyword => {
    if (!keyword || keyword.length < 1) {
      setAssets([]);
      return;
    }
    setAssetLoading(true);
    assetAPI
      .getAssets({ keyword, page: 1, pageSize: 20 })
      .then(res => setAssets(res?.data || []))
      .catch(err => console.error('搜索资产失败:', err))
      .finally(() => setAssetLoading(false));
  };
  const handleAssetSelect = value => {
    const hit = assets.find(a => a.asset_code === value);
    if (hit) {
      form.setFieldsValue({
        asset_code: hit.asset_code,
        asset_name: hit.asset_name,
        department: hit.department_new || hit.department,
        supplier: hit.supplier || hit.manufacturer,
      });
    }
  };

  useEffect(() => {
    if (!isEdit) {
      form.setFieldsValue({
        priority: '中',
        planned_acceptance_date: dayjs(),
        applicant: currentUser?.real_name || '',
      });
      return;
    }
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const resp = await api.get(`/acceptance-management/applications/${id}`);
        if (resp.success) {
          const data = resp.data || {};
          setRecord(data);
          form.setFieldsValue({
            title: data.title,
            asset_code: data.asset_code,
            asset_name: data.asset_name,
            supplier: data.supplier,
            planned_acceptance_date: data.planned_acceptance_date ? dayjs(data.planned_acceptance_date) : null,
            department: data.department,
            functional_department: data.functional_department,
            priority: data.priority || '中',
            applicant_name: data.applicant_name || currentUser?.real_name || '',
            description: data.description || data.remark,
          });
        } else {
          message.error(resp.message || '获取申请详情失败');
          navigate('/acceptance-applications');
        }
      } catch (error) {
        console.error('获取申请详情失败:', error);
        message.error('获取申请详情失败');
        navigate('/acceptance-applications');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id, isEdit, form, currentUser, navigate]);

  const readOnly = isEdit && record && record.status !== '草稿';

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        title: values.title,
        asset_code: values.asset_code,
        asset_name: values.asset_name,
        supplier: values.supplier,
        planned_acceptance_date: values.planned_acceptance_date
          ? values.planned_acceptance_date.format('YYYY-MM-DD')
          : null,
        department: values.department,
        functional_department: values.functional_department,
        priority: values.priority,
        applicant_name: values.applicant_name || currentUser?.real_name || '',
        description: values.description,
      };
      let resp;
      if (isEdit) {
        resp = await api.put(`/acceptance-management/applications/${id}`, payload);
      } else {
        resp = await api.post('/acceptance-management/applications', payload);
      }
      if (resp.success) {
        message.success(isEdit ? '更新成功' : '创建成功');
        navigate('/acceptance-applications');
      } else {
        message.error(resp.message || (isEdit ? '更新失败' : '创建失败'));
      }
    } catch (error) {
      console.error(isEdit ? '更新失败:' : '创建失败:', error);
      message.error(isEdit ? '更新失败' : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/acceptance-applications')}
        >
          返回
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          {isEdit ? '编辑验收申请' : '新增验收申请'}
        </Title>
      </div>

      <Spin spinning={loading}>
        <Card>
          {readOnly && (
            <Alert title="当前申请状态不是草稿，不可编辑"
              description={`申请状态：${record?.status || '-'}，仅草稿状态的申请可以编辑。`}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            disabled={loading || readOnly}
            style={{ maxWidth: 900 }}
          >
            <Form.Item
              name="title"
              label="标题"
              rules={[{ required: true, message: '请输入标题' }]}
            >
              <Input placeholder="请输入申请标题" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="asset_code" label="资产编号">
                  <Select
                    showSearch
                    placeholder="输入资产编号或名称关键字"
                    loading={assetLoading}
                    filterOption={false}
                    onSearch={handleAssetSearch}
                    onChange={handleAssetSelect}
                    notFoundContent={assetLoading ? '加载中...' : '未找到匹配资产'}
                    optionLabelProp="label"
                  >
                    {assets.map(a => (
                      <Option
                        key={a.asset_code}
                        value={a.asset_code}
                        label={`${a.asset_code} - ${a.asset_name}`}
                      >
                        <div>
                          <div>{a.asset_code} - {a.asset_name}</div>
                          <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                            ''
                          </div>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="asset_name" label="资产名称">
                  <Input placeholder="选择资产后自动填充" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="supplier" label="供应商">
                  <Input placeholder="请输入供应商" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="planned_acceptance_date"
                  label="计划验收日期"
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="department" label="申请科室">
                  <Select placeholder="请选择申请科室" showSearch allowClear>
                    {departments.map(dept => (
                      <Option key={dept} value={dept}>{dept}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="functional_department" label="职能部门">
                  <Select placeholder="请选择职能部门" showSearch allowClear>
                    {functionalDepts.map(dept => (
                      <Option key={dept} value={dept}>{dept}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
                  <Select placeholder="请选择优先级">
                    {priorities.map(p => (
                      <Option key={p} value={p}>{p}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="applicant_name" label="申请人">
                  <Input placeholder="申请人（自动取当前登录人）" disabled />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="description" label="申请说明">
              <Input.TextArea rows={4} placeholder="请输入申请说明" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  disabled={readOnly}
                >
                  {isEdit ? '保存修改' : '创建申请'}
                </Button>
                <Button onClick={() => navigate('/acceptance-applications')}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Spin>
    </div>
  );
};

export default AcceptanceApplicationForm;
