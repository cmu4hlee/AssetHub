/**
 * 预防性维护 中心页
 *
 * 合并了原"预防性维护 / 维护计划模板 / 维护提醒管理"三个独立菜单的功能。
 * 通过 Tabs 平铺展示,旧路由(/maintenance/templates、/maintenance/reminders)已下线,
 * 全部统一在 /maintenance/plans 下访问。
 *
 * 三个子页通过 React.lazy 拆 chunk,首屏只加载"维护计划" tab,切换时再按需加载,
 * 避免首屏一次性把 4000+ 行代码塞进 bundle。
 */
import React, { Suspense, lazy } from 'react';
import { Card, Tabs, Spin } from 'antd';
import {
  ScheduleOutlined,
  FileTextOutlined,
  BellOutlined,
  ToolOutlined,
} from '@ant-design/icons';

// 四个子页: 计划/模板/提醒/临时保养, 作为 lazy 子组件嵌入 Tabs
const PlansTab = lazy(() => import('./PreventiveMaintenanceList'));
const TemplatesTab = lazy(() => import('./MaintenanceTemplateList'));
const RemindersTab = lazy(() => import('./MaintenanceReminderList'));
const TemporaryTab = lazy(() => import('./PreventiveMaintenanceTemporary'));

const TabFallback = () => (
  <div style={{ textAlign: 'center', padding: '60px 0' }}>
    <Spin description="加载中..." />
  </div>
);

const PreventiveMaintenanceHub = () => {
  return (
    <div style={{ padding: '20px' }}>
      <Card styles={{ body: { paddingTop: 8, paddingBottom: 12 } }} variant="borderless">
        <Tabs
          defaultActiveKey="plans"
          destroyOnHidden
          items={[
            {
              key: 'plans',
              label: (
                <span>
                  <ScheduleOutlined /> 维护计划
                </span>
              ),
              children: (
                <Suspense fallback={<TabFallback />}>
                  <PlansTab />
                </Suspense>
              ),
            },
            {
              key: 'templates',
              label: (
                <span>
                  <FileTextOutlined /> 维护模板
                </span>
              ),
              children: (
                <Suspense fallback={<TabFallback />}>
                  <TemplatesTab />
                </Suspense>
              ),
            },
            {
              key: 'reminders',
              label: (
                <span>
                  <BellOutlined /> 提醒管理
                </span>
              ),
              children: (
                <Suspense fallback={<TabFallback />}>
                  <RemindersTab />
                </Suspense>
              ),
            },
            {
              key: 'temporary',
              label: (
                <span>
                  <ToolOutlined /> 临时保养
                </span>
              ),
              children: (
                <Suspense fallback={<TabFallback />}>
                  <TemporaryTab />
                </Suspense>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default PreventiveMaintenanceHub;
