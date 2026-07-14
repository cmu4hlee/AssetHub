import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  message,
  Table,
  Input,
  Select,
  Button,
  Space,
  Modal,
  Tag,
  Popconfirm,
  Form,
  Drawer,
  Descriptions,
  InputNumber,
  Row,
  Col,
  Divider,
  Tooltip,
} from 'antd';

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ScheduleOutlined,
  EyeOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { maintenanceAPI, assetAPI } from '../utils/api';
import { useIsMobile, useCan } from '../hooks';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

const MaintenanceTemplateList = () => {
  const canDelete = useCan('maintenance', 'delete');
  const canEdit = useCan('maintenance', 'edit');
  const isMobile = useIsMobile();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useState({
    asset_type: '',
    brand: '',
    model: '',
    status: '',
  });
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [relatedPlans, setRelatedPlans] = useState([]);
  const [createPlanModalVisible, setCreatePlanModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [planForm] = Form.useForm();
  const [createPlanAssets, setCreatePlanAssets] = useState([]);
  const [createPlanAssetLoading, setCreatePlanAssetLoading] = useState(false);

  // 创建计划 — 资产可搜索下拉
  const handleCreatePlanAssetSearch = keyword => {
    if (!keyword || keyword.length < 1) {
      setCreatePlanAssets([]);
      return;
    }
    setCreatePlanAssetLoading(true);
    assetAPI
      .getAssets({ keyword, page: 1, pageSize: 20 })
      .then(res => setCreatePlanAssets(res?.data || []))
      .catch(err => console.error('搜索资产失败:', err))
      .finally(() => setCreatePlanAssetLoading(false));
  };
  const handleCreatePlanAssetChange = value => {
    const hit = createPlanAssets.find(a => a.asset_code === value);
    if (hit) {
      planForm.setFieldsValue({
        asset_code: hit.asset_code,
        asset_name: hit.asset_name,
        department: hit.department_new || hit.department,
      });
    }
  };

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const response = await maintenanceAPI.getMaintenanceTemplates(searchParams);
      if (response.success) {
        setData(response.data || []);
      } else {
        message.error('加载维护计划模板失败');
      }
    } catch (error) {
      console.error('加载维护计划模板失败:', error);
      message.error('网络错误，加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchParams]);

  // 处理搜索
  const handleSearch = values => {
    setSearchParams(values);
  };

  // 处理创建
  const handleCreate = () => {
    setEditingRecord(null);
    setIsEditing(false);
    form.resetFields();
    setIsModalVisible(true);
  };

  // 处理编辑
  const handleEdit = record => {
    setEditingRecord(record);
    setIsEditing(true);
    setIsModalVisible(true);
  };

  // 处理删除
  const handleDelete = async id => {
    try {
      const response = await maintenanceAPI.deleteMaintenanceTemplate(id);
      if (response.success) {
        message.success('删除成功');
        loadData();
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('网络错误，删除失败');
    }
  };

  // 查看模板详情
  const handleViewDetail = async record => {
    setDetailRecord(record);
    setDetailVisible(true);
    // 加载关联的计划
    try {
      const response = await maintenanceAPI.getMaintenancePlans({ keyword: record.template_name, pageSize: 50 });
      if (response.success) {
        // 筛选关联此模板的计划
        const plans = (response.data || []).filter(p => p.template_id === record.id);
        setRelatedPlans(plans);
      }
    } catch (e) {
      console.warn('加载关联计划失败:', e);
    }
  };

  // 从模板创建计划
  const handleCreatePlanFromTemplate = template => {
    setSelectedTemplate(template);
    planForm.resetFields();
    // 用模板数据预填表单
    planForm.setFieldsValue({
      plan_name: `${template.template_name} - 维护计划`,
      maintenance_type: template.maintenance_type,
      cycle_type: template.cycle_type,
      cycle_value: template.cycle_value,
      estimated_hours: template.estimated_hours,
      maintenance_content: template.maintenance_content,
      template_id: template.id,
    });
    setCreatePlanModalVisible(true);
  };

  // 提交创建计划
  const handleCreatePlanSubmit = async values => {
    try {
      // 处理日期
      const payload = {
        ...values,
        next_maintenance_date: values.next_maintenance_date
          ? values.next_maintenance_date.format('YYYY-MM-DD')
          : undefined,
      };
      const response = await maintenanceAPI.createMaintenancePlan(payload);
      if (response.success) {
        message.success('维护计划创建成功');
        setCreatePlanModalVisible(false);
        setDetailVisible(false);
        loadData();
      } else {
        message.error(response.message || '创建失败');
      }
    } catch (error) {
      console.error('创建维护计划失败:', error);
      message.error('创建维护计划失败');
    }
  };

  // 处理模板提交
  const handleSubmit = async values => {
    try {
      let response;
      if (isEditing && editingRecord) {
        response = await maintenanceAPI.updateMaintenanceTemplate(editingRecord.id, values);
      } else {
        response = await maintenanceAPI.createMaintenanceTemplate(values);
      }
      if (response.success) {
        message.success(isEditing ? '更新成功' : '创建成功');
        setIsModalVisible(false);
        loadData();
      } else {
        message.error(isEditing ? '更新失败' : '创建失败');
      }
    } catch (error) {
      console.error(isEditing ? '更新失败:' : '创建失败:', error);
      message.error('网络错误，操作失败');
    }
  };

  // 处理取消
  const handleCancel = () => {
    setIsModalVisible(false);
  };

  // 状态标签
  const statusTag = status => {
    switch (status) {
      case '启用':
        return <Tag color="green">启用</Tag>;
      case '停用':
      case '禁用':
        return <Tag color="red">停用</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // 解析维护项目数量
  const getItemsCount = items => {
    if (!items) return 0;
    try {
      const parsed = typeof items === 'string' ? JSON.parse(items) : items;
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };

  // 列定义
  const columns = [
    {
      title: '模板名称',
      dataIndex: 'template_name',
      key: 'template_name',
      ellipsis: true,
      render: (text, record) => (
        <Button type="link" size="small" onClick={() => handleViewDetail(record)} style={{ padding: 0 }}>
          {text}
        </Button>
      ),
    },
    {
      title: '资产类型',
      dataIndex: 'asset_type',
      key: 'asset_type',
      ellipsis: true,
      render: text => text || <Tag>通用</Tag>,
    },
    {
      title: '品牌/型号',
      key: 'brand_model',
      ellipsis: true,
      render: (_, record) => {
        const parts = [record.brand, record.model].filter(Boolean);
        return parts.length > 0 ? parts.join(' / ') : <Tag>通用</Tag>;
      },
    },
    {
      title: '维护周期',
      key: 'cycle',
      render: (_, record) =>
        record.cycle_type ? `${record.cycle_value || ''}${record.cycle_type}` : '-',
    },
    {
      title: '维护项目',
      key: 'items_count',
      align: 'center',
      render: (_, record) => {
        const count = getItemsCount(record.maintenance_items);
        return count > 0 ? <Tag color="blue">{count} 项</Tag> : '-';
      },
    },
    {
      title: '预计工时',
      dataIndex: 'estimated_hours',
      key: 'estimated_hours',
      render: hours => (hours ? `${hours}h` : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => statusTag(status),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button icon={<EyeOutlined />} size="small" onClick={() => handleViewDetail(record)} />
          </Tooltip>
          <Tooltip title="从模板创建计划">
            <Button
              type="default"
              icon={<ScheduleOutlined />}
              size="small"
              onClick={() => handleCreatePlanFromTemplate(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="primary"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button danger icon={<DeleteOutlined />} disabled={!canDelete} size="small" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 关联计划列定义
  const planColumns = [
    { title: '计划名称', dataIndex: 'plan_name', key: 'plan_name', ellipsis: true },
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code', ellipsis: true },
    {
      title: '下次维护',
      dataIndex: 'next_maintenance_date',
      key: 'next_maintenance_date',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => statusTag(status),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>维护计划模板</Title>

      {/* 搜索栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item name="asset_type" label="资产类型">
            <Input placeholder="输入资产类型" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="brand" label="品牌">
            <Input placeholder="输入品牌" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="model" label="型号">
            <Input placeholder="输入型号" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="选择状态" style={{ width: 100 }} allowClear>
              <Option value="启用">启用</Option>
              <Option value="停用">停用</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              添加模板
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 数据表格 */}
      <Card>
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            rowKey="id"
            scroll={{ x: 1000 }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
          ) : Array.isArray(data) && data.length > 0 ? (
            data.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.template_name}</span>
                  <Tag color="blue">{record.category || '-'}</Tag>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">模板类型</span>
                    <span className="mobile-card-value">{record.template_type || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">维护类型</span>
                    <span className="mobile-card-value">{record.maintenance_type || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">周期</span>
                    <span className="mobile-card-value">{record.frequency || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">预计工时</span>
                    <span className="mobile-card-value">{record.estimated_hours || '-'}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
          )}
        </div>
      </Card>

      {/* 模板详情 Drawer */}
      <Drawer
        title="模板详情"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        styles={{ wrapper: { width: 640 } }}
        extra={
          detailRecord && (
            <Button
              type="primary"
              icon={<ScheduleOutlined />}
              onClick={() => handleCreatePlanFromTemplate(detailRecord)}
            >
              创建维护计划
            </Button>
          )
        }
      >
        {detailRecord && (
          <>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="模板名称">{detailRecord.template_name}</Descriptions.Item>
              <Descriptions.Item label="资产类型">
                {detailRecord.asset_type || '通用'}
              </Descriptions.Item>
              <Descriptions.Item label="品牌">
                {detailRecord.brand || '通用'}
              </Descriptions.Item>
              <Descriptions.Item label="型号">
                {detailRecord.model || '通用'}
              </Descriptions.Item>
              <Descriptions.Item label="维护周期">
                {detailRecord.cycle_type
                  ? `${detailRecord.cycle_value || ''}${detailRecord.cycle_type}`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="预计工时">
                {detailRecord.estimated_hours ? `${detailRecord.estimated_hours} 小时` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {statusTag(detailRecord.status)}
              </Descriptions.Item>
              <Descriptions.Item label="维护内容">
                {detailRecord.maintenance_content || '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* 维护项目列表 */}
            {getItemsCount(detailRecord.maintenance_items) > 0 && (
              <>
                <Divider titlePlacement="left" orientationMargin={0}>
                  维护项目 ({getItemsCount(detailRecord.maintenance_items)} 项)
                </Divider>
                {(() => {
                  try {
                    const items =
                      typeof detailRecord.maintenance_items === 'string'
                        ? JSON.parse(detailRecord.maintenance_items)
                        : detailRecord.maintenance_items;
                    return (
                      <ul style={{ paddingLeft: 20, margin: 0 }}>
                        {items.map((item, i) => (
                          <li key={i}>
                            <strong>{item.name}</strong>
                            {item.description ? ` - ${item.description}` : ''}
                            {item.standard ? ` (标准: ${item.standard})` : ''}
                          </li>
                        ))}
                      </ul>
                    );
                  } catch {
                    return <Text type="secondary">解析失败</Text>;
                  }
                })()}
              </>
            )}

            {/* 关联的维护计划 */}
            <Divider titlePlacement="left" orientationMargin={0}>
              关联维护计划 ({relatedPlans.length})
            </Divider>
            {relatedPlans.length > 0 ? (
              <Table
                columns={planColumns}
                dataSource={relatedPlans}
                rowKey="id"
                size="small"
                pagination={false}
              />
            ) : (
              <Text type="secondary">暂无使用此模板的维护计划</Text>
            )}
          </>
        )}
      </Drawer>

      {/* 模板编辑 Modal */}
      <Modal
        title={isEditing ? '编辑维护计划模板' : '创建维护计划模板'}
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={handleCancel}
        styles={{ wrapper: { width: 700 } }}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editingRecord || { status: '启用' }}
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="template_name"
                label="模板名称"
                rules={[{ required: true, message: '请输入模板名称' }]}
              >
                <Input placeholder="请输入模板名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="asset_type" label="资产类型">
                <Input placeholder="通用留空" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="brand" label="品牌">
                <Input placeholder="通用留空" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="model" label="型号">
                <Input placeholder="通用留空" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="cycle_type" label="周期类型">
                <Select placeholder="请选择周期类型">
                  <Option value="按天">天</Option>
                  <Option value="按周">周</Option>
                  <Option value="按月">月</Option>
                  <Option value="按季度">季度</Option>
                  <Option value="按年">年</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="cycle_value" label="周期值">
                <InputNumber placeholder="周期值" min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="estimated_hours" label="预计工时(小时)">
                <InputNumber placeholder="预计工时" min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="maintenance_content" label="维护内容">
            <Input.TextArea rows={4} placeholder="请输入维护内容" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Option value="启用">启用</Option>
              <Option value="停用">停用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 从模板创建计划 Modal */}
      <Modal
        title={
          selectedTemplate
            ? `从模板创建维护计划 - ${selectedTemplate.template_name}`
            : '创建维护计划'
        }
        open={createPlanModalVisible}
        onOk={() => planForm.submit()}
        onCancel={() => setCreatePlanModalVisible(false)}
        styles={{ wrapper: { width: 700 } }}
        destroyOnHidden
      >
        <Form form={planForm} layout="vertical" onFinish={handleCreatePlanSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="asset_code"
                label="资产编号"
                rules={[{ required: true, message: '请输入或选择资产编号' }]}
              >
                <Select
                  showSearch
                  placeholder="输入资产编号或名称关键字"
                  loading={createPlanAssetLoading}
                  filterOption={false}
                  onSearch={handleCreatePlanAssetSearch}
                  onChange={handleCreatePlanAssetChange}
                  notFoundContent={createPlanAssetLoading ? '加载中...' : '未找到匹配资产'}
                  optionLabelProp="label"
                >
                  {createPlanAssets.map(asset => (
                    <Option
                      key={asset.asset_code}
                      value={asset.asset_code}
                      label={`${asset.asset_code} - ${asset.asset_name}`}
                    >
                      <div>
                        <div>{asset.asset_code} - {asset.asset_name}</div>
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
              <Form.Item
                name="plan_name"
                label="计划名称"
                rules={[{ required: true, message: '请输入计划名称' }]}
              >
                <Input placeholder="请输入计划名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="maintenance_type" label="维护类型">
                <Select>
                  <Option value="日常维护">日常维护</Option>
                  <Option value="定期维护">定期维护</Option>
                  <Option value="专项维护">专项维护</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="trigger_type" label="触发类型">
                <Select placeholder="选择触发类型">
                  <Option value="time">时间</Option>
                  <Option value="usage">使用量</Option>
                  <Option value="condition">条件</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="cycle_type" label="周期类型">
                <Select>
                  <Option value="按天">天</Option>
                  <Option value="按周">周</Option>
                  <Option value="按月">月</Option>
                  <Option value="按季度">季度</Option>
                  <Option value="按年">年</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="cycle_value" label="周期值">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="next_maintenance_date"
                label="下次维护日期"
                rules={[{ required: true, message: '请选择下次维护日期' }]}
              >
                <Input type="date" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="responsible_person" label="责任人">
                <Input placeholder="责任人" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="maintenance_content" label="维护内容">
            <Input.TextArea rows={3} placeholder="维护内容" />
          </Form.Item>
          <Form.Item name="template_id" hidden>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MaintenanceTemplateList;
