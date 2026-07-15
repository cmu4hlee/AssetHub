import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, DatePicker, Button, message, Select, Switch, Card, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { idleAPI, assetAPI } from '../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const IdleAssetForm = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const [assetSearchLoading, setAssetSearchLoading] = useState(false);
  const [useTempAsset, setUseTempAsset] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [departmentLoading, setDepartmentLoading] = useState(false);

  // 加载部门列表
  const loadDepartments = useCallback(async () => {
    setDepartmentLoading(true);
    try {
      const result = await assetAPI.getDepartments();
      if (result.success && result.data) {
        setDepartmentOptions(
          result.data.map(dept => ({
            label: dept.department_name || dept.name,
            value: dept.department_name || dept.name,
          }))
        );
      }
    } catch (error) {
      console.error('加载部门列表失败:', error);
    } finally {
      setDepartmentLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const searchAssets = async keyword => {
    if (!keyword) {
      setAssets([]);
      return;
    }
    try {
      setAssetSearchLoading(true);
      // 搜索所有状态的资产，不限定为闲置状态
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

  // 选中资产后自动填名称/类型/品牌/型号
  const handleAssetSelect = value => {
    const hit = assets.find(a => a.asset_code === value);
    if (hit) {
      form.setFieldsValue({
        asset_code: hit.asset_code,
        asset_name: hit.asset_name,
        asset_type: hit.category_id || hit.asset_type,
        brand: hit.brand || hit.manufacturer,
        model: hit.model || hit.specification,
        specification: hit.specification,
      });
    }
  };

  const handleSubmit = async values => {
    try {
      setLoading(true);
      const data = {
        ...values,
        publish_date: values.publish_date ? values.publish_date.format('YYYY-MM-DD') : null,
      };

      const result = await idleAPI.createIdleAsset(data);
      if (result.success) {
        message.success(result.message || '闲置资产发布成功');
        navigate('/idle');
      } else {
        message.error(result.message || '发布失败');
      }
    } catch (error) {
      message.error(error.response?.data?.message || error.message || '发布失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center mb-4">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/idle')} className="mr-2">
          返回列表
        </Button>
        <h1 className="text-2xl font-bold m-0">{useTempAsset ? '创建临时闲置资产' : '发布闲置资产'}</h1>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ maxWidth: 800 }}
          initialValues={{
            publish_date: dayjs(),
          }}
        >
          <Card title="资产信息" className="mb-4">
            <Form.Item label="发布模式">
              <Switch
                checked={useTempAsset}
                onChange={setUseTempAsset}
                checkedChildren="创建临时资产"
                unCheckedChildren="选择现有资产"
              />
            </Form.Item>

            {!useTempAsset ? (
              <Form.Item
                name="asset_code"
                label="现有资产"
                rules={[{ required: true, message: '请选择资产' }]}
                extra="可以选择任何状态的资产进行发布"
              >
                <Select
                  showSearch
                  placeholder="搜索资产编号或名称"
                  style={{ width: '100%' }}
                  onSearch={searchAssets}
                  onChange={handleAssetSelect}
                  loading={assetSearchLoading}
                  filterOption={false}
                >
                  {assets.map(asset => (
                    <Option key={asset.asset_code} value={asset.asset_code}>
                      {asset.asset_code} - {asset.asset_name} ({asset.status || '未知状态'})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            ) : (
              <Space orientation="vertical" className="w-full">
                <Space size="large" className="w-full">
                  <Form.Item
                    name="asset_name"
                    label="资产名称"
                    rules={[{ required: true, message: '请输入资产名称' }]}
                    className="flex-1"
                  >
                    <Input placeholder="请输入资产名称" />
                  </Form.Item>

                  <Form.Item name="asset_type" label="资产类型" className="flex-1">
                    <Input placeholder="请输入资产类型" />
                  </Form.Item>
                </Space>

                <Space size="large" className="w-full">
                  <Form.Item name="brand" label="品牌" className="flex-1">
                    <Input placeholder="请输入品牌" />
                  </Form.Item>

                  <Form.Item name="model" label="型号" className="flex-1">
                    <Input placeholder="请输入型号" />
                  </Form.Item>
                </Space>

                <Space size="large" className="w-full">
                  <Form.Item name="specification" label="规格" className="flex-1">
                    <TextArea rows={2} placeholder="请输入规格" />
                  </Form.Item>

                  <Form.Item name="location" label="存放位置" className="flex-1">
                    <Input placeholder="请输入存放位置" />
                  </Form.Item>
                </Space>

                <Form.Item name="department" label="所属部门">
                  <Select placeholder="请选择所属部门" loading={departmentLoading} showSearch allowClear>
                    {departmentOptions.map(option => (
                      <Option key={option.value} value={option.value}>
                        {option.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Space>
            )}
          </Card>

          <Card title="发布信息" className="mb-4">
            <Space orientation="vertical" className="w-full">
              <Space size="large" className="w-full">
                <Form.Item
                  name="publish_date"
                  label="发布日期"
                  rules={[{ required: true, message: '请选择发布日期' }]}
                  className="flex-1"
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  name="publish_person"
                  label="发布人"
                  rules={[{ required: true, message: '请输入发布人' }]}
                  className="flex-1"
                >
                  <Input placeholder="请输入发布人" />
                </Form.Item>
              </Space>

              <Form.Item name="expected_use" label="用途">
                <TextArea rows={2} placeholder="请输入用途" />
              </Form.Item>

              <Space size="large" className="w-full">
                <Form.Item name="contact_person" label="联系人" className="flex-1">
                  <Input placeholder="请输入联系人" />
                </Form.Item>

                <Form.Item name="contact_phone" label="联系电话" className="flex-1">
                  <Input placeholder="请输入联系电话" />
                </Form.Item>
              </Space>

              <Form.Item name="remark" label="备注">
                <TextArea rows={2} placeholder="请输入备注" />
              </Form.Item>
            </Space>
          </Card>

          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              发布
            </Button>
            <Button onClick={() => navigate('/idle')}>取消</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default IdleAssetForm;
