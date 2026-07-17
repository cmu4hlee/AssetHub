import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs, Card, Row, Col, Statistic, Button, Space, Tag, List, Progress, message, Spin,
} from 'antd';
import {
  ExperimentOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined,
  MobileOutlined, FileTextOutlined, ReloadOutlined, ClockCircleOutlined,
  AppstoreOutlined, BookOutlined, CalendarOutlined, BellOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { poctAPI } from '../../api/domains/poct';
import { useIsMobile } from '../../hooks';

// 7 个子页(平铺 Tab 方案,全部内嵌)
import PoctRecordList from './PoctRecordList';
import PoctMobile from './PoctMobile';
import PoctSubjectList from './PoctSubjectList';
import PoctShiftList from './PoctShiftList';
import PoctScheduleList from './PoctScheduleList';
import PoctReminderList from './PoctReminderList';

const { TabPane } = Tabs;

/**
 * POCT 质控管理 - 主页(Dashboard / Tab 容器)
 *
 * 7 个 Tab 平铺:
 *  - home      首页(合格率概览 + 班次对比 + 快捷入口)
 *  - records   质控记录(PC 端列表 + 详情 + 统计)
 *  - mobile    移动录入(响应式 H5)
 *  - subjects  监测科目
 *  - shifts    班次设置
 *  - schedules 排班管理
 *  - reminders 提醒规则
 */
const PoctDashboard = () => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('home');
  const [stats, setStats] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = dayjs().format('YYYY-MM-DD');
  const monthAgo = dayjs().subtract(30, 'day').format('YYYY-MM-DD');

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const [statR, shiftR] = await Promise.all([
        poctAPI.getStatistics({ start_date: monthAgo, end_date: today }),
        poctAPI.getShifts(),
      ]);
      if (statR.data?.success) setStats(statR.data.data);
      if (shiftR.data?.success) setShifts(shiftR.data.data);
    } catch (e) {
      message.error('加载概览失败');
    } finally {
      setLoading(false);
    }
  }, [monthAgo, today]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // 当前班次(仅展示用)
  const currentShift = (() => {
    if (!shifts.length) return null;
    const now = dayjs();
    const cur = now.hour() * 60 + now.minute();
    return shifts.find(s => {
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      return end > start ? (cur >= start && cur < end) : (cur >= start || cur < end);
    });
  })();

  // ==================== 首页 Tab 内容 ====================
  const renderHome = () => {
    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;
    const homePad = isMobile ? 8 : 16;
    const summary = stats?.summary || { total: 0, pass: 0, warn: 0, fail: 0 };
    const passRateNum = summary.total > 0 ? Math.round((summary.pass / summary.total) * 100) : 0;

    return (
      <div style={{ padding: homePad }}>
        {/* 当前班次提示 */}
        {currentShift && (
          <Card style={{
            marginBottom: 16, background: currentShift.color || '#1890ff', color: '#fff',
          }} bodyStyle={{ padding: 16 }}>
            <Space>
              <ClockCircleOutlined style={{ fontSize: 24 }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 'bold' }}>当前: {currentShift.shift_name}</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {currentShift.start_time?.slice(0, 5)} - {currentShift.end_time?.slice(0, 5)}
                  {' · '}
                  {dayjs().format('YYYY-MM-DD HH:mm')}
                </div>
              </div>
              <Button
                type="primary" size="large"
                style={{ marginLeft: 'auto', background: '#fff', color: currentShift.color, borderColor: '#fff' }}
                icon={<MobileOutlined />}
                onClick={() => setTab('mobile')}
              >
                进入当班录入
              </Button>
            </Space>
          </Card>
        )}

        {/* 30天统计 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Card><Statistic title="30天总记录" value={summary.total} prefix={<FileTextOutlined />} /></Card>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Card><Statistic title="合格" value={summary.pass} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Card><Statistic title="预警" value={summary.warn} valueStyle={{ color: '#faad14' }} prefix={<WarningOutlined />} /></Card>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Card><Statistic title="不合格" value={summary.fail} valueStyle={{ color: '#ff4d4f' }} prefix={<CloseCircleOutlined />} /></Card>
          </Col>
          <Col xs={24} sm={8} md={12} lg={8}>
            <Card title="30天合格率">
              <Progress
                type="circle" percent={passRateNum}
                strokeColor={passRateNum >= 95 ? '#52c41a' : passRateNum >= 80 ? '#faad14' : '#ff4d4f'}
                format={p => `${p}%`}
              />
              <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
                {passRateNum >= 95 ? '优秀' : passRateNum >= 80 ? '合格' : '需关注'}
              </div>
            </Card>
          </Col>
        </Row>

        {/* 班次对比 + 快捷入口 */}
        <Row gutter={16}>
          <Col xs={24} lg={14}>
            <Card title="班次合格率对比(30天)" extra={<Button icon={<ReloadOutlined />} onClick={loadStats} />}>
              <List
                dataSource={stats?.byShift || []}
                renderItem={s => {
                  const rate = s.total > 0 ? Math.round((s.pass / s.total) * 100) : 0;
                  return (
                    <List.Item>
                      <List.Item.Meta
                        title={<Space><Tag color={s.color}>{s.shift_name}</Tag></Space>}
                        description={`${s.pass} / ${s.total} 合格`}
                      />
                      <div style={{ width: 200 }}>
                        <Progress
                          percent={rate}
                          strokeColor={rate >= 95 ? '#52c41a' : rate >= 80 ? '#faad14' : '#ff4d4f'}
                          format={p => `${p}%`}
                        />
                      </div>
                    </List.Item>
                  );
                }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card title="快捷入口">
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Button block size="large" icon={<MobileOutlined />} onClick={() => setTab('mobile')}>
                  移动端录入
                </Button>
                <Button block size="large" icon={<FileTextOutlined />} onClick={() => setTab('records')}>
                  质控记录列表
                </Button>
                <Button block icon={<ClockCircleOutlined />} onClick={() => setTab('shifts')}>
                  班次设置
                </Button>
                <Button block icon={<ExperimentOutlined />} onClick={() => setTab('subjects')}>
                  监测科目管理
                </Button>
                <Button block icon={<CalendarOutlined />} onClick={() => setTab('schedules')}>
                  排班管理
                </Button>
                <Button block icon={<BellOutlined />} onClick={() => setTab('reminders')}>
                  提醒规则
                </Button>
              </Space>
            </Card>

            <Card title="系统预置" style={{ marginTop: 16 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div>📊 监测科目: <b>20+</b> 项常见 POCT 项目</div>
                <div>🕐 班次: <b>3</b> 班(早 / 中 / 晚)</div>
                <div>✍️ 签名: Canvas 手绘,留痕可追溯</div>
                <div>📱 多端: PC + 移动端 H5 响应式</div>
                <div>🔔 提醒: 站内 / 飞书 / 微信 / 短信</div>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  return (
    <div>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        type="card"
        destroyInactiveTabPane={false}
        tabBarStyle={{
          margin: isMobile ? '0 8px' : '0 16px',
          marginBottom: 12,
          background: '#fff',
          borderRadius: 8,
          padding: '4px 4px 0',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
        size={isMobile ? 'small' : 'middle'}
        items={[
          { key: 'home',      label: <span><AppstoreOutlined /> 首页</span>,     children: renderHome() },
          // 其他子页自带 padding 24,这里用负 margin 抹平 dashboard 外层 padding
          { key: 'records',   label: <span><FileTextOutlined /> 记录</span>,     children: <div style={{ margin: isMobile ? '0 -8px' : '0 -16px' }}><PoctRecordList /></div> },
          { key: 'mobile',    label: <span><MobileOutlined /> 移动录入</span>,   children: <div style={{ margin: isMobile ? '0 -8px' : '0 -16px' }}><PoctMobile /></div> },
          { key: 'subjects',  label: <span><BookOutlined /> 科目</span>,         children: <div style={{ margin: isMobile ? '0 -8px' : '0 -16px' }}><PoctSubjectList /></div> },
          { key: 'shifts',    label: <span><ClockCircleOutlined /> 班次</span>,   children: <div style={{ margin: isMobile ? '0 -8px' : '0 -16px' }}><PoctShiftList /></div> },
          { key: 'schedules', label: <span><CalendarOutlined /> 排班</span>,     children: <div style={{ margin: isMobile ? '0 -8px' : '0 -16px' }}><PoctScheduleList /></div> },
          { key: 'reminders', label: <span><BellOutlined /> 提醒</span>,         children: <div style={{ margin: isMobile ? '0 -8px' : '0 -16px' }}><PoctReminderList /></div> },
        ]}
      />
    </div>
  );
};

export default PoctDashboard;
