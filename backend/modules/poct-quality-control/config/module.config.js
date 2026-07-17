/**
 * POCT 临床科室日常质控管理 - 模块配置
 *
 * 模块 ID:  poct-quality-control
 * API 路径: /api/poct-quality-control
 * 菜单路径: /poct-quality-control
 */
module.exports = {
  id: 'poct-quality-control',
  name: 'POCT 质控管理',
  version: '1.0.0',
  description: '临床科室日常质控管理,支持早中晚班次、手写签名、移动端录入、提醒通知、统计报表。',
  category: '质量与安全',
  type: 'business',
  status: 'stable',
  author: 'AssetHub',
  created_at: '2026-07-17T00:00:00Z',
  updated_at: '2026-07-17T00:00:00Z',

  dependencies: [
    { module_id: 'user-management',      dependency_type: 'required', min_version: '1.0.0', max_version: '2.0.0' },
    { module_id: 'department-management',dependency_type: 'required', min_version: '1.0.0', max_version: '2.0.0' },
    { module_id: 'event-reminder-management', dependency_type: 'optional', min_version: '1.0.0', max_version: '2.0.0' },
    { module_id: 'feishu-binding',       dependency_type: 'optional', min_version: '1.0.0', max_version: '2.0.0' },
    { module_id: 'wechat-mp-binding',    dependency_type: 'optional', min_version: '1.0.0', max_version: '2.0.0' },
  ],

  compatibility: {
    min_node_version: '14.0.0',
    max_node_version: '24.0.0',
    supported_databases: ['mysql'],
    browser_compatibility: {
      chrome: '>=80', firefox: '>=75', safari: '>=13', edge: '>=80',
    },
  },

  frontend_config: {
    menu_keys: ['/poct-quality-control'],
    menu_prefixes: ['/poct-quality-control'],
    menu_routes: [
      { key: '/poct-quality-control',          icon: 'ExperimentOutlined', label: 'POCT 质控',     path: '/poct-quality-control',         component: 'PoctDashboard',   permissions: ['poct:read'] },
      { key: '/poct-quality-control/records',  icon: 'FileTextOutlined',   label: '质控记录',     path: '/poct-quality-control/records', component: 'PoctRecordList',  permissions: ['poct:read'] },
      { key: '/poct-quality-control/mobile',   icon: 'MobileOutlined',     label: '移动录入',     path: '/poct-quality-control/mobile',  component: 'PoctMobile',      permissions: ['poct:read'] },
      { key: '/poct-quality-control/subjects', icon: 'BookOutlined',       label: '监测科目',     path: '/poct-quality-control/subjects',component: 'PoctSubjectList', permissions: ['poct:admin'] },
      { key: '/poct-quality-control/shifts',   icon: 'ClockCircleOutlined',label: '班次设置',     path: '/poct-quality-control/shifts',  component: 'PoctShiftList',   permissions: ['poct:admin'] },
      { key: '/poct-quality-control/schedules',icon: 'CalendarOutlined',   label: '排班管理',     path: '/poct-quality-control/schedules', component: 'PoctScheduleList', permissions: ['poct:admin'] },
      { key: '/poct-quality-control/reminders',icon: 'BellOutlined',       label: '提醒规则',     path: '/poct-quality-control/reminders', component: 'PoctReminderList',permissions: ['poct:admin'] },
    ],
    components: [
      { name: 'PoctDashboard',    path: 'pages/poct/PoctDashboard',    export: 'default' },
      { name: 'PoctRecordList',   path: 'pages/poct/PoctRecordList',   export: 'default' },
      { name: 'PoctMobile',       path: 'pages/poct/PoctMobile',       export: 'default' },
      { name: 'PoctSubjectList',  path: 'pages/poct/PoctSubjectList',  export: 'default' },
      { name: 'PoctShiftList',    path: 'pages/poct/PoctShiftList',    export: 'default' },
      { name: 'PoctScheduleList', path: 'pages/poct/PoctScheduleList', export: 'default' },
      { name: 'PoctReminderList', path: 'pages/poct/PoctReminderList', export: 'default' },
    ],
    permissions: ['poct:read', 'poct:create', 'poct:update', 'poct:delete', 'poct:admin'],
  },

  backend_config: {
    api_endpoints: [
      { method: 'GET',    path: '/api/poct-quality-control/subjects',                   handler: 'listSubjects' },
      { method: 'POST',   path: '/api/poct-quality-control/subjects',                   handler: 'createSubject' },
      { method: 'PUT',    path: '/api/poct-quality-control/subjects/:id',               handler: 'updateSubject' },
      { method: 'DELETE', path: '/api/poct-quality-control/subjects/:id',               handler: 'deleteSubject' },
      { method: 'GET',    path: '/api/poct-quality-control/shifts',                     handler: 'listShifts' },
      { method: 'POST',   path: '/api/poct-quality-control/shifts',                     handler: 'createShift' },
      { method: 'PUT',    path: '/api/poct-quality-control/shifts/:id',                 handler: 'updateShift' },
      { method: 'DELETE', path: '/api/poct-quality-control/shifts/:id',                 handler: 'deleteShift' },
      { method: 'GET',    path: '/api/poct-quality-control/schedules',                  handler: 'listSchedules' },
      { method: 'POST',   path: '/api/poct-quality-control/schedules',                  handler: 'upsertSchedule' },
      { method: 'DELETE', path: '/api/poct-quality-control/schedules/:id',              handler: 'deleteSchedule' },
      { method: 'GET',    path: '/api/poct-quality-control/records',                    handler: 'listRecords' },
      { method: 'POST',   path: '/api/poct-quality-control/records',                    handler: 'createRecord' },
      { method: 'GET',    path: '/api/poct-quality-control/records/:id',                handler: 'getRecordDetail' },
      { method: 'PUT',    path: '/api/poct-quality-control/records/:id',                handler: 'updateRecord' },
      { method: 'DELETE', path: '/api/poct-quality-control/records/:id',                handler: 'deleteRecord' },
      { method: 'GET',    path: '/api/poct-quality-control/records/shift-tasks',        handler: 'getShiftTasks' },
      { method: 'GET',    path: '/api/poct-quality-control/records/statistics',         handler: 'getStatistics' },
      { method: 'POST',   path: '/api/poct-quality-control/signatures',                 handler: 'addSignature' },
      { method: 'GET',    path: '/api/poct-quality-control/reminders',                  handler: 'listReminders' },
      { method: 'POST',   path: '/api/poct-quality-control/reminders',                  handler: 'upsertReminder' },
      { method: 'DELETE', path: '/api/poct-quality-control/reminders/:id',              handler: 'deleteReminder' },
    ],
    database_tables: [
      'poct_subjects', 'poct_department_subjects', 'poct_shifts', 'poct_schedules',
      'poct_records', 'poct_signatures', 'poct_reminders',
    ],
    services: [{ name: 'PoctService', path: 'services/poct.service' }],
    permissions: ['poct:read', 'poct:create', 'poct:update', 'poct:delete', 'poct:admin'],
  },

  config_schema: [
    { key: 'enable_signature',        name: '启用手写签名',  type: 'boolean', default: true },
    { key: 'enable_reminder',         name: '启用提醒',      type: 'boolean', default: true },
    { key: 'mobile_signature_canvas', name: '移动端签名画布', type: 'string',  default: 'default' },
  ],
  default_config: { enable_signature: true, enable_reminder: true, mobile_signature_canvas: 'default' },
  interfaces: [],
};
