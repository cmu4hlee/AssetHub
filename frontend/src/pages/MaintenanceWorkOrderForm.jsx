import React, { useState, useEffect } from 'react';
import { useCan } from '../hooks';
import {
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Card,
  Row,
  Col,
  InputNumber,
  message,
  Spin,
  Divider,
  Modal,
  Table,
  Popconfirm,
  Tag,
  Space,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined,
  UserOutlined,
  DollarOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { maintenanceAPI, assetAPI } from '../utils/api';
import useIsMobile from '../hooks/useIsMobile';
import useCurrentUser from '../hooks/useCurrentUser';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const MaintenanceWorkOrderForm = ({ record, mode, visible, onSuccess, onCancel }) => {
  const canDelete = useCan('workorder', 'delete');
  const canEdit = useCan('workorder', 'edit');
  const [form] = Form.useForm();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [materialList, setMaterialList] = useState([]);
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [materialForm] = Form.useForm();
  const { user: currentUser } = useCurrentUser();
  const [engineers, setEngineers] = useState([]);
  const [engineersLoading, setEngineersLoading] = useState(false);

  const priorities = [
    { value: 1, label: '紧急', color: 'red' },
    { value: 2, label: '高', color: 'orange' },
    { value: 3, label: '中', color: 'blue' },
    { value: 4, label: '低', color: 'green' },
  ];

  const workOrderStatuses = [
    { value: 'in_progress', label: '进行中', color: 'blue' },
    { value: 'pending_review', label: '待审核', color: 'warning' },
    { value: 'completed', label: '已完成', color: 'success' },
    { value: 'closed', label: '已关闭', color: 'default' },
    { value: 'cancelled', label: '已取消', color: 'error' },
  ];

  const costTypes = [
    { value: 'labor', label: '人工费' },
    { value: 'material', label: '材料费' },
    { value: 'outsourcing', label: '外包费' },
    { value: 'transport', label: '运输费' },
    { value: 'other', label: '其他' },
  ];

  useEffect(() => {
    fetchAssets();
    const loadEngineers = async () => {
      setEngineersLoading(true);
      try {
        const res = await maintenanceAPI.getEngineers();
        if (res?.success && Array.isArray(res.data)) {
          setEngineers(res.data);
        }
      } catch (err) {
        console.error('获取工程师列表失败:', err);
      } finally {
        setEngineersLoading(false);
      }
    };
    loadEngineers();
    if (record) {
      const materialData = record.materials || [];
      setMaterialList(
        Array.isArray(materialData) ? materialData : JSON.parse(materialData || '[]')
      );
      form.setFieldsValue({
        ...record,
        planned_start_date: record.planned_start_date ? dayjs(record.planned_start_date) : null,
        planned_end_date: record.planned_end_date ? dayjs(record.planned_end_date) : null,
        actual_start_date: record.actual_start_date ? dayjs(record.actual_start_date) : null,
        actual_end_date: record.actual_end_date ? dayjs(record.actual_end_date) : null,
        materials: undefined,
      });
    } else if (currentUser) {
      // 新建时默认分配人为当前用户
      form.setFieldValue('assigned_by', currentUser.real_name || currentUser.username);
    }
  }, [record, form, currentUser]);

  const fetchAssets = async (keyword = '') => {
    setAssetLoading(true);
    try {
      const response = await assetAPI.getAssets({
        page: 1,
        pageSize: 20,
        keyword,
        status: 'active',
      });
      if (response.success) {
        setAssets(response.data || []);
      }
    } catch (error) {
      console.error('获取资产列表失败:', error);
    } finally {
      setAssetLoading(false);
    }
  };

  const handleAssetSearch = keyword => {
    if (keyword) {
      fetchAssets(keyword);
    }
  };

  const handleSubmit = async values => {
    setLoading(true);
    try {
      const data = {
        ...values,
        planned_start_date: values.planned_start_date?.format('YYYY-MM-DD'),
        planned_end_date: values.planned_end_date?.format('YYYY-MM-DD'),
        actual_start_date: values.actual_start_date?.format('YYYY-MM-DD'),
        actual_end_date: values.actual_end_date?.format('YYYY-MM-DD'),
        materials: materialList,
        total_cost: calculateTotalCost(),
      };

      let response;
      if (mode === 'edit' && record?.id) {
        response = await maintenanceAPI.updateMaintenanceWorkOrder(record.id, data);
      } else {
        response = await maintenanceAPI.createMaintenanceWorkOrder(data);
      }

      if (response.success) {
        message.success(mode === 'edit' ? '更新成功' : '创建成功');
        onSuccess?.(response.data);
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('保存工单失败:', error);
      message.error('网络错误，保存失败');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalCost = () => {
    const laborCost = form.getFieldValue('labor_cost') || 0;
    const materialCost = materialList.reduce(
      (sum, item) => sum + (item.quantity * item.unit_price || 0),
      0
    );
    const outsourcingCost = form.getFieldValue('outsourcing_cost') || 0;
    const otherCost = form.getFieldValue('other_cost') || 0;
    return laborCost + materialCost + outsourcingCost + otherCost;
  };

  const handleAddMaterial = () => {
    setEditingMaterial(null);
    materialForm.resetFields();
    setMaterialModalVisible(true);
  };

  const handleEditMaterial = record => {
    setEditingMaterial(record);
    materialForm.setFieldsValue(record);
    setMaterialModalVisible(true);
  };

  const handleDeleteMaterial = index => {
    const newList = [...materialList];
    newList.splice(index, 1);
    setMaterialList(newList);
  };

  const handleMaterialSubmit = async () => {
    try {
      const values = await materialForm.validateFields();
      if (editingMaterial !== null) {
        const newList = [...materialList];
        newList[editingMaterial] = values;
        setMaterialList(newList);
      } else {
        setMaterialList([...materialList, values]);
      }
      setMaterialModalVisible(false);
    } catch (error) {
      console.error('保存材料失败:', error);
    }
  };

  const materialColumns = [
    {
      title: '材料名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 100,
      render: value => `¥${value?.toFixed(2) || '0.00'}`,
    },
    {
      title: '小计',
      key: 'subtotal',
      width: 100,
      render: (_, record) => `¥${(record.quantity * record.unit_price).toFixed(2)}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, __, index) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEditMaterial(__)}>
            编辑
          </Button>
          <Popconfirm title="确定删除此材料？" onConfirm={() => handleDeleteMaterial(index)}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 关键: visible=false 时不渲染整个 Form (避免内部 5 个 DatePicker 触发 antd 6 useInvalidate date4.isValid 错误)
  if (visible === false) {
    return null;
  }

  return (
    <div className="maintenance-workorder-form">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          status: 'in_progress',
          priority: 3,
        }}
      >
        <Card
          title={mode === 'edit' ? '编辑维护工单' : '新建维护工单'}
          className="mb-4"
          extra={
            <div className="flex gap-2">
              <Button icon={<CloseOutlined />} onClick={onCancel}>
                取消
              </Button>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={loading}>
                保存
              </Button>
            </div>
          }
        >
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="asset_code"
                label="关联资产"
                rules={[{ required: true, message: '请选择关联资产' }]}
              >
                <Select
                  showSearch
                  placeholder="搜索资产"
                  loading={assetLoading}
                  onSearch={handleAssetSearch}
                  filterOption={false}
                  optionLabelProp="label"
                >
                  {assets.map(asset => (
                    <Option
                      key={asset.id}
                      value={asset.asset_code}
                      label={`${asset.asset_code} - ${asset.asset_name}`}
                    >
                      <div>
                        <div>{asset.asset_code}</div>
                        <div className="text-gray-400 text-xs">{asset.asset_name}</div>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="priority"
                label="优先级"
                rules={[{ required: true, message: '请选择优先级' }]}
              >
                <Select placeholder="选择优先级">
                  {priorities.map(p => (
                    <Option key={p.value} value={p.value}>
                      <Tag color={p.color}>{p.label}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="status" label="状态">
                <Select placeholder="选择状态">
                  {workOrderStatuses.map(s => (
                    <Option key={s.value} value={s.value}>
                      <Tag color={s.color}>{s.label}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                name="title"
                label="工单标题"
                rules={[
                  { required: true, message: '请输入工单标题' },
                  { min: 2, max: 100, message: '标题长度应在2-100个字符之间' },
                ]}
              >
                <Input placeholder="简要描述工单内容" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                name="description"
                label="工单描述"
                rules={[{ required: true, message: '请输入工单描述' }]}
              >
                <TextArea rows={3} placeholder="详细描述工单的工作内容和要求" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <h4 className="mb-4">计划时间</h4>
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="planned_start_date" label="计划开始时间">
                <DatePicker className="w-full" showTime />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="planned_end_date" label="计划结束时间">
                <DatePicker className="w-full" showTime />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="estimated_hours" label="预估工时">
                <Space.Compact className="w-full">
                  <InputNumber
                    min={0}
                    precision={1}
                    placeholder="预估工时"
                    style={{ width: '100%' }}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 11px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 0 }}>小时</span>
                </Space.Compact>
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <h4 className="mb-4">分配信息</h4>
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="assigned_to" label="负责人（执行人）">
                <Select
                  placeholder="选择工程师 / 维修管理员"
                  loading={engineersLoading}
                  showSearch
                  optionFilterProp="label"
                  allowClear
                >
                  {engineers.map(eng => (
                    <Option key={eng.id} value={eng.real_name || eng.username}>
                      {eng.real_name || eng.username}
                      {eng.phone ? `（${eng.phone}）` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="assigned_by" label="分配人">
                <Input placeholder="分配人" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="assigned_at" label="分配时间">
                <DatePicker className="w-full" showTime />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <div className="flex justify-between items-center mb-4">
            <h4 className="m-0">材料清单</h4>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddMaterial}
              block={isMobile}
            >
              添加材料
            </Button>
          </div>
          <div className="hide-on-mobile">
            <Table
              dataSource={materialList}
              columns={materialColumns}
              rowKey="id"
              pagination={false}
              size="small"
              footer={() => (
                <div className="flex justify-end">
                  <span className="text-lg font-bold">
                    材料合计：¥
                    {materialList
                      .reduce((sum, item) => sum + (item.quantity * item.unit_price || 0), 0)
                      .toFixed(2)}
                  </span>
                </div>
              )}
            />
          </div>
          <div className="mobile-table-cards show-on-mobile">
            {Array.isArray(materialList) && materialList.length > 0 ? (
              materialList.map((record, index) => (
                <div key={record.id || index} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.name || '-'}</span>
                    <Tag color="blue">¥{(record.quantity * record.unit_price || 0).toFixed(2)}</Tag>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">规格</span>
                      <span className="mobile-card-value">{record.specification || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">数量</span>
                      <span className="mobile-card-value">{record.quantity ?? '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">单价</span>
                      <span className="mobile-card-value">
                        ¥{record.unit_price?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </div>
                  <div className="mobile-card-actions">
                    <Button
                      type="primary"
                      size="small"
                      block
                      onClick={() => handleEditMaterial(record)}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="确定删除此材料？"
                      onConfirm={() => handleDeleteMaterial(index)}
                    >
                      <Button type="primary" size="small" danger block>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              ))
            ) : (
              <Empty description="暂无材料" />
            )}
            {Array.isArray(materialList) && materialList.length > 0 && (
              <div
                style={{
                  textAlign: 'right',
                  padding: '8px 0',
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                材料合计：¥
                {materialList
                  .reduce((sum, item) => sum + (item.quantity * item.unit_price || 0), 0)
                  .toFixed(2)}
              </div>
            )}
          </div>

          <Divider />
          <h4 className="mb-4">成本信息</h4>
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="labor_cost" label="人工费">
                <InputNumber
                  className="w-full"
                  min={0}
                  precision={2}
                  placeholder="人工费"
                  formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="outsourcing_cost" label="外包费">
                <InputNumber
                  className="w-full"
                  min={0}
                  precision={2}
                  placeholder="外包费"
                  formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="other_cost" label="其他费用">
                <InputNumber
                  className="w-full"
                  min={0}
                  precision={2}
                  placeholder="其他费用"
                  formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24}>
              <div className="text-right p-4 bg-gray-50 rounded">
                <span className="text-lg font-bold mr-4">总成本：</span>
                <span className="text-2xl font-bold text-blue-600">
                  ¥{calculateTotalCost().toFixed(2)}
                </span>
              </div>
            </Col>
          </Row>

          {mode === 'edit' && (
            <>
              <Divider />
              <h4 className="mb-4">实际执行信息</h4>
              <Row gutter={16}>
                <Col xs={24} sm={12} lg={8}>
                  <Form.Item name="actual_start_date" label="实际开始时间">
                    <DatePicker className="w-full" showTime />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                  <Form.Item name="actual_end_date" label="实际结束时间">
                    <DatePicker className="w-full" showTime />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                  <Form.Item name="actual_hours" label="实际工时">
                    <Space.Compact className="w-full">
                      <InputNumber
                        min={0}
                        precision={1}
                        placeholder="实际工时"
                        style={{ width: '100%' }}
                      />
                      <span style={{ display: 'flex', alignItems: 'center', padding: '0 11px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 0 }}>小时</span>
                    </Space.Compact>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.Item name="work_content" label="实际工作内容">
                    <TextArea rows={3} placeholder="实际完成的工作内容" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.Item name="remark" label="备注">
                    <TextArea rows={2} placeholder="其他备注信息" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <Divider />
          <div className="flex justify-end gap-2">
            <Button icon={<CloseOutlined />} onClick={onCancel}>
              取消
            </Button>
            <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={loading}>
              保存
            </Button>
          </div>
        </Card>
      </Form>

      <Modal
        title={editingMaterial !== null ? '编辑材料' : '添加材料'}
        open={materialModalVisible}
        onOk={handleMaterialSubmit}
        onCancel={() => setMaterialModalVisible(false)}
        width={isMobile ? '95vw' : 520}
      >
        <Form form={materialForm} layout="vertical">
          <Form.Item
            name="name"
            label="材料名称"
            rules={[{ required: true, message: '请输入材料名称' }]}
          >
            <Input placeholder="材料名称" />
          </Form.Item>
          <Form.Item name="specification" label="规格">
            <Input placeholder="规格型号" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="quantity"
                label="数量"
                rules={[{ required: true, message: '请输入数量' }]}
              >
                <InputNumber className="w-full" min={1} placeholder="数量" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="unit_price"
                label="单价"
                rules={[{ required: true, message: '请输入单价' }]}
              >
                <InputNumber
                  className="w-full"
                  min={0}
                  precision={2}
                  placeholder="单价"
                  formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MaintenanceWorkOrderForm;
