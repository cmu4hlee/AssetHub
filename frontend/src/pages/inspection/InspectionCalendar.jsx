/**
 * 巡检日历视图
 * 月历显示巡检任务,可点击查看
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Calendar, Badge, Modal, List, Tag, Empty, Spin, Button, Space, message } from 'antd';
import { CalendarOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { inspectionAPI } from '../../utils/api';
import dayjs from 'dayjs';
import useIsMobile from '../../hooks/useIsMobile';

const priorityColor = { high: 'red', medium: 'orange', low: 'blue' };
const statusColor = { pending: 'default', in_progress: 'processing', completed: 'success', overdue: 'error', cancelled: 'default' };
const statusLabel = { pending: '待巡检', in_progress: '巡检中', completed: '已完成', overdue: '已逾期', cancelled: '已取消' };

const InspectionCalendar = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const loadMonth = useCallback(async (date) => {
    setLoading(true);
    try {
      const start = date.startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
      const end = date.endOf('month').add(7, 'day').format('YYYY-MM-DD');
      const res = await inspectionAPI.getCalendar({ start_date: start, end_date: end });
      if (res?.success) {
        setTasks(res.data.list || []);
      }
    } catch (_e) {
      message.error('加载日历失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMonth(dayjs()); }, [loadMonth]);

  const dateCellRender = value => {
    const dateStr = value.format('YYYY-MM-DD');
    const list = tasks.filter(t => {
      const d = t.plan_date instanceof Date ? t.plan_date.toISOString().slice(0, 10) : t.plan_date;
      return d === dateStr;
    });
    if (list.length === 0) return null;
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {list.slice(0, 3).map(t => (
          <li key={t.id} onClick={(e) => { e.stopPropagation(); handleSelect(value, list); }}>
            <Badge
              color={priorityColor[t.priority] || 'blue'}
              text={
                <span style={{ fontSize: 12 }}>
                  {t.task_name?.slice(0, 8) || t.task_code}
                </span>
              }
            />
          </li>
        ))}
        {list.length > 3 && <li style={{ fontSize: 11, color: '#999' }}>+{list.length - 3} 更多</li>}
      </ul>
    );
  };

  const handleSelect = (date, list) => {
    if (!list || list.length === 0) return;
    setSelectedDate(date);
    setModalVisible(true);
  };

  const monthCellRender = value => {
    const monthTasks = tasks.filter(t => {
      const d = t.plan_date instanceof Date ? t.plan_date.toISOString().slice(0, 10) : t.plan_date;
      return d?.startsWith(value.format('YYYY-MM'));
    });
    if (monthTasks.length === 0) return null;
    return <div style={{ textAlign: 'center', fontSize: 12 }}>{monthTasks.length} 个任务</div>;
  };

  const todayList = selectedDate
    ? tasks.filter(t => {
        const d = t.plan_date instanceof Date ? t.plan_date.toISOString().slice(0, 10) : t.plan_date;
        return d === selectedDate.format('YYYY-MM-DD');
      })
    : [];

  return (
    <div style={{ padding: isMobile ? '8px' : '24px' }}>
      <Spin spinning={loading}>
        <Card
          title={<span><CalendarOutlined /> 巡检任务日历</span>}
          extra={
            <Space>
              <Button onClick={() => navigate('/inspection')}>任务列表</Button>
              <Button onClick={() => navigate('/inspection/plans')}>巡检计划</Button>
            </Space>
          }
        >
          <Calendar
            cellRender={value => {
              if (value.month() === value.date() ? 1 : 0) return null;
              if (value.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')) return null;
              return dateCellRender(value);
            }}
            onSelect={handleSelect}
            onPanelChange={loadMonth}
          />
        </Card>
      </Spin>

      <Modal
        title={selectedDate ? `${selectedDate.format('YYYY-MM-DD')} 巡检任务` : ''}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={isMobile ? '95vw' : 700}
      >
        {todayList.length === 0 ? (
          <Empty description="当日无任务" />
        ) : (
          <List
            dataSource={todayList}
            renderItem={item => (
              <List.Item
                actions={[
                  <Button
                    key="view"
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => navigate('/inspection')}
                  >
                    查看
                  </Button>,
                  item.status !== 'completed' && (
                    <Button
                      key="fill"
                      type="link"
                      icon={<FileTextOutlined />}
                      onClick={() => navigate(`/inspection/records/new?taskId=${item.id}`)}
                    >
                      填写记录
                    </Button>
                  ),
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{item.task_name}</span>
                      <Tag color={statusColor[item.status]}>{statusLabel[item.status] || item.status}</Tag>
                      <Tag color={priorityColor[item.priority]}>{item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}</Tag>
                    </Space>
                  }
                  description={
                    <span>
                      编号: {item.task_code} ·
                      资产: {item.asset_name || item.inspection_area || '-'} ·
                      巡检人: {item.assignee_name || '未指派'}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  );
};

export default InspectionCalendar;
