import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
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
  CheckCircleOutlined,
} from '@ant-design/icons';
import { qualityControlAPI } from '../../utils/api';
import useIsMobile from '../../hooks/useIsMobile';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const QualityControlPage = () => {
  const canDelete = useCan('quality', 'delete');
  const canEdit = useCan('quality', 'edit');
  const [form] = Form.useForm();
  const isMobile = useIsMobile();
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
    qc_type: '',
    dateRange: null,
  });

  // 质控类型选项 - 符合医疗器械质量管理规范
  const qcTypeOptions = [
    { label: '日常质控', value: '日常质控', desc: '日常质量控制活动' },
    { label: '定期质控', value: '定期质控', desc: '周期性质量控制活动' },
    { label: '专项质控', value: '专项质控', desc: '专项质量控制活动' },
    { label: '验收质控', value: '验收质控', desc: '验收时的质量控制' },
    { label: '其他', value: '其他', desc: '其他质量控制活动' },
  ];

  // 结果选项
  const resultOptions = [
    { label: '合格', value: '合格', color: 'green' },
    { label: '不合格', value: '不合格', color: 'red' },
    { label: '待检', value: '待检', color: 'default' },
    { label: '整改中', value: '整改中', color: 'orange', desc: '不合格需整改' },
  ];

  // 状态选项
  const statusOptions = [
    { label: '待检', value: '待检' },
    { label: '进行中', value: '进行中' },
    { label: '已完成', value: '已完成' },
    { label: '已取消', value: '已取消' },
    { label: '整改中', value: '整改中' },
  ];

  // 加载质量控制记录列表
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        qc_type: filters.qc_type,
        start_date: filters.dateRange ? filters.dateRange[0].format('YYYY-MM-DD') : undefined,
        end_date: filters.dateRange ? filters.dateRange[1].format('YYYY-MM-DD') : undefined,
      };

      const response = await qualityControlAPI.getQualityControlRecords(params);
      if (response.success) {
        setData(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
        }));
      } else {
        message.error(response.message || '获取质量控制记录失败');
      }
    } catch (error) {
      console.error('获取质量控制记录失败:', error);
      message.error('获取质量控制记录失败，请稍后重试');
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
      qc_type: record.qc_type,
      qc_date: record.qc_date ? record.qc_date : null,
      qc_item: record.qc_item,
      standard_value: record.standard_value,
      actual_value: record.actual_value,
      tolerance: record.tolerance,
      result: record.result,
      qc_method: record.qc_method,
      qc_person: record.qc_person,
      department: record.department,
      remark: record.remark,
      status: record.status,
    });
    setModalVisible(true);
  };

  // 处理删除
  const handleDelete = async id => {
    try {
      const response = await qualityControlAPI.deleteQualityControlRecord(id);
      if (response.success) {
        message.success('质量控制记录删除成功');
        loadData();
      } else {
        message.error(response.message || '删除质量控制记录失败');
      }
    } catch (error) {
      console.error('删除质量控制记录失败:', error);
      message.error('删除质量控制记录失败，请稍后重试');
    }
  };

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let response;

      if (modalType === 'create') {
        response = await qualityControlAPI.createQualityControlRecord(values);
      } else {
        response = await qualityControlAPI.updateQualityControlRecord(currentRecord.id, values);
      }

      if (response.success) {
        message.success(modalType === 'create' ? '质量控制记录创建成功' : '质量控制记录更新成功');
        setModalVisible(false);
        loadData();
      } else {
        message.error(
          response.message ||
            (modalType === 'create' ? '创建质量控制记录失败' : '更新质量控制记录失败')
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
      title: '质检类型',
      dataIndex: 'qc_type',
      key: 'qc_type',
      filters: qcTypeOptions.map(option => ({ text: option.label, value: option.value })),
      onFilter: (value, record) => record.qc_type === value,
      ellipsis: true,
    },
    {
      title: '质检日期',
      dataIndex: 'qc_date',
      key: 'qc_date',
      ellipsis: true,
    },
    {
      title: '质检项目',
      dataIndex: 'qc_item',
      key: 'qc_item',
      ellipsis: true,
    },
    {
      title: '标准值',
      dataIndex: 'standard_value',
      key: 'standard_value',
      ellipsis: true,
    },
    {
      title: '实际值',
      dataIndex: 'actual_value',
      key: 'actual_value',
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
            title="确定要删除这条质量控制记录吗？"
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
        <div className="bg-gradient-to-r from-orange-600 to-red-700 text-white p-4 sm:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
            <div>
              <Title level={4} sm={3} className="text-white mb-1">
                质量控制管理
              </Title>
              <Text className="text-orange-100 text-sm sm:text-base">
                管理质检记录，包括新增、编辑、删除和查询
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
                className="bg-white text-orange-700 hover:bg-orange-50 border-white"
                size="small"
              >
                新增质检记录
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
                <Text className="font-medium text-gray-700 whitespace-nowrap">质检类型：</Text>
                <Select
                  placeholder="请选择质检类型"
                  style={{ flex: 1, minWidth: '120px' }}
                  value={filters.qc_type}
                  onChange={value => handleFilterChange('qc_type', value)}
                  allowClear
                  className="flex-1 w-full sm:w-auto"
                >
                  {qcTypeOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
                <Text className="font-medium text-gray-700 whitespace-nowrap">质检日期：</Text>
                <RangePicker
                  style={{ flex: 1, minWidth: '200px' }}
                  value={filters.dateRange}
                  onChange={dates => handleFilterChange('dateRange', dates)}
                  className="w-full sm:w-auto"
                />
              </div>
            </div>
          </Card>

          {/* 质量控制记录表格 */}
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
                        <CheckCircleOutlined style={{ fontSize: 32 }} />
                      </div>
                      <Text type="secondary">暂无质检记录</Text>
                      <p className="text-gray-500 text-sm mt-1">点击上方 "新增质检记录" 按钮添加</p>
                    </div>
                  ),
                }}
              />
            </div>
            {/* 移动端卡片列表 */}
            <div className="mobile-table-cards show-on-mobile">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
                  加载中...
                </div>
              ) : Array.isArray(data) && data.length > 0 ? (
                <>
                  {data.map(record => {
                    const resultColor =
                      record.result === '合格'
                        ? 'green'
                        : record.result === '不合格'
                        ? 'red'
                        : 'orange';
                    return (
                      <div key={record.id} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">
                            {record.asset_name || record.asset_code || '-'}
                          </span>
                          <Tag color={resultColor}>{record.result || '-'}</Tag>
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">资产编号</span>
                            <span className="mobile-card-value">{record.asset_code || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">质检类型</span>
                            <span className="mobile-card-value">{record.qc_type || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">质检日期</span>
                            <span className="mobile-card-value">{record.qc_date || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">质检项目</span>
                            <span className="mobile-card-value">{record.qc_item || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">标准值</span>
                            <span className="mobile-card-value">{record.standard_value || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">实际值</span>
                            <span className="mobile-card-value">{record.actual_value || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">状态</span>
                            <span className="mobile-card-value">{record.status || '-'}</span>
                          </div>
                        </div>
                        <div className="mobile-card-actions">
                          <Button
                            type="primary"
                            size="small"
                            block
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                          >
                            编辑
                          </Button>
                          <Popconfirm
                            title="确定要删除这条质量控制记录吗？"
                            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
                            okText="确定"
                            cancelText="取消"
                          >
                            <Button size="small" block danger icon={<DeleteOutlined />} disabled={!canDelete}>
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
                        onClick={() =>
                          setPagination(prev => ({ ...prev, current: prev.current - 1 }))
                        }
                      >
                        上一页
                      </Button>
                      <span>
                        第 {pagination.current} /{' '}
                        {Math.ceil((pagination.total || 0) / pagination.pageSize)} 页
                      </span>
                      <Button
                        disabled={
                          pagination.current >=
                          Math.ceil((pagination.total || 0) / pagination.pageSize)
                        }
                        onClick={() =>
                          setPagination(prev => ({ ...prev, current: prev.current + 1 }))
                        }
                      >
                        下一页
                      </Button>
                    </Space>
                    <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                      共 {pagination.total || 0} 条
                    </div>
                  </div>
                </>
              ) : (
                <Empty description="暂无数据" />
              )}
            </div>
          </Card>

          {/* 新增/编辑模态框 */}
          <Modal
            title={modalType === 'create' ? '新增质检记录' : '编辑质检记录'}
            open={modalVisible}
            onOk={handleSubmit}
            onCancel={() => setModalVisible(false)}
            width={isMobile ? '95vw' : Math.min(800, window.innerWidth - 40)}
            className="rounded-lg overflow-hidden"
          >
            <Form form={form} layout="vertical" className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <Form.Item
                  name="asset_code"
                  label="资产编号"
                  rules={[{ required: true, message: '请输入资产编号' }]}
                >
                  <Input placeholder="请输入资产编号" className="rounded-md" />
                </Form.Item>

                <Form.Item
                  name="qc_type"
                  label="质检类型"
                  rules={[{ required: true, message: '请选择质检类型' }]}
                >
                  <Select placeholder="请选择质检类型" className="rounded-md">
                    {qcTypeOptions.map(option => (
                      <Option key={option.value} value={option.value}>
                        {option.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>

              <Form.Item
                name="qc_date"
                label="质检日期"
                rules={[{ required: true, message: '请选择质检日期' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="请选择质检日期"
                  className="rounded-md"
                />
              </Form.Item>

              <Form.Item
                name="qc_item"
                label="质检项目"
                rules={[{ required: true, message: '请输入质检项目' }]}
              >
                <Input placeholder="请输入质检项目" className="rounded-md" />
              </Form.Item>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <Form.Item name="standard_value" label="标准值">
                  <Input placeholder="请输入标准值" className="rounded-md" />
                </Form.Item>

                <Form.Item name="actual_value" label="实际值">
                  <Input placeholder="请输入实际值" className="rounded-md" />
                </Form.Item>

                <Form.Item name="tolerance" label="公差">
                  <Input placeholder="请输入公差" className="rounded-md" />
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <Form.Item
                  name="result"
                  label="结果"
                  rules={[{ required: true, message: '请选择结果' }]}
                >
                  <Select placeholder="请选择结果" className="rounded-md">
                    {resultOptions.map(option => (
                      <Option key={option.value} value={option.value}>
                        {option.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item name="qc_person" label="质检人员">
                  <Input placeholder="请输入质检人员" className="rounded-md" />
                </Form.Item>

                <Form.Item name="department" label="部门">
                  <Input placeholder="请输入部门" className="rounded-md" />
                </Form.Item>
              </div>

              <Form.Item name="qc_method" label="质检方法">
                <Input placeholder="请输入质检方法" className="rounded-md" />
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

export default QualityControlPage;
