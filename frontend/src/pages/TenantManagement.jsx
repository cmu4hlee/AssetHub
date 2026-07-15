import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Row,
  Col,
  Divider,
  Alert,
  Tabs,
  Switch,
  Popconfirm,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { tenantAPI, rolesPermissionsAPI } from '../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const TenantManagement = () => {
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    keyword: '',
    status: '',
  });

  // 创建/编辑租户模态框
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('创建租户');
  const [editingTenant, setEditingTenant] = useState(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // 租户配置模态框
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantModules, setTenantModules] = useState([]);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleSaving, setModuleSaving] = useState(false);
  const [moduleChanges, setModuleChanges] = useState({});

  useEffect(() => {
    loadTenants();
  }, [pagination.current, pagination.pageSize]);

  // 加载租户列表
  const loadTenants = async () => {
    try {
      setLoading(true);
      const result = await tenantAPI.getTenants({
        page: pagination.current,
        pageSize: pagination.pageSize,
        keyword: filters.keyword || undefined,
        status: filters.status || undefined,
      });
      if (result.success) {
        setTenants(result.data);
        setPagination({
          ...pagination,
          total: result.pagination.total,
        });
      }
    } catch (error) {
      message.error('加载租户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 打开创建租户模态框
  const handleCreate = () => {
    setModalTitle('创建租户');
    setEditingTenant(null);
    form.resetFields();
    form.setFieldsValue({
      max_users: 100,
      max_assets: 10000,
      subscription_type: 'standard',
    });
    setModalVisible(true);
  };

  // 打开编辑租户模态框
  const handleEdit = tenant => {
    setModalTitle('编辑租户');
    setEditingTenant(tenant);
    form.setFieldsValue({
      ...tenant,
      subscription_start_date: tenant.subscription_start_date ? dayjs(tenant.subscription_start_date) : null,
      subscription_end_date: tenant.subscription_end_date ? dayjs(tenant.subscription_end_date) : null,
    });
    setModalVisible(true);
  };

  // 保存租户
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const data = {
        ...values,
        subscription_start_date: values.subscription_start_date?.format('YYYY-MM-DD'),
        subscription_end_date: values.subscription_end_date?.format('YYYY-MM-DD'),
      };

      let result;
      if (editingTenant) {
        result = await tenantAPI.updateTenant(editingTenant.id, data);
      } else {
        result = await tenantAPI.createTenant(data);
      }

      if (result.success) {
        message.success(editingTenant ? '更新成功' : '创建成功');
        setModalVisible(false);
        loadTenants();
      }
    } catch (error) {
      message.error(error.response?.data?.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除/停用租户
  const handleDelete = async id => {
    try {
      const result = await tenantAPI.deleteTenant(id);
      if (result.success) {
        message.success('租户已停用');
        loadTenants();
      }
    } catch (error) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  // 打开租户配置模态框
  const handleConfig = tenant => {
    setSelectedTenant(tenant);
    setConfigModalVisible(true);
    loadTenantModules(tenant.id);
  };

  // 加载租户模块配置
  const loadTenantModules = async tenantId => {
    try {
      setModuleLoading(true);
      const result = await tenantAPI.getTenantModules(tenantId);
      if (result && Array.isArray(result)) {
        setTenantModules(result);
        // 初始化变更追踪
        const initialChanges = {};
        result.forEach(m => { initialChanges[m.module_id] = m.enabled; });
        setModuleChanges(initialChanges);
      } else {
        setTenantModules([]);
        setModuleChanges({});
      }
    } catch (error) {
      console.error('加载租户模块配置失败:', error);
      message.error('加载模块配置失败');
    } finally {
      setModuleLoading(false);
    }
  };

  // 切换模块启用状态
  const handleModuleToggle = (moduleId, checked) => {
    setModuleChanges(prev => ({ ...prev, [moduleId]: checked }));
  };

  // 保存模块配置
  const handleSaveModules = async () => {
    if (!selectedTenant) return;
    try {
      setModuleSaving(true);
      const modules = tenantModules.map(m => ({
        module_id: m.module_id,
        enabled: moduleChanges[m.module_id] !== undefined ? moduleChanges[m.module_id] : m.enabled,
      }));
      await tenantAPI.updateTenantModules(selectedTenant.id, modules);
      message.success('模块配置保存成功');
      // 刷新列表
      await loadTenantModules(selectedTenant.id);
    } catch (error) {
      message.error('保存模块配置失败');
    } finally {
      setModuleSaving(false);
    }
  };

  // 判断是否有未保存的更改
  const hasModuleChanges = () => {
    return tenantModules.some(m => {
      const current = moduleChanges[m.module_id];
      return current !== undefined && current !== m.enabled;
    });
  };

  // 模块分类颜色
  const getCategoryColor = category => {
    const colorMap = {
      core: 'blue',
      asset: 'green',
      maintenance: 'orange',
      quality: 'purple',
      financial: 'gold',
      compliance: 'cyan',
      integration: 'geekblue',
      analytics: 'magenta',
    };
    return colorMap[category] || 'default';
  };

  // 获取模块类型标签
  const getTypeTag = type => {
    if (type === 'builtin') return <Tag color="red">系统</Tag>;
    if (type === 'optional') return <Tag color="blue">可选</Tag>;
    return null;
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '租户编码',
      dataIndex: 'tenant_code',
      key: 'tenant_code',
    },
    {
      title: '租户名称',
      dataIndex: 'tenant_name',
      key: 'tenant_name',
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person',
      render: person => person || '-',
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone',
      render: phone => phone || '-',
    },
    {
      title: '订阅类型',
      dataIndex: 'subscription_type',
      key: 'subscription_type',
      render: type => {
        const typeMap = {
          free: <Tag color="default">免费版</Tag>,
          standard: <Tag color="blue">标准版</Tag>,
          professional: <Tag color="purple">专业版</Tag>,
          enterprise: <Tag color="red">企业版</Tag>,
        };
        return typeMap[type] || type;
      },
    },
    {
      title: '用户配额',
      dataIndex: 'max_users',
      key: 'max_users',
      render: (max, record) => {
        const used = record.user_count || 0;
        return (
          <Space orientation="vertical" size={0}>
            <span>
              {used} / {max}
            </span>
            <div style={{ width: 60, height: 4, background: '#f0f0f0', borderRadius: 2 }}>
              <div
                style={{
                  width: `${Math.min((used / max) * 100, 100)}%`,
                  height: '100%',
                  background: used >= max ? '#ff4d4f' : '#1890ff',
                  borderRadius: 2,
                }}
              />
            </div>
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status =>
        status === 'active' ? (
          <Tag color="success">正常</Tag>
        ) : (
          <Tag color="error">已停用</Tag>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: time => (time ? new Date(time).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<SettingOutlined />} onClick={() => handleConfig(record)}>
            配置
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要停用这个租户吗？"
            description="停用后，该租户下的所有用户将无法登录"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              停用
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>租户管理</span>
            <Tag color="blue">{pagination.total} 个租户</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadTenants}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              创建租户
            </Button>
          </Space>
        }
      >
        {/* 筛选条件 */}
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input.Search
              placeholder="搜索租户名称/编码/联系人"
              style={{ width: 250 }}
              allowClear
              value={filters.keyword}
              onChange={e => setFilters({ ...filters, keyword: e.target.value })}
              onSearch={() => {
                setPagination({ ...pagination, current: 1 });
                loadTenants();
              }}
            />
            <Select
              placeholder="状态"
              style={{ width: 120 }}
              allowClear
              value={filters.status || undefined}
              onChange={value => {
                setFilters({ ...filters, status: value || '' });
                setPagination({ ...pagination, current: 1 });
              }}
            >
              <Option value="active">正常</Option>
              <Option value="inactive">已停用</Option>
            </Select>
          </Space>
        </div>

        {/* 租户列表 */}
        <Table
          columns={columns}
          dataSource={tenants}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            },
          }}
        />
      </Card>

      {/* 创建/编辑租户模态框 */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        width={640}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="tenant_code"
                label="租户编码"
                rules={[
                  { required: true, message: '请输入租户编码' },
                  { pattern: /^[a-zA-Z0-9_]+$/, message: '只能包含字母、数字和下划线' },
                ]}
              >
                <Input placeholder="例如：company_a" disabled={!!editingTenant} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tenant_name"
                label="租户名称"
                rules={[{ required: true, message: '请输入租户名称' }]}
              >
                <Input placeholder="例如：XX医院" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contact_person" label="联系人">
                <Input placeholder="联系人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contact_phone" label="联系电话">
                <Input placeholder="联系电话" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="contact_email" label="联系邮箱">
            <Input placeholder="邮箱地址" />
          </Form.Item>

          <Form.Item name="address" label="地址">
            <Input placeholder="详细地址" />
          </Form.Item>

          <Divider>订阅信息</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="subscription_type" label="订阅类型">
                <Select placeholder="选择订阅类型">
                  <Option value="free">免费版</Option>
                  <Option value="standard">标准版</Option>
                  <Option value="professional">专业版</Option>
                  <Option value="enterprise">企业版</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="license_no" label="许可证号">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="max_users" label="用户配额">
                <Input type="number" placeholder="最大用户数" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_assets" label="资产配额">
                <Input type="number" placeholder="最大资产数" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="subscription_start_date" label="订阅开始日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="subscription_end_date" label="订阅结束日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="可选备注信息" />
          </Form.Item>

          {editingTenant && (
            <Form.Item name="status" label="状态">
              <Select>
                <Option value="active">正常</Option>
                <Option value="inactive">已停用</Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 租户配置模态框 */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            <span>租户配置 - {selectedTenant?.tenant_name}</span>
          </Space>
        }
        open={configModalVisible}
        onCancel={() => {
          setConfigModalVisible(false);
          setModuleChanges({});
        }}
        footer={null}
        width={800}
      >
        <Tabs
          items={[
            {
              key: 'modules',
              label: `功能模块 (${tenantModules.length})`,
              children: (
                <Spin spinning={moduleLoading}>
                  {tenantModules.length === 0 && !moduleLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                      暂无模块配置数据
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#666', fontSize: 13 }}>启用/禁用功能模块</span>
                        <Button
                          type="primary"
                          size="small"
                          onClick={handleSaveModules}
                          loading={moduleSaving}
                          disabled={!hasModuleChanges()}
                        >
                          保存模块配置
                        </Button>
                      </div>
                      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        {tenantModules.map(m => {
                          const isEnabled = moduleChanges[m.module_id] !== undefined
                            ? moduleChanges[m.module_id]
                            : m.enabled;
                          return (
                            <div
                              key={m.module_id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 12px',
                                marginBottom: 6,
                                borderRadius: 6,
                                border: '1px solid #e8e8e8',
                                backgroundColor: isEnabled ? '#f6ffed' : '#fafafa',
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <Space>
                                  <span style={{ fontWeight: 500 }}>{m.module_name || m.module_id}</span>
                                  <Tag color={getCategoryColor(m.category)}>{m.category || '其他'}</Tag>
                                  {getTypeTag(m.type)}
                                  {m.version && <span style={{ fontSize: 11, color: '#999' }}>v{m.version}</span>}
                                </Space>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onChange={checked => handleModuleToggle(m.module_id, checked)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </Spin>
              ),
            },
            {
              key: 'limits',
              label: '使用限制',
              children: (
                <Form layout="vertical">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="用户配额">
                        <Input type="number" value={selectedTenant?.max_users} disabled />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="资产配额">
                        <Input type="number" value={selectedTenant?.max_assets} disabled />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              ),
            },
            {
              key: 'subscription',
              label: '订阅信息',
              children: (
                <Form layout="vertical">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="订阅类型">
                        <Input value={selectedTenant?.subscription_type} disabled />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="当前状态">
                        <Tag color={selectedTenant?.status === 'active' ? 'success' : 'error'}>
                          {selectedTenant?.status === 'active' ? '正常' : '已停用'}
                        </Tag>
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default TenantManagement;
