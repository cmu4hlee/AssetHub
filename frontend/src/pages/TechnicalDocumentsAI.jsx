import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Input,
  Button,
  List,
  Tag,
  Space,
  Typography,
  Modal,
  Drawer,
  Tabs,
  Spin,
  Empty,
  Avatar,
  Tooltip,
  Badge,
  Select,
  Checkbox,
  Row,
  Col,
  message,
  Segmented,
  Collapse,
  Divider,
  Result,
  Dropdown,
  Progress,
} from 'antd';
import {
  RobotOutlined,
  SearchOutlined,
  FileTextOutlined,
  FolderOutlined,
  TagOutlined,
  MessageOutlined,
  HistoryOutlined,
  StarOutlined,
  StarFilled,
  DeleteOutlined,
  CopyOutlined,
  ReloadOutlined,
  SendOutlined,
  CloseOutlined,
  BulbOutlined,
  SyncOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  AudioOutlined,
  ExportOutlined,
  SettingOutlined,
  PlusOutlined,
  RightOutlined,
  LeftOutlined,
  PaperClipOutlined
} from '@ant-design/icons';
import { technicalDocumentsAPI, technicalDocumentsAI } from '../utils/api';
import useIsMobile from '../hooks/useIsMobile';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

const TechnicalDocumentsAI = () => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docSummary, setDocSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [viewHistory, setViewHistory] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [compareDocs, setCompareDocs] = useState([]);
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const chatContainerRef = useRef(null);
  const recognitionRef = useRef(null);

  const suggestedQuestions = [
    '如何维护医疗设备？',
    '设备出现故障怎么办？',
    '查找关于XX设备的使用手册',
    '哪些文档需要定期审核？',
    '解释一下设备保养周期'
  ];

  useEffect(() => {
    loadFavorites();
    loadViewHistory();
    loadConversations();
    initSpeechRecognition();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const initSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'zh-CN';
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setQuestion(prev => prev + transcript);
        setIsRecording(false);
        message.success('语音识别完成');
      };

      recognitionRef.current.onerror = () => {
        setIsRecording(false);
        message.error('语音识别失败，请重试');
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  };

  const handleVoiceInput = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current?.start();
      setIsRecording(true);
      message.info('请开始说话...');
    }
  };

  const loadFavorites = async () => {
    try {
      const result = await technicalDocumentsAPI.getUserFavorites();
      if (result.success) {
        setFavorites(result.data.documents || []);
      }
    } catch (error) {
      console.error('加载收藏失败:', error);
    }
  };

  const loadViewHistory = async () => {
    try {
      const result = await technicalDocumentsAPI.getUserHistory();
      if (result.success) {
        setViewHistory(result.data || []);
      }
    } catch (error) {
      console.error('加载访问历史失败:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const result = await technicalDocumentsAI.getConversations();
      if (result.success) {
        setConversations(result.data || []);
      }
    } catch (error) {
      console.error('加载对话列表失败:', error);
    }
  };

  const loadConversationDetail = async (id) => {
    try {
      const result = await technicalDocumentsAI.getConversationDetail(id);
      if (result.success) {
        setSelectedConversation(result.data);
        setChatHistory(result.data.messages || []);
        setConversationId(id);
        setActiveTab('chat');
      }
    } catch (error) {
      console.error('加载对话详情失败:', error);
    }
  };

  const deleteConversation = async (id, e) => {
    e.stopPropagation();
    try {
      const result = await technicalDocumentsAI.deleteConversation(id);
      if (result.success) {
        message.success('对话已删除');
        loadConversations();
        if (conversationId === id) {
          setChatHistory([]);
          setConversationId(null);
        }
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      message.warning('请输入搜索关键词');
      return;
    }

    setSearchLoading(true);
    try {
      const result = await technicalDocumentsAPI.aiSearch({
        query: searchQuery,
        limit: 20
      });

      if (result.success) {
        setSearchResults(result.data.documents || []);
        if (result.data.suggestion) {
          message.info(result.data.suggestion);
        }
      } else {
        message.error(result.message || '搜索失败');
      }
    } catch (error) {
      message.error('搜索失败');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleGetSummary = async (docId) => {
    setSummaryLoading(true);
    try {
      const result = await technicalDocumentsAI.getDocumentSummary(docId);
      if (result.success) {
        setSelectedDoc(result.data);
        setDocSummary(result.data);
      } else {
        message.error(result.message || '获取摘要失败');
      }
    } catch (error) {
      message.error('获取摘要失败');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) {
      message.warning('请输入问题');
      return;
    }

    setChatLoading(true);
    const newHistory = [...chatHistory, { role: 'user', content: question }];
    setChatHistory(newHistory);
    setQuestion('');

    try {
      const result = await technicalDocumentsAI.askQuestion({
        conversation_id: conversationId,
        question: question
      });

      if (result.success) {
        setConversationId(result.data.conversation_id);
        const updatedHistory = [
          ...newHistory,
          { role: 'assistant', content: result.data.answer, sources: result.data.sources }
        ];
        setChatHistory(updatedHistory);
        loadConversations();
      } else {
        message.error(result.message || '问答失败');
      }
    } catch (error) {
      message.error('问答失败');
    } finally {
      setChatLoading(false);
    }
  };

  const handleExtract = async (docId) => {
    try {
      const result = await technicalDocumentsAI.extractInfo(docId);
      if (result.success) {
        Modal.info({
          title: '文档信息提取结果',
          width: isMobile ? '95vw' : 600,
          content: (
            <div>
              <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )
        });
      } else {
        message.error(result.message || '提取失败');
      }
    } catch (error) {
      message.error('提取失败');
    }
  };

  const handleRecommend = async (docId) => {
    try {
      const result = await technicalDocumentsAI.getRecommendations(docId);
      if (result.success) {
        setRecommendations(result.data.recommendations || []);
        message.success(`为您推荐 ${result.data.recommendations?.length || 0} 个相关文档`);
      } else {
        message.error(result.message || '推荐失败');
      }
    } catch (error) {
      message.error('推荐失败');
    }
  };

  const handleCompare = async () => {
    if (compareDocs.length < 2) {
      message.warning('请至少选择2个文档进行对比');
      return;
    }

    setCompareLoading(true);
    try {
      const result = await technicalDocumentsAI.compareDocuments(compareDocs.map(d => d.id));
      if (result.success) {
        setCompareResult(result.data);
        setCompareModalVisible(true);
      } else {
        message.error(result.message || '对比失败');
      }
    } catch (error) {
      message.error('对比失败');
    } finally {
      setCompareLoading(false);
    }
  };

  const handleFavorite = async (doc) => {
    try {
      const isFavorite = favorites.some(f => f.id === doc.id);
      if (isFavorite) {
        await technicalDocumentsAPI.removeFavorite(doc.id);
        setFavorites(favorites.filter(f => f.id !== doc.id));
        message.success('已取消收藏');
      } else {
        const result = await technicalDocumentsAPI.addFavorite(doc.id);
        if (result.alreadyFavorited) {
          // 后端告知已收藏，同步本地状态
          setFavorites(prev => prev.some(f => f.id === doc.id) ? prev : [...prev, doc]);
          message.info('该资料已在收藏列表中');
        } else {
          setFavorites([...favorites, doc]);
          message.success('收藏成功');
        }
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleExportConversation = () => {
    if (chatHistory.length === 0) {
      message.warning('没有对话内容可导出');
      return;
    }

    const content = chatHistory.map(msg => {
      const role = msg.role === 'user' ? '用户' : 'AI助手';
      return `[${role}]\n${msg.content}\n`;
    }).join('\n' + '='.repeat(50) + '\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AI对话_${new Date().toLocaleString()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('对话已导出');
  };

  const handleClearChat = () => {
    setChatHistory([]);
    setConversationId(null);
    setSelectedConversation(null);
  };

  const handleQuickAsk = (q) => {
    setQuestion(q);
  };

  const renderSearchResult = (doc) => (
    <List.Item
      key={doc.id}
      actions={[
        <Tooltip title="获取摘要">
          <Button type="text" icon={<BulbOutlined />} onClick={() => handleGetSummary(doc.id)} />
        </Tooltip>,
        <Tooltip title="信息提取">
          <Button type="text" icon={<ExperimentOutlined />} onClick={() => handleExtract(doc.id)} />
        </Tooltip>,
        <Tooltip title="智能推荐">
          <Button type="text" icon={<RobotOutlined />} onClick={() => handleRecommend(doc.id)} />
        </Tooltip>,
        <Tooltip title={favorites.some(f => f.id === doc.id) ? '取消收藏' : '收藏'}>
          <Button
            type="text"
            icon={favorites.some(f => f.id === doc.id) ? <StarFilled /> : <StarOutlined />}
            onClick={() => handleFavorite(doc)}
          />
        </Tooltip>,
        <Tooltip title="添加到对比">
          <Checkbox
            checked={compareDocs.some(d => d.id === doc.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setCompareDocs([...compareDocs, doc]);
              } else {
                setCompareDocs(compareDocs.filter(d => d.id !== doc.id));
              }
            }}
          />
        </Tooltip>
      ]}
    >
      <List.Item.Meta
        avatar={<Avatar icon={<FileTextOutlined />} style={{ backgroundColor: '#1890ff' }} />}
        title={
          <Space>
            <span>{doc.title}</span>
            {doc.tags?.map(tag => (
              <Tag key={tag.id} color={tag.tag_color}>{tag.tag_name}</Tag>
            ))}
          </Space>
        }
        description={
          <div>
            <Paragraph type="secondary" ellipsis={{ rows: 2 }}>
              {doc.description || '暂无描述'}
            </Paragraph>
            <Space size="small">
              <Tag>{doc.file_type}</Tag>
              <Text type="secondary">{formatFileSize(doc.file_size)}</Text>
              <Text type="secondary">浏览 {doc.view_count}</Text>
              <Text type="secondary">下载 {doc.download_count}</Text>
            </Space>
          </div>
        }
      />
    </List.Item>
  );

  const renderChatMessage = (msg, index) => {
    if (msg.role === 'user') {
      return (
        <div key={index} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <div style={{ maxWidth: isMobile ? '85%' : '70%', background: '#1890ff', color: '#fff', padding: '12px 16px', borderRadius: 16, borderTopRightRadius: 4 }}>
            {msg.content}
          </div>
        </div>
      );
    }
    return (
      <div key={index} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
        <Avatar icon={<RobotOutlined />} style={{ marginRight: 10, backgroundColor: '#52c41a' }} />
        <div style={{ maxWidth: isMobile ? '85%' : '70%', background: '#f5f5f5', padding: '12px 16px', borderRadius: 16, borderTopLeftRadius: 4 }}>
          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
          {msg.sources && msg.sources.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>📚 参考文档：</Text>
              {msg.sources.map(source => (
                <Tag key={source.id} color="blue" style={{ marginLeft: 4 }}>{source.title}</Tag>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const chatTabContent = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }} ref={chatContainerRef}>
        {chatHistory.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            <RobotOutlined style={{ fontSize: 64, marginBottom: 16 }} />
            <Text type="secondary">您好！我是AI文档助手</Text>
            <Text type="secondary" style={{ marginTop: 8 }}>您可以问我关于技术文档的任何问题</Text>

            <Divider>快捷问题</Divider>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 600 }}>
              {suggestedQuestions.map((q, i) => (
                <Button key={i} size="small" onClick={() => handleQuickAsk(q)}>
                  {q}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          chatHistory.map((msg, index) => renderChatMessage(msg, index))
        )}
        {chatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
            <Avatar icon={<RobotOutlined />} style={{ marginRight: 10, backgroundColor: '#52c41a' }} />
            <div style={{ background: '#f5f5f5', padding: '12px 16px', borderRadius: 16 }}>
              <Spin size="small" /> 思考中...
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
        <Input.Group compact style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <Tooltip title="语音输入">
            <Button
              icon={<AudioOutlined />}
              onClick={handleVoiceInput}
              type={isRecording ? 'primary' : 'default'}
              danger={isRecording}
            />
          </Tooltip>
          <TextArea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleAskQuestion();
              }
            }}
            placeholder="输入您的问题... (Enter 发送，Shift+Enter 换行)"
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ flex: 1, minWidth: isMobile ? '100%' : 0 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleAskQuestion}
            loading={chatLoading}
            disabled={!question.trim()}
            block={isMobile}
          >
            发送
          </Button>
        </Input.Group>
        {isRecording && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Badge status="processing" text="正在录音..." />
            <Progress percent={30} showInfo={false} strokeColor="#ff4d4f" />
          </div>
        )}
      </div>
    </div>
  );

  const searchTabContent = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
        <Input.Search
          placeholder="输入关键词搜索技术文档..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onSearch={handleSearch}
          loading={searchLoading}
          enterButton="AI搜索"
          size="large"
        />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <List
          dataSource={searchResults}
          renderItem={renderSearchResult}
          locale={{ emptyText: <Empty description="输入关键词开始搜索" /> }}
        />
        {compareDocs.length > 0 && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, left: isMobile ? 16 : 'auto' }}>
            <Button type="primary" onClick={handleCompare} loading={compareLoading} block={isMobile}>
              对比 ({compareDocs.length})
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const historyTabContent = (
    <Tabs
      items={[
        {
          key: 'conversations',
          label: 'AI对话',
          children: (
            <List
              dataSource={conversations}
              renderItem={(item) => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() => loadConversationDetail(item.id)}
                  actions={[
                    <Tooltip title="删除">
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => deleteConversation(item.id, e)}
                      />
                    </Tooltip>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<MessageOutlined />} style={{ backgroundColor: '#52c41a' }} />}
                    title={item.last_message ? item.last_message.substring(0, 30) + '...' : '新对话'}
                    description={`${item.message_count} 条消息 • ${new Date(item.timestamp).toLocaleString()}`}
                  />
                </List.Item>
              )}
              locale={{ emptyText: <Empty description="暂无对话记录" /> }}
            />
          )
        },
        {
          key: 'favorites',
          label: '我的收藏',
          children: (
            <List
              dataSource={favorites}
              renderItem={(doc) => (
                <List.Item
                  actions={[
                    <Tooltip title="取消收藏">
                      <Button
                        type="text"
                        danger
                        icon={<StarFilled />}
                        onClick={() => handleFavorite(doc)}
                      />
                    </Tooltip>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<FileTextOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                    title={doc.title}
                    description={doc.description?.substring(0, 50) || '暂无描述'}
                  />
                </List.Item>
              )}
              locale={{ emptyText: <Empty description="暂无收藏" /> }}
            />
          )
        },
        {
          key: 'history',
          label: '访问历史',
          children: (
            <List
              dataSource={viewHistory}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<FileTextOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                    title={item.title || item.document_title}
                    description={new Date(item.created_at || item.action_time).toLocaleString()}
                  />
                </List.Item>
              )}
              locale={{ emptyText: <Empty description="暂无访问记录" /> }}
            />
          )
        },
        {
          key: 'recommendations',
          label: '推荐文档',
          children: (
            <List
              dataSource={recommendations}
              renderItem={(doc) => (
                <List.Item
                  actions={[
                    <Tooltip title="收藏">
                      <Button
                        type="text"
                        icon={favorites.some(f => f.id === doc.id) ? <StarFilled /> : <StarOutlined />}
                        onClick={() => handleFavorite(doc)}
                      />
                    </Tooltip>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<FileTextOutlined />} style={{ backgroundColor: '#52c41a' }} />}
                    title={doc.title}
                    description={doc.description?.substring(0, 50) || '暂无描述'}
                  />
                </List.Item>
              )}
              locale={{ emptyText: <Empty description="暂无推荐" /> }}
            />
          )
        }
      ]}
    />
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
      <div
        className={isMobile ? 'hide-on-mobile' : ''}
        style={{ width: sidebarCollapsed ? 0 : 280, transition: 'width 0.3s', overflow: 'hidden', borderRight: '1px solid #f0f0f0' }}
      >
        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Title level={4} style={{ margin: 0 }}>
            <RobotOutlined /> AI助手
          </Title>
        </div>
        <div style={{ padding: 8 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ width: '100%' }}
            onClick={handleClearChat}
          >
            新建对话
          </Button>
        </div>
        <List
          size="small"
          dataSource={conversations.slice(0, 10)}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: 'pointer', padding: '8px 16px' }}
              onClick={() => loadConversationDetail(item.id)}
            >
              <Text ellipsis style={{ flex: 1 }}>
                {item.last_message ? item.last_message.substring(0, 20) + '...' : '新对话'}
              </Text>
            </List.Item>
          )}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Tooltip title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}>
              <Button
                type="text"
                icon={sidebarCollapsed ? <RightOutlined /> : <LeftOutlined />}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
            </Tooltip>
            <Segmented
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { label: '智能对话', value: 'chat', icon: <MessageOutlined /> },
                { label: '文档搜索', value: 'search', icon: <FileSearchOutlined /> },
                { label: '历史记录', value: 'history', icon: <HistoryOutlined /> }
              ]}
            />
          </Space>
          <Space>
            {chatHistory.length > 0 && (
              <>
                <Tooltip title="导出对话">
                  <Button icon={<ExportOutlined />} onClick={handleExportConversation} />
                </Tooltip>
                <Tooltip title="清空对话">
                  <Button icon={<DeleteOutlined />} danger onClick={handleClearChat} />
                </Tooltip>
              </>
            )}
          </Space>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeTab === 'chat' && chatTabContent}
          {activeTab === 'search' && searchTabContent}
          {activeTab === 'history' && historyTabContent}
        </div>
      </div>

      <Drawer
        title="文档摘要"
        placement="right"
        styles={{ wrapper: { width: 400 } }}
        open={!!docSummary}
        onClose={() => { setDocSummary(null); setSelectedDoc(null); }}
      >
        {docSummary && (
          <div>
            <Title level={4}>{docSummary.title}</Title>

            <Paragraph>
              <Text strong>摘要：</Text>
              {docSummary.summary}
            </Paragraph>

            <Divider />

            <Space orientation="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>分类：</Text>
                <Tag>{docSummary.metadata?.category}</Tag>
              </div>
              <div>
                <Text strong>标签：</Text>
                {docSummary.metadata?.tags?.map(tag => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
              <div>
                <Text strong>文件类型：</Text>
                <Tag>{docSummary.metadata?.file_type}</Tag>
              </div>
              <div>
                <Text strong>文件大小：</Text>
                <Text>{docSummary.metadata?.file_size}</Text>
              </div>
              <div>
                <Text strong>上传者：</Text>
                <Text>{docSummary.metadata?.uploaded_by}</Text>
              </div>
              <div>
                <Text strong>上传时间：</Text>
                <Text>{new Date(docSummary.metadata?.created_at).toLocaleString()}</Text>
              </div>
            </Space>

            {docSummary.related_documents?.length > 0 && (
              <>
                <Divider />
                <Title level={5}>相关文档</Title>
                <List
                  size="small"
                  dataSource={docSummary.related_documents}
                  renderItem={(doc) => (
                    <List.Item>
                      <List.Item.Meta title={doc.title} />
                    </List.Item>
                  )}
                />
              </>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        title="文档对比分析"
        open={compareModalVisible}
        onCancel={() => setCompareModalVisible(false)}
        footer={null}
        styles={{ wrapper: { width: 700 } }}
      >
        {compareResult && (
          <div>
            <Row gutter={16}>
              <Col xs={24} lg={8}>
                <Card>
                  <Text type="secondary">文档总数</Text>
                  <Title level={4} style={{ margin: 0 }}>{compareResult.analysis?.total_documents}</Title>
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card>
                  <Text type="secondary">总大小</Text>
                  <Title level={4} style={{ margin: 0 }}>{compareResult.analysis?.total_size_formatted}</Title>
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card>
                  <Text type="secondary">总浏览量</Text>
                  <Title level={4} style={{ margin: 0 }}>{compareResult.analysis?.total_views}</Title>
                </Card>
              </Col>
            </Row>

            <Divider />

            <Title level={5}>最热门文档</Title>
            <Paragraph>
              <Text strong>{compareResult.analysis?.most_popular?.title}</Text>
              <Tag color="blue" style={{ marginLeft: 8 }}>
                热度 {compareResult.analysis?.most_popular?.popularity}
              </Tag>
            </Paragraph>

            <Divider />

            <div className="hide-on-mobile">
              <Table
                dataSource={compareResult.documents}
                columns={[
                  { title: '文档名称', dataIndex: 'title', key: 'title' },
                  { title: '类型', dataIndex: 'file_type', key: 'file_type' },
                  { title: '大小', dataIndex: 'file_size', key: 'file_size' },
                  { title: '热度', dataIndex: 'popularity', key: 'popularity' }
                ]}
                rowKey="id"
                pagination={false}
              />
            </div>
            <div className="mobile-table-cards show-on-mobile">
              {Array.isArray(compareResult.documents) && compareResult.documents.length > 0 ? (
                compareResult.documents.map(record => (
                  <div key={record.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{record.title}</span>
                      <Tag>{record.file_type}</Tag>
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">大小</span>
                        <span className="mobile-card-value">{record.file_size}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">热度</span>
                        <span className="mobile-card-value">{record.popularity}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <Empty description="暂无数据" />
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const Statistic = ({ title, value }) => (
  <Card>
    <Text type="secondary">{title}</Text>
    <Title level={4} style={{ margin: 0 }}>{value}</Title>
  </Card>
);

const Table = ({ dataSource, columns, rowKey, pagination }) => (
  <List
    dataSource={dataSource || []}
    renderItem={(item) => (
      <List.Item>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Text>{item.title}</Text>
          <Space>
            <Tag>{item.file_type}</Tag>
            <Text>{item.file_size}</Text>
            <Tag color="blue">{item.popularity}</Tag>
          </Space>
        </Space>
      </List.Item>
    )}
  />
);

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default TechnicalDocumentsAI;
