import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  message,
  Spin,
  Space,
  Row,
  Col,
  Divider,
  Typography,
  Radio,
} from 'antd';

import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { assetAPI, maintenanceAPI } from '../utils/api';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text } = Typography;

const TemporaryMaintenanceForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [selectedAssetName, setSelectedAssetName] = useState('');
  const searchTimerRef = useRef(null);

  // 费用计算
  const laborCost = Form.useWatch('labor_cost', form) || 0;
  const materialCost = Form.useWatch('material_cost', form) || 0;
  const otherCost = Form.useWatch('other_cost', form) || 0;
  const totalCost = (Number(laborCost) || 0) + (Number(materialCost) || 0) + (Number(otherCost) || 0);

  // 编辑时加载数据
  useEffect(() => {
    if (isEditing) {
      loadRecord();
    }
  }, [id]);

  const loadRecord = async () => {
    setPageLoading(true);
    try {
      const response = await maintenanceAPI.getMaintenanceLog(id);
      if (response.success && response.data) {
        const record = response.data;
        setSelectedAssetName(record.asset_name || '');
        form.setFieldsValue({
          asset_code: record.asset_code,
          maintenance_date: record.maintenance_date ? dayjs(record.maintenance_date) : null,
          maintenance_person: record.maintenance_person,
          maintenance_content: record.maintenance_content,
          maintenance_cost: record.maintenance_cost || 0,
          labor_cost: record.labor_cost || 0,
          material_cost: record.material_cost || 0,
          other_cost: record.other_cost || 0,
          maintenance_duration: record.maintenance_duration,
          maintenance_location: record.maintenance_location,
          maintenance_method: record.maintenance_method,
          parts_replaced: record.parts_replaced,
          next_maintenance_date: record.next_maintenance_date ? dayjs(record.next_maintenance_date) : null,
          status: record.status,
          quality_check: record.quality_check,
          quality_check_person: record.quality_check_person,
          quality_check_date: record.quality_check_date ? dayjs(record.quality_check_date) : null,
          remark: record.remark,
        });
      }
    } catch (error) {
      message.error('加载保养记录失败');
      console.error('加载保养记录失败:', error);
    } finally {
      setPageLoading(false);
    }
  };

  // 防抖搜索资产
  const handleAssetSearch = useCallback(value => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    if (!value || value.length < 2) {
      setAssets([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setAssetLoading(true);
      try {
        const response = await assetAPI.getAssetsNoCache({ search: value, pageSize: 20 });
        if (response.success) {
          setAssets(response.data || []);
        }
      } catch (error) {
        console.error('搜索资产失败:', error);
      } finally {
        setAssetLoading(false);
      }
    }, 400);
  }, []);

  const handleAssetSelect = (value, option) => {
    setSelectedAssetName(option?.assetName || '');
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const formData = {
        asset_code: values.asset_code,
        maintenance_type: '临时保养',
        maintenance_date: values.maintenance_date.format('YYYY-MM-DD'),
        maintenance_person: values.maintenance_person,
        maintenance_content: values.maintenance_content,
        maintenance_cost: values.maintenance_cost || totalCost || 0,
        labor_cost: values.labor_cost || 0,
        material_cost: values.material_cost || 0,
        other_cost: values.other_cost || 0,
        maintenance_duration: values.maintenance_duration,
        maintenance_location: values.maintenance_location,
        maintenance_method: values.maintenance_method,
        parts_replaced: values.parts_replaced,
        next_maintenance_date: values.next_maintenance_date?.format('YYYY-MM-DD') || null,
        status: values.status,
        quality_check: values.quality_check,
        quality_check_person: values.quality_check_person,
        quality_check_date: values.quality_check_date?.format('YYYY-MM-DD') || null,
        remark: values.remark,
      };

      if (isEditing) {
        const response = await maintenanceAPI.updateMaintenanceLog(id, formData);
        if (response.success) {
          message.success('临时保养记录更新成功');
          navigate('/maintenance/temporary');
        }
      } else {
        const response = await maintenanceAPI.createMaintenanceLog(formData);
        if (response.success) {
          message.success('临时保养记录创建成功');
          navigate('/maintenance/temporary');
        }
      }
    } catch (error) {
      if (error?.errorFields) return;
      message.error(isEditing ? '更新失败' : '创建失败');
      console.error('提交失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Spin spinning={pageLoading}>
        <Card
          title={
            <Space>
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/maintenance/temporary')} />
              {isEditing ? '编辑临时保养' : '新建临时保养'}
            </Space>
          }
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              status: '进行中',
              quality_check: '待检查',
              maintenance_date: dayjs(),
              maintenance_method: '现场',
            }}
          >
            <Row gutter={24}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="资产编号"
                  name="asset_code"
                  rules={[{ required: true, message: '请选择资产' }]}
                >
                  <Select
                    showSearch
                    placeholder="输入资产编号或名称搜索"
                    filterOption={false}
                    onSearch={handleAssetSearch}
                    onSelect={handleAssetSelect}
                    loading={assetLoading}
                    notFoundContent={assetLoading ? '搜索中...' : '输入至少2个字符搜索'}
                  >
                    {assets.map(asset => (
                      <Select.Option key={asset.asset_code} value={asset.asset_code} assetName={asset.asset_name}>
                        {asset.asset_code} - {asset.asset_name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="资产名称">
                  <Text strong>{selectedAssetName || '-'}</Text>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="保养日期"
                  name="maintenance_date"
                  rules={[{ required: true, message: '请选择保养日期' }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="保养人"
                  name="maintenance_person"
                  rules={[{ required: true, message: '请输入保养人' }]}
                >
                  <Input placeholder="请输入保养人姓名" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="保养方式" name="maintenance_method">
                  <Select
                    options={[
                      { value: '现场', label: '现场' },
                      { value: '送修', label: '送修' },
                      { value: '远程', label: '远程' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="保养内容"
              name="maintenance_content"
              rules={[{ required: true, message: '请输入保养内容' }]}
            >
              <TextArea rows={3} placeholder="请描述本次临时保养的具体内容" />
            </Form.Item>

            <Row gutter={24}>
              <Col xs={24} sm={8}>
                <Form.Item label="保养地点" name="maintenance_location">
                  <Input placeholder="保养地点" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="耗时（分钟）" name="maintenance_duration">
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="保养耗时" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="下次保养日期" name="next_maintenance_date">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider>费用信息</Divider>
            <Row gutter={24}>
              <Col xs={24} sm={8}>
                <Form.Item label="人工费" name="labor_cost">
                  <InputNumber style={{ width: '100%' }} min={0} prefix="¥" placeholder="0.00" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="材料费" name="material_cost">
                  <InputNumber style={{ width: '100%' }} min={0} prefix="¥" placeholder="0.00" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="其他费用" name="other_cost">
                  <InputNumber style={{ width: '100%' }} min={0} prefix="¥" placeholder="0.00" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="总费用">
              <Text strong style={{ fontSize: 18, color: '#fa8c16' }}>
                ¥{totalCost.toLocaleString()}
              </Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                （人工费 + 材料费 + 其他费用）
              </Text>
            </Form.Item>

            <Form.Item label="更换部件" name="parts_replaced">
              <TextArea rows={2} placeholder="如有更换部件请填写，无则留空" />
            </Form.Item>

            <Divider>状态与质检</Divider>
            <Row gutter={24}>
              <Col xs={24} sm={8}>
                <Form.Item label="状态" name="status">
                  <Radio.Group>
                    <Radio.Button value="进行中">进行中</Radio.Button>
                    <Radio.Button value="已完成">已完成</Radio.Button>
                    <Radio.Button value="已取消">已取消</Radio.Button>
                  </Radio.Group>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="质检结果" name="quality_check">
                  <Select
                    options={[
                      { value: '待检查', label: '待检查' },
                      { value: '合格', label: '合格' },
                      { value: '不合格', label: '不合格' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="质检人" name="quality_check_person">
                  <Input placeholder="质检人姓名" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="备注" name="remark">
              <TextArea rows={2} placeholder="其他需要说明的事项" />
            </Form.Item>

            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Space>
                <Button onClick={() => navigate('/maintenance/temporary')}>取消</Button>
                <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSubmit}>
                  {isEditing ? '保存修改' : '创建保养记录'}
                </Button>
              </Space>
            </div>
          </Form>
        </Card>
      </Spin>
    </div>
  );
};

export default TemporaryMaintenanceForm;
