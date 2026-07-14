import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../hooks';
import {
  Card,
  Table,
  Button,
  Switch,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Tabs,
  Tag,
  Tooltip,
  Popconfirm,
  Drawer,
  Descriptions,
  Alert,
  Row,
  Col,
  Typography,
  Tree,
} from 'antd';

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  HistoryOutlined,
  CloudUploadOutlined,
  CloudDownloadOutlined,
  ReloadOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  FileSearchOutlined,
  MenuOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { moduleConfigAPI } from '../utils/api';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

const ModuleManagement = () => {
  const isMobile = useIsMobile();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [selectedModule, setSelectedModule] = useState(null);
  const [configVersions, setConfigVersions] = useState([]);
  const [menuPermissions, setMenuPermissions] = useState([]);
  const [menuTreeData, setMenuTreeData] = useState([]);
  const [configForm] = Form.useForm();
  const [versionForm] = Form.useForm();
  const [conflicts, setConflicts] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      setLoading(true);
      const response = await moduleConfigAPI.getModuleConfigs();
      if (response.success) {
        setModules(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      message.error('获取模块列表失败');
      console.error('获取模块列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredModules = modules.filter(module => {
    const matchesSearch =
      (module.name || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (module.description || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (module.id || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesCategory = !categoryFilter || module.category === categoryFilter;
    const matchesType = !typeFilter || module.type === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  const categories = [...new Set(modules.map(module => module.category))];
  const types = [...new Set(modules.map(module => module.type))];

  const handleToggleModule = async (moduleId, enabled) => {
    try {
      setLoading(true);
      if (enabled) {
        const response = await moduleConfigAPI.enableModule({ module_id: moduleId });
        if (response.success) {
          message.success('模块启用成功');
        } else {
          message.error(response.message || '模块启用失败');
          return;
        }
      } else {
        const response = await moduleConfigAPI.disableModule({ module_id: moduleId });
        if (response.success) {
          message.success('模块禁用成功');
        } else {
          message.error(response.message || '模块禁用失败');
          return;
        }
      }
      fetchModules();
    } catch (error) {
      message.error(enabled ? '模块启用失败' : '模块禁用失败');
      console.error('切换模块状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenConfig = async module => {
    try {
      setSelectedModule(module);
      const configSchema = module.config_schema || [];
      const defaultConfig = module.default_config || {};
      const currentConfig = module.config || {};

      const initialValues = {};
      configSchema.forEach(schema => {
        if (currentConfig[schema.key] !== undefined) {
          initialValues[schema.key] = currentConfig[schema.key];
          return;
        }
        if (defaultConfig[schema.key] !== undefined) {
          initialValues[schema.key] = defaultConfig[schema.key];
          return;
        }
        if (schema.default !== undefined) {
          initialValues[schema.key] = schema.default;
        }
      });

      configForm.setFieldsValue(initialValues);
      setConfigModalVisible(true);
    } catch (error) {
      message.error('加载模块配置失败');
      console.error('加载模块配置失败:', error);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      setLoading(true);

      const validateResponse = await moduleConfigAPI.validateConfig(selectedModule.id, {
        config: JSON.stringify(values),
      });

      if (!validateResponse.success) {
        message.error('配置验证失败');
        return;
      }

      const response = await moduleConfigAPI.updateModuleConfig(selectedModule.id, values);
      if (response.success) {
        message.success('模块配置保存成功');
        setConfigModalVisible(false);
        fetchModules();
      } else {
        message.error(response.message || '模块配置保存失败');
      }
    } catch (error) {
      message.error('模块配置保存失败');
      console.error('保存模块配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenVersions = async module => {
    try {
      setSelectedModule(module);
      setLoading(true);
      const response = await moduleConfigAPI.getConfigVersions(module.id);
      if (response.success) {
        setConfigVersions(response.data);
        setVersionModalVisible(true);
      } else {
        message.error('获取配置版本失败');
      }
    } catch (error) {
      message.error('获取配置版本失败');
      console.error('获取配置版本失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    try {
      const values = await versionForm.validateFields();
      setLoading(true);

      const response = await moduleConfigAPI.createConfigVersion(selectedModule.id, {
        config: selectedModule.config,
        change_log: values.change_log,
      });

      if (response.success) {
        message.success('配置版本创建成功');
        versionForm.resetFields();
        handleOpenVersions(selectedModule);
      } else {
        message.error(response.message || '配置版本创建失败');
      }
    } catch (error) {
      message.error('配置版本创建失败');
      console.error('创建配置版本失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async versionId => {
    try {
      setLoading(true);
      const response = await moduleConfigAPI.rollbackConfig(selectedModule.id, {
        version_id: versionId,
      });
      if (response.success) {
        message.success('配置版本回滚成功');
        handleOpenVersions(selectedModule);
        fetchModules();
      } else {
        message.error(response.message || '配置版本回滚失败');
      }
    } catch (error) {
      message.error('配置版本回滚失败');
      console.error('回滚配置版本失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async moduleId => {
    try {
      setLoading(true);
      const response = await moduleConfigAPI.backupConfig(moduleId);
      if (response.success) {
        message.success('模块配置备份成功');
        const blob = new Blob([JSON.stringify(response.data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `module-config-${moduleId}-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        message.error(response.message || '模块配置备份失败');
      }
    } catch (error) {
      message.error('模块配置备份失败');
      console.error('备份模块配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMenuConfig = async module => {
    try {
      setSelectedModule(module);
      setLoading(true);

      const response = await moduleConfigAPI.getModuleMenus(module.id);
      if (response.success) {
        setMenuPermissions(response.data);
        const treeData = buildMenuTree(response.data);
        setMenuTreeData(treeData);
        setMenuModalVisible(true);
      } else {
        message.error('获取菜单权限失败');
        console.error('获取菜单权限失败:', response);
      }
    } catch (error) {
      message.error('加载菜单权限失败');
      console.error('加载菜单权限失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildMenuTree = menus => {
    const menuMap = new Map();
    const rootMenus = [];

    // 首先构建所有菜单项的映射
    menus.forEach(menu => {
      menuMap.set(menu.menu_key, {
        title: (
          <Space>
            <span>{menu.menu_label}</span>
            <Switch
              checked={menu.is_visible}
              onChange={checked => handleMenuPermissionChange(menu.menu_key, checked)}
            />
          </Space>
        ),
        key: menu.menu_key,
        children: [],
        is_visible: menu.is_visible,
      });
    });

    // 构建树结构
    menus.forEach(menu => {
      const menuItem = menuMap.get(menu.menu_key);
      if (menu.parent_key) {
        // 子菜单
        const parent = menuMap.get(menu.parent_key);
        if (parent) {
          parent.children.push(menuItem);
        }
      } else {
        // 根菜单
        rootMenus.push(menuItem);
      }
    });

    return rootMenus;
  };

  const handleMenuPermissionChange = (menuKey, isVisible) => {
    setMenuPermissions(prevPermissions => {
      const updatedPermissions = prevPermissions.map(menu => {
        if (menu.menu_key === menuKey) {
          return { ...menu, is_visible: isVisible };
        }
        return menu;
      });
      setMenuTreeData(buildMenuTree(updatedPermissions));
      return updatedPermissions;
    });
  };

  const handleSaveMenuConfig = async () => {
    try {
      setLoading(true);

      const response = await moduleConfigAPI.updateModuleMenus(selectedModule.id, {
        menus: menuPermissions,
      });

      if (response.success) {
        message.success('菜单权限配置保存成功');
        setMenuModalVisible(false);
      } else {
        message.error(response.message || '菜单权限配置保存失败');
        console.error('保存菜单权限失败:', response);
      }
    } catch (error) {
      message.error('保存菜单权限失败');
      console.error('保存菜单权限失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderConfigItem = schema => {
    const { key, name, type, required, description, options, validation } = schema;

    const rules = [];
    if (required) {
      rules.push({ required: true, message: `${name}为必填项` });
    }

    if (validation) {
      if (validation.min !== undefined) {
        rules.push({
          type: 'number',
          min: validation.min,
          message: `${name}不能小于${validation.min}`,
        });
      }
      if (validation.max !== undefined) {
        rules.push({
          type: 'number',
          max: validation.max,
          message: `${name}不能大于${validation.max}`,
        });
      }
      if (validation.pattern) {
        rules.push({ pattern: new RegExp(validation.pattern), message: `${name}格式不正确` });
      }
    }

    const itemKey = key || name;
    const commonProps = {
      label: name,
      name: key,
      rules,
      tooltip: description,
    };

    switch (type) {
      case 'string':
        return (
          <Form.Item key={itemKey} {...commonProps}>
            <Input placeholder={`请输入${name}`} />
          </Form.Item>
        );
      case 'number':
        return (
          <Form.Item key={itemKey} {...commonProps}>
            <InputNumber style={{ width: '100%' }} placeholder={`请输入${name}`} />
          </Form.Item>
        );
      case 'boolean':
        return (
          <Form.Item key={itemKey} {...commonProps} valuePropName="checked">
            <Switch />
          </Form.Item>
        );
      case 'select':
        return (
          <Form.Item key={itemKey} {...commonProps}>
            <Select placeholder={`请选择${name}`}>
              {options?.map(opt => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        );
      case 'multi_select':
        return (
          <Form.Item key={itemKey} {...commonProps}>
            <Select mode="multiple" placeholder={`请选择${name}`}>
              {options?.map(opt => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        );
      case 'json':
        return (
          <Form.Item key={itemKey} {...commonProps}>
            <TextArea rows={4} placeholder={`请输入${name}（JSON格式）`} />
          </Form.Item>
        );
      default:
        return (
          <Form.Item key={itemKey} {...commonProps}>
            <Input placeholder={`请输入${name}`} />
          </Form.Item>
        );
    }
  };

  const columns = [
    {
      title: '模块名称',
      dataIndex: 'name',
      key: 'name',
      flex: 1,
      minWidth: 150,
      render: (text, record) => (
        <Space orientation="vertical" size={0} style={{ minWidth: '100%' }}>
          <Text strong style={{ wordBreak: 'break-word' }}>
            {text}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, wordBreak: 'break-word' }}>
            {record.id}
          </Text>
        </Space>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 100,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: text => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: text => <Tag color="green">{text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          onChange={checked => handleToggleModule(record.id, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          loading={loading}
        />
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      flex: 2,
      minWidth: 200,
      ellipsis: {
        showTitle: true,
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="配置">
            <Button
              type="link"
              icon={<SettingOutlined />}
              onClick={() => handleOpenConfig(record)}
              disabled={!record.enabled}
            />
          </Tooltip>
          <Tooltip title="菜单权限">
            <Button
              type="link"
              icon={<MenuOutlined />}
              onClick={() => handleOpenMenuConfig(record)}
              disabled={!record.enabled}
            />
          </Tooltip>
          <Tooltip title="版本管理">
            <Button
              type="link"
              icon={<HistoryOutlined />}
              onClick={() => handleOpenVersions(record)}
              disabled={!record.enabled}
            />
          </Tooltip>
          <Tooltip title="备份配置">
            <Button
              type="link"
              icon={<CloudDownloadOutlined />}
              onClick={() => handleBackup(record.id)}
              disabled={!record.enabled}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="模块管理"
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchModules} loading={loading}>
            刷新
          </Button>
        }
      >
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'end',
          }}
        >
          <Input
            placeholder="搜索模块名称、ID或描述"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
            prefix={<FileSearchOutlined />}
          />
          <Select
            placeholder="按分类筛选"
            value={categoryFilter}
            onChange={setCategoryFilter}
            style={{ width: 150 }}
            allowClear
          >
            {categories.map(category => (
              <Option key={category} value={category}>
                {category}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="按类型筛选"
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 150 }}
            allowClear
          >
            {types.map(type => (
              <Option key={type} value={type}>
                {type}
              </Option>
            ))}
          </Select>
        </div>
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={filteredModules}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 个模块`,
            }}
            scroll={{
              x: 1200,
            }}
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {filteredModules.length === 0 ? (
            !loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无模块</div> : null
          ) : (
            filteredModules.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.name || record.id}</span>
                  <span className="mobile-card-badge">
                    <Tag color={record.enabled ? 'green' : 'default'}>{record.enabled ? '已启用' : '已禁用'}</Tag>
                  </span>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">模块ID</span>
                    <span className="mobile-card-value"><Text type="secondary" style={{ fontSize: 12 }}>{record.id}</Text></span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">版本</span>
                    <span className="mobile-card-value">{record.version || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">分类</span>
                    <span className="mobile-card-value"><Tag color="blue">{record.category || '-'}</Tag></span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">类型</span>
                    <span className="mobile-card-value"><Tag color="green">{record.type || '-'}</Tag></span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">状态</span>
                    <span className="mobile-card-value">
                      <Switch
                        checked={record.enabled}
                        onChange={checked => handleToggleModule(record.id, checked)}
                        checkedChildren="启用"
                        unCheckedChildren="禁用"
                        size="small"
                      />
                    </span>
                  </div>
                  {record.description && (
                    <div className="mobile-card-field mobile-card-field--full">
                      <span className="mobile-card-label">描述</span>
                      <span className="mobile-card-value">{record.description}</span>
                    </div>
                  )}
                </div>
                <div className="mobile-card-actions">
                  <Button
                    size="small"
                    icon={<SettingOutlined />}
                    onClick={() => handleOpenConfig(record)}
                    disabled={!record.enabled}
                  >配置</Button>
                  <Button
                    size="small"
                    icon={<MenuOutlined />}
                    onClick={() => handleOpenMenuConfig(record)}
                    disabled={!record.enabled}
                  >菜单</Button>
                  <Button
                    size="small"
                    icon={<HistoryOutlined />}
                    onClick={() => handleOpenVersions(record)}
                    disabled={!record.enabled}
                  >版本</Button>
                  <Button
                    size="small"
                    icon={<CloudDownloadOutlined />}
                    onClick={() => handleBackup(record.id)}
                    disabled={!record.enabled}
                  >备份</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal
        title={`配置模块 - ${selectedModule?.name}`}
        open={configModalVisible}
        onOk={handleSaveConfig}
        onCancel={() => setConfigModalVisible(false)}
        width={600}
        confirmLoading={loading}
      >
        {selectedModule?.description && (
          <Alert
            title={selectedModule.description}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={configForm} layout="vertical">
          {selectedModule?.config_schema?.map(schema => renderConfigItem(schema))}
        </Form>
      </Modal>

      <Modal
        title={`版本管理 - ${selectedModule?.name}`}
        open={versionModalVisible}
        onCancel={() => setVersionModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setVersionModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          <Card size="small" title="创建新版本">
            <Form form={versionForm} layout="inline">
              <Form.Item
                name="change_log"
                label="变更说明"
                rules={[{ required: true, message: '请输入变更说明' }]}
              >
                <Input placeholder="请输入变更说明" style={{ width: 300 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" onClick={handleCreateVersion} loading={loading}>
                  创建版本
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <div className="hide-on-mobile">
            <Table
              columns={[
                {
                  title: '版本',
                  dataIndex: 'version',
                  key: 'version',
                  width: 100,
                },
                {
                  title: '创建时间',
                  dataIndex: 'created_at',
                  key: 'created_at',
                  width: 180,
                },
                {
                  title: '创建人',
                  dataIndex: 'created_by',
                  key: 'created_by',
                  width: 100,
                },
                {
                  title: '变更说明',
                  dataIndex: 'change_log',
                  key: 'change_log',
                  ellipsis: true,
                },
                {
                  title: '当前版本',
                  dataIndex: 'is_current',
                  key: 'is_current',
                  width: 100,
                  render: isCurrent => (isCurrent ? <Tag color="green">当前</Tag> : null),
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 120,
                  render: (_, record) => (
                    <Space size="small">
                      {!record.is_current && (
                        <Popconfirm
                          title="确认回滚到此版本？"
                          onConfirm={() => handleRollback(record.id)}
                          okText="确认"
                          cancelText="取消"
                        >
                          <Button type="link" size="small" icon={<ReloadOutlined />}>
                            回滚
                          </Button>
                        </Popconfirm>
                      )}
                    </Space>
                  ),
                },
              ]}
              dataSource={configVersions}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>
          <div className="mobile-table-cards show-on-mobile">
            {configVersions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无版本</div>
            ) : (
              configVersions.map(record => (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">v{record.version}</span>
                    {record.is_current && <span className="mobile-card-badge"><Tag color="green">当前</Tag></span>}
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">创建时间</span>
                      <span className="mobile-card-value">{record.created_at || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">创建人</span>
                      <span className="mobile-card-value">{record.created_by || '-'}</span>
                    </div>
                    {record.change_log && (
                      <div className="mobile-card-field mobile-card-field--full">
                        <span className="mobile-card-label">变更说明</span>
                        <span className="mobile-card-value">{record.change_log}</span>
                      </div>
                    )}
                  </div>
                  {!record.is_current && (
                    <div className="mobile-card-actions">
                      <Popconfirm
                        title="确认回滚到此版本？"
                        onConfirm={() => handleRollback(record.id)}
                        okText="确认"
                        cancelText="取消"
                      >
                        <Button size="small" type="primary" ghost icon={<ReloadOutlined />}>回滚</Button>
                      </Popconfirm>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Space>
      </Modal>

      <Modal
        title={`菜单权限配置 - ${selectedModule?.name}`}
        open={menuModalVisible}
        onOk={handleSaveMenuConfig}
        onCancel={() => setMenuModalVisible(false)}
        width={600}
        confirmLoading={loading}
      >
        {selectedModule?.description && (
          <Alert
            title={selectedModule.description}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <Tree treeData={menuTreeData} defaultExpandAll showLine />
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
          <InfoCircleOutlined style={{ marginRight: 4 }} />
          提示：通过开关控制菜单是否对当前租户可见
        </div>
      </Modal>
    </div>
  );
};

export default ModuleManagement;
