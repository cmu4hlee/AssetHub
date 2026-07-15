import { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Button, Card, message, Select, Space, Row, Col } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { scrappingAPI, assetAPI } from '../utils/api';

const { TextArea } = Input;

const ScrappingForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);

  useEffect(() => {
    if (isEdit) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await scrappingAPI.getScrappingRecord(id);
      if (result.success) {
        form.setFieldsValue(result.data);
      } else {
        message.error(result.message || '获取数据失败');
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAssets = async (keyword = '') => {
    try {
      setAssetLoading(true);
      const result = await assetAPI.getAssetsNoCache({ search: keyword, page: 1, pageSize: 20 });
      if (result.success) {
        // assetAPI.getAssetsNoCache 走 getNormalizedList, records 已被抽到 result.data (数组)
        setAssets(result.data || []);
      }
    } catch (error) {
      console.error('加载资产列表失败:', error);
    } finally {
      setAssetLoading(false);
    }
  };

  // 选中资产后自动填名称/型号/部门
  const handleAssetChange = value => {
    const hit = assets.find(a => a.asset_code === value);
    if (hit) {
      form.setFieldsValue({
        asset_code: hit.asset_code,
        asset_name: hit.asset_name,
        asset_model: hit.model || hit.specification || '',
        department: hit.department_new || hit.department || '',
      });
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      let result;
      if (isEdit) {
        result = await scrappingAPI.updateScrapping(id, values);
      } else {
        result = await scrappingAPI.createScrappingRequest(values);
      }
      if (result.success) {
        message.success(isEdit ? '更新成功' : '创建成功');
        navigate('/scrapping');
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '0' }}>
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            current_status: 'pending',
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="asset_code"
                label="资产编号"
                rules={[{ required: true, message: '请输入资产编号' }]}
              >
                <Select
                  showSearch
                  placeholder="请输入资产编号"
                  allowClear
                  loading={assetLoading}
                  filterOption={false}
                  onSearch={(value) => {
                    if (value) {
                      loadAssets(value);
                    }
                  }}
                  onChange={handleAssetChange}
                  onFocus={() => loadAssets('')}
                >
                  {assets.map(asset => (
                    <Select.Option key={asset.asset_code} value={asset.asset_code}>
                      {asset.asset_code} - {asset.asset_name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="asset_name"
                label="资产名称"
                rules={[{ required: true, message: '请输入资产名称' }]}
              >
                <Input placeholder="请输入资产名称" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="asset_model" label="资产型号">
                <Input placeholder="请输入资产型号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="所属部门">
                <Input placeholder="请输入所属部门" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="applicant"
                label="申请人"
                rules={[{ required: true, message: '请输入申请人' }]}
              >
                <Input placeholder="请输入申请人" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="estimated_value" label="预估价值">
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入预估价值"
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="scrapping_reason"
            label="报废原因"
            rules={[{ required: true, message: '请输入报废原因' }]}
          >
            <TextArea
              rows={4}
              placeholder="请详细描述报废原因"
              maxLength={1000}
              showCount
            />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <TextArea
              rows={2}
              placeholder="请输入备注信息"
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                {isEdit ? '更新' : '提交'}
              </Button>
              <Button onClick={() => navigate('/scrapping')}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ScrappingForm;
