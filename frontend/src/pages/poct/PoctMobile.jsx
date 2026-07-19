import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Input, Select, Space, Tag, message, Spin, Empty, Modal, List, Badge, Result,
} from 'antd';
import {
  ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined,
  EnvironmentOutlined, UserOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { poctAPI } from '../../api/domains/poct';
import SignaturePad from '../../components/poct/SignaturePad';
import { useIsMobile } from '../../hooks';

/**
 * POCT 移动端 - 当班快速录入
 *
 * 流程:
 *  1) 选科室 → 选班次 → 选日期
 *  2) 拉取当班待办任务(已排班但未录入)
 *  3) 每个任务:填实测值 → (自动判定结果) → 签名 → 提交
 */
const PoctMobile = () => {
  const isMobile = useIsMobile();
  const today = dayjs().format('YYYY-MM-DD');

  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [deptId, setDeptId] = useState(null);
  const [shiftId, setShiftId] = useState(null);
  const [date, setDate] = useState(today);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  // 录入弹窗状态
  const [submitting, setSubmitting] = useState(null);  // 当前正在录入的 task
  const [measuredValue, setMeasuredValue] = useState('');
  const [remarks, setRemarks] = useState('');
  const [signature, setSignature] = useState(null);
  const [instrument, setInstrument] = useState('');
  const [reagentLot, setReagentLot] = useState('');

  // 加载班次
  useEffect(() => {
    poctAPI.getShifts().then(r => {
      if (r.success) setShifts(r.data);
    }).catch(() => message.error('加载班次失败'));
  }, []);

  // 加载科室 (复用 user-management 部门列表)
  useEffect(() => {
    // 尝试从全局或常见 API 拿科室
    import('../../api/domains/users').then(({ departmentsAPI }) => {
      departmentsAPI.getDepartments({ pageSize: 100 }).then(r => {
        const list = r.data?.data || r.data || [];
        setDepartments(Array.isArray(list) ? list : []);
      }).catch(() => {});
    });
  }, []);

  // 自动判定当前班次
  useEffect(() => {
    if (!shifts.length) return;
    const now = dayjs();
    const current = shifts.find(s => {
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      const cur = now.hour() * 60 + now.minute();
      if (end > start) return cur >= start && cur < end;
      // 跨天班次(如 22:00-06:00)
      return cur >= start || cur < end;
    });
    if (current) setShiftId(current.id);
  }, [shifts]);

  const loadTasks = useCallback(async () => {
    if (!deptId || !shiftId || !date) {
      setTasks([]);
      return;
    }
    try {
      setLoading(true);
      const r = await poctAPI.getShiftTasks({ department_id: deptId, shift_id: shiftId, date });
      if (r.success) setTasks(r.data || []);
      else setTasks([]);
    } catch (e) {
      message.error('加载当班任务失败');
    } finally {
      setLoading(false);
    }
  }, [deptId, shiftId, date]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const openSubmit = (task) => {
    setSubmitting(task);
    setMeasuredValue('');
    setRemarks('');
    setSignature(null);
    setInstrument('');
    setReagentLot('');
  };

  const closeSubmit = () => setSubmitting(null);

  const handleSubmit = async () => {
    if (!measuredValue) { message.warning('请填写实测值'); return; }
    if (!signature) { message.warning('请手写签名'); return; }
    try {
      setSubmitting(prev => ({ ...prev, _submitting: true }));
      const payload = {
        schedule_id: submitting.schedule_id,
        shift_id: submitting.shift_id,
        department_id: deptId,
        subject_id: submitting.subject_id,
        record_date: date,
        measured_value: measuredValue,
        instrument: instrument || null,
        reagent_lot: reagentLot || null,
        remarks: remarks || null,
        signature_data: signature,
        sign_device: isMobile ? 'mobile' : 'pc',
      };
      const r = await poctAPI.createRecord(payload);
      if (r.success) {
        const { result, deviation } = r.data;
        const color = result === 'pass' ? 'success' : result === 'warn' ? 'warning' : 'error';
        const text = result === 'pass' ? '合格' : result === 'warn' ? '预警' : '不合格';
        message.success(`提交成功 - ${text} (偏差 ${deviation || '0%'})`);
        closeSubmit();
        loadTasks();
      } else {
        message.error(r.message || '提交失败');
      }
    } catch (e) {
      message.error(e.response?.data?.message || '提交失败');
    } finally {
      setSubmitting(prev => prev ? { ...prev, _submitting: false } : null);
    }
  };

  const completed = tasks.filter(t => t.record_id).length;
  const total = tasks.length;
  const passRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div style={{ padding: isMobile ? 12 : 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Card styles={{ body: { padding: 16 } }}>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22 }}>📋 POCT 质控 - 当班录入</h2>
          <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
            {dayjs(date).format('YYYY年MM月DD日')}
            {shifts.find(s => s.id === shiftId)?.shift_name && ` · ${shifts.find(s => s.id === shiftId)?.shift_name}`}
          </div>
        </div>

        {/* 选择区 */}
        <Space orientation={isMobile ? 'vertical' : 'horizontal'} style={{ width: '100%' }} size={8}>
          <Select
            placeholder="选择科室"
            value={deptId}
            onChange={setDeptId}
            style={{ width: isMobile ? '100%' : 200 }}
            options={departments.map(d => ({ value: d.id, label: d.department_name || d.name }))}
          />
          <Select
            placeholder="选择班次"
            value={shiftId}
            onChange={setShiftId}
            style={{ width: isMobile ? '100%' : 160 }}
            options={shifts.map(s => ({
              value: s.id,
              label: `${s.shift_name} (${s.start_time?.slice(0, 5)}-${s.end_time?.slice(0, 5)})`,
            }))}
          />
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ width: isMobile ? '100%' : 160 }}
          />
          <Button icon={<ReloadOutlined />} onClick={loadTasks}>刷新</Button>
        </Space>

        {/* 进度条 */}
        {total > 0 && (
          <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>当班进度</span>
              <span style={{ fontSize: 18, fontWeight: 'bold', color: passRate === 100 ? '#52c41a' : '#1890ff' }}>
                {completed} / {total} ({passRate}%)
              </span>
            </div>
            <div style={{
              marginTop: 8, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                width: `${passRate}%`, height: '100%',
                background: passRate === 100 ? '#52c41a' : '#1890ff',
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        )}
      </Card>

      {/* 任务列表 */}
      <div style={{ marginTop: 12 }}>
        {loading ? (
          <Card><Spin tip="加载中..." style={{ width: '100%' }} /></Card>
        ) : tasks.length === 0 ? (
          <Card>
            <Empty
              description={
                !deptId ? '请先选择科室' :
                !shiftId ? '请选择班次' :
                '该班次暂无排班任务'
              }
            />
          </Card>
        ) : (
          <List
            dataSource={tasks}
            renderItem={task => (
              <List.Item style={{ padding: 0, marginBottom: 8 }}>
                <Card style={{ width: '100%' }} styles={{ body: { padding: 12 } }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>
                        {task.subject_name}
                        <Tag color="blue" style={{ marginLeft: 8 }}>{task.subject_code}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                        <ClockCircleOutlined /> 靶值 {task.target_value || '-'} · 容差 {task.tolerance || '-'}
                      </div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        <UserOutlined /> {task.operator_name || '未指派'}
                      </div>
                    </div>
                    <div>
                      {task.record_id ? (
                        <Tag color={task.result === 'pass' ? 'success' : task.result === 'warn' ? 'warning' : 'error'}>
                          {task.result === 'pass' ? '合格' : task.result === 'warn' ? '预警' : '不合格'}
                        </Tag>
                      ) : (
                        <Button type="primary" size={isMobile ? 'middle' : 'large'} onClick={() => openSubmit(task)}>
                          录入
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        )}
      </div>

      {/* 录入弹窗 */}
      <Modal
        title={submitting ? `录入 - ${submitting.subject_name}` : ''}
        open={!!submitting}
        onCancel={closeSubmit}
        width={isMobile ? '100%' : 600}
        style={isMobile ? { top: 0, maxWidth: '100vw', margin: 0 } : {}}
        footer={null}
        destroyOnHidden      >
        {submitting && (
          <div>
            <Card size="small" style={{ marginBottom: 12, background: '#fafafa' }}>
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <div>科目: <b>{submitting.subject_name}</b> ({submitting.subject_code})</div>
                <div>靶值: <b>{submitting.target_value || '-'}</b> · 容差: {submitting.tolerance || '-'}</div>
                <div>参考范围: {submitting.reference_range || '-'}</div>
              </Space>
            </Card>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, color: '#666' }}>
                实测值 <span style={{ color: 'red' }}>*</span>
              </label>
              <Input
                size="large"
                value={measuredValue}
                onChange={e => setMeasuredValue(e.target.value)}
                placeholder={`请输入 ${submitting.unit || ''} 实测值`}
                suffix={submitting.unit && <span style={{ color: '#999' }}>{submitting.unit}</span>}
              />
            </div>

            <Space style={{ width: '100%' }} orientation={isMobile ? 'vertical' : 'horizontal'}>
              <Input
                placeholder="设备名称/编号"
                value={instrument}
                onChange={e => setInstrument(e.target.value)}
                style={{ width: isMobile ? '100%' : 200 }}
              />
              <Input
                placeholder="试剂批号"
                value={reagentLot}
                onChange={e => setReagentLot(e.target.value)}
                style={{ width: isMobile ? '100%' : 200 }}
              />
            </Space>

            <div style={{ marginTop: 12 }}>
              <Input.TextArea
                placeholder="备注(可选)"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={2}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <SignaturePad
                value={signature}
                onChange={setSignature}
                height={isMobile ? 150 : 180}
                label="操作人签名 *"
              />
            </div>

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Button onClick={closeSubmit}>取消</Button>
                <Button
                  type="primary"
                  size="large"
                  loading={submitting._submitting}
                  onClick={handleSubmit}
                  disabled={!measuredValue || !signature}
                >
                  提交
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PoctMobile;
