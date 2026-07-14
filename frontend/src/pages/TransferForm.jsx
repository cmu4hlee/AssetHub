import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, message, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import { assetAPI } from '../utils/api';
import { useCurrentUser } from '../hooks';

const { Option } = Select;
const { TextArea } = Input;

const TransferForm = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const [assetSearchLoading, setAssetSearchLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const { user } = useCurrentUser();

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async (keyword = '') => {
    try {
      setDepartmentLoading(true);
      const searchKeyword = keyword ? keyword.trim() : '';
      const result = await assetAPI.getDepartments(searchKeyword);
      if (result.success) {
        setDepartments(result.data || []);
      } else {
        console.error('加载科室列表失败:', result.message);
        setDepartments([]);
      }
    } catch (error) {
      console.error('加载科室列表失败:', error);
      setDepartments([]);
    } finally {
      setDepartmentLoading(false);
    }
  };

  const searchAssets = async keyword => {
    if (!keyword) {
      setAssets([]);
      return;
    }
    try {
      setAssetSearchLoading(true);
      const result = await assetAPI.getAssetsNoCache({ search: keyword, pageSize: 10 });
      if (result.success) {
        setAssets(result.data);
      }
    } catch (error) {
      console.error('搜索资产失败:', error);
    } finally {
      setAssetSearchLoading(false);
    }
  };

  const getTenantId = useCallback(async () => {
    let tenantId = null;
    if (user?.tenant_id) {
      tenantId = user.tenant_id;
    }
    return tenantId;
  }, [user]);

  const handleSubmit = async values => {
    try {
      setLoading(true);
      if (!values.asset_code) {
        message.error('请选择资产');
        return;
      }
      if (!values.target_department) {
        message.error('请选择目标部门');
        return;
      }
      if (!values.reason) {
        message.error('请输入调配原因');
        return;
      }

      const tenantId = await getTenantId();
      const data = {
        target_department: values.target_department,
        reason: values.reason,
        tenant_id: tenantId,
      };

      const result = await assetAPI.applyTransfer(values.asset_code, data);
      if (result.success) {
        message.success('调配申请提交成功，等待管理员审批');
        navigate(user?.role === 'system_admin' ? '/transfer/requests' : '/transfer');
      } else {
        message.error(result.message || '提交调配申请失败');
      }
    } catch (error) {
      console.error('提交调配申请失败:', error);
      const errorMessage =
        error.response?.data?.message || error.message || '提交调配申请失败，请稍后重试';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(user?.role === 'system_admin' ? '/transfer/requests' : '/transfer');
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button onClick={handleBack}>返回</Button>
      </div>
      <Form form={form} onFinish={handleSubmit}>
        <Form.Item name="asset_code" label="资产" rules={[{ required: true }]}>
          <Select
            showSearch
            placeholder="请输入关键词搜索资产"
            onSearch={searchAssets}
            filterOption={false}
            notFoundContent={assetSearchLoading ? '搜索中...' : '未找到匹配的资产'}
            options={assets.map(asset => ({
              value: asset.asset_code,
              label: `${asset.asset_code} - ${asset.name}`,
            }))}
          />
        </Form.Item>
        <Form.Item name="target_department" label="目标部门" rules={[{ required: true }]}>
          <Select placeholder="请选择目标部门">
            {departments.map(dept => (
              <Option key={dept.id} value={dept.department_name}>
                {dept.department_name}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="reason" label="调配原因" rules={[{ required: true }]}>
          <TextArea rows={3} placeholder="请输入调配原因" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            提交申请
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default TransferForm;
