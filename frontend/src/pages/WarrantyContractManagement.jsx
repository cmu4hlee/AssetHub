import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../hooks';
import {
  Card,
  Table,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  Modal,
  Tag,
  Space,
  Tabs,
  Row,
  Col,
  InputNumber,
  message,
  Popconfirm,
  Upload,
  Empty,
} from 'antd';

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  UploadOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { warrantyAPI, assetAPI } from '../utils/api';
import useIsMobile from '../hooks/useIsMobile';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

// 状态颜色映射
const CONTRACT_STATUS_COLOR = {
  生效中: 'green',
  即将到期: 'orange',
  已过期: 'red',
  已终止: 'default',
};

const ARCHIVE_STATUS_COLOR = {
  在档: 'green',
  已移交: 'blue',
  已销毁: 'default',
};

const INVOICE_STATUS_COLOR = {
  待审核: 'orange',
  已审核: 'green',
  已驳回: 'red',
};

const PAYMENT_STATUS_COLOR = {
  待付款: 'orange',
  已付款: 'green',
  已取消: 'default',
};

const formatAmount = value => {
  if (value == null || value === '' || isNaN(Number(value))) return '¥0.00';
  return `¥${Number(value).toFixed(2)}`;
};

// ===================== 合同管理 =====================
const ContractList = () => {
  const canDelete = useCan('maintenance', 'delete');
  const canEdit = useCan('maintenance', 'edit');
  const isMobile = useIsMobile();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);

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
        asset_name: hit.asset_name,
        supplier_name: hit.supplier || hit.manufacturer,
      });
    }
  };

  const [searchParams, setSearchParams] = useState({
    keyword: '',
    status: '',
    warranty_type: '',
  });

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const fetchData = useCallback(
    async (params = {}) => {
      setLoading(true);
      try {
        const requestParams = {
          page: params.page || pagination.current,
          pageSize: params.pageSize || pagination.pageSize,
          ...searchParams,
        };
        const response = await warrantyAPI.getContracts(requestParams);
        const list = response.data || [];
        setData(list);
        setPagination(prev => ({
          ...prev,
          current: params.page || prev.current,
          pageSize: params.pageSize || prev.pageSize,
          total: response.pagination?.total || list.length,
        }));
      } catch (error) {
        console.error('加载合同列表失败:', error);
        message.error('加载合同列表失败');
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.pageSize, searchParams]
  );

  useEffect(() => {
    fetchData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchData({ page: 1 });
  };

  const handleReset = () => {
    setSearchParams({ keyword: '', status: '', warranty_type: '' });
  };

  const handleTableChange = pag => {
    fetchData({ page: pag.current, pageSize: pag.pageSize });
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = record => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      start_date: record.start_date ? dayjs(record.start_date) : null,
      end_date: record.end_date ? dayjs(record.end_date) : null,
    });
    setModalOpen(true);
  };

  const handleDelete = async id => {
    try {
      await warrantyAPI.deleteContract(id);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        start_date: values.start_date ? dayjs(values.start_date).format('YYYY-MM-DD') : null,
        end_date: values.end_date ? dayjs(values.end_date).format('YYYY-MM-DD') : null,
        contract_amount: values.contract_amount != null ? Number(values.contract_amount) : null,
      };
      setSubmitting(true);
      if (editingRecord) {
        await warrantyAPI.updateContract(editingRecord.id, payload);
        message.success('更新成功');
      } else {
        await warrantyAPI.createContract(payload);
        message.success('新增成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (error) {
      if (error?.errorFields) return; // 表单校验错误
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: '合同编号', dataIndex: 'contract_no', key: 'contract_no', ellipsis: true },
    { title: '合同名称', dataIndex: 'contract_name', key: 'contract_name', ellipsis: true },
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code', ellipsis: true },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name', ellipsis: true },
    { title: '供应商', dataIndex: 'supplier_name', key: 'supplier_name', ellipsis: true },
    { title: '保修类型', dataIndex: 'warranty_type', key: 'warranty_type' },
    { title: '开始日期', dataIndex: 'start_date', key: 'start_date' },
    { title: '结束日期', dataIndex: 'end_date', key: 'end_date' },
    {
      title: '合同金额',
      dataIndex: 'contract_amount',
      key: 'contract_amount',
      render: val => formatAmount(val),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: val => <Tag color={CONTRACT_STATUS_COLOR[val] || 'default'}>{val || '-'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该合同吗？"
            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="合同编号/名称/资产/供应商"
              value={searchParams.keyword}
              onChange={e => setSearchParams(prev => ({ ...prev, keyword: e.target.value }))}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="状态筛选"
              value={searchParams.status || undefined}
              onChange={val => setSearchParams(prev => ({ ...prev, status: val || '' }))}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="生效中">生效中</Option>
              <Option value="即将到期">即将到期</Option>
              <Option value="已过期">已过期</Option>
              <Option value="已终止">已终止</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="保修类型筛选"
              value={searchParams.warranty_type || undefined}
              onChange={val => setSearchParams(prev => ({ ...prev, warranty_type: val || '' }))}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="原厂保修">原厂保修</Option>
              <Option value="延保">延保</Option>
              <Option value="第三方保修">第三方保修</Option>
              <Option value="自行维修">自行维修</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card
        title="保修合同列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} block={isMobile}>
            新增合同
          </Button>
        }
      >
        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: total => `共 ${total} 条记录`,
            }}
            onChange={handleTableChange}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(data) && data.length > 0 ? (
            <>
              {data.map(record => (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">
                      {record.contract_name || record.contract_no || '-'}
                    </span>
                    <Tag color={CONTRACT_STATUS_COLOR[record.status] || 'default'}>
                      {record.status || '-'}
                    </Tag>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">合同编号</span>
                      <span className="mobile-card-value">{record.contract_no || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">资产编号</span>
                      <span className="mobile-card-value">{record.asset_code || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">资产名称</span>
                      <span className="mobile-card-value">{record.asset_name || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">供应商</span>
                      <span className="mobile-card-value">{record.supplier_name || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">保修类型</span>
                      <span className="mobile-card-value">{record.warranty_type || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">合同金额</span>
                      <span className="mobile-card-value">{formatAmount(record.contract_amount)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">开始日期</span>
                      <span className="mobile-card-value">{record.start_date || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">结束日期</span>
                      <span className="mobile-card-value">{record.end_date || '-'}</span>
                    </div>
                  </div>
                  <div className="mobile-card-actions">
                    <Button
                      type="primary"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(record)}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="确认删除该合同吗？"
                      onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="primary" danger size="small" icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              ))}
              {/* 移动端分页 */}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Space>
                  <Button
                    disabled={pagination.current === 1}
                    onClick={() => fetchData({ page: pagination.current - 1 })}
                  >
                    上一页
                  </Button>
                  <span>
                    第 {pagination.current} /{' '}
                    {Math.ceil(pagination.total / pagination.pageSize) || 1} 页
                  </span>
                  <Button
                    disabled={
                      pagination.current >=
                      Math.ceil(pagination.total / pagination.pageSize)
                    }
                    onClick={() => fetchData({ page: pagination.current + 1 })}
                  >
                    下一页
                  </Button>
                </Space>
                <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                  共 {pagination.total} 条
                </div>
              </div>
            </>
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>

      <Modal
        title={editingRecord ? '编辑合同' : '新增合同'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={isMobile ? '95vw' : 800}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ warranty_type: '原厂保修' }}>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item name="contract_no" label="合同编号">
                <Input placeholder="留空自动生成" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="contract_name"
                label="合同名称"
                rules={[{ required: true, message: '请输入合同名称' }]}
              >
                <Input placeholder="请输入合同名称" />
              </Form.Item>
            </Col>
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
                    <Option
                      key={a.asset_code}
                      value={a.asset_code}
                      label={`${a.asset_code} - ${a.asset_name}`}
                    >
                      <div>{a.asset_code} - {a.asset_name}</div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="asset_name" label="资产名称">
                <Input placeholder="请输入资产名称" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="supplier_name" label="供应商">
                <Input placeholder="请输入供应商" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="supplier_contact" label="供应商联系方式">
                <Input placeholder="请输入供应商联系方式" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="warranty_type" label="保修类型">
                <Select placeholder="请选择保修类型">
                  <Option value="原厂保修">原厂保修</Option>
                  <Option value="延保">延保</Option>
                  <Option value="第三方保修">第三方保修</Option>
                  <Option value="自行维修">自行维修</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="start_date"
                label="开始日期"
                rules={[{ required: true, message: '请选择开始日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="end_date"
                label="结束日期"
                rules={[{ required: true, message: '请选择结束日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="contract_amount" label="合同金额">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入合同金额"
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="service_level" label="服务等级">
                <Input placeholder="请输入服务等级" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="response_time" label="响应时间">
                <Input placeholder="请输入响应时间" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={24}>
              <Form.Item name="coverage_scope" label="保修范围">
                <TextArea rows={2} placeholder="请输入保修范围" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={24}>
              <Form.Item name="remark" label="备注">
                <TextArea rows={2} placeholder="请输入备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

// ===================== 档案管理 =====================
const DocumentList = () => {
  const canEdit = useCan('maintenance', 'edit');
  const canDelete = useCan('maintenance', 'delete');
  const isMobile = useIsMobile();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);

  const [searchParams, setSearchParams] = useState({
    keyword: '',
    document_type: '',
  });

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

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
        asset_name: hit.asset_name,
        supplier_name: hit.supplier || hit.manufacturer,
      });
    }
  };

  const fetchData = useCallback(
    async (params = {}) => {
      setLoading(true);
      try {
        const requestParams = {
          page: params.page || pagination.current,
          pageSize: params.pageSize || pagination.pageSize,
          ...searchParams,
        };
        const response = await warrantyAPI.getArchives(requestParams);
        const list = response.data || [];
        setData(list);
        setPagination(prev => ({
          ...prev,
          current: params.page || prev.current,
          pageSize: params.pageSize || prev.pageSize,
          total: response.pagination?.total || list.length,
        }));
      } catch (error) {
        console.error('加载档案列表失败:', error);
        message.error('加载档案列表失败');
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.pageSize, searchParams]
  );

  useEffect(() => {
    fetchData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchData({ page: 1 });
  };

  const handleReset = () => {
    setSearchParams({ keyword: '', document_type: '' });
  };

  const handleTableChange = pag => {
    fetchData({ page: pag.current, pageSize: pag.pageSize });
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = record => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      archive_date: record.archive_date ? dayjs(record.archive_date) : null,
      retention_until: record.retention_until ? dayjs(record.retention_until) : null,
    });
    setModalOpen(true);
  };

  const handleDelete = async id => {
    try {
      await warrantyAPI.deleteArchive(id);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        archive_date: values.archive_date ? dayjs(values.archive_date).format('YYYY-MM-DD') : null,
        retention_until: values.retention_until
          ? dayjs(values.retention_until).format('YYYY-MM-DD')
          : null,
        contract_id: values.contract_id != null ? Number(values.contract_id) : null,
      };
      setSubmitting(true);
      if (editingRecord) {
        await warrantyAPI.updateArchive(editingRecord.id, payload);
        message.success('更新成功');
      } else {
        await warrantyAPI.createArchive(payload);
        message.success('新增成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (error) {
      if (error?.errorFields) return;
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: '档案编号', dataIndex: 'archive_no', key: 'archive_no', ellipsis: true },
    { title: '档案名称', dataIndex: 'archive_name', key: 'archive_name', ellipsis: true },
    {
      title: '文档类型',
      dataIndex: 'document_type',
      key: 'document_type',
      render: val => (val ? <Tag color="blue">{val}</Tag> : '-'),
    },
    { title: '关联合同', dataIndex: 'contract_no', key: 'contract_no', ellipsis: true },
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code', ellipsis: true },
    { title: '归档日期', dataIndex: 'archive_date', key: 'archive_date' },
    { title: '保管截止', dataIndex: 'retention_until', key: 'retention_until' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: val => <Tag color={ARCHIVE_STATUS_COLOR[val] || 'default'}>{val || '-'}</Tag>,
    },
    {
      title: '文件',
      dataIndex: 'file_path',
      key: 'file_path',
      render: val =>
        val ? (
          <Button type="link" size="small" icon={<PaperClipOutlined />} href={val} target="_blank">
            查看
          </Button>
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该档案吗？"
            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="档案编号/名称/合同/资产"
              value={searchParams.keyword}
              onChange={e => setSearchParams(prev => ({ ...prev, keyword: e.target.value }))}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="文档类型筛选"
              value={searchParams.document_type || undefined}
              onChange={val => setSearchParams(prev => ({ ...prev, document_type: val || '' }))}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="合同原件">合同原件</Option>
              <Option value="验收报告">验收报告</Option>
              <Option value="保修证书">保修证书</Option>
              <Option value="技术资料">技术资料</Option>
              <Option value="维修记录">维修记录</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card
        title="档案列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} block={isMobile}>
            新增档案
          </Button>
        }
      >
        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: total => `共 ${total} 条记录`,
            }}
            onChange={handleTableChange}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(data) && data.length > 0 ? (
            <>
              {data.map(record => (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">
                      {record.archive_name || record.archive_no || '-'}
                    </span>
                    <Tag color={ARCHIVE_STATUS_COLOR[record.status] || 'default'}>
                      {record.status || '-'}
                    </Tag>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">档案编号</span>
                      <span className="mobile-card-value">{record.archive_no || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">文档类型</span>
                      <span className="mobile-card-value">
                        {record.document_type ? (
                          <Tag color="blue">{record.document_type}</Tag>
                        ) : (
                          '-'
                        )}
                      </span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">关联合同</span>
                      <span className="mobile-card-value">{record.contract_no || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">资产编号</span>
                      <span className="mobile-card-value">{record.asset_code || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">归档日期</span>
                      <span className="mobile-card-value">{record.archive_date || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">保管截止</span>
                      <span className="mobile-card-value">{record.retention_until || '-'}</span>
                    </div>
                  </div>
                  <div className="mobile-card-actions">
                    <Button
                      type="primary"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(record)}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="确认删除该档案吗？"
                      onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="primary" danger size="small" icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              ))}
              {/* 移动端分页 */}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Space>
                  <Button
                    disabled={pagination.current === 1}
                    onClick={() => fetchData({ page: pagination.current - 1 })}
                  >
                    上一页
                  </Button>
                  <span>
                    第 {pagination.current} /{' '}
                    {Math.ceil(pagination.total / pagination.pageSize) || 1} 页
                  </span>
                  <Button
                    disabled={
                      pagination.current >=
                      Math.ceil(pagination.total / pagination.pageSize)
                    }
                    onClick={() => fetchData({ page: pagination.current + 1 })}
                  >
                    下一页
                  </Button>
                </Space>
                <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                  共 {pagination.total} 条
                </div>
              </div>
            </>
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>

      <Modal
        title={editingRecord ? '编辑档案' : '新增档案'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={isMobile ? '95vw' : 700}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ document_type: '合同原件' }}>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item name="archive_no" label="档案编号">
                <Input placeholder="留空自动生成" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="archive_name"
                label="档案名称"
                rules={[{ required: true, message: '请输入档案名称' }]}
              >
                <Input placeholder="请输入档案名称" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="document_type" label="文档类型">
                <Select placeholder="请选择文档类型">
                  <Option value="合同原件">合同原件</Option>
                  <Option value="验收报告">验收报告</Option>
                  <Option value="保修证书">保修证书</Option>
                  <Option value="技术资料">技术资料</Option>
                  <Option value="维修记录">维修记录</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="contract_id" label="关联合同ID">
                <InputNumber style={{ width: '100%' }} placeholder="可选" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="asset_code" label="资产编号">
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
                    <Option
                      key={a.asset_code}
                      value={a.asset_code}
                      label={`${a.asset_code} - ${a.asset_name}`}
                    >
                      <div>
                        <div>{a.asset_code} - {a.asset_name}</div>
                        <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                          ''
                        </div>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="file_path"
                label="档案文件"
                rules={[{ required: true, message: '请上传档案文件' }]}
              >
                <Upload
                  maxCount={1}
                  beforeUpload={file => {
                    const formData = new FormData();
                    formData.append('file', file);
                    warrantyAPI.uploadFile('archive', formData).then(res => {
                      if (res?.data?.file_path) {
                        form.setFieldValue('file_path', res.data.file_path);
                        form.setFieldValue('file_size', res.data.file_size);
                        message.success('文件上传成功');
                      }
                    }).catch(() => message.error('文件上传失败'));
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />}>点击上传</Button>
                </Upload>
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="archive_date" label="归档日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="retention_until" label="保管截止">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={24}>
              <Form.Item name="description" label="描述">
                <TextArea rows={2} placeholder="请输入描述" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

// ===================== 发票管理 =====================
const InvoiceList = () => {
  const canEdit = useCan('maintenance', 'edit');
  const canDelete = useCan('maintenance', 'delete');
  const isMobile = useIsMobile();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const [searchParams, setSearchParams] = useState({
    keyword: '',
    status: '',
  });

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const fetchData = useCallback(
    async (params = {}) => {
      setLoading(true);
      try {
        const requestParams = {
          page: params.page || pagination.current,
          pageSize: params.pageSize || pagination.pageSize,
          ...searchParams,
        };
        const response = await warrantyAPI.getInvoices(requestParams);
        const list = response.data || [];
        setData(list);
        setPagination(prev => ({
          ...prev,
          current: params.page || prev.current,
          pageSize: params.pageSize || prev.pageSize,
          total: response.pagination?.total || list.length,
        }));
      } catch (error) {
        console.error('加载发票列表失败:', error);
        message.error('加载发票列表失败');
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.pageSize, searchParams]
  );

  useEffect(() => {
    fetchData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchData({ page: 1 });
  };

  const handleReset = () => {
    setSearchParams({ keyword: '', status: '' });
  };

  const handleTableChange = pag => {
    fetchData({ page: pag.current, pageSize: pag.pageSize });
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = record => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      invoice_date: record.invoice_date ? dayjs(record.invoice_date) : null,
    });
    setModalOpen(true);
  };

  const handleDelete = async id => {
    try {
      await warrantyAPI.deleteInvoice(id);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        invoice_date: values.invoice_date ? dayjs(values.invoice_date).format('YYYY-MM-DD') : null,
        amount: values.amount != null ? Number(values.amount) : null,
        tax_amount: values.tax_amount != null ? Number(values.tax_amount) : null,
        contract_id: values.contract_id != null ? Number(values.contract_id) : null,
      };
      setSubmitting(true);
      if (editingRecord) {
        await warrantyAPI.updateInvoice(editingRecord.id, payload);
        message.success('更新成功');
      } else {
        await warrantyAPI.createInvoice(payload);
        message.success('新增成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (error) {
      if (error?.errorFields) return;
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: '发票编号', dataIndex: 'invoice_no', key: 'invoice_no', ellipsis: true },
    { title: '发票代码', dataIndex: 'invoice_code', key: 'invoice_code', ellipsis: true },
    { title: '发票类型', dataIndex: 'invoice_type', key: 'invoice_type' },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: val => formatAmount(val),
    },
    {
      title: '税额',
      dataIndex: 'tax_amount',
      key: 'tax_amount',
      render: val => formatAmount(val),
    },
    { title: '开票日期', dataIndex: 'invoice_date', key: 'invoice_date' },
    { title: '开票方', dataIndex: 'issuer', key: 'issuer', ellipsis: true },
    { title: '关联合同', dataIndex: 'contract_no', key: 'contract_no', ellipsis: true },
    {
      title: '审核状态',
      dataIndex: 'status',
      key: 'status',
      render: val => <Tag color={INVOICE_STATUS_COLOR[val] || 'default'}>{val || '-'}</Tag>,
    },
    {
      title: '附件',
      dataIndex: 'file_path',
      key: 'file_path',
      render: val =>
        val ? (
          <Button type="link" size="small" icon={<PaperClipOutlined />} href={val} target="_blank">
            查看
          </Button>
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该发票吗？"
            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="发票编号/代码/开票方/合同"
              value={searchParams.keyword}
              onChange={e => setSearchParams(prev => ({ ...prev, keyword: e.target.value }))}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="审核状态筛选"
              value={searchParams.status || undefined}
              onChange={val => setSearchParams(prev => ({ ...prev, status: val || '' }))}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="待审核">待审核</Option>
              <Option value="已审核">已审核</Option>
              <Option value="已驳回">已驳回</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card
        title="发票列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} block={isMobile}>
            新增发票
          </Button>
        }
      >
        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: total => `共 ${total} 条记录`,
            }}
            onChange={handleTableChange}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(data) && data.length > 0 ? (
            <>
              {data.map(record => (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.invoice_no || '-'}</span>
                    <Tag color={INVOICE_STATUS_COLOR[record.status] || 'default'}>
                      {record.status || '-'}
                    </Tag>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">发票代码</span>
                      <span className="mobile-card-value">{record.invoice_code || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">发票类型</span>
                      <span className="mobile-card-value">{record.invoice_type || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">金额</span>
                      <span className="mobile-card-value">{formatAmount(record.amount)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">税额</span>
                      <span className="mobile-card-value">{formatAmount(record.tax_amount)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">开票日期</span>
                      <span className="mobile-card-value">{record.invoice_date || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">开票方</span>
                      <span className="mobile-card-value">{record.issuer || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">关联合同</span>
                      <span className="mobile-card-value">{record.contract_no || '-'}</span>
                    </div>
                  </div>
                  <div className="mobile-card-actions">
                    <Button
                      type="primary"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(record)}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="确认删除该发票吗？"
                      onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="primary" danger size="small" icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              ))}
              {/* 移动端分页 */}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Space>
                  <Button
                    disabled={pagination.current === 1}
                    onClick={() => fetchData({ page: pagination.current - 1 })}
                  >
                    上一页
                  </Button>
                  <span>
                    第 {pagination.current} /{' '}
                    {Math.ceil(pagination.total / pagination.pageSize) || 1} 页
                  </span>
                  <Button
                    disabled={
                      pagination.current >=
                      Math.ceil(pagination.total / pagination.pageSize)
                    }
                    onClick={() => fetchData({ page: pagination.current + 1 })}
                  >
                    下一页
                  </Button>
                </Space>
                <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                  共 {pagination.total} 条
                </div>
              </div>
            </>
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>

      <Modal
        title={editingRecord ? '编辑发票' : '新增发票'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={isMobile ? '95vw' : 700}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ invoice_type: '增值税专用发票' }}>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="invoice_no"
                label="发票编号"
                rules={[{ required: true, message: '请输入发票编号' }]}
              >
                <Input placeholder="请输入发票编号" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="invoice_code" label="发票代码">
                <Input placeholder="请输入发票代码" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="invoice_type" label="发票类型">
                <Select placeholder="请选择发票类型">
                  <Option value="增值税专用发票">增值税专用发票</Option>
                  <Option value="增值税普通发票">增值税普通发票</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="contract_id" label="关联合同ID">
                <InputNumber style={{ width: '100%' }} placeholder="可选" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="amount"
                label="金额"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入金额"
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="tax_amount" label="税额">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入税额"
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="invoice_date"
                label="开票日期"
                rules={[{ required: true, message: '请选择开票日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="issuer" label="开票方">
                <Input placeholder="请输入开票方" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="receiver" label="收票方">
                <Input placeholder="请输入收票方" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="file_path" label="发票文件">
                <Upload
                  maxCount={1}
                  beforeUpload={file => {
                    const formData = new FormData();
                    formData.append('file', file);
                    warrantyAPI.uploadFile('invoice', formData).then(res => {
                      if (res?.data?.file_path) {
                        form.setFieldValue('file_path', res.data.file_path);
                        message.success('文件上传成功');
                      }
                    }).catch(() => message.error('文件上传失败'));
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />}>点击上传</Button>
                </Upload>
              </Form.Item>
            </Col>
            <Col xs={24} lg={24}>
              <Form.Item name="remark" label="备注">
                <TextArea rows={2} placeholder="请输入备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

// ===================== 付款管理 =====================
const PaymentList = () => {
  const canEdit = useCan('maintenance', 'edit');
  const canDelete = useCan('maintenance', 'delete');
  const isMobile = useIsMobile();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const [searchParams, setSearchParams] = useState({
    keyword: '',
    status: '',
  });

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const fetchData = useCallback(
    async (params = {}) => {
      setLoading(true);
      try {
        const requestParams = {
          page: params.page || pagination.current,
          pageSize: params.pageSize || pagination.pageSize,
          ...searchParams,
        };
        const response = await warrantyAPI.getPayments(requestParams);
        const list = response.data || [];
        setData(list);
        setPagination(prev => ({
          ...prev,
          current: params.page || prev.current,
          pageSize: params.pageSize || prev.pageSize,
          total: response.pagination?.total || list.length,
        }));
      } catch (error) {
        console.error('加载付款列表失败:', error);
        message.error('加载付款列表失败');
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.pageSize, searchParams]
  );

  useEffect(() => {
    fetchData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchData({ page: 1 });
  };

  const handleReset = () => {
    setSearchParams({ keyword: '', status: '' });
  };

  const handleTableChange = pag => {
    fetchData({ page: pag.current, pageSize: pag.pageSize });
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = record => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      payment_date: record.payment_date ? dayjs(record.payment_date) : null,
    });
    setModalOpen(true);
  };

  const handleDelete = async id => {
    try {
      await warrantyAPI.deletePayment(id);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        payment_date: values.payment_date ? dayjs(values.payment_date).format('YYYY-MM-DD') : null,
        amount: values.amount != null ? Number(values.amount) : null,
        contract_id: values.contract_id != null ? Number(values.contract_id) : null,
        invoice_id: values.invoice_id != null ? Number(values.invoice_id) : null,
      };
      setSubmitting(true);
      if (editingRecord) {
        await warrantyAPI.updatePayment(editingRecord.id, payload);
        message.success('更新成功');
      } else {
        await warrantyAPI.createPayment(payload);
        message.success('新增成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (error) {
      if (error?.errorFields) return;
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: '付款单号', dataIndex: 'payment_no', key: 'payment_no', ellipsis: true },
    { title: '付款类型', dataIndex: 'payment_type', key: 'payment_type' },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: val => formatAmount(val),
    },
    { title: '付款方式', dataIndex: 'payment_method', key: 'payment_method' },
    { title: '付款日期', dataIndex: 'payment_date', key: 'payment_date' },
    { title: '收款方', dataIndex: 'payee', key: 'payee', ellipsis: true },
    { title: '关联合同', dataIndex: 'contract_no', key: 'contract_no', ellipsis: true },
    { title: '关联发票', dataIndex: 'invoice_no', key: 'invoice_no', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: val => <Tag color={PAYMENT_STATUS_COLOR[val] || 'default'}>{val || '-'}</Tag>,
    },
    {
      title: '凭证',
      dataIndex: 'file_path',
      key: 'file_path',
      render: val =>
        val ? (
          <Button type="link" size="small" icon={<PaperClipOutlined />} href={val} target="_blank">
            查看
          </Button>
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该付款记录吗？"
            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="付款单号/收款方/合同/发票"
              value={searchParams.keyword}
              onChange={e => setSearchParams(prev => ({ ...prev, keyword: e.target.value }))}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="状态筛选"
              value={searchParams.status || undefined}
              onChange={val => setSearchParams(prev => ({ ...prev, status: val || '' }))}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="待付款">待付款</Option>
              <Option value="已付款">已付款</Option>
              <Option value="已取消">已取消</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card
        title="付款列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} block={isMobile}>
            新增付款
          </Button>
        }
      >
        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: total => `共 ${total} 条记录`,
            }}
            onChange={handleTableChange}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(data) && data.length > 0 ? (
            <>
              {data.map(record => (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.payment_no || '-'}</span>
                    <Tag color={PAYMENT_STATUS_COLOR[record.status] || 'default'}>
                      {record.status || '-'}
                    </Tag>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">付款类型</span>
                      <span className="mobile-card-value">{record.payment_type || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">金额</span>
                      <span className="mobile-card-value">{formatAmount(record.amount)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">付款方式</span>
                      <span className="mobile-card-value">{record.payment_method || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">付款日期</span>
                      <span className="mobile-card-value">{record.payment_date || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">收款方</span>
                      <span className="mobile-card-value">{record.payee || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">关联合同</span>
                      <span className="mobile-card-value">{record.contract_no || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">关联发票</span>
                      <span className="mobile-card-value">{record.invoice_no || '-'}</span>
                    </div>
                  </div>
                  <div className="mobile-card-actions">
                    <Button
                      type="primary"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(record)}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="确认删除该付款记录吗？"
                      onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="primary" danger size="small" icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              ))}
              {/* 移动端分页 */}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Space>
                  <Button
                    disabled={pagination.current === 1}
                    onClick={() => fetchData({ page: pagination.current - 1 })}
                  >
                    上一页
                  </Button>
                  <span>
                    第 {pagination.current} /{' '}
                    {Math.ceil(pagination.total / pagination.pageSize) || 1} 页
                  </span>
                  <Button
                    disabled={
                      pagination.current >=
                      Math.ceil(pagination.total / pagination.pageSize)
                    }
                    onClick={() => fetchData({ page: pagination.current + 1 })}
                  >
                    下一页
                  </Button>
                </Space>
                <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                  共 {pagination.total} 条
                </div>
              </div>
            </>
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>

      <Modal
        title={editingRecord ? '编辑付款' : '新增付款'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={isMobile ? '95vw' : 700}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ payment_type: '全款', payment_method: '银行转账' }}
        >
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item name="payment_no" label="付款单号">
                <Input placeholder="留空自动生成" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="contract_id" label="关联合同ID">
                <InputNumber style={{ width: '100%' }} placeholder="可选" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="invoice_id" label="关联发票ID">
                <InputNumber style={{ width: '100%' }} placeholder="可选" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="payment_type" label="付款类型">
                <Select placeholder="请选择付款类型">
                  <Option value="预付款">预付款</Option>
                  <Option value="进度款">进度款</Option>
                  <Option value="尾款">尾款</Option>
                  <Option value="全款">全款</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="amount"
                label="金额"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入金额"
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="payment_method" label="付款方式">
                <Select placeholder="请选择付款方式">
                  <Option value="银行转账">银行转账</Option>
                  <Option value="支票">支票</Option>
                  <Option value="现金">现金</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="payment_date"
                label="付款日期"
                rules={[{ required: true, message: '请选择付款日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="payee" label="收款方">
                <Input placeholder="请输入收款方" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="bank_account" label="银行账号">
                <Input placeholder="请输入银行账号" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="file_path" label="付款凭证">
                <Upload
                  maxCount={1}
                  beforeUpload={file => {
                    const formData = new FormData();
                    formData.append('file', file);
                    warrantyAPI.uploadFile('payment', formData).then(res => {
                      if (res?.data?.file_path) {
                        form.setFieldValue('file_path', res.data.file_path);
                        message.success('文件上传成功');
                      }
                    }).catch(() => message.error('文件上传失败'));
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />}>点击上传</Button>
                </Upload>
              </Form.Item>
            </Col>
            <Col xs={24} lg={24}>
              <Form.Item name="remark" label="备注">
                <TextArea rows={2} placeholder="请输入备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

// ===================== 主页面 =====================
const WarrantyContractManagement = () => {
  const canEdit = useCan('maintenance', 'edit');
  const [activeTab, setActiveTab] = useState('contract');

  const tabItems = [
    {
      key: 'contract',
      label: '保修合同管理',
      children: <ContractList />,
    },
    {
      key: 'archive',
      label: '档案管理',
      children: <DocumentList />,
    },
    {
      key: 'invoice',
      label: '发票管理',
      children: <InvoiceList />,
    },
    {
      key: 'payment',
      label: '付款管理',
      children: <PaymentList />,
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        destroyOnHidden={false}
      />
    </div>
  );
};

export default WarrantyContractManagement;
