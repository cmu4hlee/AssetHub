import React, { startTransition, useRef, useState } from 'react';
import { Button, Card, Input, List, Space, Typography } from 'antd';

import {
  createConversationId,
  createOpenClawAssetHubSystemMessage,
  sendOpenClawAssistantMessage,
} from '../api/openclawAssistant';

const { Paragraph, Text, Title } = Typography;

const seedMessages = [
  {
    id: 'assistant-welcome',
    role: 'assistant',
    content: '您好，我已经按当前登录账号和当前租户上下文接入 OpenClaw。您可以直接问“我的用户名是什么”或“病理科的资产总量是多少”。',
  },
];

export default function OpenClawAssistantExample() {
  const [messages, setMessages] = useState(seedMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => createConversationId('openclaw-demo'));
  const abortControllerRef = useRef(null);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    startTransition(() => {
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setLoading(true);
    });

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const result = await sendOpenClawAssistantMessage({
        sessionId,
        signal: abortControllerRef.current.signal,
        messages: [
          createOpenClawAssetHubSystemMessage(),
          ...messages.map(item => ({
            role: item.role,
            content: item.content,
          })),
          {
            role: userMessage.role,
            content: userMessage.content,
          },
        ],
      });

      startTransition(() => {
        setSessionId(result.sessionId);
        setMessages(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: result.content || 'OpenClaw 未返回有效内容，请稍后重试。',
          },
        ]);
      });
    } catch (error) {
      startTransition(() => {
        setMessages(prev => [
          ...prev,
          {
            id: `assistant-error-${Date.now()}`,
            role: 'assistant',
            content: error?.response?.data?.message || error?.message || 'AI 请求失败，请稍后重试。',
          },
        ]);
      });
    } finally {
      startTransition(() => {
        setLoading(false);
      });
    }
  };

  return (
    <Card
      title={<Title level={4} style={{ margin: 0 }}>OpenClaw 资产助手示例</Title>}
      extra={<Text type="secondary">session: {sessionId}</Text>}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          这个示例直接调用 AssetHost 后端的 <Text code>/api/ai/chat/completions</Text>，
          鉴权 token 和当前租户由现有 axios 拦截器自动注入。
        </Paragraph>

        <List
          bordered
          dataSource={messages}
          renderItem={item => (
            <List.Item>
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Text strong>{item.role === 'assistant' ? 'AI助手' : '您'}</Text>
                <div style={{ whiteSpace: 'pre-wrap' }}>{item.content}</div>
              </Space>
            </List.Item>
          )}
        />

        <Input.TextArea
          autoSize={{ minRows: 3, maxRows: 6 }}
          placeholder="请输入资产管理问题，例如：当前资产总量是多少"
          value={input}
          onChange={event => setInput(event.target.value)}
          onPressEnter={event => {
            if (!event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
        />

        <Space>
          <Button type="primary" onClick={() => void sendMessage()} loading={loading}>
            发送
          </Button>
          <Button
            onClick={() => {
              abortControllerRef.current?.abort();
              setLoading(false);
            }}
            disabled={!loading}
          >
            取消
          </Button>
          <Button
            onClick={() => {
              setMessages(seedMessages);
              setSessionId(createConversationId('openclaw-demo'));
            }}
          >
            新会话
          </Button>
        </Space>
      </Space>
    </Card>
  );
}
