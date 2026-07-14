import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  message,
  Space,
  Tooltip,
  Popconfirm,
  Card,
  Typography,
  Tag,
  Empty,
} from 'antd';

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { qualityControlAPI, assetAPI } from '../../utils/api';
import useIsMobile from '../../hooks/useIsMobile';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const MetrologyPage = () => {
  const canDelete = useCan('metrology', 'delete');
  const canEdit = useCan('metrology', 'edit');
  const isMobile = useIsMobile();
  const [form] = Form.useForm();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('create'); // create or update
  const [currentRecord, setCurrentRecord] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  const [filters, setFilters] = useState({
    metrology_type: '',
    dateRange: null,
  });
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  // 加载资产列表
  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const response = await assetAPI.getAssets({ pageSize: 500 });
      if (response.success) {
        setAssets(response.data || []);
      }
    } catch (error) {
      console.error('加载资产列表失败:', error);
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  // 当打开模态框时加载资产列表
  useEffect(() => {
    if (modalVisible) {
      loadAssets();
    }
  }, [modalVisible, loadAssets]);

  // 计量类型选项 - 符合《中华人民共和国计量法》
  const metrologyTypeOptions = [
    { label: '强制检定', value: '强制检定', desc: '贸易结算、安全防护、医疗卫生、环境监测' },
    { label: '非强制检定', value: '非强制检定', desc: '其他计量器具' },
    { label: '校准', value: '校准', desc: '确定示值误差并进行校正' },
    { label: '期间核查', value: '期间核查', desc: '保持校准状态可信度的核查' },
    { label: '其他', value: '其他', desc: '其他计量活动' },
  ];

  // 结果选项 - 符合计量检定规程
  const resultOptions = [
    { label: '合格', value: '合格', color: 'green' },
    { label: '不合格', value: '不合格', color: 'red' },
    { label: '限用', value: '限用', color: 'orange', desc: '可降级使用' },
    { label: '待检', value: '待检', color: 'default' },
  ];

  // 状态选项
  const statusOptions = [
    { label: '待检', value: '待检' },
    { label: '进行中', value: '进行中' },
    { label: '已完成', value: '已完成' },
    { label: '已取消', value: '已取消' },
  ];

  // 加载计量记录列表
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        metrology_type: filters.metrology_type,
        start_date: filters.dateRange ? filters.dateRange[0].format('YYYY-MM-DD') : undefined,
        end_date: filters.dateRange ? filters.dateRange[1].format('YYYY-MM-DD') : undefined,
      };

      const response = await qualityControlAPI.getMetrologyRecords(params);
      if (response.success) {
        setData(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
        }));
      } else {
        message.error(response.message || '获取计量记录失败');
      }
    } catch (error) {
      console.error('获取计量记录失败:', error);
      message.error('获取计量记录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [pagination, filters]);

  // 初始化加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 处理分页变化
  const handlePaginationChange = (page, pageSize) => {
    setPagination({
      current: page,
      pageSize,
    });
  };

  // 处理筛选变化
  const handleFilterChange = (key, value) => {
    setFilters({
      ...filters,
      [key]: value,
    });
    setPagination({
      ...pagination,
      current: 1,
    });
  };

  // 打开创建模态框
  const handleCreate = () => {
    form.resetFields();
    setCurrentRecord(null);
    setModalType('create');
    setModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = record => {
    setCurrentRecord(record);
    setModalType('update');
    form.setFieldsValue({
      asset_code: record.asset_code,
      metrology_type: record.metrology_type,
      metrology_date: record.metrology_date ? record.metrology_date : null,
      next_metrology_date: record.next_metrology_date ? record.next_metrology_date : null,
      metrology_agency: record.metrology_agency,
      certificate_no: record.certificate_no,
      result: record.result,
      accuracy_level: record.accuracy_level,
      measurement_range: record.measurement_range,
      cost: record.cost,
      operator: record.operator,
      remark: record.remark,
      status: record.status,
      metrology_cycle: record.metrology_cycle,
      warning_days: record.warning_days,
    });
    setModalVisible(true);
  };

  // 处理删除
  const handleDelete = async id => {
    try {
      const response = await qualityControlAPI.deleteMetrologyRecord(id);
      if (response.success) {
        message.success('计量记录删除成功');
        loadData();
      } else {
        message.error(response.message || '删除计量记录失败');
      }
    } catch (error) {
      console.error('删除计量记录失败:', error);
      message.error('删除计量记录失败，请稍后重试');
    }
  };

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let response;

      if (modalType === 'create') {
        response = await qualityControlAPI.createMetrologyRecord(values);
      } else {
        response = await qualityControlAPI.updateMetrologyRecord(currentRecord.id, values);
      }

      if (response.success) {
        message.success(modalType === 'create' ? '计量记录创建成功' : '计量记录更新成功');
        setModalVisible(false);
        loadData();
      } else {
        message.error(
          response.message || (modalType === 'create' ? '创建计量记录失败' : '更新计量记录失败')
        );
      }
    } catch (error) {
      console.error('提交表单失败:', error);
      message.error('提交表单失败，请稍后重试');
    }
  };

  // 表格列配置
  const columns = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      render: (_, __, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      ellipsis: true,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      ellipsis: true,
    },
    {
      title: '计量类型',
      dataIndex: 'metrology_type',
      key: 'metrology_type',
      filters: metrologyTypeOptions.map(option => ({ text: option.label, value: option.value })),
      onFilter: (value, record) => record.metrology_type === value,
      ellipsis: true,
    },
    {
      title: '计量日期',
      dataIndex: 'metrology_date',
      key: 'metrology_date',
      ellipsis: true,
    },
    {
      title: '下次计量日期',
      dataIndex: 'next_metrology_date',
      key: 'next_metrology_date',
      ellipsis: true,
    },
    {
      title: '计量机构',
      dataIndex: 'metrology_agency',
      key: 'metrology_agency',
      ellipsis: true,
    },
    {
      title: '证书编号',
      dataIndex: 'certificate_no',
      key: 'certificate_no',
      ellipsis: true,
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      filters: resultOptions.map(option => ({ text: option.label, value: option.value })),
      onFilter: (value, record) => record.result === value,
      ellipsis: true,
      render: text => {
        const color = text === '合格' ? 'green' : text === '不合格' ? 'red' : 'orange';
        return <Text style={{ color }}>{text}</Text>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      filters: statusOptions.map(option => ({ text: option.label, value: option.value })),
      onFilter: (value, record) => record.status === value,
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="查看">
            <Button icon={<EyeOutlined />} size="small" />
          </Tooltip>
          <Tooltip title="编辑">
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="确定要删除这条计量记录吗？"
            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-3 sm:px-4 lg:px-6">
      <Card className="max-w-7xl mx-auto shadow-lg overflow-hidden">
        {/* 页面头部 */}
        <div className="bg-gradient-to-r from-green-600 to-teal-700 text-white p-4 sm:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
            <div>
              <Title level={4} sm={3} className="text-white mb-1">
                计量管理
              </Title>
              <Text className="text-green-100 text-sm sm:text-base">
                管理计量记录，包括新增、编辑、删除和查询
              </Text>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                icon={<ReloadOutlined />}
                onClick={loadData}
                loading={loading}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white border-white"
                size="small"
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
                className="bg-white text-green-700 hover:bg-green-50 border-white"
                size="small"
              >
                新增计量记录
              </Button>
            </div>
          </div>
        </div>

        {/* 主要内容 */}
        <div className="p-4 sm:p-6">
          {/* 筛选区域 */}
          <Card className="mb-4 sm:mb-6 shadow-sm border border-gray-200">
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
                <Text className="font-medium text-gray-700 whitespace-nowrap">计量类型：</Text>
                <Select
                  placeholder="请选择计量类型"
                  style={{ flex: 1, minWidth: '120px' }}
                  value={filters.metrology_type}
                  onChange={value => handleFilterChange('metrology_type', value)}
                  allowClear
                  className="flex-1 w-full sm:w-auto"
                >
                  {metrologyTypeOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
                <Text className="font-medium text-gray-700 whitespace-nowrap">计量日期：</Text>
                <RangePicker
                  style={{ flex: 1, minWidth: '200px' }}
                  value={filters.dateRange}
                  onChange={dates => handleFilterChange('dateRange', dates)}
                  className="w-full sm:w-auto"
                />
              </div>
            </div>
          </Card>

          {/* 计量记录表格 */}
          <Card className="shadow-sm border border-gray-200">
            {/* 桌面端表格 */}
            <div className="hide-on-mobile">
              <Table
                columns={columns}
                dataSource={data}
                rowKey="id"
                loading={loading}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  onChange: handlePaginationChange,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50', '100'],
                  className: 'mt-4',
                  size: 'middle',
                }}
                scroll={{ x: 'max-content' }}
                className="overflow-x-auto"
                size="middle"
                locale={{
                  emptyText: (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-2">
                        <ReloadOutlined style={{ fontSize: 32 }} />
                      </div>
                      <Text type="secondary">暂无计量记录</Text>
                      <p className="text-gray-500 text-sm mt-1">点击上方 "新增计量记录" 按钮添加</p>
                    </div>
                  ),
                }}
              />
            </div>

            {/* 移动端卡片列表 */}
            <div className="mobile-table-cards show-on-mobile">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
              ) : Array.isArray(data) && data.length > 0 ? (
                <>
                  {data.map((record, index) => {
                    const resultColor = record.result === '合格' ? 'green' : record.result === '不合格' ? 'red' : record.result === '限用' ? 'orange' : 'default';
                    const statusColor = record.status === '已完成' ? 'success' : record.status === '进行中' ? 'processing' : record.status === '已取消' ? 'default' : 'warning';
                    return (
                      <div key={record.id} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">{record.asset_name || '-'}</span>
                          {record.result && <Tag color={resultColor}>{record.result}</Tag>}
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">资产编号</span>
                            <span className="mobile-card-value">{record.asset_code || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">计量类型</span>
                            <span className="mobile-card-value">{record.metrology_type || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">计量日期</span>
                            <span className="mobile-card-value">{record.metrology_date || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">下次计量</span>
                            <span className="mobile-card-value">{record.next_metrology_date || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">计量机构</span>
                            <span className="mobile-card-value">{record.metrology_agency || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">证书编号</span>
                            <span className="mobile-card-value">{record.certificate_no || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">状态</span>
                            <span className="mobile-card-value">
                              <Tag color={statusColor}>{record.status || '-'}</Tag>
                            </span>
                          </div>
                        </div>
                        <div className="mobile-card-actions">
                          <Button
                            type="primary"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                            block
                          >
                            编辑
                          </Button>
                          <Popconfirm
                            title="确定要删除这条计量记录吗？"
                            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
                            okText="确定"
                            cancelText="取消"
                          >
                            <Button danger size="small" icon={<DeleteOutlined />} block>
                              删除
                            </Button>
                          </Popconfirm>
                        </div>
                      </div>
                    );
                  })}
                  {/* 移动端分页 */}
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <Space>
                      <Button
                        disabled={pagination.current === 1}
                        onClick={() => handlePaginationChange(pagination.current - 1, pagination.pageSize)}
                      >
                        上一页
                      </Button>
                      <span>
                        第 {pagination.current} / {Math.ceil(pagination.total / pagination.pageSize) || 1} 页
                      </span>
                      <Button
                        disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                        onClick={() => handlePaginationChange(pagination.current + 1, pagination.pageSize)}
                      >
                        下一页
                      </Button>
                    </Space>
                    <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>共 {pagination.total || 0} 条</div>
                  </div>
                </>
              ) : (
                <Empty description="暂无计量记录" />
              )}
            </div>
          </Card>

          {/* 新增/编辑模态框 */}
          <Modal
            title={modalType === 'create' ? '新增计量记录' : '编辑计量记录'}
            open={modalVisible}
            onOk={handleSubmit}
            onCancel={() => setModalVisible(false)}
            width={Math.min(800, window.innerWidth - 40)}
            className="rounded-lg overflow-hidden"
          >
            <Form form={form} layout="vertical" className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <Form.Item
                  name="asset_code"
                  label="资产"
                  rules={[{ required: true, message: '请选择资产' }]}
                >
                  <Select
                    placeholder="请选择资产（从资产台账选择）"
                    showSearch
                    allowClear
                    loading={assetsLoading}
                    filterOption={(input, option) =>
                      option.children.toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {assets.map(asset => (
                      <Option key={asset.asset_code} value={asset.asset_code}>
                        {asset.asset_name} - {asset.asset_code}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="metrology_type"
                  label="计量类型"
                  rules={[{ required: true, message: '请选择计量类型' }]}
                >
                  <Select placeholder="请选择计量类型" className="rounded-md">
                    {metrologyTypeOptions.map(option => (
                      <Option key={option.value} value={option.value}>
                        {option.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <Form.Item
                  name="metrology_date"
                  label="计量日期"
                  rules={[{ required: true, message: '请选择计量日期' }]}
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    placeholder="请选择计量日期"
                    className="rounded-md"
                  />
                </Form.Item>

                <Form.Item name="next_metrology_date" label="下次计量日期">
                  <DatePicker
                    style={{ width: '100%' }}
                    placeholder="请选择下次计量日期"
                    className="rounded-md"
                  />
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <Form.Item name="metrology_agency" label="计量机构">
                  <Input placeholder="请输入计量机构" className="rounded-md" />
                </Form.Item>

                <Form.Item name="certificate_no" label="证书编号">
                  <Input placeholder="请输入证书编号" className="rounded-md" />
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <Form.Item name="result" label="结果">
                  <Select placeholder="请选择结果" className="rounded-md">
                    {resultOptions.map(option => (
                      <Option key={option.value} value={option.value}>
                        {option.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item name="cost" label="费用">
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="请输入费用"
                    className="rounded-md"
                  />
                </Form.Item>

                <Form.Item name="status" label="状态">
                  <Select placeholder="请选择状态" className="rounded-md">
                    {statusOptions.map(option => (
                      <Option key={option.value} value={option.value}>
                        {option.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <Form.Item name="accuracy_level" label="精度等级">
                  <Input placeholder="请输入精度等级" className="rounded-md" />
                </Form.Item>

                <Form.Item name="measurement_range" label="测量范围">
                  <Input placeholder="请输入测量范围" className="rounded-md" />
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <Form.Item name="operator" label="操作人员">
                  <Input placeholder="请输入操作人员" className="rounded-md" />
                </Form.Item>

                <Form.Item name="metrology_cycle" label="计量周期">
                  <Input placeholder="请输入计量周期" className="rounded-md" />
                </Form.Item>
              </div>

              <Form.Item name="warning_days" label="预警天数">
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入预警天数"
                  className="rounded-md"
                />
              </Form.Item>

              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} sm={3} placeholder="请输入备注" className="rounded-md" />
              </Form.Item>
            </Form>
          </Modal>
        </div>
      </Card>
    </div>
  );
};

export default MetrologyPage;
