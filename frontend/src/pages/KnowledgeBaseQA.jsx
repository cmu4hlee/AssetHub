/**
 * 知识库 AI 智能问答页
 *
 * 用户从知识库选择 → 输入问题 → 后端检索 + OpenClaw 回答 → 展示答案 + 引用
 * 支持多会话(左侧会话列表)
 * 支持流式(可选,默认非流式简单起)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Card, Input, Button, Select, Space, Tag, Empty, message, Spin, Avatar, List, Tooltip, Switch, Row, Col, Drawer, Tabs, Typography,
} from 'antd';
import {
  SendOutlined, ClearOutlined, RobotOutlined, UserOutlined, BookOutlined, HistoryOutlined,
  DeleteOutlined, ReloadOutlined, ThunderboltOutlined, FileTextOutlined, CloseOutlined,
  BulbOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { knowledgeBaseAPI } from '../api/domains/knowledgeBase';

const { Text } = Typography;
const { TextArea } = Input;

const STORAGE_KEY = 'knowledge-base-qa-sessions';

const newSessionId = () => `kbqa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const KnowledgeBaseQA = () => {
  const [kbs, setKbs] = useState([]);
  const [kbId, setKbId] = useState(null); // null = 全租户
  const [sessions, setSessions] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* ignore */ }
    return [{ id: newSessionId(), title: '新会话', messages: [], createdAt: Date.now() }];
  });
  const [activeSessionId, setActiveSessionId] = useState(sessions[0]?.id);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const scrollRef = useRef(null);

  // 持久化会话
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) { /* ignore quota */ }
  }, [sessions]);

  // 加载知识库
  useEffect(() => {
    (async () => {
      try {
        const result = await knowledgeBaseAPI.listKnowledgeBases({ page: 1, pageSize: 100 });
        if (result.success) {
          setKbs(result.data || []);
        }
      } catch (e) {
        console.error('加载知识库失败:', e);
      }
    })();
  }, []);

  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId]
  );

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeSession?.messages, loading]);

  // ============= 会话管理 =============

  const handleNewSession = () => {
    const s = { id: newSessionId(), title: '新会话', messages: [], createdAt: Date.now() };
    setSessions(prev => [s, ...prev]);
    setActiveSessionId(s.id);
  };

  const handleDeleteSession = id => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (next.length === 0) {
        const blank = { id: newSessionId(), title: '新会话', messages: [], createdAt: Date.now() };
        setActiveSessionId(blank.id);
        return [blank];
      }
      if (id === activeSessionId) setActiveSessionId(next[0].id);
      return next;
    });
  };

  const updateSession = (id, patch) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const appendMessage = (id, message) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, messages: [...s.messages, message] } : s));
  };

  const updateLastMessage = (id, patch) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== id) return s;
      const messages = [...s.messages];
      if (messages.length === 0) return s;
      messages[messages.length - 1] = { ...messages[messages.length - 1], ...patch };
      return { ...s, messages };
    }));
  };

  // ============= 发送问答 =============

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const blank = { id: newSessionId(), title: text.slice(0, 30), messages: [], createdAt: Date.now() };
      setSessions(prev => [blank, ...prev]);
      setActiveSessionId(blank.id);
      sessionId = blank.id;
    }

    // 第一次提问时把会话标题更新
    if (activeSession && activeSession.messages.length === 0) {
      updateSession(sessionId, { title: text.slice(0, 30) });
    }

    const userMsg = { role: 'user', content: text, ts: Date.now() };
    appendMessage(sessionId, userMsg);
    appendMessage(sessionId, { role: 'assistant', content: '', ts: Date.now(), loading: true });
    setInput('');
    setLoading(true);

    if (streamEnabled) {
      // 流式路径
      try {
        const { body } = await knowledgeBaseAPI.askStream({
          question: text, kb_id: kbId, session_id: sessionId,
        });
        const reader = body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullText = '';
        let meta = { provider: null, model: null, latency_ms: 0, citations: [] };

        // 读 SSE 流
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            // 解析 event: / data: 行
            let eventName = 'message';
            let dataLines = [];
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) eventName = line.slice(6).trim();
              else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
            }
            const dataStr = dataLines.join('\n');
            if (!dataStr) continue;
            try {
              const payload = JSON.parse(dataStr);
              if (eventName === 'delta' && payload.text) {
                fullText += payload.text;
                // 增量更新最后一条 assistant 消息
                setSessions(prev => prev.map(s => {
                  if (s.id !== sessionId) return s;
                  const msgs = [...s.messages];
                  const last = msgs[msgs.length - 1];
                  if (last && last.role === 'assistant') {
                    msgs[msgs.length - 1] = { ...last, content: fullText, loading: true };
                  }
                  return { ...s, messages: msgs };
                }));
              } else if (eventName === 'done') {
                meta = {
                  provider: payload.provider,
                  model: payload.model,
                  latency_ms: payload.latency_ms,
                  citations: payload.citations || [],
                };
              } else if (eventName === 'error') {
                setSessions(prev => prev.map(s => {
                  if (s.id !== sessionId) return s;
                  const msgs = [...s.messages];
                  const last = msgs[msgs.length - 1];
                  if (last && last.role === 'assistant') {
                    msgs[msgs.length - 1] = { ...last, error: payload.message || '流式错误', loading: false };
                  }
                  return { ...s, messages: msgs };
                }));
                message.error(payload.message || '流式错误');
                return; // 不再 await finally
              }
            } catch (parseErr) {
              // 忽略解析失败
            }
          }
        }
        // 流结束后 finalize
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s;
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, content: fullText || '(无回答)', ...meta, loading: false };
          }
          return { ...s, messages: msgs };
        }));
      } catch (e) {
        const msg = e.message || '流式问答失败';
        updateLastMessage(sessionId, { content: '', error: msg, loading: false });
        message.error(msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    // 非流式路径
    try {
      const result = await knowledgeBaseAPI.ask({
        question: text,
        kb_id: kbId,
        session_id: sessionId,
      });
      if (result.success) {
        const data = result.data || {};
        updateLastMessage(sessionId, {
          content: data.answer || '(无回答)',
          citations: data.citations || [],
          provider: data.provider,
          model: data.model,
          latency_ms: data.latency_ms,
          loading: false,
        });
      } else {
        updateLastMessage(sessionId, {
          content: '',
          error: result.message || '问答失败',
          loading: false,
        });
        message.error(result.message || '问答失败');
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.message || '问答失败';
      updateLastMessage(sessionId, { content: '', error: msg, loading: false });
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [input, loading, activeSessionId, activeSession, kbId, streamEnabled]);

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ============= 历史记录 =============

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const result = await knowledgeBaseAPI.listQaRecords({ page: 1, pageSize: 50 });
      if (result.success) setHistoryRecords(result.data || []);
    } catch (e) {
      message.error('加载历史记录失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  // ============= 渲染 =============

  return (
    <div style={{ padding: 16, height: 'calc(100vh - 64px)' }}>
      <Row gutter={16} style={{ height: '100%' }}>
        {/* 左侧:会话列表 */}
        <Col span={5} style={{ height: '100%' }}>
          <Card
            size="small"
            title={
              <Space>
                <HistoryOutlined />
                <span>会话</span>
              </Space>
            }
            extra={
              <Space>
                <Tooltip title="历史问答记录">
                  <Button size="small" type="text" icon={<FileTextOutlined />} onClick={() => { loadHistory(); setDrawerOpen(true); }} />
                </Tooltip>
                <Tooltip title="新建会话">
                  <Button size="small" type="text" icon={<ThunderboltOutlined />} onClick={handleNewSession} />
                </Tooltip>
              </Space>
            }
            styles={{ body: { padding: 0, height: 'calc(100% - 40px)', overflow: 'auto' } }}
            style={{ height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {sessions.map(s => (
                <List.Item
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  style={{
                    cursor: 'pointer',
                    padding: '8px 12px',
                    background: s.id === activeSessionId ? '#e6f4ff' : 'transparent',
                    borderLeft: s.id === activeSessionId ? '3px solid #1890ff' : '3px solid transparent',
                  }}
                  actions={[
                    <Button
                      key="del" type="text" size="small" danger icon={<DeleteOutlined />}
                      onClick={e => { e.stopPropagation(); handleDeleteSession(s.id); }}
                    />,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar size="small" icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                    title={
                      <Text ellipsis style={{ fontSize: 13 }}>
                        {s.title || '新会话'}
                      </Text>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {s.messages.length > 0 ? `${s.messages.length} 条消息` : '空会话'}
                      </Text>
                    }
                  />
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* 右侧:对话区 */}
        <Col span={19} style={{ height: '100%' }}>
          <Card
            size="small"
            title={
              <Space>
                <RobotOutlined style={{ color: '#1890ff' }} />
                <span>知识库智能问答</span>
                <Tag color="blue">OpenClaw</Tag>
              </Space>
            }
            extra={
              <Space>
                <Text type="secondary">知识库:</Text>
                <Select
                  size="small" value={kbId}
                  onChange={setKbId}
                  style={{ width: 200 }}
                  placeholder="全租户"
                  allowClear
                  options={[
                    ...kbs.map(kb => ({ value: kb.id, label: `${kb.kb_name} (${kb.doc_count} 文档)` })),
                  ]}
                />
              </Space>
            }
            styles={{ body: {
              padding: 0,
              height: 'calc(100% - 40px)',
              display: 'flex',
              flexDirection: 'column',
            } }}
            style={{ height: '100%' }}
          >
            {/* 消息列表 */}
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                background: '#fafafa',
              }}
            >
              {!activeSession || activeSession.messages.length === 0 ? (
                <Empty
                  image={<BulbOutlined style={{ fontSize: 64, color: '#1890ff' }} />}
                  styles={{ image: { height: 80 } }}
                  description={
                    <div>
                      <p style={{ fontSize: 16, color: '#666' }}>向知识库提问</p>
                      <p style={{ color: '#999', marginTop: 8 }}>
                        上传文档到知识库后,在这里向 AI 提问,它会基于文档内容回答,并标注引用来源
                      </p>
                      <div style={{ marginTop: 20 }}>
                        <Text type="secondary">试试这样问:</Text>
                        <div style={{ marginTop: 8 }}>
                          {['CT 设备的日常保养要点?', '实验室安全操作规范有哪些?', '设备故障报修流程是什么?'].map(q => (
                            <Tag
                              key={q} color="blue" style={{ cursor: 'pointer', marginBottom: 6 }}
                              onClick={() => setInput(q)}
                            >
                              {q}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    </div>
                  }
                />
              ) : (
                activeSession.messages.map((m, idx) => (
                  <MessageBubble
                    key={idx}
                    message={m}
                    onSelectCitation={(citation) => {
                      setInput(prev => `${prev}[参考资料 ${citation.index}] ${citation.doc_title || ''}`.trim());
                    }}
                  />
                ))
              )}
            </div>

            {/* 输入区 */}
            <div style={{ borderTop: '1px solid #f0f0f0', padding: 12, background: '#fff' }}>
              <TextArea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的问题,Shift+Enter 换行"
                autoSize={{ minRows: 2, maxRows: 6 }}
                disabled={loading}
              />
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <QuestionCircleOutlined /> 回答将基于 {kbId ? (kbs.find(k => k.id === kbId)?.kb_name || '当前知识库') : '全部已启用知识库'}
                  </Text>
                  <Tooltip title="开启后, AI 回答会逐字流式输出">
                    <Switch size="small" checked={streamEnabled} onChange={setStreamEnabled} checkedChildren="流式" unCheckedChildren="一次性" />
                  </Tooltip>
                </Space>
                <Space>
                  <Button
                    icon={<ClearOutlined />}
                    onClick={() => {
                      if (activeSession) updateSession(activeSession.id, { messages: [] });
                    }}
                    disabled={!activeSession?.messages?.length}
                  >
                    清空对话
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSend}
                    loading={loading}
                    disabled={!input.trim()}
                  >
                    发送
                  </Button>
                </Space>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 历史问答记录 */}
      <Drawer
        title="历史问答记录"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size="large"
      >
        {historyLoading ? (
          <Spin />
        ) : historyRecords.length === 0 ? (
          <Empty />
        ) : (
          <div>
            {historyRecords.map(item => (
              <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Space>
                  <Text strong>{item.question}</Text>
                  {item.status === 'failed' && <Tag color="red">失败</Tag>}
                </Space>
                <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 4 }}>
                  <div style={{
                    background: '#f5f5f5', padding: 8, borderRadius: 4,
                    maxHeight: 120, overflow: 'hidden', position: 'relative',
                  }}>
                    <Text style={{ fontSize: 12 }}>{item.answer || item.error_message || '(无)'}</Text>
                  </div>
                  <Space size={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.user_name || '匿名'}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.provider} / {item.model}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.latency_ms}ms</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(item.created_at).toLocaleString('zh-CN')}
                    </Text>
                  </Space>
                </Space>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
};

// 消息气泡
const MessageBubble = ({ message, onSelectCitation }) => {
  const isUser = message.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 16,
      }}
    >
      {!isUser && (
        <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff', marginRight: 8, flexShrink: 0 }} />
      )}
      <div style={{ maxWidth: '80%' }}>
        <div
          style={{
            background: isUser ? '#1890ff' : '#fff',
            color: isUser ? '#fff' : '#333',
            padding: '10px 14px',
            borderRadius: 8,
            boxShadow: isUser ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
            border: isUser ? 'none' : '1px solid #f0f0f0',
            whiteSpace: 'normal',
          }}
        >
          {message.loading ? (
            <Space>
              <Spin size="small" />
              <Text type="secondary">正在检索并生成答案...</Text>
            </Space>
          ) : message.error ? (
            <Text type="danger">{message.error}</Text>
          ) : isUser ? (
            message.content
          ) : (
            <MarkdownContent content={message.content} />
          )}
        </div>

        {/* 引用来源 */}
        {!isUser && !message.loading && message.citations && message.citations.length > 0 && (
          <div style={{ marginTop: 8, paddingLeft: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>参考资料:</Text>
            <div style={{ marginTop: 4 }}>
              {message.citations.map(c => (
                <Tooltip
                  key={c.index}
                  title={
                    <div style={{ maxWidth: 360 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.doc_title || '(无标题)'}</div>
                      <div style={{ fontSize: 12, color: '#ddd' }}>{c.snippet}</div>
                    </div>
                  }
                >
                  <Tag
                    color="blue" style={{ cursor: 'pointer', marginBottom: 4 }}
                    onClick={() => onSelectCitation && onSelectCitation(c)}
                  >
                    [{c.index}] {c.doc_title || '文档'}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          </div>
        )}

        {/* 元信息 */}
        {!isUser && !message.loading && !message.error && (message.provider || message.latency_ms) && (
          <div style={{ marginTop: 4, paddingLeft: 4 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {message.provider} · {message.model} · {message.latency_ms}ms
            </Text>
          </div>
        )}
      </div>
      {isUser && (
        <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#52c41a', marginLeft: 8, flexShrink: 0 }} />
      )}
    </div>
  );
};

const MarkdownContent = ({ content }) => (
  <div className="markdown-body" style={{ lineHeight: 1.7 }}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener" />,
      }}
    >
      {String(content || '')}
    </ReactMarkdown>
  </div>
);

export default KnowledgeBaseQA;
