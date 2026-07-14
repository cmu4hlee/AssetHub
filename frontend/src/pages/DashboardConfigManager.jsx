import React, { useEffect, useState } from 'react';
import { useCan } from '../hooks';
import { Card, Table, Button, Modal, Form, Input, Switch, Space, Tag, message } from 'antd';
import { dashboardAPI } from '../utils/api';
import dayjs from 'dayjs';
import useIsMobile from '../hooks/useIsMobile';

const { TextArea } = Input;

const sampleConfig = {
  layout: 'grid',
  widgets: [
    { id: 'assets_total', type: 'stat', title: '资产总数', source: 'assets.count' },
    { id: 'assets_status', type: 'pie', title: '资产状态', source: 'assets.by_status' },
    { id: 'inventory_stats', type: 'stat', title: '盘点进行中', source: 'inventory.stats', metric: 'in_progress' },
  ],
};

const DashboardConfigManager = () => {
  const canDelete = useCan('system', 'delete');
  const canEdit = useCan('system', 'edit');
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const result = await dashboardAPI.getConfigs();
      if (result && result.success) {
        setConfigs(result.data || []);
      }
    } catch (error) {
      console.error('加载仪表盘配置失败:', error);
      message.error('加载仪表盘配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const openModal = config => {
    setEditing(config || null);
    form.resetFields();
    if (config) {
      form.setFieldsValue({
        name: config.name,
        description: config.description,
        is_active: config.is_active === 1,
        config_json: config.config_json || '',
      });
    } else {
      form.setFieldsValue({
        is_active: false,
        config_json: JSON.stringify(sampleConfig, null, 2),
      });
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        description: values.description,
        is_active: values.is_active ? 1 : 0,
        config_json: values.config_json,
      };

      if (editing) {
        const result = await dashboardAPI.updateConfig(editing.id, payload);
        if (result && result.success) {
          message.success('配置已更新');
          setModalVisible(false);
          loadConfigs();
        } else {
          message.error(result?.message || '更新失败');
        }
      } else {
        const result = await dashboardAPI.createConfig(payload);
        if (result && result.success) {
          message.success('配置已创建');
          setModalVisible(false);
          loadConfigs();
        } else {
          message.error(result?.message || '创建失败');
        }
      }
    } catch (error) {
      if (error?.name === 'SyntaxError') {
        message.error('配置 JSON 格式错误');
        return;
      }
      console.error('保存配置失败:', error);
      message.error('保存配置失败');
    }
  };

  const handleDelete = async id => {
    try {
      const result = await dashboardAPI.deleteConfig(id);
      if (result && result.success) {
        message.success('配置已删除');
        loadConfigs();
      } else {
        message.error(result?.message || '删除失败');
      }
    } catch (error) {
      console.error('删除配置失败:', error);
      message.error('删除配置失败');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (value, record) => (
        <Space>
          <span>{value}</span>
          {record.is_active ? <Tag color="green">激活</Tag> : null}
        </Space>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: value => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openModal(record)}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="仪表盘配置"
        extra={
          <Button type="primary" onClick={() => openModal(null)}>
            新建配置
          </Button>
        }
      >
        <div className="hide-on-mobile">
          <Table rowKey="id" dataSource={configs} columns={columns} loading={loading} />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {configs.length === 0 ? (
            !loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无配置</div> : null
          ) : (
            configs.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.name || '-'}</span>
                  {record.is_active ? <span className="mobile-card-badge"><Tag color="green">激活</Tag></span> : null}
                </div>
                <div className="mobile-card-body">
                  {record.description && (
                    <div className="mobile-card-field mobile-card-field--full">
                      <span className="mobile-card-label">描述</span>
                      <span className="mobile-card-value">{record.description}</span>
                    </div>
                  )}
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">更新时间</span>
                    <span className="mobile-card-value">{record.updated_at ? dayjs(record.updated_at).format('YYYY-MM-DD HH:mm') : '-'}</span>
                  </div>
                </div>
                <div className="mobile-card-actions">
                  <Button size="small" type="primary" ghost onClick={() => openModal(record)}>编辑</Button>
                  <Button size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal
        title={editing ? '编辑配置' : '新建配置'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        width={760}
        okText="保存"
        cancelText="取消"
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="配置名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input placeholder="配置描述" />
          </Form.Item>
          <Form.Item label="激活" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            label="配置 JSON"
            name="config_json"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.reject(new Error('请输入配置 JSON'));
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch (error) {
                    return Promise.reject(new Error('JSON 格式无效'));
                  }
                },
              },
            ]}
          >
            <TextArea rows={10} placeholder="请输入 JSON 配置" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DashboardConfigManager;
