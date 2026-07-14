import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, message, Card, Space, DatePicker, InputNumber } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { tenantAPI } from '../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const TenantForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const isEdit = !!id;

  useEffect(() => {
    if (isEdit) {
      loadTenant();
    } else {
      // 新建企业时，设置默认值
      form.resetFields();
      form.setFieldsValue({
        status: 'active',
        subscription_type: 'free',
        max_users: 100,
        max_assets: 10000,
      });
    }
  }, [id, form, isEdit]);

  const loadTenant = async () => {
    try {
      setLoading(true);
      const result = await tenantAPI.getTenant(id);
      if (result.success) {
        const tenant = result.data;
        form.resetFields();
        form.setFieldsValue({
          ...tenant,
          subscription_start_date: tenant.subscription_start_date
            ? dayjs(tenant.subscription_start_date)
            : null,
          subscription_end_date: tenant.subscription_end_date
            ? dayjs(tenant.subscription_end_date)
            : null,
        });
      }
    } catch (error) {
      message.error(error.response?.data?.message || '加载企业信息失败');
      navigate('/tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async values => {
    try {
      setLoading(true);
      const submitData = {
        ...values,
        subscription_start_date: values.subscription_start_date
          ? values.subscription_start_date.format('YYYY-MM-DD')
          : null,
        subscription_end_date: values.subscription_end_date
          ? values.subscription_end_date.format('YYYY-MM-DD')
          : null,
      };

      if (isEdit) {
        // 编辑时不需要提交 tenant_code
        delete submitData.tenant_code;
        const result = await tenantAPI.updateTenant(id, submitData);
        if (result.success) {
          message.success('更新成功');
          navigate('/tenants');
        }
      } else {
        // 新建时需要 tenant_code
        const result = await tenantAPI.createTenant(submitData);
        if (result.success) {
          message.success('创建成功');
          navigate('/tenants');
        }
      }
    } catch (error) {
      console.error('提交失败:', error);
      const errorMessage =
        error.response?.data?.message || error.message || (isEdit ? '更新失败' : '创建失败');
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button onClick={() => navigate('/tenants')}>返回列表</Button>
      </div>
      <Card title={isEdit ? '编辑企业' : '新建企业'} loading={loading && isEdit ? true : undefined}>
        <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Form.Item
            name="tenant_code"
            label="企业编码"
            rules={[
              { required: !isEdit, message: '请输入企业编码' },
              { pattern: /^[A-Za-z0-9]+$/, message: '企业编码只能包含字母和数字' },
            ]}
            extra={isEdit ? '企业编码创建后不可修改' : '企业编码创建后不可修改，请谨慎填写'}
          >
            <Input placeholder="请输入企业编码，例如：001" disabled={isEdit} size="large" />
          </Form.Item>

          <Form.Item
            name="tenant_name"
            label="企业名称"
            rules={[{ required: true, message: '请输入企业名称' }]}
          >
            <Input placeholder="请输入企业名称" size="large" />
          </Form.Item>

          <Form.Item name="contact_person" label="联系人">
            <Input placeholder="请输入联系人姓名" size="large" />
          </Form.Item>

          <Form.Item
            name="contact_phone"
            label="联系电话"
            rules={[
              { pattern: /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/, message: '请输入有效的电话号码' },
            ]}
          >
            <Input placeholder="请输入联系电话" size="large" />
          </Form.Item>

          <Form.Item
            name="contact_email"
            label="联系邮箱"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input placeholder="请输入联系邮箱" size="large" />
          </Form.Item>

          <Form.Item name="address" label="企业地址">
            <TextArea placeholder="请输入企业地址" rows={3} size="large" />
          </Form.Item>

          <Form.Item name="license_no" label="营业执照号">
            <Input placeholder="请输入营业执照号" size="large" />
          </Form.Item>

          <Form.Item
            name="subscription_type"
            label="订阅类型"
            rules={[{ required: true, message: '请选择订阅类型' }]}
          >
            <Select placeholder="请选择订阅类型" size="large">
              <Option value="free">免费版</Option>
              <Option value="basic">基础版</Option>
              <Option value="premium">高级版</Option>
              <Option value="enterprise">企业版</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="max_users"
            label="最大用户数"
            rules={[{ required: true, message: '请输入最大用户数' }]}
          >
            <InputNumber
              placeholder="请输入最大用户数"
              min={1}
              style={{ width: '100%' }}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="max_assets"
            label="最大资产数"
            rules={[{ required: true, message: '请输入最大资产数' }]}
          >
            <InputNumber
              placeholder="请输入最大资产数"
              min={1}
              style={{ width: '100%' }}
              size="large"
            />
          </Form.Item>

          <Form.Item name="subscription_start_date" label="订阅开始日期">
            <DatePicker style={{ width: '100%' }} size="large" format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item name="subscription_end_date" label="订阅结束日期">
            <DatePicker style={{ width: '100%' }} size="large" format="YYYY-MM-DD" />
          </Form.Item>

          {isEdit && (
            <Form.Item
              name="status"
              label="状态"
              rules={[{ required: true, message: '请选择状态' }]}
            >
              <Select placeholder="请选择状态" size="large">
                <Option value="active">启用</Option>
                <Option value="inactive">停用</Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item name="remark" label="备注">
            <TextArea placeholder="请输入备注信息" rows={4} size="large" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading} size="large">
                {isEdit ? '更新' : '创建'}
              </Button>
              <Button onClick={() => navigate('/tenants')} size="large">
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default TenantForm;
