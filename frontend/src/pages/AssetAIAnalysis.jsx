import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useIsMobile, useCurrentUser } from '../hooks';
import {
  Card,
  Button,
  Input,
  Select,
  Space,
  message,
  Spin,
  Tag,
  Tabs,
  Table,
  Empty,
  Row,
  Col,
  Typography,
  Divider,
  Modal,
} from 'antd';

const { Text, Title } = Typography;
import {
  RobotOutlined,
  SendOutlined,
  ReloadOutlined,
  HistoryOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { assetAIAnalysisAPI } from '../utils/api';

const { TextArea } = Input;
const { Option } = Select;

// 移动端动态结果表渲染：列名由 record 的 key 动态生成
const renderSqlResultsCards = results => {
  if (!Array.isArray(results) || results.length === 0) return null;
  const keys = Object.keys(results[0]);
  return (
    <div className="mobile-table-cards show-on-mobile">
      {results.map((r, idx) => {
        const title = r.asset_name || r.asset_code || r.name || r.title || r.id || `记录 ${idx + 1}`;
        return (
          <div key={idx} className="mobile-card-item">
            <div className="mobile-card-header">
              <span className="mobile-card-title">{String(title)}</span>
            </div>
            <div className="mobile-card-body">
              {keys.map(k => {
                const val = r[k];
                if (val === null || val === undefined || val === '') return null;
                const label = k.replace(/_/g, ' ').replace(/(?:^|\s)\w/g, l => l.toUpperCase());
                const display = typeof val === 'object' ? JSON.stringify(val) : String(val);
                return (
                  <div key={k} className="mobile-card-field mobile-card-field--full">
                    <span className="mobile-card-label">{label}</span>
                    <span className="mobile-card-value">{display}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 安全渲染Markdown的组件 - 替代 dangerouslySetInnerHTML
const MarkdownRenderer = ({ content, isMobile }) => {
  const markdownStyle = useMemo(() => ({
    fontSize: isMobile ? '14px' : '15px',
    lineHeight: 1.8,
    background: '#f6ffed',
    padding: 16,
    borderRadius: 4,
    border: '1px solid #b7eb8f',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  }), [isMobile]);

  const components = useMemo(() => ({
    h1: ({ children }) => <h3 style={{ margin: '16px 0 8px 0', color: '#262626', fontSize: '18px', fontWeight: 'bold' }}>{children}</h3>,
    h2: ({ children }) => <h4 style={{ margin: '12px 0 6px 0', color: '#333', fontSize: '16px', fontWeight: 'bold' }}>{children}</h4>,
    h3: ({ children }) => <h5 style={{ margin: '10px 0 5px 0', color: '#404040', fontSize: '14px', fontWeight: 'bold' }}>{children}</h5>,
    ul: ({ children }) => <ul style={{ margin: '8px 0', paddingLeft: '24px' }}>{children}</ul>,
    ol: ({ children }) => <ol style={{ margin: '8px 0', paddingLeft: '24px' }}>{children}</ol>,
    li: ({ children }) => <li style={{ margin: '4px 0', paddingLeft: '8px' }}>{children}</li>,
    p: ({ children }) => <p style={{ margin: '12px 0' }}>{children}</p>,
    strong: ({ children }) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
    em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
    code: ({ children, className }) => {
      // 行内代码
      if (!className) {
        return <code style={{ background: '#f0f0f0', padding: '2px 4px', borderRadius: '3px', fontFamily: 'monospace' }}>{children}</code>;
      }
      return <code className={className}>{children}</code>;
    },
    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff', textDecoration: 'none' }}>{children}</a>,
  }), []);

  if (!content) return null;

  return (
    <div style={markdownStyle}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

const AssetAIAnalysis = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [datasources, setDatasources] = useState([]);
  const [datasourceId, setDatasourceId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const isMobile = useIsMobile();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  // 详情相关状态
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentDetail, setCurrentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { user: currentUser, loading: userLoading } = useCurrentUser();

  // 检查用户是否已登录
  useEffect(() => {
    if (!userLoading && !currentUser) {
      message.error('请先登录');
      navigate('/login');
    }
  }, [navigate, userLoading, currentUser]);

  useEffect(() => {
    loadDatasources();
    loadHistory();
  }, [pagination.current, pagination.pageSize]);

  const loadDatasources = async () => {
    try {
      const result = await assetAIAnalysisAPI.getDatasources();
      if (result.success) {
        const availableDatasources = Array.isArray(result.data) ? result.data : [];
        setDatasources(availableDatasources);
        if (!datasourceId && availableDatasources.length > 0) {
          setDatasourceId(availableDatasources[0].id);
        }
      }
    } catch (error) {
      console.error('加载数据源失败:', error);
      message.warning('未能加载本地分析配置，将使用默认模型');
    }
  };

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const result = await assetAIAnalysisAPI.getAnalysisHistory({
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      if (result.success) {
        setHistory(result.data?.logs || []);
        setPagination(prev => ({
          ...prev,
          total: result.data?.total || 0,
        }));
      }
    } catch (error) {
      console.error('加载分析历史失败:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleViewDetail = async record => {
    try {
      setDetailLoading(true);
      setCurrentDetail(null);

      const result = await assetAIAnalysisAPI.getAnalysisReport(record.id);
      if (result.success) {
        setCurrentDetail(result.data);
        setDetailModalVisible(true);
      } else {
        message.error('获取报告详情失败');
      }
    } catch (error) {
      console.error('获取报告详情失败:', error);
      message.error('获取报告详情失败，请稍后重试');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!customPrompt.trim()) {
      message.warning('请输入问题内容');
      return;
    }

    try {
      setLoading(true);
      setAnalysisResult(null);

      // 构建分析请求数据
      const requestData = {
        prompt: customPrompt.trim(),
        datasourceId: datasourceId || undefined,
      };

      const result = await assetAIAnalysisAPI.customAnalysis(requestData);

      if (result.success) {
        setAnalysisResult(result.data);
        message.success('问答完成');
        loadHistory(); // 刷新历史记录
      } else {
        message.error(result.message || '问答失败');
      }
    } catch (error) {
      console.error('问答失败:', error);
      message.error(error.response?.data?.message || '问答失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleResetChat = () => {
    setAnalysisResult(null);
    message.success('已清空本次分析结果');
  };

  const historyColumns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 120,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 150,
    },
    {
      title: '分析维度',
      dataIndex: 'dimension',
      key: 'dimension',
      width: 120,
      render: dimension => {
        const dimensionMap = {
          overview: '概览分析',
          value: '价值分析',
          utilization: '利用率分析',
          maintenance: '维护分析',
          lifecycle: '生命周期分析',
          risk: '风险评估',
          optimization: '优化建议',
          custom: '自定义分析',
        };
        return <Tag>{dimensionMap[dimension] || dimension}</Tag>;
      },
    },
    {
      title: '分析人员',
      dataIndex: 'real_name',
      key: 'real_name',
      width: 100,
      render: (text, record) => text || record.username || '-',
    },
    {
      title: '分析时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: time => (time ? new Date(time).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button type="link" onClick={() => handleViewDetail(record)} size="small">
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? '12px' : '24px' }}>
      <Title level={2} style={{ marginBottom: isMobile ? 12 : 24 }}>
        <RobotOutlined /> 资产本地AI分析
      </Title>

      <Tabs
        defaultActiveKey="analysis"
        size={isMobile ? 'small' : 'middle'}
        items={[
          {
            key: 'analysis',
            label: (
              <span>
                <FileTextOutlined /> AI问答
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={8}>
                  <Card title="问答配置" size="small">
                    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                      <div>
                        <Text strong>提问内容</Text>
                        <TextArea
                          style={{ marginTop: 8 }}
                          rows={6}
                          placeholder="输入业务问题，例如：最近30天维修工单趋势、按部门统计设备数量、故障率最高的资产类型"
                          value={customPrompt}
                          onChange={e => setCustomPrompt(e.target.value)}
                          size={isMobile ? 'small' : 'middle'}
                        />
                      </div>

                      <div>
                        <Text strong>分析上下文</Text>
                        <Select
                          style={{ marginTop: 8, width: '100%' }}
                          value={datasourceId}
                          onChange={setDatasourceId}
                          placeholder="默认使用当前租户资产库"
                          allowClear
                          size={isMobile ? 'small' : 'middle'}
                        >
                          {datasources.map(item => (
                            <Option key={item.id} value={item.id}>
                              {item.name || `数据源-${item.id}`} ({item.type_name || item.type || 'unknown'})
                            </Option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <Text strong>执行模式</Text>
                        <div style={{ marginTop: 8 }}>
                          <Tag color="blue">本地 Ollama 无状态分析</Tag>
                        </div>
                      </div>

                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={handleAnalyze}
                        loading={loading}
                        block
                        size={isMobile ? 'small' : 'middle'}
                      >
                        发送问题
                      </Button>

                      <Button
                        icon={<ReloadOutlined />}
                        onClick={handleResetChat}
                        size={isMobile ? 'small' : 'middle'}
                      >
                        重置会话
                      </Button>
                    </Space>
                  </Card>
                </Col>

                <Col xs={24} lg={16}>
                  <Card
                    title="问答结果"
                    extra={
                      analysisResult && (
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => setAnalysisResult(null)}
                          size="small"
                        >
                          清除
                        </Button>
                      )
                    }
                  >
                    {loading ? (
                      <div style={{ textAlign: 'center', padding: '40px' }}>
                        <Spin size="large" />
                        <div style={{ marginTop: 16 }}>本地模型分析中，请稍候...</div>
                      </div>
                    ) : analysisResult ? (
                      <div>
                        <div style={{ marginBottom: 12 }}>
                          <Tag color="blue">{analysisResult.aiSource || 'ollama'}</Tag>
                          {datasourceId && (
                            <Tag color="green">
                              {datasources.find(item => item.id === datasourceId)?.name || '当前租户资产库'}
                            </Tag>
                          )}
                        </div>

                        {analysisResult.asset && (
                          <div style={{ marginBottom: 16 }}>
                            <Text strong>分析资产：</Text>
                            <Tag>{analysisResult.asset.asset_code}</Tag>
                            <Tag>{analysisResult.asset.asset_name}</Tag>
                          </div>
                        )}
                        <Divider />
                        <div
                          style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            lineHeight: 1.8,
                            fontSize: isMobile ? '14px' : '15px',
                          }}
                        >
                          {typeof analysisResult.message === 'string'
                            ? analysisResult.message
                            : analysisResult.message
                              ? JSON.stringify(analysisResult.message, null, 2)
                              : ''}
                          {!analysisResult.message &&
                            (analysisResult.analysis
                              ? typeof analysisResult.analysis === 'string'
                                ? analysisResult.analysis
                                : typeof analysisResult.analysis === 'object'
                                  ? JSON.stringify(analysisResult.analysis, null, 2)
                                  : String(analysisResult.analysis)
                              : '无分析结果')}
                        </div>

                        {/* 展示SQL语句和执行结果 */}
                        {analysisResult.sql && (
                          <div style={{ marginTop: 20 }}>
                            <Divider titlePlacement="left">
                              <Text strong>AI生成的SQL</Text>
                            </Divider>
                            <pre
                              style={{
                                background: '#f5f5f5',
                                padding: 12,
                                borderRadius: 4,
                                overflowX: 'auto',
                                fontSize: '14px',
                                lineHeight: 1.6,
                              }}
                            >
                              {analysisResult.sql}
                            </pre>
                          </div>
                        )}

                        {analysisResult.sqlExecution && (
                          <div style={{ marginTop: 16 }}>
                            {typeof analysisResult.sqlExecution === 'string' ? (
                              // 如果是字符串，尝试解析为JSON
                              (() => {
                                try {
                                  const parsedExecution = JSON.parse(analysisResult.sqlExecution);
                                  // 给动态结果集附加稳定的 __rowId，避免 JSON.stringify 每次 render 序列化整行
                                  if (Array.isArray(parsedExecution.results)) {
                                    parsedExecution.results = parsedExecution.results.map((r, i) => ({
                                      __rowId: `r-${i}-${JSON.stringify(r).length}`,
                                      ...r,
                                    }));
                                  }
                                  if (Array.isArray(parsedExecution.detail_results)) {
                                    parsedExecution.detail_results = parsedExecution.detail_results.map((r, i) => ({
                                      __rowId: `d-${i}-${JSON.stringify(r).length}`,
                                      ...r,
                                    }));
                                  }
                                  if (
                                    parsedExecution.success &&
                                    parsedExecution.results &&
                                    parsedExecution.results.length > 0
                                  ) {
                                    return (
                                      <>
                                        <Divider titlePlacement="left">
                                          <Text strong>数据库查询结果</Text>
                                        </Divider>
                                        <div className="hide-on-mobile">
                                          <Table
                                            dataSource={parsedExecution.results}
                                            columns={Object.keys(parsedExecution.results[0]).map(
                                              key => ({
                                                title: key
                                                  .replace(/_/g, ' ')
                                                  .replace(/(?:^|\s)\w/g, l => l.toUpperCase()),
                                                dataIndex: key,
                                                key: key,
                                              })
                                            )}
                                            pagination={false}
                                            size="small"
                                            scroll={{ x: true }}
                                            rowKey="__rowId"
                                          />
                                        </div>
                                        {renderSqlResultsCards(parsedExecution.results)}
                                      </>
                                    );
                                  } else if (!parsedExecution.success) {
                                    return (
                                      <div
                                        style={{
                                          marginTop: 16,
                                          padding: 12,
                                          background: '#fff1f0',
                                          borderRadius: 4,
                                          border: '1px solid #ffccc7',
                                        }}
                                      >
                                        <Text type="danger">
                                          SQL执行失败: {parsedExecution.error || '未知错误'}
                                        </Text>
                                      </div>
                                    );
                                  }
                                  return null;
                                } catch (e) {
                                  return (
                                    <div
                                      style={{
                                        marginTop: 16,
                                        padding: 12,
                                        background: '#fff1f0',
                                        borderRadius: 4,
                                        border: '1px solid #ffccc7',
                                      }}
                                    >
                                      <Text type="danger">SQL执行结果解析失败: {e.message}</Text>
                                    </div>
                                  );
                                }
                              })()
                            ) : typeof analysisResult.sqlExecution === 'object' ? (
                              // 如果是对象，直接使用
                              analysisResult.sqlExecution.success &&
                              analysisResult.sqlExecution.results &&
                              analysisResult.sqlExecution.results.length > 0 ? (
                                <>
                                  <Divider titlePlacement="left">
                                    <Text strong>数据库查询结果</Text>
                                  </Divider>
                                  <div className="hide-on-mobile">
                                    <Table
                                      dataSource={analysisResult.sqlExecution.results}
                                      columns={Object.keys(
                                        analysisResult.sqlExecution.results[0]
                                      ).map(key => ({
                                        title: key
                                          .replace(/_/g, ' ')
                                          .replace(/(?:^|\s)\w/g, l => l.toUpperCase()),
                                        dataIndex: key,
                                        key: key,
                                      }))}
                                      pagination={false}
                                      size="small"
                                      scroll={{ x: true }}
                                      rowKey="__rowId"
                                    />
                                  </div>
                                  {renderSqlResultsCards(analysisResult.sqlExecution.results)}
                                </>
                              ) : !analysisResult.sqlExecution.success ? (
                                <div
                                  style={{
                                    marginTop: 16,
                                    padding: 12,
                                    background: '#fff1f0',
                                    borderRadius: 4,
                                    border: '1px solid #ffccc7',
                                  }}
                                >
                                  <Text type="danger">
                                    SQL执行失败: {analysisResult.sqlExecution.error || '未知错误'}
                                  </Text>
                                </div>
                              ) : null
                            ) : null}
                          </div>
                        )}

                        {/* 展示AI对查询结果的分析 */}
                        {analysisResult.resultAnalysis && (
                          <div style={{ marginTop: 16 }}>
                            <Divider titlePlacement="left">
                              <Text strong>AI数据分析结果</Text>
                            </Divider>
                            <MarkdownRenderer content={analysisResult.resultAnalysis} isMobile={isMobile} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <Empty
                        description="输入问题并发送，系统会通过本地 Ollama 模型完成分析"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'history',
            label: (
              <span>
                <HistoryOutlined /> 分析历史
              </span>
            ),
            children: (
              <Card>
                <div className="hide-on-mobile">
                  <Table
                    columns={historyColumns}
                    dataSource={history}
                    rowKey="id"
                    loading={historyLoading}
                    pagination={{
                      ...pagination,
                      showSizeChanger: true,
                      showTotal: total => `共 ${total} 条`,
                      onChange: (page, pageSize) => {
                        setPagination({ ...pagination, current: page, pageSize });
                      },
                    }}
                    scroll={{ x: 800 }}
                    size="middle"
                  />
                </div>
                {/* 移动端卡片列表 */}
                <div className="mobile-table-cards show-on-mobile">
                  {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
                  ) : Array.isArray(history) && history.length > 0 ? (
                    history.map(r => {
                      const dimensionMap = {
                        overview: '概览分析', value: '价值分析', utilization: '利用率分析',
                        maintenance: '维护分析', lifecycle: '生命周期分析', risk: '风险评估',
                        optimization: '优化建议', custom: '自定义分析',
                      };
                      return (
                        <div key={r.id} className="mobile-card-item">
                          <div className="mobile-card-header">
                            <span className="mobile-card-title">{r.asset_name || r.asset_code || `#${r.id}`}</span>
                            <Tag>{dimensionMap[r.dimension] || r.dimension || '-'}</Tag>
                          </div>
                          <div className="mobile-card-body">
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">资产编号</span>
                              <span className="mobile-card-value">{r.asset_code || '-'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">分析人员</span>
                              <span className="mobile-card-value">{r.real_name || r.username || '-'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">分析时间</span>
                              <span className="mobile-card-value">{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</span>
                            </div>
                          </div>
                          <div className="mobile-card-actions">
                            <Button type="primary" size="small" block onClick={() => handleViewDetail(r)}>
                              查看详情
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <Empty description="暂无分析历史" />
                  )}
                </div>
              </Card>
            ),
          },
        ]}
      />

      {/* 分析详情模态框 */}
      <Modal
        title="分析报告详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={isMobile ? '90%' : 900}
        destroyOnHidden
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>加载详情中，请稍候...</div>
          </div>
        ) : currentDetail ? (
          <div>
            {/* 资产信息 */}
            {currentDetail.asset_code && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>分析资产：</Text>
                <Tag>{currentDetail.asset_code}</Tag>
                <Tag>{currentDetail.asset_name}</Tag>
              </div>
            )}

            {/* 分析基本信息 */}
            <div style={{ marginBottom: 16, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <Text strong>分析维度：</Text>
                <Tag>{currentDetail.dimension}</Tag>
              </div>
              <div>
                <Text strong>分析人员：</Text>
                <Text>{currentDetail.real_name || currentDetail.username || '-'}</Text>
              </div>
              <div>
                <Text strong>分析时间：</Text>
                <Text>{new Date(currentDetail.created_at).toLocaleString()}</Text>
              </div>
              {currentDetail.ai_source && (
                <div>
                  <Text strong>AI来源：</Text>
                  <Tag color="blue">{currentDetail.ai_source}</Tag>
                </div>
              )}
            </div>

            <Divider />

            {/* 用户提示词 */}
            <div style={{ marginBottom: 16 }}>
              <Text strong>用户提问：</Text>
              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  background: '#f5f5f5',
                  borderRadius: 4,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {currentDetail.prompt}
              </div>
            </div>

            {/* AI原始响应 */}
            <div style={{ marginBottom: 16 }}>
              <Text strong>AI原始响应：</Text>
              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  background: '#f5f5f5',
                  borderRadius: 4,
                  whiteSpace: 'pre-wrap',
                  fontSize: '14px',
                  lineHeight: 1.6,
                }}
              >
                {currentDetail.response}
              </div>
            </div>

            {/* 生成的SQL */}
            {currentDetail.sql && (
              <div style={{ marginBottom: 16 }}>
                <Divider titlePlacement="left">
                  <Text strong>AI生成的SQL</Text>
                </Divider>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    overflowX: 'auto',
                    fontSize: '14px',
                    lineHeight: 1.6,
                  }}
                >
                  {currentDetail.sql}
                </pre>
              </div>
            )}

            {/* SQL执行结果 */}
            {currentDetail.sql_execution ? (
              <div style={{ marginBottom: 16 }}>
                <Divider titlePlacement="left">
                  <Text strong>数据库查询结果</Text>
                </Divider>
                {typeof currentDetail.sql_execution === 'string' ? (
                  // 如果是字符串，尝试解析为JSON
                  (() => {
                    try {
                      const sqlExecution = JSON.parse(currentDetail.sql_execution);
                      if (
                        sqlExecution.success &&
                        sqlExecution.results &&
                        sqlExecution.results.length > 0
                      ) {
                        return (
                          <>
                            <div className="hide-on-mobile">
                              <Table
                                dataSource={sqlExecution.results}
                                columns={Object.keys(sqlExecution.results[0]).map(key => ({
                                  title: key
                                    .replace(/_/g, ' ')
                                    .replace(/(?:^|\s)\w/g, l => l.toUpperCase()),
                                  dataIndex: key,
                                  key: key,
                                }))}
                                pagination={false}
                                size="small"
                                scroll={{ x: true }}
                                style={{ margin: '10px 0' }}
                                rowKey="__rowId"
                              />
                            </div>
                            {renderSqlResultsCards(sqlExecution.results)}
                          </>
                        );
                      } else if (!sqlExecution.success) {
                        return (
                          <div
                            style={{
                              marginTop: 10,
                              padding: 12,
                              background: '#fff1f0',
                              borderRadius: 4,
                              border: '1px solid #ffccc7',
                            }}
                          >
                            <Text type="danger">
                              SQL执行失败: {sqlExecution.error || '未知错误'}
                            </Text>
                          </div>
                        );
                      }
                      return null;
                    } catch (e) {
                      return (
                        <div
                          style={{
                            marginTop: 10,
                            padding: 12,
                            background: '#fff1f0',
                            borderRadius: 4,
                            border: '1px solid #ffccc7',
                          }}
                        >
                          <Text type="danger">SQL执行结果解析失败: {e.message}</Text>
                        </div>
                      );
                    }
                  })()
                ) : typeof currentDetail.sql_execution === 'object' ? (
                  // 如果是对象，直接使用
                  currentDetail.sql_execution.success &&
                  currentDetail.sql_execution.results &&
                  currentDetail.sql_execution.results.length > 0 ? (
                    <>
                      <div className="hide-on-mobile">
                        <Table
                          dataSource={currentDetail.sql_execution.results}
                          columns={Object.keys(currentDetail.sql_execution.results[0]).map(key => ({
                            title: key.replace(/_/g, ' ').replace(/(?:^|\s)\w/g, l => l.toUpperCase()),
                            dataIndex: key,
                            key: key,
                          }))}
                          pagination={false}
                          size="small"
                          scroll={{ x: true }}
                          style={{ margin: '10px 0' }}
                        />
                      </div>
                      {renderSqlResultsCards(currentDetail.sql_execution.results)}
                    </>
                  ) : !currentDetail.sql_execution.success ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        background: '#fff1f0',
                        borderRadius: 4,
                        border: '1px solid #ffccc7',
                      }}
                    >
                      <Text type="danger">
                        SQL执行失败: {currentDetail.sql_execution.error || '未知错误'}
                      </Text>
                    </div>
                  ) : (
                    <Empty description="无SQL执行结果" />
                  )
                ) : (
                  <Empty description="无SQL执行结果" />
                )}
              </div>
            ) : null}

            {/* AI对结果的分析 */}
            {currentDetail.result_analysis && (
              <div style={{ marginBottom: 16 }}>
                <Divider titlePlacement="left">
                  <Text strong>AI数据分析结果</Text>
                </Divider>
                <MarkdownRenderer content={currentDetail.result_analysis} isMobile={isMobile} />
              </div>
            )}

            {/* AI来源信息 */}
            {currentDetail.result_analysis_source && (
              <div style={{ marginTop: 16 }}>
                <Text strong>结果分析AI来源：</Text>
                <Tag color="green">{currentDetail.result_analysis_source}</Tag>
              </div>
            )}
          </div>
        ) : (
          <Empty description="无详情数据" />
        )}
      </Modal>
    </div>
  );
};

export default AssetAIAnalysis;
