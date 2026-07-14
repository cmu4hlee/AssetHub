import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Typography,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Checkbox,
  Table,
  Modal,
  Space,
  InputNumber,
  Divider,
  Row,
  Col,
  Tag,
  Empty,
} from 'antd';

import dayjs from 'dayjs';
import { maintenanceAPI, assetAPI } from '../utils/api';
import useIsMobile from '../hooks/useIsMobile';
import AssetTypeSelect from '../components/AssetTypeSelect';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const cycleTypeMap = {
  '按天': 'day',
  '按周': 'week',
  '按月': 'month',
  '按季度': 'quarter',
  '按年': 'year',
};

// 根据周期类型和周期值计算下次维护日期
const calcNextDate = (cycleType, cycleValue) => {
  if (!cycleType || !cycleValue || cycleValue <= 0) return null;
  const unit = cycleTypeMap[cycleType];
  if (!unit) return null;
  return dayjs().add(cycleValue, unit);
};

const PreventiveMaintenanceForm = ({ record, isEditing, onSubmit, onCancel }) => {
  const [form] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [materialForm] = Form.useForm();
  const isMobile = useIsMobile();

  const [templates, setTemplates] = useState([]);
  const [recommendedTemplates, setRecommendedTemplates] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [maintenanceItems, setMaintenanceItems] = useState([]);
  const [requiredMaterials, setRequiredMaterials] = useState([]);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [showRecommendedModal, setShowRecommendedModal] = useState(false);
  const [calculatedNextDate, setCalculatedNextDate] = useState(null);
  const [triggerType, setTriggerType] = useState(record?.trigger_type || 'time');

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
        asset_type: hit.category_id || hit.asset_type,
        department: hit.department_new || hit.department,
      });
    }
  };

  // 加载模板列表
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await maintenanceAPI.getMaintenanceTemplates({ status: '启用' });
        if (response.success) {
          setTemplates(response.data || []);
        }
      } catch (error) {
        console.error('加载模板失败:', error);
      }
    };
    loadTemplates();
  }, []);

  // 初始化表单数据（编辑模式）
  useEffect(() => {
    if (record) {
      // 初始化维护项目
      if (record.maintenance_items) {
        try {
          const items =
            typeof record.maintenance_items === 'string'
              ? JSON.parse(record.maintenance_items)
              : record.maintenance_items;
          setMaintenanceItems(items || []);
        } catch (e) {
          console.error('解析维护项目失败:', e);
        }
      }

      // 初始化物料清单
      if (record.required_materials) {
        try {
          const materials =
            typeof record.required_materials === 'string'
              ? JSON.parse(record.required_materials)
              : record.required_materials;
          setRequiredMaterials(materials || []);
        } catch (e) {
          console.error('解析物料清单失败:', e);
        }
      }

      // 设置表单初始值
      form.setFieldsValue({
        ...record,
        next_maintenance_date: record.next_maintenance_date
          ? dayjs(record.next_maintenance_date)
          : undefined,
      });

      setTriggerType(record.trigger_type || 'time');
    }
  }, [record, form]);

  // 监听周期类型和周期值变化，自动计算下次维护日期
  const handleCycleChange = () => {
    const cycleType = form.getFieldValue('cycle_type');
    const cycleValue = form.getFieldValue('cycle_value');
    const nextDate = calcNextDate(cycleType, cycleValue);
    setCalculatedNextDate(nextDate);
  };

  // 应用模板
  const handleApplyTemplate = templateId => {
    const template = [...templates, ...recommendedTemplates].find(t => t.id === templateId);
    if (template) {
      form.setFieldsValue({
        template_id: template.id,
        maintenance_type: template.maintenance_type,
        cycle_type: template.cycle_type,
        cycle_value: template.cycle_value,
        estimated_hours: template.estimated_hours,
        maintenance_content: template.maintenance_content,
      });

      // 应用模板中的维护项目
      if (template.maintenance_items) {
        try {
          const items =
            typeof template.maintenance_items === 'string'
              ? JSON.parse(template.maintenance_items)
              : template.maintenance_items;
          setMaintenanceItems(items || []);
        } catch (e) {
          console.error('解析模板维护项目失败:', e);
        }
      }

      // 应用模板中的物料清单
      if (template.required_materials) {
        try {
          const materials =
            typeof template.required_materials === 'string'
              ? JSON.parse(template.required_materials)
              : template.required_materials;
          setRequiredMaterials(materials || []);
        } catch (e) {
          console.error('解析模板物料清单失败:', e);
        }
      }

      // 触发周期计算
      const nextDate = calcNextDate(template.cycle_type, template.cycle_value);
      setCalculatedNextDate(nextDate);

      message.success('模板应用成功');
    }
  };

  // 智能推荐模板
  const handleRecommendTemplates = async () => {
    const assetCode = form.getFieldValue('asset_code');
    if (!assetCode) {
      message.error('请先输入资产编号');
      return;
    }

    setLoading(true);
    try {
      const response = await maintenanceAPI.recommendTemplatesByAsset(assetCode);
      if (response.success) {
        const data = (response.data || []).sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
        setRecommendedTemplates(data);
        setShowRecommendedModal(true);
        message.success(`找到 ${data.length} 个推荐模板`);
      } else {
        message.error('获取推荐模板失败');
      }
    } catch (error) {
      console.error('推荐模板失败:', error);
      message.error('推荐模板失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 添加维护项目和物料清单
      values.maintenance_items = maintenanceItems;
      values.required_materials = requiredMaterials;

      // 转换 DatePicker 值为字符串
      if (values.next_maintenance_date) {
        values.next_maintenance_date = dayjs(values.next_maintenance_date).format('YYYY-MM-DD');
      }

      onSubmit(values);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 维护项目表格列
  const itemsColumns = [
    { title: '项目名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '标准', dataIndex: 'standard', key: 'standard' },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, item) => (
        <Space size="small">
          <Button size="small" type="link" onClick={() => editItem(item)}>
            编辑
          </Button>
          <Button size="small" type="link" danger onClick={() => deleteItem(item.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 物料清单表格列
  const materialsColumns = [
    { title: '物料名称', dataIndex: 'name', key: 'name' },
    { title: '规格', dataIndex: 'specification', key: 'specification' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, material) => (
        <Space size="small">
          <Button size="small" type="link" onClick={() => editMaterial(material)}>
            编辑
          </Button>
          <Button size="small" type="link" danger onClick={() => deleteMaterial(material.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 维护项目操作
  const addItem = () => {
    setEditingItem(null);
    itemForm.resetFields();
    setShowItemsModal(true);
  };

  const editItem = item => {
    setEditingItem(item);
    itemForm.setFieldsValue(item);
    setShowItemsModal(true);
  };

  const deleteItem = id => {
    setMaintenanceItems(maintenanceItems.filter(item => item.id !== id));
  };

  const saveItem = () => {
    itemForm.validateFields().then(values => {
      if (editingItem) {
        setMaintenanceItems(
          maintenanceItems.map(item => (item.id === editingItem.id ? { ...item, ...values } : item))
        );
      } else {
        setMaintenanceItems([...maintenanceItems, { id: Date.now(), ...values }]);
      }
      setEditingItem(null);
      setShowItemsModal(false);
      itemForm.resetFields();
    });
  };

  // 物料操作
  const addMaterial = () => {
    setEditingMaterial(null);
    materialForm.resetFields();
    setShowMaterialsModal(true);
  };

  const editMaterial = material => {
    setEditingMaterial(material);
    materialForm.setFieldsValue(material);
    setShowMaterialsModal(true);
  };

  const deleteMaterial = id => {
    setRequiredMaterials(requiredMaterials.filter(material => material.id !== id));
  };

  const saveMaterial = () => {
    materialForm.validateFields().then(values => {
      if (editingMaterial) {
        setRequiredMaterials(
          requiredMaterials.map(material =>
            material.id === editingMaterial.id ? { ...material, ...values } : material
          )
        );
      } else {
        setRequiredMaterials([...requiredMaterials, { id: Date.now(), ...values }]);
      }
      setEditingMaterial(null);
      setShowMaterialsModal(false);
      materialForm.resetFields();
    });
  };

  // 触发类型变更
  const handleTriggerTypeChange = value => {
    setTriggerType(value);
    if (value !== 'usage') {
      form.setFieldsValue({ current_usage: undefined, usage_threshold: undefined });
    }
  };

  // 应用计算日期到表单
  const applyCalculatedDate = () => {
    if (calculatedNextDate) {
      form.setFieldsValue({ next_maintenance_date: calculatedNextDate });
      message.success(`已设置下次维护日期为 ${calculatedNextDate.format('YYYY-MM-DD')}`);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <Title level={3}>{isEditing ? '编辑预防性维护计划' : '创建预防性维护计划'}</Title>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {/* 基本信息 */}
          <Divider titlePlacement="left">基本信息</Divider>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="asset_code"
                label="资产编号"
                rules={[{ required: true, message: '请输入或选择资产编号' }]}
              >
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
                    <Select.Option
                      key={a.asset_code}
                      value={a.asset_code}
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
            <Col xs={24} lg={12}>
              <Form.Item name="asset_type" label="资产类型">
                <AssetTypeSelect placeholder="请选择资产类型" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="plan_name"
                label="计划名称"
                rules={[{ required: true, message: '请输入计划名称' }]}
              >
                <Input placeholder="请输入计划名称" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="responsible_person" label="责任人">
                <Input placeholder="请输入责任人" />
              </Form.Item>
            </Col>
          </Row>

          {/* 模板选择 */}
          <Divider titlePlacement="left">模板选择</Divider>
          <Row gutter={16}>
            <Col xs={24} lg={18}>
              <Form.Item name="template_id" label="维护模板">
                <Select
                  placeholder="选择维护模板以自动填充表单"
                  onChange={handleApplyTemplate}
                  allowClear
                  onClear={() => {
                    form.setFieldsValue({
                      maintenance_type: undefined,
                      cycle_type: undefined,
                      cycle_value: undefined,
                      estimated_hours: undefined,
                      maintenance_content: undefined,
                    });
                    setMaintenanceItems([]);
                    setRequiredMaterials([]);
                    setCalculatedNextDate(null);
                  }}
                >
                  {templates.map(template => (
                    <Option key={template.id} value={template.id}>
                      {template.template_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} lg={6} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 24 }}>
              <Button type="dashed" onClick={handleRecommendTemplates} loading={loading} block={isMobile}>
                智能推荐
              </Button>
            </Col>
          </Row>

          {/* 维护配置 */}
          <Divider titlePlacement="left">维护配置</Divider>
          <Row gutter={16}>
            <Col xs={24} lg={8}>
              <Form.Item
                name="maintenance_type"
                label="维护类型"
                rules={[{ required: true, message: '请选择维护类型' }]}
              >
                <Select placeholder="请选择维护类型">
                  <Option value="日常维护">日常维护</Option>
                  <Option value="定期维护">定期维护</Option>
                  <Option value="专项维护">专项维护</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item
                name="trigger_type"
                label="触发类型"
                rules={[{ required: true, message: '请选择触发类型' }]}
              >
                <Select placeholder="请选择触发类型" onChange={handleTriggerTypeChange}>
                  <Option value="time">时间</Option>
                  <Option value="usage">使用量</Option>
                  <Option value="condition">条件</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item name="estimated_hours" label="预计工时（小时）">
                <InputNumber placeholder="请输入预计工时" min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {/* 使用量相关字段 - 仅在 trigger_type='usage' 时显示 */}
          {triggerType === 'usage' && (
            <Row gutter={16}>
              <Col xs={24} lg={12}>
                <Form.Item name="current_usage" label="当前使用量">
                  <InputNumber placeholder="请输入当前使用量" min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} lg={12}>
                <Form.Item name="usage_threshold" label="使用量阈值">
                  <InputNumber placeholder="请输入使用量阈值" min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* 周期配置 */}
          <Row gutter={16}>
            <Col xs={24} lg={8}>
              <Form.Item
                name="cycle_type"
                label="周期类型"
                rules={[{ required: true, message: '请选择周期类型' }]}
              >
                <Select placeholder="请选择周期类型" onChange={handleCycleChange}>
                  <Option value="按天">天</Option>
                  <Option value="按周">周</Option>
                  <Option value="按月">月</Option>
                  <Option value="按季度">季度</Option>
                  <Option value="按年">年</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item
                name="cycle_value"
                label="周期值"
                rules={[{ required: true, message: '请输入周期值' }]}
              >
                <InputNumber
                  placeholder="请输入周期值"
                  min={1}
                  style={{ width: '100%' }}
                  onChange={handleCycleChange}
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item
                name="next_maintenance_date"
                label="下次维护日期"
                rules={[{ required: true, message: '请选择下次维护日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              {calculatedNextDate && (
                <div style={{ marginTop: -20, marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    建议日期：{calculatedNextDate.format('YYYY-MM-DD')}
                    <Button type="link" size="small" onClick={applyCalculatedDate} style={{ padding: '0 4px' }}>
                      应用
                    </Button>
                  </Text>
                </div>
              )}
            </Col>
          </Row>

          {/* 维护内容 */}
          <Divider titlePlacement="left">维护内容</Divider>
          <Form.Item name="maintenance_content" label="维护内容">
            <TextArea rows={4} placeholder="请输入维护内容" />
          </Form.Item>

          {/* 维护项目 */}
          <Form.Item label="维护项目">
            <Button type="primary" onClick={addItem} style={{ marginBottom: 8 }} block={isMobile}>
              添加维护项目
            </Button>
            <div className="hide-on-mobile">
              <Table
                columns={itemsColumns}
                dataSource={maintenanceItems}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: '暂无维护项目' }}
              />
            </div>
            <div className="mobile-table-cards show-on-mobile">
              {Array.isArray(maintenanceItems) && maintenanceItems.length > 0 ? (
                maintenanceItems.map(item => (
                  <div key={item.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{item.name || '-'}</span>
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">描述</span>
                        <span className="mobile-card-value">{item.description || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">标准</span>
                        <span className="mobile-card-value">{item.standard || '-'}</span>
                      </div>
                    </div>
                    <div className="mobile-card-actions">
                      <Button
                        type="primary"
                        size="small"
                        block
                        onClick={() => editItem(item)}
                      >
                        编辑
                      </Button>
                      <Button
                        type="primary"
                        size="small"
                        danger
                        block
                        onClick={() => deleteItem(item.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty description="暂无维护项目" />
              )}
            </div>
          </Form.Item>

          {/* 所需物料 */}
          <Form.Item label="所需物料">
            <Button type="primary" onClick={addMaterial} style={{ marginBottom: 8 }} block={isMobile}>
              添加所需物料
            </Button>
            <div className="hide-on-mobile">
              <Table
                columns={materialsColumns}
                dataSource={requiredMaterials}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: '暂无所需物料' }}
              />
            </div>
            <div className="mobile-table-cards show-on-mobile">
              {Array.isArray(requiredMaterials) && requiredMaterials.length > 0 ? (
                requiredMaterials.map(material => (
                  <div key={material.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{material.name || '-'}</span>
                      {material.unit && <Tag color="blue">{material.unit}</Tag>}
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">规格</span>
                        <span className="mobile-card-value">{material.specification || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">数量</span>
                        <span className="mobile-card-value">{material.quantity ?? '-'}</span>
                      </div>
                    </div>
                    <div className="mobile-card-actions">
                      <Button
                        type="primary"
                        size="small"
                        block
                        onClick={() => editMaterial(material)}
                      >
                        编辑
                      </Button>
                      <Button
                        type="primary"
                        size="small"
                        danger
                        block
                        onClick={() => deleteMaterial(material.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty description="暂无所需物料" />
              )}
            </div>
          </Form.Item>

          {/* 其他设置 */}
          <Divider titlePlacement="left">其他设置</Divider>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item name="auto_generate_workorder" valuePropName="checked" label="自动生成工单">
                <Checkbox>开启自动生成工单</Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>

          {/* 提醒设置 */}
          <Divider titlePlacement="left">提醒设置</Divider>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} lg={8}>
                <Form.Item name="reminder_days" label="提前提醒天数" initialValue={7}>
                  <InputNumber placeholder="天数" min={1} max={30} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} lg={8}>
                <Form.Item name="reminder_types" label="提醒方式" initialValue={['system']}>
                  <Select
                    mode="multiple"
                    placeholder="请选择提醒方式"
                    options={[
                      { value: 'system', label: '系统通知' },
                      { value: 'email', label: '邮件' },
                      { value: 'sms', label: '短信' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} lg={8}>
                <Form.Item name="reminder_recipient" label="提醒接收人">
                  <Input placeholder="多个用逗号分隔" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* 提交按钮 */}
          <Form.Item>
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'flex-end',
              gap: isMobile ? 8 : 0,
            }}>
              <Button onClick={onCancel} block={isMobile} style={{ marginRight: isMobile ? 0 : 8 }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" block={isMobile}>
                保存
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>

      {/* 维护项目编辑模态框 */}
      <Modal
        title={editingItem ? '编辑维护项目' : '添加维护项目'}
        open={showItemsModal}
        onOk={saveItem}
        onCancel={() => {
          setShowItemsModal(false);
          setEditingItem(null);
          itemForm.resetFields();
        }}
        destroyOnHidden
        width={isMobile ? '95vw' : 520}
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="请输入项目描述" />
          </Form.Item>
          <Form.Item name="standard" label="标准">
            <TextArea rows={2} placeholder="请输入验收标准" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 物料编辑模态框 */}
      <Modal
        title={editingMaterial ? '编辑物料' : '添加物料'}
        open={showMaterialsModal}
        onOk={saveMaterial}
        onCancel={() => {
          setShowMaterialsModal(false);
          setEditingMaterial(null);
          materialForm.resetFields();
        }}
        destroyOnHidden
        width={isMobile ? '95vw' : 520}
      >
        <Form form={materialForm} layout="vertical">
          <Form.Item
            name="name"
            label="物料名称"
            rules={[{ required: true, message: '请输入物料名称' }]}
          >
            <Input placeholder="请输入物料名称" />
          </Form.Item>
          <Form.Item name="specification" label="规格">
            <Input placeholder="请输入物料规格" />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="数量"
            rules={[{ required: true, message: '请输入数量' }]}
          >
            <InputNumber placeholder="请输入数量" min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请输入单位' }]}>
            <Input placeholder="请输入单位" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 推荐模板模态框 */}
      <Modal
        title="智能推荐维护模板"
        open={showRecommendedModal}
        onCancel={() => setShowRecommendedModal(false)}
        width={isMobile ? '95vw' : 800}
        footer={[
          <Button key="close" onClick={() => setShowRecommendedModal(false)} block={isMobile}>
            关闭
          </Button>,
        ]}
      >
        {recommendedTemplates.length > 0 ? (
          <>
            <div className="hide-on-mobile">
              <Table
                columns={[
                  {
                    title: '模板名称',
                    dataIndex: 'template_name',
                    key: 'template_name',
                  },
                  {
                    title: '资产类型',
                    dataIndex: 'asset_type',
                    key: 'asset_type',
                  },
                  {
                    title: '品牌',
                    dataIndex: 'brand',
                    key: 'brand',
                  },
                  {
                    title: '型号',
                    dataIndex: 'model',
                    key: 'model',
                  },
                  {
                    title: '匹配度',
                    dataIndex: 'match_score',
                    key: 'match_score',
                    sorter: (a, b) => (a.match_score || 0) - (b.match_score || 0),
                    render: score => {
                      if (score >= 3) return <Text type="success">完全匹配</Text>;
                      if (score >= 2) return <Text type="warning">品牌匹配</Text>;
                      if (score >= 1) return <Text type="secondary">类型匹配</Text>;
                      return '未知';
                    },
                  },
                  {
                    title: '操作',
                    key: 'action',
                    render: (_, tpl) => (
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => {
                          handleApplyTemplate(tpl.id);
                          setShowRecommendedModal(false);
                        }}
                      >
                        应用
                      </Button>
                    ),
                  },
                ]}
                dataSource={recommendedTemplates}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </div>
            <div className="mobile-table-cards show-on-mobile">
              {recommendedTemplates.map(tpl => {
                const score = tpl.match_score || 0;
                let matchTag;
                if (score >= 3) matchTag = <Tag color="green">完全匹配</Tag>;
                else if (score >= 2) matchTag = <Tag color="orange">品牌匹配</Tag>;
                else if (score >= 1) matchTag = <Tag color="blue">类型匹配</Tag>;
                else matchTag = <Tag>未知</Tag>;
                return (
                  <div key={tpl.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{tpl.template_name || '-'}</span>
                      {matchTag}
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">资产类型</span>
                        <span className="mobile-card-value">{tpl.asset_type || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">品牌</span>
                        <span className="mobile-card-value">{tpl.brand || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">型号</span>
                        <span className="mobile-card-value">{tpl.model || '-'}</span>
                      </div>
                    </div>
                    <div className="mobile-card-actions">
                      <Button
                        type="primary"
                        size="small"
                        block
                        onClick={() => {
                          handleApplyTemplate(tpl.id);
                          setShowRecommendedModal(false);
                        }}
                      >
                        应用
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <Empty description="暂无推荐模板" />
        )}
      </Modal>
    </div>
  );
};

export default PreventiveMaintenanceForm;
