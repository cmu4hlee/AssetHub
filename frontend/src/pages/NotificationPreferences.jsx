/**
 * 通知偏好设置
 *
 * 功能：
 *   - 全局启用 / 关闭
 *   - 紧急度阈值（low/medium/high）
 *   - 勿扰模式 + 时段 + 生效日 + 紧急度突破
 *   - 桌面通知 / 顶部气泡
 *   - 实时预览：在当前时间 + 选定的紧急度下，是否会推送
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Form, Switch, Select, TimePicker, Checkbox, Button, Space, message,
  Input, Divider, Alert, Spin, Row, Col, Tag, Empty, Modal, Tabs, Typography,
} from 'antd';
import {
  BellOutlined, ClockCircleOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ReloadOutlined, DeleteOutlined, PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { notificationPreferenceAPI } from '../utils/api';
import { useIsMobile } from '../hooks';

const { Option } = Select;
const { Text } = Typography;

const URGENCY_OPTIONS = [
  { value: 'low',    label: '一般', color: 'default', desc: '所有通知都接收' },
  { value: 'medium', label: '重要', color: 'orange',  desc: '只接收"重要"和"紧急"通知' },
  { value: 'high',   label: '紧急', color: 'red',     desc: '只接收"紧急"通知' },
];

const DND_DAY_OPTIONS = [
  { value: '1', label: '一' },
  { value: '2', label: '二' },
  { value: '3', label: '三' },
  { value: '4', label: '四' },
  { value: '5', label: '五' },
  { value: '6', label: '六' },
  { value: '7', label: '日' },
];

const NotificationPreferences = () => {
  const isMobile = useIsMobile();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState({ urgencyLevels: [], dndDayOptions: [], defaults: {} });
  const [myPref, setMyPref] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrgency, setPreviewUrgency] = useState('medium');
  const [previewTime, setPreviewTime] = useState(null); // null = 用当前时间

  // 加载元数据 + 我的偏好
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [metaRes, prefRes] = await Promise.all([
        notificationPreferenceAPI.getMeta(),
        notificationPreferenceAPI.getEffective(null), // 全局合并偏好
      ]);
      if (metaRes?.success) setMeta(metaRes.data);
      if (prefRes?.success) {
        const prefs = prefRes.data.preferences;
        setMyPref(prefs);
        // 填表
        form.setFieldsValue({
          enabled: prefs.enabled !== false,
          urgency_threshold: prefs.urgencyThreshold || 'low',
          dnd_enabled: !!prefs.dndEnabled,
          dnd_start_time: prefs.dndStartTime ? dayjs(prefs.dndStartTime, 'HH:mm:ss') : null,
          dnd_end_time: prefs.dndEndTime ? dayjs(prefs.dndEndTime, 'HH:mm:ss') : null,
          dnd_days: (prefs.dndDays || '1,2,3,4,5,6,7').split(','),
          dnd_override_urgency: prefs.dndOverrideUrgency || 'high',
          desktop_enabled: prefs.desktopEnabled !== false,
          toast_enabled: prefs.toastEnabled !== false,
          remark: prefs.remark || '',
        });
      }
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 实时预览
  const runPreview = useCallback(async () => {
    setPreviewing(true);
    try {
      const nowIso = previewTime ? previewTime.toISOString() : new Date().toISOString();
      const res = await notificationPreferenceAPI.preview(previewUrgency, nowIso, null);
      if (res?.success) setPreview(res.data);
    } catch (e) {
      message.error('预览失败');
    } finally {
      setPreviewing(false);
    }
  }, [previewUrgency, previewTime]);

  // 表单值变化时自动重算预览
  const handleValuesChange = useCallback((changed, all) => {
    runPreviewWithForm(all);
  }, [runPreviewWithForm]);

  function runPreviewWithForm(formValues) {
    // 立即用表单值计算预览（不等 API）
    const urgency = formValues.urgency_threshold || 'low';
    const override = formValues.dnd_override_urgency || 'high';
    const enabled = formValues.enabled !== false;
    const dndEnabled = !!formValues.dnd_enabled;
    const dndStart = formValues.dnd_start_time;
    const dndEnd = formValues.dnd_end_time;
    const dndDays = formValues.dnd_days || ['1','2','3','4','5','6','7'];

    const URGENCY_ORDER = { low: 0, medium: 1, high: 2 };
    const now = previewTime ? previewTime.toDate() : new Date();
    const day = now.getDay() === 0 ? 7 : now.getDay();
    const inDay = dndDays.includes(String(day));
    let willDeliver = true;
    let reason = null;
    if (!enabled) { willDeliver = false; reason = '已关闭通知'; }
    else if (URGENCY_ORDER[urgency] < URGENCY_ORDER[previewUrgency]) {
      willDeliver = false; reason = `紧急度阈值 ${urgency} > 当前 ${previewUrgency}`;
    }
    else if (dndEnabled && dndStart && dndEnd && inDay) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const start = dndStart.hour() * 60 + dndStart.minute();
      const end = dndEnd.hour() * 60 + dndEnd.minute();
      const inDnd = start <= end
        ? (nowMin >= start && nowMin < end)
        : (nowMin >= start || nowMin < end);
      if (inDnd) {
        if (URGENCY_ORDER[previewUrgency] < URGENCY_ORDER[override]) {
          willDeliver = false; reason = `DND 中（${dndStart.format('HH:mm')}-${dndEnd.format('HH:mm')}），当前紧急度 ${previewUrgency} < 突破阈值 ${override}`;
        }
      }
    }
    setPreview({ willDeliver, reason, preferences: formValues, now: now.toISOString() });
  }

  // 保存
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const body = {
        user_id: undefined, // 后端会自己取 req.user.id
        event_code: null,    // 全局偏好
        enabled: values.enabled,
        urgency_threshold: values.urgency_threshold,
        dnd_enabled: values.dnd_enabled,
        dnd_start_time: values.dnd_start_time ? values.dnd_start_time.format('HH:mm:ss') : null,
        dnd_end_time: values.dnd_end_time ? values.dnd_end_time.format('HH:mm:ss') : null,
        dnd_days: (values.dnd_days || []).join(','),
        dnd_override_urgency: values.dnd_override_urgency,
        desktop_enabled: values.desktop_enabled,
        toast_enabled: values.toast_enabled,
        remark: values.remark || '',
      };
      const res = await notificationPreferenceAPI.upsert(body);
      if (res?.success) {
        message.success('保存成功');
        fetchData();
      }
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Modal.confirm({
      title: '恢复默认？',
      content: '将删除当前偏好，通知行为恢复为：不限制时段 / 不限制紧急度。',
      okType: 'danger',
      onOk: async () => {
        if (myPref?.id) {
          await notificationPreferenceAPI.remove(myPref.id);
        }
        message.success('已恢复默认');
        fetchData();
      },
    });
  };

  const dndEnabled = Form.useWatch('dnd_enabled', form);

  return (
    <div style={{ padding: isMobile ? 12 : 24 }}>
      <Card
        title={
          <Space>
            <BellOutlined />
            <span>通知偏好设置</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleReset}>恢复默认</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>保存</Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <Row gutter={24}>
            <Col xs={24} md={14}>
              <Form
                form={form}
                layout="vertical"
                onValuesChange={handleValuesChange}
              >
                <Form.Item label="启用通知" name="enabled" valuePropName="checked">
                  <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                </Form.Item>

                <Form.Item
                  label="紧急度阈值"
                  name="urgency_threshold"
                  extra="低于此紧急度的通知会被自动过滤"
                >
                  <Select>
                    {URGENCY_OPTIONS.map(o => (
                      <Option key={o.value} value={o.value}>
                        <Tag color={o.color}>{o.label}</Tag> <Text type="secondary">{o.desc}</Text>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Divider style={{ margin: '12px 0' }} />

                <Form.Item label="勿扰模式" name="dnd_enabled" valuePropName="checked">
                  <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                </Form.Item>

                {dndEnabled && (
                  <>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item label="开始时间" name="dnd_start_time" rules={[{ required: true, message: '必填' }]}>
                          <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="结束时间" name="dnd_end_time" rules={[{ required: true, message: '必填' }]}>
                          <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item label="生效日" name="dnd_days">
                      <Checkbox.Group>
                        <Space>
                          {DND_DAY_OPTIONS.map(d => (
                            <Checkbox key={d.value} value={d.value}>周{d.label}</Checkbox>
                          ))}
                        </Space>
                      </Checkbox.Group>
                    </Form.Item>
                    <Form.Item
                      label="紧急度突破"
                      name="dnd_override_urgency"
                      extra="DND 期间，达到此紧急度的通知仍会推送"
                    >
                      <Select>
                        {URGENCY_OPTIONS.map(o => (
                          <Option key={o.value} value={o.value}>
                            <Tag color={o.color}>{o.label}</Tag>
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </>
                )}

                <Divider style={{ margin: '12px 0' }} />

                <Form.Item label="桌面通知（仅站内）" name="desktop_enabled" valuePropName="checked">
                  <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                </Form.Item>
                <Form.Item label="顶部气泡（仅站内）" name="toast_enabled" valuePropName="checked">
                  <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                </Form.Item>

                <Form.Item label="备注" name="remark">
                  <Input.TextArea rows={2} maxLength={200} showCount />
                </Form.Item>
              </Form>
            </Col>

            <Col xs={24} md={10}>
              <Card type="inner" title={<><ClockCircleOutlined /> 实时预览</>}>
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <div>
                    <Text type="secondary">测试紧急度：</Text>
                    <Select value={previewUrgency} onChange={setPreviewUrgency} style={{ width: 120, marginLeft: 8 }}>
                      {URGENCY_OPTIONS.map(o => (
                        <Option key={o.value} value={o.value}>
                          <Tag color={o.color}>{o.label}</Tag>
                        </Option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Text type="secondary">测试时间：</Text>
                    <Select
                      value={previewTime ? 'custom' : 'now'}
                      onChange={v => setPreviewTime(v === 'now' ? null : dayjs('2026-07-15T23:00:00'))}
                      style={{ width: 180, marginLeft: 8 }}
                    >
                      <Option value="now">当前时间</Option>
                      <Option value="custom">2026-07-15 23:00（晚 11 点）</Option>
                    </Select>
                  </div>
                  <Button block onClick={runPreview} loading={previewing}>
                    重新预览
                  </Button>

                  {preview && (
                    <Alert
                      type={preview.willDeliver ? 'success' : 'warning'}
                      showIcon
                      icon={preview.willDeliver ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                      message={preview.willDeliver ? '会推送' : '会被静默'}
                      description={
                        <>
                          <div>时间: {dayjs(preview.now).format('YYYY-MM-DD HH:mm:ss ddd')}</div>
                          <div>紧急度: <Tag color={URGENCY_OPTIONS.find(o => o.value === previewUrgency)?.color}>{previewUrgency}</Tag></div>
                          {preview.reason && <div>原因: {preview.reason}</div>}
                        </>
                      }
                    />
                  )}
                </Space>
              </Card>

              <Card type="inner" title="说明" style={{ marginTop: 16 }} size="small">
                <Space direction="vertical" size={4}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    • 飞书和站内双通道共用此偏好
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    • 即使被静默，消息仍会落库（不丢历史）
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    • 跨午夜时段：开始时间 &gt; 结束时间
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    • 当前为全局偏好，后续可按事件单独配置
                  </Text>
                </Space>
              </Card>
            </Col>
          </Row>
        )}
      </Card>
    </div>
  );
};

export default NotificationPreferences;
