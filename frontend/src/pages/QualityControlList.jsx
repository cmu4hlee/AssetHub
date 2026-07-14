import React, { useState, useEffect, useCallback } from 'react';
import { useIsMobile, useCan } from '../hooks';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Popconfirm,
  message,
  Card,
  Tag,
  DatePicker,
} from 'antd';

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  EyeOutlined,
  ReloadOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { qualityControlAPI } from '../utils/api';
import { printQualityControlReport } from '../utils/printReport';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

const QualityControlList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    qc_type: '',
    result: '',
    status: '',
    keyword: '',
    start_date: '',
    end_date: '',
  });
  const isMobile = useIsMobile();
  const canDelete = useCan('quality', 'delete');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      };
      const result = await qualityControlAPI.getQualityControlRecords(params);
      if (result.success) {
        setData(Array.isArray(result.data) ? result.data : []);
        setPagination(prev => ({
          ...prev,
          total: result.pagination?.total || 0,
        }));
      }
    } catch (error) {
      message.error('加载质控记录失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters.qc_type, filters.result, filters.status, filters.keyword, filters.start_date, filters.end_date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async id => {
    try {
      const result = await qualityControlAPI.deleteQualityControlRecord(id);
      if (result.success) {
        message.success('删除成功');
        loadData();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handlePrintReport = () => {
    if (!data || data.length === 0) {
      message.warning('暂无数据可打印');
      return;
    }
    printQualityControlReport(data);
  };

  const getResultColor = result => {
    const colorMap = {
      合格: 'green',
      不合格: 'red',
      待检: 'default',
      整改中: 'orange',
    };
    return colorMap[result] || 'default';
  };

  const getStatusColor = status => {
    const colorMap = {
      待检: 'default',
      进行中: 'processing',
      已完成: 'success',
      已取消: 'error',
      整改中: 'warning',
    };
    return colorMap[status] || 'default';
  };

  const columns = [
    {
      title: '质控单号',
      dataIndex: 'record_no',
      key: 'record_no',
      width: 150,
    },
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 150,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '质控类型',
      dataIndex: 'qc_type',
      key: 'qc_type',
      width: 120,
    },
    {
      title: '质控日期',
      dataIndex: 'qc_date',
      key: 'qc_date',
      width: 120,
    },
    {
      title: '质控项目',
      dataIndex: 'qc_item',
      key: 'qc_item',
      width: 150,
      ellipsis: true,
    },
    {
      title: '质控结果',
      dataIndex: 'result',
      key: 'result',
      width: 100,
      render: result => <Tag color={getResultColor(result)}>{result}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: status => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/quality-control/qc/${record.id}`)}>
            详情
          </Button>
          <Button type="link" onClick={() => navigate(`/quality-control/qc/edit/${record.id}`)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.id)}
              disabled={!canDelete}
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
    <div style={{ padding: isMobile ? '12px' : '24px' }}>
      <Card>
        <div
          style={{
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <h2 style={{ margin: 0 }}>质控管理</h2>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/quality-control/qc/new')}
            >
              新建质控记录
            </Button>
          </Space>
        </div>

        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button icon={<PrinterOutlined />} onClick={handlePrintReport}>
            打印报表
          </Button>
        </div>

        <Card size="small" style={{ marginBottom: '16px' }}>
          <Space wrap>
            <Search
              placeholder="搜索质控单号/资产编号/名称"
              style={{ width: isMobile ? '100%' : 300 }}
              allowClear
              value={filters.keyword}
              onChange={e => setFilters({ ...filters, keyword: e.target.value })}
              onSearch={loadData}
              enterButton
            />
            <Select
              placeholder="质控类型"
              style={{ width: isMobile ? '100%' : 150 }}
              allowClear
              value={filters.qc_type || undefined}
              onChange={value => {
                setFilters({ ...filters, qc_type: value || '' });
                setPagination({ ...pagination, current: 1 });
              }}
            >
              <Option value="日常质控">日常质控</Option>
              <Option value="定期质控">定期质控</Option>
              <Option value="专项质控">专项质控</Option>
              <Option value="验收质控">验收质控</Option>
              <Option value="其他">其他</Option>
            </Select>
            <Select
              placeholder="质控结果"
              style={{ width: isMobile ? '100%' : 120 }}
              allowClear
              value={filters.result || undefined}
              onChange={value => {
                setFilters({ ...filters, result: value || '' });
                setPagination({ ...pagination, current: 1 });
              }}
            >
              <Option value="合格">合格</Option>
              <Option value="不合格">不合格</Option>
              <Option value="待检">待检</Option>
              <Option value="整改中">整改中</Option>
            </Select>
            <Select
              placeholder="状态"
              style={{ width: isMobile ? '100%' : 120 }}
              allowClear
              value={filters.status || undefined}
              onChange={value => {
                setFilters({ ...filters, status: value || '' });
                setPagination({ ...pagination, current: 1 });
              }}
            >
              <Option value="待检">待检</Option>
              <Option value="进行中">进行中</Option>
              <Option value="已完成">已完成</Option>
              <Option value="已取消">已取消</Option>
              <Option value="整改中">整改中</Option>
            </Select>
            <RangePicker
              style={{ width: isMobile ? '100%' : 240 }}
              onChange={dates => {
                if (dates && dates.length === 2) {
                  setFilters({
                    ...filters,
                    start_date: dates[0].format('YYYY-MM-DD'),
                    end_date: dates[1].format('YYYY-MM-DD'),
                  });
                } else {
                  setFilters({
                    ...filters,
                    start_date: '',
                    end_date: '',
                  });
                }
                setPagination({ ...pagination, current: 1 });
              }}
            />
          </Space>
        </Card>

        {/* 桌面端表格 */}
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={data}
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
            scroll={{ x: 1500 }}
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
          ) : Array.isArray(data) && data.length > 0 ? (
            <>
              {data.map(record => (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.record_no || '-'}</span>
                    <Tag color={getStatusColor(record.status)}>{record.status || '-'}</Tag>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">资产编号</span>
                      <span className="mobile-card-value">{record.asset_code || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">资产名称</span>
                      <span className="mobile-card-value">{record.asset_name || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">质控类型</span>
                      <span className="mobile-card-value">{record.qc_type || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">质控日期</span>
                      <span className="mobile-card-value">{record.qc_date || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">质控结果</span>
                      <Tag color={getResultColor(record.result)}>{record.result || '-'}</Tag>
                    </div>
                  </div>
                  <div className="mobile-card-footer">
                    <Space>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => navigate(`/quality-control/qc/${record.id}`)}
                      >
                        详情
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => navigate(`/quality-control/qc/edit/${record.id}`)}
                      >
                        编辑
                      </Button>
                      <Popconfirm
                        title="确定要删除这条记录吗？"
                        onConfirm={() => handleDelete(record.id)}
              disabled={!canDelete}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button type="link" danger size="small" icon={<DeleteOutlined />} disabled={!canDelete}>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>暂无数据</div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default QualityControlList;
