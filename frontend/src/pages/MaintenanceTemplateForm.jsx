import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Button,
  Form,
  Input,
  Select,
  message,
  Checkbox,
  Table,
  Modal,
  Space,
  InputNumber,
  Tag,
  Empty,
} from 'antd';

import { maintenanceAPI } from '../utils/api';
import AssetTypeSelect from '../components/AssetTypeSelect';
import useIsMobile from '../hooks/useIsMobile';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const parseArrayField = (value, errorMessage) => {
  if (!value) return [];

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(errorMessage, error);
    return [];
  }
};

const MaintenanceTemplateForm = ({ record, isEditing, onSubmit, onCancel }) => {
  const [form] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [materialForm] = Form.useForm();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [maintenanceItems, setMaintenanceItems] = useState([]);
  const [requiredMaterials, setRequiredMaterials] = useState([]);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);

  useEffect(() => {
    if (!record) return;

    form.setFieldsValue(record);
    const nextMaintenanceItems = parseArrayField(record.maintenance_items, '解析维护项目失败:');
    const nextRequiredMaterials = parseArrayField(record.required_materials, '解析物料清单失败:');

    queueMicrotask(() => {
      setMaintenanceItems(nextMaintenanceItems);
      setRequiredMaterials(nextRequiredMaterials);
    });
  }, [record, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      values.maintenance_items = maintenanceItems;
      values.required_materials = requiredMaterials;
      onSubmit(values);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const itemsColumns = [
    { title: '项目名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '标准', dataIndex: 'standard', key: 'standard' },
    {
      title: '操作',
      key: 'action',
      render: (_, item) => (
        <Space size="middle">
          <Button size="small" onClick={() => editItem(item)}>
            编辑
          </Button>
          <Button size="small" danger onClick={() => deleteItem(item.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const materialsColumns = [
    { title: '物料名称', dataIndex: 'name', key: 'name' },
    { title: '规格', dataIndex: 'specification', key: 'specification' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    {
      title: '操作',
      key: 'action',
      render: (_, material) => (
        <Space size="middle">
          <Button size="small" onClick={() => editMaterial(material)}>
            编辑
          </Button>
          <Button size="small" danger onClick={() => deleteMaterial(material.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const editItem = item => {
    setEditingItem(item);
    setShowItemsModal(true);
  };

  const deleteItem = id => {
    setMaintenanceItems(maintenanceItems.filter(item => item.id !== id));
  };

  const editMaterial = material => {
    setEditingMaterial(material);
    setShowMaterialsModal(true);
  };

  const deleteMaterial = id => {
    setRequiredMaterials(requiredMaterials.filter(material => material.id !== id));
  };

  const saveItem = values => {
    if (editingItem) {
      setMaintenanceItems(
        maintenanceItems.map(item => (item.id === editingItem.id ? { ...item, ...values } : item))
      );
    } else {
      const newItem = {
        id: Date.now(),
        ...values,
      };
      setMaintenanceItems([...maintenanceItems, newItem]);
    }
    setEditingItem(null);
    setShowItemsModal(false);
  };

  const saveMaterial = values => {
    if (editingMaterial) {
      setRequiredMaterials(
        requiredMaterials.map(material =>
          material.id === editingMaterial.id ? { ...material, ...values } : material
        )
      );
    } else {
      const newMaterial = {
        id: Date.now(),
        ...values,
      };
      setRequiredMaterials([...requiredMaterials, newMaterial]);
    }
    setEditingMaterial(null);
    setShowMaterialsModal(false);
  };

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>{isEditing ? '编辑维护计划模板' : '创建维护计划模板'}</Title>
      <Card>
        <Form form={form} layout="vertical" initialValues={record} onFinish={handleSubmit}>
          <Form.Item
            name="template_name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>
          <Form.Item name="asset_type" label="资产类型">
            <AssetTypeSelect placeholder="请选择资产类型" />
          </Form.Item>
          <Form.Item name="brand" label="品牌">
            <Input placeholder="请输入品牌" />
          </Form.Item>
          <Form.Item name="model" label="型号">
            <Input placeholder="请输入型号" />
          </Form.Item>
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
          <Form.Item
            name="cycle_type"
            label="周期类型"
            rules={[{ required: true, message: '请选择周期类型' }]}
          >
            <Select placeholder="请选择周期类型">
              <Option value="按天">天</Option>
              <Option value="按周">周</Option>
              <Option value="按月">月</Option>
              <Option value="按季度">季度</Option>
              <Option value="按年">年</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="cycle_value"
            label="周期值"
            rules={[{ required: true, message: '请输入周期值' }]}
          >
            <InputNumber placeholder="请输入周期值" style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="estimated_hours" label="预计工时">
            <InputNumber placeholder="请输入预计工时" style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="maintenance_content" label="维护内容">
            <TextArea rows={4} placeholder="请输入维护内容" />
          </Form.Item>
          <Form.Item label="维护项目">
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                onClick={() => setShowItemsModal(true)}
                block={isMobile}
              >
                添加维护项目
              </Button>
              <div className="hide-on-mobile">
                <Table
                  columns={itemsColumns}
                  dataSource={maintenanceItems}
                  rowKey="id"
                  pagination={false}
                  style={{ marginTop: 8 }}
                />
              </div>
              <div className="mobile-table-cards show-on-mobile" style={{ marginTop: 8 }}>
                {Array.isArray(maintenanceItems) && maintenanceItems.length > 0 ? (
                  maintenanceItems.map(record => (
                    <div key={record.id} className="mobile-card-item">
                      <div className="mobile-card-header">
                        <span className="mobile-card-title">{record.name || '-'}</span>
                      </div>
                      <div className="mobile-card-body">
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">描述</span>
                          <span className="mobile-card-value">{record.description || '-'}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">标准</span>
                          <span className="mobile-card-value">{record.standard || '-'}</span>
                        </div>
                      </div>
                      <div className="mobile-card-actions">
                        <Button
                          type="primary"
                          size="small"
                          block
                          onClick={() => editItem(record)}
                        >
                          编辑
                        </Button>
                        <Button
                          type="primary"
                          size="small"
                          danger
                          block
                          onClick={() => deleteItem(record.id)}
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
            </Space>
          </Form.Item>
          <Form.Item label="所需物料">
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                onClick={() => setShowMaterialsModal(true)}
                block={isMobile}
              >
                添加所需物料
              </Button>
              <div className="hide-on-mobile">
                <Table
                  columns={materialsColumns}
                  dataSource={requiredMaterials}
                  rowKey="id"
                  pagination={false}
                  style={{ marginTop: 8 }}
                />
              </div>
              <div className="mobile-table-cards show-on-mobile" style={{ marginTop: 8 }}>
                {Array.isArray(requiredMaterials) && requiredMaterials.length > 0 ? (
                  requiredMaterials.map(record => (
                    <div key={record.id} className="mobile-card-item">
                      <div className="mobile-card-header">
                        <span className="mobile-card-title">{record.name || '-'}</span>
                        {record.unit && <Tag color="blue">{record.unit}</Tag>}
                      </div>
                      <div className="mobile-card-body">
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">规格</span>
                          <span className="mobile-card-value">
                            {record.specification || '-'}
                          </span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">数量</span>
                          <span className="mobile-card-value">{record.quantity ?? '-'}</span>
                        </div>
                      </div>
                      <div className="mobile-card-actions">
                        <Button
                          type="primary"
                          size="small"
                          block
                          onClick={() => editMaterial(record)}
                        >
                          编辑
                        </Button>
                        <Button
                          type="primary"
                          size="small"
                          danger
                          block
                          onClick={() => deleteMaterial(record.id)}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty description="暂无物料" />
                )}
              </div>
            </Space>
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
            initialValue="启用"
          >
            <Select placeholder="请选择状态">
              <Option value="启用">启用</Option>
              <Option value="停用">停用</Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
          <Form.Item>
            <div
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'flex-end',
                gap: isMobile ? 8 : 0,
              }}
            >
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

      <Modal
        title={editingItem ? '编辑维护项目' : '添加维护项目'}
        open={showItemsModal}
        onOk={() => {
          itemForm.validateFields().then(values => {
            saveItem(values);
          });
        }}
        onCancel={() => {
          setShowItemsModal(false);
          setEditingItem(null);
        }}
        width={isMobile ? '95vw' : 520}
      >
        <Form form={itemForm} initialValues={editingItem}>
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

      <Modal
        title={editingMaterial ? '编辑物料' : '添加物料'}
        open={showMaterialsModal}
        onOk={() => {
          materialForm.validateFields().then(values => {
            saveMaterial(values);
          });
        }}
        onCancel={() => {
          setShowMaterialsModal(false);
          setEditingMaterial(null);
        }}
        width={isMobile ? '95vw' : 520}
      >
        <Form form={materialForm} initialValues={editingMaterial}>
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
            <InputNumber placeholder="请输入数量" style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请输入单位' }]}>
            <Input placeholder="请输入单位" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MaintenanceTemplateForm;
