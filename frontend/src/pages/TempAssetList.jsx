import React, { useState, useEffect } from 'react';
import { useIsMobile, useCan } from '../hooks';
import {
  Card,
  Table,
  Button,
  message,
  Space,
  Input,
  Select,
  Modal,
  Form,
  DatePicker,
  Tag,
  Popconfirm,
} from 'antd';

import { useNavigate } from 'react-router-dom';
import { tempAssetAPI } from '../utils/api';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';

const { Option } = Select;
const { TextArea } = Input;

const TempAssetList = () => {
  const canDelete = useCan('asset', 'delete');
  const canEdit = useCan('asset', 'edit');
  const navigate = useNavigate();
  const [tempAssets, setTempAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const isMobile = useIsMobile();
  const [sourceFilter, setSourceFilter] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const loadTempAssets = async (page = 1, pageSize = 20) => {
    try {
      setLoading(true);
      const result = await tempAssetAPI.getTempAssets({
        page,
        pageSize,
        keyword: searchKeyword,
        status: statusFilter,
        source: sourceFilter,
      });
      if (result.success) {
        setTempAssets(result.data);
        setPagination({
          ...pagination,
          current: page,
          pageSize,
          total: result.pagination?.total || 0,
        });
      }
    } catch (error) {
      message.error('加载临时资产列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTempAssets();
  }, [searchKeyword, statusFilter, sourceFilter]);

  const handleCreate = async values => {
    try {
      const result = await tempAssetAPI.createTempAsset(values);
      if (result.success) {
        message.success('创建成功');
        setModalVisible(false);
        form.resetFields();
        loadTempAssets();
      }
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleEdit = record => {
    setEditingRecord(record);
    editForm.setFieldsValue(record);
    setEditModalVisible(true);
  };

  const handleUpdate = async values => {
    try {
      const result = await tempAssetAPI.updateTempAsset(editingRecord.id, values);
      if (result.success) {
        message.success('更新成功');
        setEditModalVisible(false);
        editForm.resetFields();
        setEditingRecord(null);
        loadTempAssets();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleDelete = async id => {
    try {
      const result = await tempAssetAPI.deleteTempAsset(id);
      if (result.success) {
        message.success('删除成功');
        loadTempAssets();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleTableChange = (pagination, filters, sorter) => {
    loadTempAssets(pagination.current, pagination.pageSize);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      ellipsis: true,
    },
    {
      title: '资产类型',
      dataIndex: 'asset_type',
      key: 'asset_type',
      ellipsis: true,
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      ellipsis: true,
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      ellipsis: true,
    },
    {
      title: '存放位置',
      dataIndex: 'location',
      key: 'location',
      ellipsis: true,
    },
    {
      title: '所属部门',
      dataIndex: 'department',
      key: 'department',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => {
        const colorMap = {
          在用: 'green',
          闲置: 'blue',
          维修: 'orange',
          报废: 'red',
        };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      },
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: source => {
        const colorMap = {
          盘盈: 'purple',
          临时: 'cyan',
        };
        return <Tag color={colorMap[source]}>{source}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button onClick={() => navigate('/')}>返回首页</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            添加临时资产
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadTempAssets()} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Card
        title="临时资产管理"
        extra={
          <Space>
            <Input
              placeholder="搜索资产名称、类型等"
              style={{ width: 200 }}
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
            />
            <Select
              placeholder="状态"
              style={{ width: 120 }}
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
            >
              <Option value="在用">在用</Option>
              <Option value="闲置">闲置</Option>
              <Option value="维修">维修</Option>
              <Option value="报废">报废</Option>
            </Select>
            <Select
              placeholder="来源"
              style={{ width: 120 }}
              value={sourceFilter}
              onChange={setSourceFilter}
              allowClear
            >
              <Option value="盘盈">盘盈</Option>
              <Option value="临时">临时</Option>
            </Select>
          </Space>
        }
      >
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={tempAssets}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              onChange: handleTableChange,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条`,
            }}
            scroll={{ x: 1200 }}
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
          ) : Array.isArray(tempAssets) && tempAssets.length > 0 ? (
            tempAssets.map(record => {
              const statusColorMap = { 在用: 'green', 闲置: 'blue', 维修: 'orange', 报废: 'red' };
              const sourceColorMap = { 盘盈: 'purple', 临时: 'cyan' };
              return (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.asset_name || `#${record.id}`}</span>
                    {record.status && <Tag color={statusColorMap[record.status]}>{record.status}</Tag>}
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">资产类型</span>
                      <span className="mobile-card-value">{record.asset_type || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">品牌</span>
                      <span className="mobile-card-value">{record.brand || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">型号</span>
                      <span className="mobile-card-value">{record.model || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">存放位置</span>
                      <span className="mobile-card-value">{record.location || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">所属部门</span>
                      <span className="mobile-card-value">{record.department || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">来源</span>
                      <span className="mobile-card-value">
                        {record.source ? <Tag color={sourceColorMap[record.source]}>{record.source}</Tag> : '-'}
                      </span>
                    </div>
                    {record.created_at && (
                      <div className="mobile-card-field mobile-card-field--full">
                        <span className="mobile-card-label">创建时间</span>
                        <span className="mobile-card-value">{record.created_at}</span>
                      </div>
                    )}
                  </div>
                  <div className="mobile-card-actions">
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(record)}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="确定要删除这条记录吗？"
                      onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
          )}
        </div>
      </Card>

      {/* 创建临时资产模态框 */}
      <Modal
        title="添加临时资产"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="asset_name"
            label="资产名称"
            rules={[{ required: true, message: '请输入资产名称' }]}
          >
            <Input placeholder="请输入资产名称" />
          </Form.Item>

          <Form.Item name="asset_type" label="资产类型">
            <Input placeholder="请输入资产类型" />
          </Form.Item>

          <Form.Item name="brand" label="品牌">
            <Input placeholder="请输入品牌" />
          </Form.Item>

          <Form.Item name="model" label="型号">
            <Input placeholder="请输入型号" />
          </Form.Item>

          <Form.Item name="specification" label="规格">
            <TextArea rows={2} placeholder="请输入规格" />
          </Form.Item>

          <Form.Item name="location" label="存放位置">
            <Input placeholder="请输入存放位置" />
          </Form.Item>

          <Form.Item name="department" label="所属部门">
            <Input placeholder="请输入所属部门" />
          </Form.Item>

          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态" defaultValue="闲置">
              <Option value="在用">在用</Option>
              <Option value="闲置">闲置</Option>
              <Option value="维修">维修</Option>
              <Option value="报废">报废</Option>
            </Select>
          </Form.Item>

          <Form.Item name="source" label="来源">
            <Select placeholder="请选择来源" defaultValue="临时">
              <Option value="盘盈">盘盈</Option>
              <Option value="临时">临时</Option>
            </Select>
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑临时资产模态框 */}
      <Modal
        title="编辑临时资产"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingRecord(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        width={800}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item
            name="asset_name"
            label="资产名称"
            rules={[{ required: true, message: '请输入资产名称' }]}
          >
            <Input placeholder="请输入资产名称" />
          </Form.Item>

          <Form.Item name="asset_type" label="资产类型">
            <Input placeholder="请输入资产类型" />
          </Form.Item>

          <Form.Item name="brand" label="品牌">
            <Input placeholder="请输入品牌" />
          </Form.Item>

          <Form.Item name="model" label="型号">
            <Input placeholder="请输入型号" />
          </Form.Item>

          <Form.Item name="specification" label="规格">
            <TextArea rows={2} placeholder="请输入规格" />
          </Form.Item>

          <Form.Item name="location" label="存放位置">
            <Input placeholder="请输入存放位置" />
          </Form.Item>

          <Form.Item name="department" label="所属部门">
            <Input placeholder="请输入所属部门" />
          </Form.Item>

          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态">
              <Option value="在用">在用</Option>
              <Option value="闲置">闲置</Option>
              <Option value="维修">维修</Option>
              <Option value="报废">报废</Option>
            </Select>
          </Form.Item>

          <Form.Item name="source" label="来源">
            <Select placeholder="请选择来源">
              <Option value="盘盈">盘盈</Option>
              <Option value="临时">临时</Option>
            </Select>
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TempAssetList;
