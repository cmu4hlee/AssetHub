import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, Space, Tag, Spin, Alert, Typography } from 'antd';
import { RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { tenderingAPI } from '../../api/domains/tendering';
import { PageHeader } from '../../components/tendering';

const { Paragraph } = Typography;

const LEVEL_COLORS = { 高: 'red', 中: 'orange', 低: 'blue' };
const DECISION_LABELS = {
  approve: { label: '建议通过', color: 'green' },
  reject: { label: '建议驳回', color: 'red' },
  need_more: { label: '建议补充材料', color: 'gold' },
};

function buildStreamUrl() {
  return tenderingAPI.aiAssistStreamUrl;
}

async function streamAIAudit({ entityType, entityId, context, approverHint, onDelta, onDone, onError }) {
  const token = localStorage.getItem('token');
  const baseURL = (window.__ASSETHUB_API_BASE__ || '') + '/api';
  const resp = await fetch(`${baseURL}${buildStreamUrl()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ entity_type: entityType, entity_id: entityId, context, approver_hint: approverHint }),
  });
  if (!resp.ok || !resp.body) {
    onError(new Error(`HTTP ${resp.status}`));
    return;
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  let donePayload = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of chunk.split('\n')) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const obj = JSON.parse(payload);
          if (obj.type === 'delta' && obj.text) onDelta(obj.text);
          else if (obj.type === 'done') donePayload = obj;
          else if (obj.type === 'error') onError(new Error(obj.message || 'AI 生成失败'));
        } catch (_) { /* ignore parse */ }
      }
    }
  }
  onDone(donePayload);
}

function tryParse(text) {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (_) { return null; }
}

export default function TenderApprovalAI({ entityType, entityId, context, approverHint, embedded = false }) {
  const [streaming, setStreaming] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [donePayload, setDonePayload] = useState(null);
  const cancelledRef = useRef(false);
  const [instant, setInstant] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await tenderingAPI.aiAssist({ entity_type: entityType, entity_id: entityId, context, approver_hint: approverHint });
        if (mounted) setInstant(res?.data || res);
      } catch (e) {
        // 流式生成失败时降级
      }
    })();
    return () => { mounted = false; };
  }, [entityType, entityId]);

  const handleStream = async () => {
    setStreaming(true); setError(null); setText(''); setDonePayload(null);
    cancelledRef.current = false;
    try {
      await streamAIAudit({
        entityType, entityId, context, approverHint,
        onDelta: delta => {
          if (cancelledRef.current) return;
          setText(prev => prev + delta);
        },
        onDone: payload => { setStreaming(false); setDonePayload(payload); },
        onError: e => { setError(e.message || 'AI 生成失败'); setStreaming(false); },
      });
    } catch (e) {
      setError(e.message || 'AI 生成失败');
      setStreaming(false);
    }
  };

  const parsed = tryParse(text) || donePayload?.parsed || (instant || null);
  const decisionTag = parsed && parsed.decision ? DECISION_LABELS[parsed.decision] : null;

  if (embedded) {
    return (
      <div>
        {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 12 }} />}
        <div style={{ textAlign: 'right', marginBottom: 12 }}>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={streaming}
            onClick={handleStream}
          >
            实时流式生成
          </Button>
        </div>
        {text ? (
          <div style={{ marginBottom: 12 }}>
            <Typography.Text type="secondary">模型流式输出：</Typography.Text>
            <pre style={{
              background: '#fafafa', padding: 8, borderRadius: 4,
              whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto',
            }}>{text}</pre>
          </div>
        ) : null}
        {parsed ? (
          <Space orientation="vertical" style={{ width: '100%' }}>
            {decisionTag ? <Tag color={decisionTag.color}>{decisionTag.label}</Tag> : null}
            {parsed.opinion ? (
              <Paragraph style={{ marginBottom: 0 }}>
                <strong>意见：</strong>{parsed.opinion}
              </Paragraph>
            ) : null}
            {Array.isArray(parsed.risks) && parsed.risks.length > 0 ? (
              <div>
                <strong>风险点：</strong>
                <Space wrap style={{ marginTop: 4 }}>
                  {parsed.risks.map((r, idx) => (
                    <Tag key={idx} color={LEVEL_COLORS[r.level] || 'default'}>
                      {r.level} · {r.desc}
                    </Tag>
                  ))}
                </Space>
              </div>
            ) : null}
            {Array.isArray(parsed.notes) && parsed.notes.length > 0 ? (
              <div>
                <strong>关注点：</strong>
                <ul style={{ marginTop: 4, marginBottom: 0 }}>
                  {parsed.notes.map((n, idx) => <li key={idx}>{n}</li>)}
                </ul>
              </div>
            ) : null}
            {parsed.model ? <Typography.Text type="secondary">模型: {parsed.model}</Typography.Text> : null}
          </Space>
        ) : streaming ? <Spin /> : (
          <Typography.Text type="secondary">
            点击「实时流式生成」获取 AI 审批建议；审批意见由人工最终决定。
          </Typography.Text>
        )}
      </div>
    );
  }

  return (
    <PageHeader
      title={
        <Space><RobotOutlined /> AI 辅助审批意见 (MiniMax)</Space>
      }
      description="基于 MiniMax 模型的智能审批建议"
      extra={
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={streaming}
          onClick={handleStream}
        >
          实时流式生成
        </Button>
      }
    >
      <Card>
        {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 12 }} />}
        {text ? (
          <div style={{ marginBottom: 12 }}>
            <Typography.Text type="secondary">模型流式输出：</Typography.Text>
            <pre style={{
              background: '#fafafa', padding: 8, borderRadius: 4,
              whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto',
            }}>{text}</pre>
          </div>
        ) : null}
        {parsed ? (
          <Space orientation="vertical" style={{ width: '100%' }}>
            {decisionTag ? <Tag color={decisionTag.color}>{decisionTag.label}</Tag> : null}
            {parsed.opinion ? (
              <Paragraph style={{ marginBottom: 0 }}>
                <strong>意见：</strong>{parsed.opinion}
              </Paragraph>
            ) : null}
            {Array.isArray(parsed.risks) && parsed.risks.length > 0 ? (
              <div>
                <strong>风险点：</strong>
                <Space wrap style={{ marginTop: 4 }}>
                  {parsed.risks.map((r, idx) => (
                    <Tag key={idx} color={LEVEL_COLORS[r.level] || 'default'}>
                      {r.level} · {r.desc}
                    </Tag>
                  ))}
                </Space>
              </div>
            ) : null}
            {Array.isArray(parsed.notes) && parsed.notes.length > 0 ? (
              <div>
                <strong>关注点：</strong>
                <ul style={{ marginTop: 4, marginBottom: 0 }}>
                  {parsed.notes.map((n, idx) => <li key={idx}>{n}</li>)}
                </ul>
              </div>
            ) : null}
            {parsed.model ? <Typography.Text type="secondary">模型: {parsed.model}</Typography.Text> : null}
          </Space>
        ) : streaming ? <Spin /> : (
          <Typography.Text type="secondary">
            点击「实时流式生成」获取 AI 审批建议；审批意见由人工最终决定。
          </Typography.Text>
        )}
      </Card>
    </PageHeader>
  );
}
