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
  Descriptions,
  Statistic,
  Empty,
} from 'antd';

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { warrantyAPI } from '../utils/api';
import useIsMobile from '../hooks/useIsMobile';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Search } = Input;

const WARRANTY_TYPE_OPTIONS = [
  { value: '原厂保修', label: '原厂保修' },
  { value: '延保', label: '延保' },
  { value: '第三方保修', label: '第三方保修' },
  { value: '自行维修', label: '自行维修' },
  { value: '无保修', label: '无保修' },
];

const WARRANTY_STATUS_OPTIONS = [
  { value: '在保', label: '在保' },
  { value: '过保', label: '过保' },
  { value: '即将到期', label: '即将到期' },
];

const CHANGE_TYPE_COLORS = {
  创建: 'blue',
  更新: 'orange',
  删除: 'red',
  状态变更: 'purple',
  续保: 'green',
};

// 导出Excel
const escapeHtml = str =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const exportToExcel = (data, headers, filename) => {
  if (!data || data.length === 0) {
    message.warning('没有数据可导出');
    return;
  }
  const headerCells = Object.values(headers)
    .map(label => `<th>${escapeHtml(label)}</th>`)
    .join('');
  const bodyRows = data
    .map(row => {
      const cells = Object.keys(headers)
        .map(key => `<td>${escapeHtml(row[key])}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8" /><style>table{border-collapse:collapse}th,td{border:1px solid #d9d9d9;padding:6px 8px;white-space:nowrap}th{background:#f5f5f5;font-weight:600}</style></head><body><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${dayjs().format('YYYYMMDD_HHmmss')}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const WARRANTY_EXPORT_HEADERS = {
  asset_code: '资产编号',
  asset_name: '资产名称',
  warranty_type: '保修类型',
  warranty_status: '保修状态',
  start_date: '保修开始日期',
  end_date: '保修结束日期',
  supplier_name: '保修服务方',
  service_hotline: '服务热线',
  contract_no: '关联合同',
};

const HISTORY_EXPORT_HEADERS = {
  asset_code: '资产编号',
  asset_name: '资产名称',
  change_type: '变更类型',
  field_name: '变更字段',
  old_value: '旧值',
  new_value: '新值',
  change_description: '变更说明',
  changed_by: '操作人',
  changed_at: '操作时间',
};

const WarrantyManagement = () => {
  const canDelete = useCan('maintenance', 'delete');
  const canEdit = useCan('maintenance', 'edit');
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('inWarranty');

  // 统计数据
  const [statistics, setStatistics] = useState({
    inWarrantyCount: 0,
    outWarrantyCount: 0,
    expiringCount: 0,
  });
  const [statisticsLoading, setStatisticsLoading] = useState(false);

  // Tab1: 在保清单
  const [inWarrantyData, setInWarrantyData] = useState([]);
  const [inWarrantyLoading, setInWarrantyLoading] = useState(false);
  const [inWarrantySearch, setInWarrantySearch] = useState({
    keyword: '',
    warranty_type: '',
  });
  const [inWarrantyPagination, setInWarrantyPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Tab2: 过保清单
  const [outWarrantyData, setOutWarrantyData] = useState([]);
  const [outWarrantyLoading, setOutWarrantyLoading] = useState(false);
  const [outWarrantySearch, setOutWarrantySearch] = useState({
    keyword: '',
    warranty_type: '',
  });
  const [outWarrantyPagination, setOutWarrantyPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Tab3: 保修信息维护
  const [warrantyInfoData, setWarrantyInfoData] = useState([]);
  const [warrantyInfoLoading, setWarrantyInfoLoading] = useState(false);
  const [warrantyInfoSearch, setWarrantyInfoSearch] = useState({
    keyword: '',
    warranty_status: '',
    warranty_type: '',
  });
  const [warrantyInfoPagination, setWarrantyInfoPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Tab4: 保修历史记录
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState({
    change_type: '',
    asset_code: '',
    start_date: null,
    end_date: null,
  });
  const [historyPagination, setHistoryPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 获取统计数据
  const fetchStatistics = useCallback(async () => {
    setStatisticsLoading(true);
    try {
      const response = await warrantyAPI.getStatistics();
      const data = response.data || response;
      setStatistics({
        inWarrantyCount: data?.in_warranty_count ?? data?.inWarrantyCount ?? 0,
        outWarrantyCount: data?.out_warranty_count ?? data?.outWarrantyCount ?? 0,
        expiringCount: data?.expiring_count ?? data?.expiringCount ?? 0,
      });
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setStatisticsLoading(false);
    }
  }, []);

  // 获取在保清单
  const fetchInWarrantyList = useCallback(async (params = {}) => {
    setInWarrantyLoading(true);
    try {
      const response = await warrantyAPI.getInWarrantyList({
        page: params.page || inWarrantyPagination.current,
        pageSize: params.pageSize || inWarrantyPagination.pageSize,
        keyword: inWarrantySearch.keyword,
        warranty_type: inWarrantySearch.warranty_type,
      });
      if (response.success !== false) {
        setInWarrantyData(response.data || []);
        setInWarrantyPagination(prev => ({
          ...prev,
          current: params.page || prev.current,
          pageSize: params.pageSize || prev.pageSize,
          total: response.pagination?.total || (response.data || []).length,
        }));
      } else {
        message.error(response.message || '获取在保清单失败');
      }
    } catch (error) {
      console.error('获取在保清单失败:', error);
      message.error('网络错误，获取在保清单失败');
    } finally {
      setInWarrantyLoading(false);
    }
  }, [inWarrantySearch, inWarrantyPagination.current, inWarrantyPagination.pageSize]);

  // 获取过保清单
  const fetchOutWarrantyList = useCallback(async (params = {}) => {
    setOutWarrantyLoading(true);
    try {
      const response = await warrantyAPI.getOutWarrantyList({
        page: params.page || outWarrantyPagination.current,
        pageSize: params.pageSize || outWarrantyPagination.pageSize,
        keyword: outWarrantySearch.keyword,
        warranty_type: outWarrantySearch.warranty_type,
      });
      if (response.success !== false) {
        setOutWarrantyData(response.data || []);
        setOutWarrantyPagination(prev => ({
          ...prev,
          current: params.page || prev.current,
          pageSize: params.pageSize || prev.pageSize,
          total: response.pagination?.total || (response.data || []).length,
        }));
      } else {
        message.error(response.message || '获取过保清单失败');
      }
    } catch (error) {
      console.error('获取过保清单失败:', error);
      message.error('网络错误，获取过保清单失败');
    } finally {
      setOutWarrantyLoading(false);
    }
  }, [outWarrantySearch, outWarrantyPagination.current, outWarrantyPagination.pageSize]);

  // 获取保修信息维护列表
  const fetchWarrantyInfo = useCallback(async (params = {}) => {
    setWarrantyInfoLoading(true);
    try {
      const response = await warrantyAPI.getWarrantyInfo({
        page: params.page || warrantyInfoPagination.current,
        pageSize: params.pageSize || warrantyInfoPagination.pageSize,
        keyword: warrantyInfoSearch.keyword,
        warranty_status: warrantyInfoSearch.warranty_status,
        warranty_type: warrantyInfoSearch.warranty_type,
      });
      if (response.success !== false) {
        setWarrantyInfoData(response.data || []);
        setWarrantyInfoPagination(prev => ({
          ...prev,
          current: params.page || prev.current,
          pageSize: params.pageSize || prev.pageSize,
          total: response.pagination?.total || (response.data || []).length,
        }));
      } else {
        message.error(response.message || '获取保修信息失败');
      }
    } catch (error) {
      console.error('获取保修信息失败:', error);
      message.error('网络错误，获取保修信息失败');
    } finally {
      setWarrantyInfoLoading(false);
    }
  }, [warrantyInfoSearch, warrantyInfoPagination.current, warrantyInfoPagination.pageSize]);

  // 获取保修历史记录
  const fetchHistory = useCallback(async (params = {}) => {
    setHistoryLoading(true);
    try {
      const response = await warrantyAPI.getHistory({
        page: params.page || historyPagination.current,
        pageSize: params.pageSize || historyPagination.pageSize,
        change_type: historySearch.change_type,
        asset_code: historySearch.asset_code,
        start_date: historySearch.start_date,
        end_date: historySearch.end_date,
      });
      if (response.success !== false) {
        setHistoryData(response.data || []);
        setHistoryPagination(prev => ({
          ...prev,
          current: params.page || prev.current,
          pageSize: params.pageSize || prev.pageSize,
          total: response.pagination?.total || (response.data || []).length,
        }));
      } else {
        message.error(response.message || '获取保修历史记录失败');
      }
    } catch (error) {
      console.error('获取保修历史记录失败:', error);
      message.error('网络错误，获取保修历史记录失败');
    } finally {
      setHistoryLoading(false);
    }
  }, [historySearch, historyPagination.current, historyPagination.pageSize]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  useEffect(() => {
    if (activeTab === 'inWarranty') {
      fetchInWarrantyList({ page: 1 });
    } else if (activeTab === 'outWarranty') {
      fetchOutWarrantyList({ page: 1 });
    } else if (activeTab === 'warrantyInfo') {
      fetchWarrantyInfo({ page: 1 });
    } else if (activeTab === 'history') {
      fetchHistory({ page: 1 });
    }
  }, [activeTab]);

  // 在保/过保清单列定义
  const getWarrantyColumns = (statusTag) => [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 160,
    },
    {
      title: '保修类型',
      dataIndex: 'warranty_type',
      key: 'warranty_type',
      width: 110,
    },
    {
      title: '保修开始日期',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 120,
      render: text => (text ? dayjs(text).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '保修结束日期',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 120,
      render: text => (text ? dayjs(text).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '保修服务方',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 140,
    },
    {
      title: '服务热线',
      dataIndex: 'service_hotline',
      key: 'service_hotline',
      width: 130,
    },
    {
      title: '关联合同',
      dataIndex: 'contract_no',
      key: 'contract_no',
      width: 140,
    },
    {
      title: '状态',
      dataIndex: 'warranty_status',
      key: 'warranty_status',
      width: 90,
      render: () => statusTag,
    },
  ];

  const inWarrantyColumns = getWarrantyColumns(<Tag color="green">在保</Tag>);
  const outWarrantyColumns = getWarrantyColumns(<Tag color="red">过保</Tag>);

  // 保修信息维护列定义
  const warrantyInfoColumns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
    },
    {
      title: '保修类型',
      dataIndex: 'warranty_type',
      key: 'warranty_type',
      width: 110,
    },
    {
      title: '保修开始日期',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 120,
      render: text => (text ? dayjs(text).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '保修结束日期',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 120,
      render: text => (text ? dayjs(text).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '保修服务方',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 140,
    },
    {
      title: '服务热线',
      dataIndex: 'service_hotline',
      key: 'service_hotline',
      width: 130,
    },
    {
      title: '状态',
      dataIndex: 'warranty_status',
      key: 'warranty_status',
      width: 90,
      render: status => {
        const colorMap = { 在保: 'green', 过保: 'red', 即将到期: 'orange' };
        return <Tag color={colorMap[status] || 'default'}>{status || '-'}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除该保修信息吗？"
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

  // 保修历史记录列定义
  const historyColumns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 160,
    },
    {
      title: '变更类型',
      dataIndex: 'change_type',
      key: 'change_type',
      width: 110,
      render: type => (
        <Tag color={CHANGE_TYPE_COLORS[type] || 'default'}>{type || '-'}</Tag>
      ),
    },
    {
      title: '变更字段',
      dataIndex: 'field_name',
      key: 'field_name',
      width: 130,
    },
    {
      title: '旧值',
      dataIndex: 'old_value',
      key: 'old_value',
      width: 150,
      render: text => text ?? '-',
    },
    {
      title: '新值',
      dataIndex: 'new_value',
      key: 'new_value',
      width: 150,
      render: text => text ?? '-',
    },
    {
      title: '变更说明',
      dataIndex: 'change_description',
      key: 'change_description',
      width: 200,
      render: text => text ?? '-',
    },
    {
      title: '操作人',
      dataIndex: 'changed_by',
      key: 'changed_by',
      width: 110,
    },
    {
      title: '操作时间',
      dataIndex: 'changed_at',
      key: 'changed_at',
      width: 170,
      render: text => (text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
  ];

  // 新增
  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 编辑
  const handleEdit = record => {
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      start_date: record.start_date ? dayjs(record.start_date) : null,
      end_date: record.end_date ? dayjs(record.end_date) : null,
    });
    setModalVisible(true);
  };

  // 删除
  const handleDelete = async id => {
    try {
      await warrantyAPI.deleteWarrantyInfo(id);
      message.success('删除成功');
      fetchWarrantyInfo({ page: warrantyInfoPagination.current });
      fetchStatistics();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const submitData = {
        ...values,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
      };
      if (editingId) {
        await warrantyAPI.updateWarrantyInfo(editingId, submitData);
        message.success('更新成功');
      } else {
        await warrantyAPI.createWarrantyInfo(submitData);
        message.success('新增成功');
      }
      setModalVisible(false);
      form.resetFields();
      fetchWarrantyInfo({ page: warrantyInfoPagination.current });
      fetchStatistics();
    } catch (error) {
      console.error('保存失败:', error);
      if (error.errorFields) {
        message.error('请填写必填字段');
      } else {
        message.error('保存失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 分页配置
  const getPaginationConfig = (pagination, setPagination, fetchFn) => ({
    current: pagination.current,
    pageSize: pagination.pageSize,
    total: pagination.total,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: total => `共 ${total} 条`,
    onChange: (page, pageSize) => {
      setPagination(prev => ({ ...prev, current: page, pageSize }));
      fetchFn({ page, pageSize });
    },
    onShowSizeChange: (current, size) => {
      setPagination(prev => ({ ...prev, current: 1, pageSize: size }));
      fetchFn({ page: 1, pageSize: size });
    },
  });

  // Tab1: 在保清单内容
  const inWarrantyTab = (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="搜索资产编号/名称"
              allowClear
              enterButton={<><SearchOutlined /> 搜索</>}
              onSearch={value => {
                setInWarrantySearch(prev => ({ ...prev, keyword: value }));
                setInWarrantyPagination(prev => ({ ...prev, current: 1 }));
                setTimeout(() => fetchInWarrantyList({ page: 1 }), 0);
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="保修类型"
              allowClear
              style={{ width: '100%' }}
              value={inWarrantySearch.warranty_type || undefined}
              onChange={value => {
                setInWarrantySearch(prev => ({ ...prev, warranty_type: value || '' }));
                setInWarrantyPagination(prev => ({ ...prev, current: 1 }));
                setTimeout(() => fetchInWarrantyList({ page: 1 }), 0);
              }}
              options={WARRANTY_TYPE_OPTIONS}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                block={isMobile}
                onClick={() => {
                  setInWarrantySearch({ keyword: '', warranty_type: '' });
                  setInWarrantyPagination(prev => ({ ...prev, current: 1 }));
                  setTimeout(() => fetchInWarrantyList({ page: 1 }), 0);
                }}
              >
                重置
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => exportToExcel(inWarrantyData, WARRANTY_EXPORT_HEADERS, '在保清单')}
              >
                导出
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card size="small">
        <div className="hide-on-mobile">
          <Table
            columns={inWarrantyColumns}
            dataSource={inWarrantyData}
            rowKey="id"
            loading={inWarrantyLoading}
            scroll={{ x: 1200 }}
            pagination={getPaginationConfig(
              inWarrantyPagination,
              setInWarrantyPagination,
              fetchInWarrantyList
            )}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {inWarrantyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(inWarrantyData) && inWarrantyData.length > 0 ? (
            inWarrantyData.map(record => (
              <div key={record.id || record.asset_code} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.asset_name || record.asset_code || '-'}</span>
                  <Tag color="green">在保</Tag>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产编号</span>
                    <span className="mobile-card-value">{record.asset_code || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">保修类型</span>
                    <span className="mobile-card-value">{record.warranty_type || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">保修开始日期</span>
                    <span className="mobile-card-value">{record.start_date ? dayjs(record.start_date).format('YYYY-MM-DD') : '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">保修结束日期</span>
                    <span className="mobile-card-value">{record.end_date ? dayjs(record.end_date).format('YYYY-MM-DD') : '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">保修服务方</span>
                    <span className="mobile-card-value">{record.supplier_name || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">服务热线</span>
                    <span className="mobile-card-value">{record.service_hotline || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">关联合同</span>
                    <span className="mobile-card-value">{record.contract_no || '-'}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>
    </div>
  );

  // Tab2: 过保清单内容
  const outWarrantyTab = (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="搜索资产编号/名称"
              allowClear
              enterButton={<><SearchOutlined /> 搜索</>}
              onSearch={value => {
                setOutWarrantySearch(prev => ({ ...prev, keyword: value }));
                setOutWarrantyPagination(prev => ({ ...prev, current: 1 }));
                setTimeout(() => fetchOutWarrantyList({ page: 1 }), 0);
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="保修类型"
              allowClear
              style={{ width: '100%' }}
              value={outWarrantySearch.warranty_type || undefined}
              onChange={value => {
                setOutWarrantySearch(prev => ({ ...prev, warranty_type: value || '' }));
                setOutWarrantyPagination(prev => ({ ...prev, current: 1 }));
                setTimeout(() => fetchOutWarrantyList({ page: 1 }), 0);
              }}
              options={WARRANTY_TYPE_OPTIONS}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                block={isMobile}
                onClick={() => {
                  setOutWarrantySearch({ keyword: '', warranty_type: '' });
                  setOutWarrantyPagination(prev => ({ ...prev, current: 1 }));
                  setTimeout(() => fetchOutWarrantyList({ page: 1 }), 0);
                }}
              >
                重置
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => exportToExcel(outWarrantyData, WARRANTY_EXPORT_HEADERS, '过保清单')}
              >
                导出
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card size="small">
        <div className="hide-on-mobile">
          <Table
            columns={outWarrantyColumns}
            dataSource={outWarrantyData}
            rowKey="id"
            loading={outWarrantyLoading}
            scroll={{ x: 1200 }}
            pagination={getPaginationConfig(
              outWarrantyPagination,
              setOutWarrantyPagination,
              fetchOutWarrantyList
            )}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {outWarrantyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(outWarrantyData) && outWarrantyData.length > 0 ? (
            outWarrantyData.map(record => (
              <div key={record.id || record.asset_code} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.asset_name || record.asset_code || '-'}</span>
                  <Tag color="red">过保</Tag>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产编号</span>
                    <span className="mobile-card-value">{record.asset_code || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">保修类型</span>
                    <span className="mobile-card-value">{record.warranty_type || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">保修开始日期</span>
                    <span className="mobile-card-value">{record.start_date ? dayjs(record.start_date).format('YYYY-MM-DD') : '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">保修结束日期</span>
                    <span className="mobile-card-value">{record.end_date ? dayjs(record.end_date).format('YYYY-MM-DD') : '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">保修服务方</span>
                    <span className="mobile-card-value">{record.supplier_name || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">服务热线</span>
                    <span className="mobile-card-value">{record.service_hotline || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">关联合同</span>
                    <span className="mobile-card-value">{record.contract_no || '-'}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>
    </div>
  );

  // Tab3: 保修信息维护内容
  const warrantyInfoTab = (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={7}>
            <Search
              placeholder="搜索资产编号/服务方"
              allowClear
              enterButton={<><SearchOutlined /> 搜索</>}
              onSearch={value => {
                setWarrantyInfoSearch(prev => ({ ...prev, keyword: value }));
                setWarrantyInfoPagination(prev => ({ ...prev, current: 1 }));
                setTimeout(() => fetchWarrantyInfo({ page: 1 }), 0);
              }}
            />
          </Col>
          <Col xs={12} sm={6} md={5}>
            <Select
              placeholder="保修状态"
              allowClear
              style={{ width: '100%' }}
              value={warrantyInfoSearch.warranty_status || undefined}
              onChange={value => {
                setWarrantyInfoSearch(prev => ({ ...prev, warranty_status: value || '' }));
                setWarrantyInfoPagination(prev => ({ ...prev, current: 1 }));
                setTimeout(() => fetchWarrantyInfo({ page: 1 }), 0);
              }}
              options={WARRANTY_STATUS_OPTIONS}
            />
          </Col>
          <Col xs={12} sm={6} md={5}>
            <Select
              placeholder="保修类型"
              allowClear
              style={{ width: '100%' }}
              value={warrantyInfoSearch.warranty_type || undefined}
              onChange={value => {
                setWarrantyInfoSearch(prev => ({ ...prev, warranty_type: value || '' }));
                setWarrantyInfoPagination(prev => ({ ...prev, current: 1 }));
                setTimeout(() => fetchWarrantyInfo({ page: 1 }), 0);
              }}
              options={WARRANTY_TYPE_OPTIONS}
            />
          </Col>
          <Col xs={24} md={7} style={{ textAlign: 'right' }}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                block={isMobile}
                onClick={() => {
                  setWarrantyInfoSearch({ keyword: '', warranty_status: '', warranty_type: '' });
                  setWarrantyInfoPagination(prev => ({ ...prev, current: 1 }));
                  setTimeout(() => fetchWarrantyInfo({ page: 1 }), 0);
                }}
              >
                重置
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} block={isMobile}>
                新增
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card size="small">
        <div className="hide-on-mobile">
          <Table
            columns={warrantyInfoColumns}
            dataSource={warrantyInfoData}
            rowKey="id"
            loading={warrantyInfoLoading}
            scroll={{ x: 1300 }}
            pagination={getPaginationConfig(
              warrantyInfoPagination,
              setWarrantyInfoPagination,
              fetchWarrantyInfo
            )}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {warrantyInfoLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(warrantyInfoData) && warrantyInfoData.length > 0 ? (
            warrantyInfoData.map(record => {
              const statusColorMap = { 在保: 'green', 过保: 'red', 即将到期: 'orange' };
              return (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.asset_code || '-'}</span>
                    <Tag color={statusColorMap[record.warranty_status] || 'default'}>{record.warranty_status || '-'}</Tag>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">保修类型</span>
                      <span className="mobile-card-value">{record.warranty_type || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">保修开始日期</span>
                      <span className="mobile-card-value">{record.start_date ? dayjs(record.start_date).format('YYYY-MM-DD') : '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">保修结束日期</span>
                      <span className="mobile-card-value">{record.end_date ? dayjs(record.end_date).format('YYYY-MM-DD') : '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">保修服务方</span>
                      <span className="mobile-card-value">{record.supplier_name || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">服务热线</span>
                      <span className="mobile-card-value">{record.service_hotline || '-'}</span>
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
                      title="确定要删除该保修信息吗？"
                      onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="primary" size="small" danger block icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              );
            })
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>

      <Modal
        title={editingId ? '编辑保修信息' : '新增保修信息'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingId(null);
        }}
        confirmLoading={submitting}
        width={isMobile ? '95vw' : 800}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="asset_code"
                label="资产编号"
                rules={[{ required: true, message: '请输入资产编号' }]}
              >
                <Input placeholder="请输入资产编号" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="warranty_type" label="保修类型">
                <Select
                  placeholder="请选择保修类型"
                  allowClear
                  options={WARRANTY_TYPE_OPTIONS}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} lg={8}>
              <Form.Item name="start_date" label="保修开始日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item name="end_date" label="保修结束日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item name="warranty_period_months" label="保修时长(月)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="请输入保修时长"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item name="supplier_name" label="保修服务方">
                <Input placeholder="请输入保修服务方" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="supplier_contact" label="服务方联系方式">
                <Input placeholder="请输入服务方联系方式" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item name="service_hotline" label="服务热线">
                <Input placeholder="请输入服务热线" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="remark" label="备注">
                <Input placeholder="请输入备注" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="coverage_details" label="保修范围">
            <Input.TextArea rows={3} placeholder="请输入保修范围详情" />
          </Form.Item>
          <Form.Item name="exclusions" label="保修排除项">
            <Input.TextArea rows={3} placeholder="请输入保修排除项" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  // Tab4: 保修历史记录内容
  const historyTab = (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="变更类型"
              allowClear
              style={{ width: '100%' }}
              value={historySearch.change_type || undefined}
              onChange={value => {
                setHistorySearch(prev => ({ ...prev, change_type: value || '' }));
                setHistoryPagination(prev => ({ ...prev, current: 1 }));
                setTimeout(() => fetchHistory({ page: 1 }), 0);
              }}
              options={Object.keys(CHANGE_TYPE_COLORS).map(type => ({
                value: type,
                label: type,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="资产编号"
              allowClear
              value={historySearch.asset_code || undefined}
              onChange={e => {
                const value = e.target.value;
                setHistorySearch(prev => ({ ...prev, asset_code: value }));
              }}
              onPressEnter={() => {
                setHistoryPagination(prev => ({ ...prev, current: 1 }));
                setTimeout(() => fetchHistory({ page: 1 }), 0);
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={7}>
            <RangePicker
              style={{ width: '100%' }}
              value={[historySearch.start_date, historySearch.end_date]}
              onChange={(dates, dateStrings) => {
                setHistorySearch(prev => ({
                  ...prev,
                  start_date: dateStrings[0] || null,
                  end_date: dateStrings[1] || null,
                }));
                setHistoryPagination(prev => ({ ...prev, current: 1 }));
                setTimeout(() => fetchHistory({ page: 1 }), 0);
              }}
            />
          </Col>
          <Col xs={24} md={5} style={{ textAlign: 'right' }}>
            <Button
              icon={<ReloadOutlined />}
              block={isMobile}
              onClick={() => {
                setHistorySearch({
                  change_type: '',
                  asset_code: '',
                  start_date: null,
                  end_date: null,
                });
                setHistoryPagination(prev => ({ ...prev, current: 1 }));
                setTimeout(() => fetchHistory({ page: 1 }), 0);
              }}
            >
              重置
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => exportToExcel(historyData, HISTORY_EXPORT_HEADERS, '保修历史记录')}
            >
              导出
            </Button>
          </Col>
        </Row>
      </Card>
      <Card size="small">
        <div className="hide-on-mobile">
          <Table
            columns={historyColumns}
            dataSource={historyData}
            rowKey="id"
            loading={historyLoading}
            scroll={{ x: 1400 }}
            pagination={getPaginationConfig(
              historyPagination,
              setHistoryPagination,
              fetchHistory
            )}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(historyData) && historyData.length > 0 ? (
            historyData.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.asset_name || record.asset_code || '-'}</span>
                  <Tag color={CHANGE_TYPE_COLORS[record.change_type] || 'default'}>{record.change_type || '-'}</Tag>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产编号</span>
                    <span className="mobile-card-value">{record.asset_code || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">变更字段</span>
                    <span className="mobile-card-value">{record.field_name || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">旧值</span>
                    <span className="mobile-card-value">{record.old_value ?? '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">新值</span>
                    <span className="mobile-card-value">{record.new_value ?? '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">变更说明</span>
                    <span className="mobile-card-value">{record.change_description ?? '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">操作人</span>
                    <span className="mobile-card-value">{record.changed_by || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">操作时间</span>
                    <span className="mobile-card-value">{record.changed_at ? dayjs(record.changed_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>
    </div>
  );

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>
        <SafetyCertificateOutlined style={{ marginRight: 8 }} />
        保修管理
      </h2>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Statistic
              title="在保数量"
              value={statistics.inWarrantyCount}
              styles={{ content: { color: '#52c41a' } }}
              loading={statisticsLoading}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="过保数量"
              value={statistics.outWarrantyCount}
              styles={{ content: { color: '#f5222d' } }}
              loading={statisticsLoading}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="即将到期数量"
              value={statistics.expiringCount}
              styles={{ content: { color: '#faad14' } }}
              loading={statisticsLoading}
            />
          </Col>
        </Row>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'inWarranty',
            label: '在保清单',
            children: inWarrantyTab,
          },
          {
            key: 'outWarranty',
            label: '过保清单',
            children: outWarrantyTab,
          },
          {
            key: 'warrantyInfo',
            label: '保修信息维护',
            children: warrantyInfoTab,
          },
          {
            key: 'history',
            label: '保修历史记录',
            children: historyTab,
          },
        ]}
      />
    </div>
  );
};

export default WarrantyManagement;
