/**
 * 知识库 AI 智能问答页
 *
 * 用户从知识库选择 → 输入问题 → 后端检索 + OpenClaw 回答 → 展示答案 + 引用
 * 支持多会话(左侧会话列表)
 * 支持流式(可选,默认非流式简单起)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Card, Input, Button, Select, Space, Tag, Empty, message, Spin, Avatar, Tooltip, Switch, Row, Col, Drawer, Tabs, Typography,
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

const KnowledgeBaseQA = () => {
  const [selectedKb, setSelectedKb] = useState(null);
  const [kbs, setKbs] = useState([]);
  const [loadingKbs, setLoadingKbs] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentAskKb, setCurrentAskKb] = useState(null);
  const chatContainerRef = useRef(null);

  // 会话管理
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(s => ({
          ...s,
          messages: s.messages || [],
          streaming: false,
        }));
      }
    } catch (_e) { /* ignore */ }
    return [{ id: Date.now().toString(), title: '新会话', messages: [], createdAt: Date.now(), streaming: false }];
  });
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const s = sessions[0];
    return s ? s.id : null;
  });

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // 持久化会话
  useEffect(() => {
    if (sessions.length > 0) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.map(s => ({
        ...s, streaming: false,
      })))); } catch (_e) { /* ignore */ }
    }
  }, [sessions]);

  // 加载知识库
  const loadKbs = useCallback(async () => {
    setLoadingKbs(true);
    try {
      const res = await knowledgeBaseAPI.getKnowledgeBases({ pageSize: 200 });
      if (res?.success) {
        setKbs(res.data || []);
        if (!selectedKb && res.data?.length > 0) {
          setSelectedKb(res.data[0].id);
        }
      }
    } catch (_e) {
      // 忽略
    } finally {
      setLoadingKbs(false);
    }
  }, [selectedKb]);

  useEffect(() => { void loadKbs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewSession = useCallback(() => {
    const newS = { id: Date.now().toString(), title: '新会话', messages: [], createdAt: Date.now(), streaming: false };
    setSessions(prev => [newS, ...prev]);
    setActiveSessionId(newS.id);
  }, []);

  const handleDeleteSession = useCallback((id) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) {
        const newS = { id: Date.now().toString(), title: '新会话', messages: [], createdAt: Date.now(), streaming: false };
        setActiveSessionId(newS.id);
        return [newS];
      }
      if (id === activeSessionId) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  }, [activeSessionId]);

  // 添加消息到当前会话
  const addMessage = useCallback((msg) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== activeSessionId) return s;
      return { ...s, messages: [...s.messages, msg], title: s.title === '新会话' && msg.role === 'user' ? msg.content.slice(0, 30) : s.title };
    }));
  }, [activeSessionId]);

  // 更新会话的最后一条消息（用于流式追加）
  const updateLastMessage = useCallback((updater) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== activeSessionId) return s;
      const msgs = [...s.messages];
      if (msgs.length > 0) {
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], ...updater(msgs[msgs.length - 1]) };
      }
      return { ...s, messages: msgs };
    }));
  }, [activeSessionId]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || sending || !selectedKb || !activeSessionId) return;

    setInput('');
    setSending(true);

    addMessage({ role: 'user', content, timestamp: Date.now() });
    const aiMsgId = `ai-${Date.now()}`;
    addMessage({ id: aiMsgId, role: 'assistant', content: '', timestamp: Date.now(), references: [] });
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) return { ...s, streaming: true };
      return s;
    }));

    try {
      if (streamEnabled) {
        // 流式模式 — 使用 API 客户端的 askStream（自动处理 token、租户头）
        let streamResp;
        try {
          streamResp = await knowledgeBaseAPI.askStream({ kb_id: selectedKb, question: content });
        } catch (fetchErr) {
          throw new Error(fetchErr.message || '流式请求失败');
        }
        const reader = streamResp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let refs = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const part of parts) {
            // 从 SSE 块中提取 data 行（可能含 event: 前缀行）
            const dataLines = part.split('\n').filter(l => l.startsWith('data: '));
            if (dataLines.length === 0) continue;
            const data = dataLines[dataLines.length - 1].slice(6).trim();
            if (!data) continue;
            try {
              const parsed = JSON.parse(data);
              // 后端格式: delta → { text, citations? }; done → { ok, citations }; error → { message, code }
              if (parsed.text !== undefined) {
                fullContent += parsed.text;
                updateLastMessage(() => ({ content: fullContent }));
              } else if (parsed.ok) {
                refs = parsed.citations || [];
                updateLastMessage(() => ({ content: fullContent, references: refs }));
              } else if (parsed.message) {
                updateLastMessage(() => ({ content: `错误: ${parsed.message}` }));
              }
            } catch (_e) {
              // 忽略解析错误
            }
          }
        }
        updateLastMessage(prev => ({ references: refs }));
      } else {
        // 非流式
        const res = await knowledgeBaseAPI.ask({ question: content, kb_id: selectedKb });
        if (res?.success && res.data) {
          updateLastMessage(() => ({
            content: res.data.answer || '未获取到回答',
            references: res.data.citations || [],
          }));
        } else {
          updateLastMessage(() => ({ content: '抱歉，无法获取回答' }));
        }
      }
    } catch (error) {
      updateLastMessage(() => ({ content: `请求失败: ${error.message}` }));
    } finally {
      setSending(false);
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) return { ...s, streaming: false };
        return s;
      }));
    }
  }, [input, sending, selectedKb, activeSessionId, streamEnabled, addMessage, updateLastMessage]);

  // 引用点击
  const handleSelectCitation = useCallback((citation) => {
    if (citation && citation.index) {
      setInput(prev => `${prev}[参考资料 ${citation.index}] ${citation.doc_title || ''}`.trim());
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!selectedKb) return;
    try {
      const res = await knowledgeBaseAPI.listQaRecords({ kb_id: selectedKb, pageSize: 50 });
      if (res?.success && Array.isArray(res.data)) {
        setSessions(prev => {
          const existing = prev.map(s => ({ ...s, messages: s.messages || [] }));
          const newSessions = res.data.map((record, idx) => ({
            id: `hist-${record.id || idx}`,
            title: record.question ? record.question.slice(0, 30) : '历史记录',
            messages: [
              { role: 'user', content: record.question || '', timestamp: record.created_at },
              { role: 'assistant', content: record.answer || '', timestamp: record.created_at, references: record.references || [] },
            ],
            createdAt: record.created_at,
            streaming: false,
          }));
          return [...newSessions, ...existing];
        });
      }
    } catch (_e) { /* ignore */ }
  }, [selectedKb]);

  // ==================== 消息气泡渲染 ====================
  const MessageBubble = useMemo(() => {
    // eslint-disable-next-line react/display-name
    return React.memo(({ message, onSelectCitation }) => {
      const isUser = message.role === 'user';
      return (
        <div style={{
          display: 'flex',
          marginBottom: 16,
          justifyContent: isUser ? 'flex-end' : 'flex-start',
        }}>
          <div style={{
            maxWidth: '70%',
            padding: '10px 14px',
            borderRadius: 12,
            background: isUser ? '#1890ff' : '#f5f5f5',
            color: isUser ? '#fff' : '#333',
            fontSize: 14,
            lineHeight: 1.6,
            wordBreak: 'break-word',
          }}>
            {isUser ? (
              <div>{message.content}</div>
            ) : (
              <div>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
                {Array.isArray(message.references) && message.references.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #e8e8e8' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>参考资料:</Text>
                    <div style={{ marginTop: 4 }}>
                      {message.references.map((ref, idx) => (
                        <Tag
                          key={idx}
                          color="blue"
                          style={{ cursor: 'pointer', marginBottom: 4 }}
                          onClick={() => onSelectCitation && onSelectCitation({ ...ref, index: idx + 1 })}
                        >
                          [{idx + 1}] {ref.doc_title || ref.file_name || `来源 ${idx + 1}`}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
                {message.streaming && (
                  <span style={{ display: 'inline-block', animation: 'pulse 1s infinite' }}>▊</span>
                )}
              </div>
            )}
          </div>
        </div>
      );
    });
  }, []);

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
                <div
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  style={{
                    cursor: 'pointer',
                    padding: '8px 12px',
                    background: s.id === activeSessionId ? '#e6f4ff' : 'transparent',
                    borderLeft: s.id === activeSessionId ? '3px solid #1890ff' : '3px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
                    <Avatar size="small" icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff', marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text ellipsis style={{ fontSize: 13, display: 'block' }}>
                        {s.title || '新会话'}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {s.messages.length > 0 ? `${s.messages.length} 条消息` : '空会话'}
                      </Text>
                    </div>
                  </div>
                  <Button
                    type="text" size="small" danger icon={<DeleteOutlined />}
                    onClick={() => handleDeleteSession(s.id)}
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* 右侧:对话区 */}
        <Col span={19} style={{ height: '100%' }}>
          <Card
            size="small"
            title={
              <Space>
                <BookOutlined />
                <Select
                  placeholder="选择知识库..."
                  value={selectedKb}
                  onChange={setSelectedKb}
                  loading={loadingKbs}
                  style={{ minWidth: 200 }}
                  options={kbs.map(kb => ({ label: kb.kb_name, value: kb.id }))}
                />
              </Space>
            }
            extra={
              <Space>
                <span style={{ fontSize: 12, color: '#999' }}>流式</span>
                <Switch size="small" checked={streamEnabled} onChange={setStreamEnabled} />
              </Space>
            }
            styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: 'calc(100% - 40px)' } }}
            style={{ height: '100%' }}
          >
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }} ref={chatContainerRef}>
              {(() => {
                if (!activeSession || activeSession.messages.length === 0) {
                  return (
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
                  );
                }
                return activeSession.messages.map((m, idx) => (
                  <MessageBubble
                    key={idx}
                    message={m}
                    onSelectCitation={handleSelectCitation}
                  />
                ));
              })()}
            </div>

            {/* 输入区 */}
            <div style={{ borderTop: '1px solid #f0f0f0', padding: 12, background: '#fff' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <TextArea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="输入问题..."
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  style={{ flex: 1 }}
                  onPressEnter={e => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  loading={sending}
                  disabled={!input.trim() || !selectedKb}
                />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 历史记录抽屉 */}
      <Drawer
        title="历史问答记录"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={400}
      >
        <Button type="primary" block onClick={() => {
          loadHistory();
        }}>刷新历史记录</Button>
        <div style={{ marginTop: 16 }}>
          {sessions.filter(s => s.id.startsWith('hist-')).map(s => (
            <Card
              key={s.id}
              size="small"
              hoverable
              style={{ marginBottom: 8 }}
              onClick={() => {
                setActiveSessionId(s.id);
                setDrawerOpen(false);
              }}
            >
              <Text ellipsis style={{ display: 'block' }}>{s.title || '历史记录'}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {s.messages.length > 0 ? `${s.messages[0].content.slice(0, 50)}...` : ''}
              </Text>
            </Card>
          ))}
        </div>
      </Drawer>
    </div>
  );
};

export default KnowledgeBaseQA;
