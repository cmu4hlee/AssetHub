import React, { useEffect, useState } from 'react';
import { useCan } from '../hooks';
import { Card, Tabs, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Empty } from 'antd';
import { cloudSyncAPI } from '../utils/api';
import useIsMobile from '../hooks/useIsMobile';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const CloudSyncManagement = () => {
  const canDelete = useCan('system', 'delete');
  const canEdit = useCan('system', 'edit');
  const isMobile = useIsMobile();
  const [sources, setSources] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventsPagination, setEventsPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const loadSources = async () => {
    try {
      setLoadingSources(true);
      const result = await cloudSyncAPI.getSources();
      if (result && result.success) {
        setSources(result.data || []);
      }
    } catch (error) {
      console.error('加载同步源失败:', error);
      message.error('加载同步源失败');
    } finally {
      setLoadingSources(false);
    }
  };

  const loadEvents = async (page = 1, pageSize = 20) => {
    try {
      setLoadingEvents(true);
      const result = await cloudSyncAPI.getEvents({ page, pageSize });
      if (result && result.success) {
        setEvents(result.data || []);
        setEventsPagination(result.pagination || { page, pageSize, total: 0 });
      }
    } catch (error) {
      console.error('加载同步事件失败:', error);
      message.error('加载同步事件失败');
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    loadSources();
    loadEvents();
  }, []);

  const openModal = source => {
    setEditing(source || null);
    form.resetFields();
    if (source) {
      form.setFieldsValue({
        name: source.name,
        source_type: source.source_type,
        status: source.status,
        secret_token: source.secret_token,
        config_json: source.config_json || '',
      });
    } else {
      form.setFieldsValue({ status: 'active', source_type: 'webhook' });
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        source_type: values.source_type,
        status: values.status,
        secret_token: values.secret_token,
        config_json: values.config_json,
      };
      if (editing) {
        const result = await cloudSyncAPI.updateSource(editing.id, payload);
        if (result && result.success) {
          message.success('同步源已更新');
          setModalVisible(false);
          loadSources();
        } else {
          message.error(result?.message || '更新失败');
        }
      } else {
        const result = await cloudSyncAPI.createSource(payload);
        if (result && result.success) {
          message.success('同步源已创建');
          setModalVisible(false);
          loadSources();
        } else {
          message.error(result?.message || '创建失败');
        }
      }
    } catch (error) {
      console.error('保存同步源失败:', error);
      message.error('保存同步源失败');
    }
  };

  const handleDelete = async id => {
    try {
      const result = await cloudSyncAPI.deleteSource(id);
      if (result && result.success) {
        message.success('同步源已删除');
        loadSources();
      } else {
        message.error(result?.message || '删除失败');
      }
    } catch (error) {
      console.error('删除同步源失败:', error);
      message.error('删除同步源失败');
    }
  };

  const sourceColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'source_type', key: 'source_type', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: value => (value === 'active' ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: 'Webhook',
      key: 'webhook',
      render: (_, record) => <span>/api/cloud-sync/webhook/{record.id}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
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

  const eventColumns = [
    { title: '事件ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '类型', dataIndex: 'event_type', key: 'event_type', width: 160 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: value => {
        const color = value === 'processed' ? 'green' : value === 'failed' ? 'red' : 'blue';
        return <Tag color={color}>{value}</Tag>;
      },
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: value => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card title="云/IoT 同步">
        <Tabs
          items={[
            {
              key: 'sources',
              label: '同步源',
              children: (
                <div>
                  <Button
                    type="primary"
                    onClick={() => openModal(null)}
                    style={{ marginBottom: 12 }}
                    block={isMobile}
                  >
                    新建同步源
                  </Button>
                  {/* 桌面端表格 */}
                  <div className="hide-on-mobile">
                    <Table
                      rowKey="id"
                      dataSource={sources}
                      columns={sourceColumns}
                      loading={loadingSources}
                    />
                  </div>
                  {/* 移动端卡片列表 */}
                  <div className="mobile-table-cards show-on-mobile">
                    {loadingSources ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
                        加载中...
                      </div>
                    ) : Array.isArray(sources) && sources.length > 0 ? (
                      sources.map(record => (
                        <div key={record.id} className="mobile-card-item">
                          <div className="mobile-card-header">
                            <span className="mobile-card-title">{record.name || '-'}</span>
                            {record.status === 'active' ? (
                              <Tag color="green">启用</Tag>
                            ) : (
                              <Tag>停用</Tag>
                            )}
                          </div>
                          <div className="mobile-card-body">
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">类型</span>
                              <span className="mobile-card-value">
                                {record.source_type || '-'}
                              </span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">Webhook</span>
                              <span className="mobile-card-value">
                                /api/cloud-sync/webhook/{record.id}
                              </span>
                            </div>
                          </div>
                          <div className="mobile-card-actions">
                            <Button
                              type="primary"
                              size="small"
                              block
                              onClick={() => openModal(record)}
                            >
                              编辑
                            </Button>
                            <Button
                              type="primary"
                              danger
                              size="small"
                              block
                              onClick={() => handleDelete(record.id)}
                            >
                              删除
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <Empty description="暂无数据" />
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'events',
              label: '同步事件',
              children: (
                <div>
                  {/* 桌面端表格 */}
                  <div className="hide-on-mobile">
                    <Table
                      rowKey="id"
                      dataSource={events}
                      columns={eventColumns}
                      loading={loadingEvents}
                      pagination={{
                        current: eventsPagination.page,
                        pageSize: eventsPagination.pageSize,
                        total: eventsPagination.total,
                        onChange: (page, pageSize) => loadEvents(page, pageSize),
                      }}
                    />
                  </div>
                  {/* 移动端卡片列表 */}
                  <div className="mobile-table-cards show-on-mobile">
                    {loadingEvents ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
                        加载中...
                      </div>
                    ) : Array.isArray(events) && events.length > 0 ? (
                      <>
                        {events.map(record => {
                          const statusColor =
                            record.status === 'processed'
                              ? 'green'
                              : record.status === 'failed'
                                ? 'red'
                                : 'blue';
                          return (
                            <div key={record.id} className="mobile-card-item">
                              <div className="mobile-card-header">
                                <span className="mobile-card-title">事件 #{record.id}</span>
                                <Tag color={statusColor}>{record.status}</Tag>
                              </div>
                              <div className="mobile-card-body">
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">类型</span>
                                  <span className="mobile-card-value">
                                    {record.event_type || '-'}
                                  </span>
                                </div>
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">时间</span>
                                  <span className="mobile-card-value">
                                    {record.created_at
                                      ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm')
                                      : '-'}
                                  </span>
                                </div>
                                {record.error_message && (
                                  <div className="mobile-card-field">
                                    <span className="mobile-card-label">错误信息</span>
                                    <span className="mobile-card-value">
                                      {record.error_message}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {/* 移动端分页 */}
                        <div style={{ marginTop: '16px', textAlign: 'center' }}>
                          <Space>
                            <Button
                              disabled={eventsPagination.page === 1}
                              onClick={() =>
                                loadEvents(
                                  eventsPagination.page - 1,
                                  eventsPagination.pageSize
                                )
                              }
                            >
                              上一页
                            </Button>
                            <span>
                              第 {eventsPagination.page} /{' '}
                              {Math.ceil(
                                eventsPagination.total / eventsPagination.pageSize
                              )}{' '}
                              页
                            </span>
                            <Button
                              disabled={
                                eventsPagination.page >=
                                Math.ceil(
                                  eventsPagination.total / eventsPagination.pageSize
                                )
                              }
                              onClick={() =>
                                loadEvents(
                                  eventsPagination.page + 1,
                                  eventsPagination.pageSize
                                )
                              }
                            >
                              下一页
                            </Button>
                          </Space>
                          <div
                            style={{
                              marginTop: '8px',
                              color: '#8c8c8c',
                              fontSize: '12px',
                            }}
                          >
                            共 {eventsPagination.total} 条
                          </div>
                        </div>
                      </>
                    ) : (
                      <Empty description="暂无数据" />
                    )}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? '编辑同步源' : '新建同步源'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        width={isMobile ? '95vw' : 520}
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="同步源名称" />
          </Form.Item>
          <Form.Item label="类型" name="source_type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select>
              <Option value="webhook">Webhook</Option>
              <Option value="iot">IoT</Option>
              <Option value="cloud">云平台</Option>
            </Select>
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select>
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Webhook Token" name="secret_token">
            <Input placeholder="可选，外部Webhook校验用" />
          </Form.Item>
          <Form.Item label="配置 JSON" name="config_json">
            <TextArea rows={4} placeholder="可选配置" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CloudSyncManagement;
