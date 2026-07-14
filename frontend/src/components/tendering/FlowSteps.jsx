import React from 'react';
import { Steps, Tooltip } from 'antd';
import './FlowSteps.css';

/**
 * 流程步骤条
 *
 * @param {Array} steps - [{ title, description, time, user, status, icon }]
 *   status: 'wait' | 'process' | 'finish' | 'error'
 * @param {string|number} current - 当前步骤 index
 * @param {string} direction - 'horizontal' | 'vertical'（移动端自动 vertical）
 *
 * @example
 * <FlowSteps
 *   current={2}
 *   steps={[
 *     { title: '提交申请', time: '2025-01-12 10:00', user: '张三', status: 'finish' },
 *     { title: '审批通过', time: '2025-01-13 14:30', user: '李四', status: 'finish' },
 *     { title: '合同签订中', status: 'process' },
 *     { title: '已完成', status: 'wait' },
 *   ]}
 * />
 */
const FlowSteps = ({ steps = [], current, direction = 'horizontal' }) => {
  const items = steps.map((s, idx) => {
    const item = {
      title: (
        <div className="flow-step-title">
          <span>{s.title}</span>
          {s.time ? <span className="flow-step-time">{s.time}</span> : null}
        </div>
      ),
      description: s.user ? (
        <Tooltip title={s.user}>
          <span className="flow-step-user">{s.user}</span>
        </Tooltip>
      ) : s.description || null,
      status: s.status || (idx < current ? 'finish' : idx === current ? 'process' : 'wait'),
    };
    if (s.icon) item.icon = s.icon;
    return item;
  });

  return (
    <div className="flow-steps">
      <Steps
        direction={direction}
        current={current}
        items={items}
        size="small"
      />
    </div>
  );
};

export default FlowSteps;
