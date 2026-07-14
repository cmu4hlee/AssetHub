import React, { useState, useEffect } from 'react';
import { Table, Modal, Button, message, Spin, Empty, Input, Select, Space, Card, Tag } from 'antd';
import { FileTextOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { assetAIAnalysisAPI } from '../utils/api';
import useIsMobile from '../hooks/useIsMobile';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;

const AIQuestionRecords = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [searchText, setSearchText] = useState('');
  const [sqlExecutionFilter, setSqlExecutionFilter] = useState('all');

  // 获取问答记录
  const fetchRecords = async (page = 1, pageSize = 10, search = '', sqlExecution = 'all') => {
    try {
      setLoading(true);
      // 当前API不支持分页和搜索参数，直接调用
      const result = await assetAIAnalysisAPI.getQuestionRecords();
      if (result.success) {
        // 对数据进行本地筛选
        let filteredData = result.data;

        // 搜索过滤
        if (search) {
          filteredData = filteredData.filter(
            record =>
              record.question.toLowerCase().includes(search.toLowerCase()) ||
              record.result_analysis?.toLowerCase().includes(search.toLowerCase()) ||
              record.answer?.toLowerCase().includes(search.toLowerCase())
          );
        }

        // SQL执行过滤
        if (sqlExecution !== 'all') {
          const isSqlExecution = sqlExecution === 'true';
          filteredData = filteredData.filter(record => record.sql_execution === isSqlExecution);
        }

        // 本地分页
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        setRecords(paginatedData);
        setPagination(prev => ({
          ...prev,
          current: page,
          pageSize,
          total: filteredData.length,
        }));
      } else {
        message.error('获取问答记录失败');
      }
    } catch (error) {
      message.error('获取问答记录失败');
      console.error('获取问答记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(pagination.current, pagination.pageSize, searchText, sqlExecutionFilter);
  }, [pagination.current, pagination.pageSize, searchText, sqlExecutionFilter]);

  // 处理分页变化
  const handlePaginationChange = (page, pageSize) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize,
    }));
  };

  // 处理搜索
  const handleSearch = value => {
    setSearchText(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // 处理筛选变化
  const handleFilterChange = value => {
    setSqlExecutionFilter(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // 刷新数据
  const handleRefresh = () => {
    fetchRecords(pagination.current, pagination.pageSize, searchText, sqlExecutionFilter);
  };

  // 查看详情
  const handleViewDetail = record => {
    setSelectedRecord(record);
    setModalVisible(true);
  };

  // 生成回答摘要
  const generateAnswerSummary = record => {
    // 优先使用result_analysis字段（AI最后返回的分析报告）
    if (record.result_analysis) {
      const textStr =
        typeof record.result_analysis === 'string'
          ? record.result_analysis
          : String(record.result_analysis);
      return textStr.substring(0, 100) + (textStr.length > 100 ? '...' : '');
    }
    // 如果result_analysis为空，从answer字段提取摘要（保留兼容）
    if (record.answer) {
      const textStr = typeof record.answer === 'string' ? record.answer : String(record.answer);
      return textStr.substring(0, 100) + (textStr.length > 100 ? '...' : '');
    }
    return '无回答内容';
  };

  // 表格列配置
  const columns = [
    {
      title: '问题',
      dataIndex: 'question',
      key: 'question',
      ellipsis: true,
      sorter: (a, b) => a.question.localeCompare(b.question),
      width: 300,
    },
    {
      title: '回答摘要',
      key: 'answer_summary',
      ellipsis: true,
      render: (_, record) => generateAnswerSummary(record),
      width: 300,
    },
    {
      title: '生成SQL',
      dataIndex: 'sql_execution',
      key: 'sql_execution',
      render: sql_execution => (sql_execution ? '是' : '否'),
      sorter: (a, b) => (a.sql_execution ? 1 : 0) - (b.sql_execution ? 1 : 0),
      width: 100,
      align: 'center',
    },
    {
      title: 'AI来源',
      dataIndex: 'ai_source',
      key: 'ai_source',
      ellipsis: true,
      sorter: (a, b) => (a.ai_source || '').localeCompare(b.ai_source || ''),
      width: 150,
    },
    {
      title: '分析时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      render: text => (text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="primary" icon={<FileTextOutlined />} onClick={() => handleViewDetail(record)}>
          查看详情
        </Button>
      ),
      width: 120,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>AI问答记录</h1>

      {/* 搜索和筛选区域 */}
      <Card style={{ marginBottom: 24 }}>
        <Space
          size="middle"
          wrap
          direction={isMobile ? 'vertical' : 'horizontal'}
          style={isMobile ? { width: '100%' } : undefined}
        >
          <Search
            placeholder="搜索问题或回答"
            allowClear
            enterButton={<SearchOutlined />}
            size="middle"
            onSearch={handleSearch}
            onChange={e => handleSearch(e.target.value)}
            style={{ width: isMobile ? '100%' : 300 }}
          />
          <Select
            placeholder="是否生成SQL"
            allowClear
            size="middle"
            style={{ width: isMobile ? '100%' : 150 }}
            value={sqlExecutionFilter}
            onChange={handleFilterChange}
          >
            <Option value="all">全部</Option>
            <Option value="true">是</Option>
            <Option value="false">否</Option>
          </Select>
          <Button
            type="default"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            size="middle"
            block={isMobile}
          >
            刷新
          </Button>
        </Space>
      </Card>

      {/* 表格区域 - 桌面端 */}
      <div className="hide-on-mobile">
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: <Empty description="暂无问答记录" />,
          }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: handlePaginationChange,
            onShowSizeChange: handlePaginationChange,
          }}
        />
      </div>

      {/* 移动端卡片列表 */}
      <div className="mobile-table-cards show-on-mobile">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
        ) : records.length > 0 ? (
          <>
            {records.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.question || '-'}</span>
                  <Tag color={record.sql_execution ? 'green' : 'default'}>
                    {record.sql_execution ? '生成SQL' : '未生成SQL'}
                  </Tag>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">回答摘要</span>
                    <span className="mobile-card-value">{generateAnswerSummary(record)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">AI来源</span>
                    <span className="mobile-card-value">{record.ai_source || '未知'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">分析时间</span>
                    <span className="mobile-card-value">
                      {record.created_at
                        ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')
                        : '-'}
                    </span>
                  </div>
                </div>
                <div className="mobile-card-actions">
                  <Button
                    type="primary"
                    size="small"
                    block
                    icon={<FileTextOutlined />}
                    onClick={() => handleViewDetail(record)}
                  >
                    查看详情
                  </Button>
                </div>
              </div>
            ))}
            {/* 移动端分页 */}
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <Space>
                <Button
                  disabled={pagination.current === 1}
                  onClick={() =>
                    handlePaginationChange(pagination.current - 1, pagination.pageSize)
                  }
                >
                  上一页
                </Button>
                <span>
                  第 {pagination.current} /{' '}
                  {Math.ceil(pagination.total / pagination.pageSize) || 1} 页
                </span>
                <Button
                  disabled={
                    pagination.current >= Math.ceil(pagination.total / pagination.pageSize)
                  }
                  onClick={() =>
                    handlePaginationChange(pagination.current + 1, pagination.pageSize)
                  }
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
          <Empty description="暂无问答记录" />
        )}
      </div>

      {/* 详情弹窗 */}
      <Modal
        title="AI分析详情"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={isMobile ? '95vw' : 800}
        destroyOnHidden
      >
        {selectedRecord && (
          <div>
            <h3>问题</h3>
            <Card size="small" style={{ marginBottom: 20 }}>
              <p>{selectedRecord.question}</p>
            </Card>

            {/* 基本信息卡片 */}
            <Card size="small" style={{ marginBottom: 20 }}>
              <h4>基本信息</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '12px' }}>
                <div>
                  <span style={{ fontWeight: 'bold', marginRight: '8px' }}>AI来源：</span>
                  <span>{selectedRecord.ai_source || '未知'}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold', marginRight: '8px' }}>分析时间：</span>
                  <span>{dayjs(selectedRecord.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold', marginRight: '8px' }}>是否生成SQL：</span>
                  <span>{selectedRecord.sql_execution ? '是' : '否'}</span>
                </div>
              </div>
            </Card>

            {/* 分析报告 */}
            {selectedRecord.result_analysis && (
              <div style={{ marginBottom: 20 }}>
                <h3>分析报告</h3>
                <Card size="small">
                  <div
                    style={{
                      backgroundColor: '#f5f5f5',
                      padding: 15,
                      borderRadius: 4,
                      whiteSpace: 'pre-wrap',
                      maxHeight: '400px',
                      overflowY: 'auto',
                    }}
                  >
                    {selectedRecord.result_analysis}
                  </div>
                </Card>
              </div>
            )}

            {/* 生成的SQL */}
            {selectedRecord.sql_execution && selectedRecord.sql && (
              <div style={{ marginBottom: 20 }}>
                <h3>生成的SQL</h3>
                <Card size="small">
                  <pre
                    style={{
                      backgroundColor: '#f5f5f5',
                      padding: 10,
                      borderRadius: 4,
                      overflowX: 'auto',
                      fontSize: '14px',
                    }}
                  >
                    {selectedRecord.sql}
                  </pre>
                </Card>
              </div>
            )}

            {/* SQL执行结果 */}
            {selectedRecord.sql_execution &&
              selectedRecord.sql_results &&
              Array.isArray(selectedRecord.sql_results) &&
              selectedRecord.sql_results.length > 0 && (
                <div>
                  <h3>SQL执行结果</h3>
                  <Card size="small">
                    <Table
                      dataSource={selectedRecord.sql_results}
                      columns={Object.keys(selectedRecord.sql_results[0]).map(key => ({
                        title: key,
                        dataIndex: key,
                        key: key,
                      }))}
                      rowKey="id"
                      pagination={false}
                      scroll={{ x: true }}
                      size="small"
                    />
                  </Card>
                </div>
              )}

            {/* AI原始回答（保留兼容，折叠显示） */}
            {selectedRecord.answer && (
              <div style={{ marginBottom: 20 }}>
                <h3>AI原始回答</h3>
                <Card size="small" type="inner">
                  <p style={{ whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: 1.5 }}>
                    {selectedRecord.answer}
                  </p>
                </Card>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AIQuestionRecords;
