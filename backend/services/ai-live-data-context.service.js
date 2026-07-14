const path = require('path');
const axios = require('axios');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.AI_LIVE_DATA_TIMEOUT_MS || '8000', 10);
const ASSET_LIST_TIMEOUT_MS = parseInt(
  process.env.AI_LIVE_DATA_ASSET_LIST_TIMEOUT_MS || String(Math.max(DEFAULT_TIMEOUT_MS, 12000)),
  10,
);
const FULL_ASSET_LIST_TIMEOUT_MS = parseInt(
  process.env.AI_LIVE_DATA_FULL_ASSET_LIST_TIMEOUT_MS || String(Math.max(DEFAULT_TIMEOUT_MS, 20000)),
  10,
);
const MAINTENANCE_QUERY_TIMEOUT_MS = parseInt(
  process.env.AI_LIVE_DATA_MAINTENANCE_TIMEOUT_MS || String(Math.max(DEFAULT_TIMEOUT_MS, 12000)),
  10,
);
const DEFAULT_LIST_LIMIT = Math.max(
  1,
  Math.min(20, parseInt(process.env.AI_LIVE_DATA_LIST_LIMIT || '10', 10)),
);
const ASSET_FOLLOW_UP_FULL_LIST_LIMIT = Math.max(
  DEFAULT_LIST_LIMIT,
  Math.min(100, parseInt(process.env.AI_LIVE_DATA_ASSET_FULL_LIST_LIMIT || '50', 10)),
);
const { ASSET_STATUS_LIST } = require('../config/asset-status.constants');
const ASSET_STATUS_OPTIONS = ASSET_STATUS_LIST;

const ASSET_KEYWORD_RE = /(资产|设备|器械|仪器|台账)/;
const DEPRECIATION_KEYWORD_RE = /(折旧|累计折旧|账面净值|账面价值|折旧率|残值|净值)/;
const ROLE_KEYWORD_RE = /(角色|role[_\s-]?(code|name)|权限角色|岗位角色)/i;
const USER_DIRECTORY_KEYWORD_RE = /(用户|账号|人员|成员)/;
const DEPARTMENT_DIRECTORY_KEYWORD_RE = /(部门|科室|组织架构|组织)/;
const MENU_KEYWORD_RE = /(菜单|导航|功能入口|页面入口|可见功能|访问入口)/;
const AUDIT_LOG_KEYWORD_RE = /(审计日志|操作日志)/;
const MAINTENANCE_LOG_KEYWORD_RE =
  /(维修日志|维护日志|维修记录|维护记录|维修历史|维护历史|保养日志|保养记录)/;
const WORKORDER_KEYWORD_RE = /(维修工单|维护工单|工单)/;
const INVENTORY_RECORD_KEYWORD_RE =
  /(库存盘点|盘点(记录|单|任务|列表|明细|情况|统计|数量|多少))/;
const PROCUREMENT_RECORD_KEYWORD_RE =
  /(采购(记录|申请|单|列表|明细|情况|统计|数量|多少|审批|执行|合同|招标)|采购管理|待审批采购|已批准采购|已完成采购)/;
const TRANSFER_RECORD_KEYWORD_RE =
  /((资产)?调配(记录|申请|单|列表|明细|情况|统计|数量|多少)|调拨(记录|申请|单|列表|明细|情况|统计|数量|多少)|待审批调配|已批准调配|已完成调配|已取消调配)/;
const IDLE_RECORD_KEYWORD_RE =
  /(闲置(发布|记录|清单|列表|明细|情况|统计)|闲置资产(发布|记录|清单|列表|明细)|发布中的闲置资产|已分配闲置资产|已取消闲置资产)/;
const SCRAPPING_RECORD_KEYWORD_RE =
  /(报废(记录|申请|单|流程|列表|明细|情况|统计|数量|多少)|待审批报废|已完成报废|已驳回报废|处置中报废)/;
const MODULE_QUERY_RE = /(启用模块|模块.*(启用|开启|打开|可用)|当前.*模块)/;
const MANAGED_DEPARTMENT_QUERY_RE =
  /((我|当前登录用户).*(管理|负责|有权限管理).*(科室|部门)|(我负责的|我管理的)(科室|部门)|管理科室|负责科室)/;
const ASSET_DATA_QUERY_RE =
  /(查|查询|统计|总览|概览|概况|概述|情况|数量|多少|总数|总量|列表|列出|看看|看下|详情|明细|状态|在用|闲置|维修|报废|价值|金额|汇总)/;
const DEPRECIATION_DATA_QUERY_RE =
  /(查|查询|统计|总览|概览|概况|概述|情况|明细|详情|汇总|数据|趋势|列表|列出|多少|按部门|按科室|按类型|按分类|按月|月份|月度)/;
const DIRECTORY_DATA_QUERY_RE =
  /(查|查询|统计|总览|概览|概况|概述|情况|数量|多少|总数|总量|列表|列出|看看|看下|详情|明细|有哪些|前\d+|top\s*\d+)/i;
const ASSET_FOLLOW_UP_RE =
  /(那|这些|那些|它们|这个|那个|在用|闲置|维修|报废|数量|多少|总数|总量|详情|明细|状态|情况)/;
const ASSET_REFINE_FOLLOW_UP_RE =
  /(把这些|把刚才那批|把这批|刚才那批|这批|只看|只要|仅看|只显示|只列出|筛选|过滤|再按|按.*(排序|从高到低|从低到高|升序|降序))/;
const NEXT_PAGE_QUERY_RE =
  /^(下一页|继续|继续看|继续列出|再来|再来一页|后面|后面的|往后看|继续下一页|看下一页|下一页看看|翻到下一页|翻下一页|再往后看一页)$/i;
const PREVIOUS_PAGE_QUERY_RE =
  /^(上一页|前一页|往前看|回上一页|看上一页|上一页看看|翻到上一页|翻上一页|回到上一页|再往前看一页)$/i;
const EXPLICIT_PAGE_QUERY_RE =
  /^(?:(?:跳到|跳转到|去|看|打开|回到)\s*)?第\s*(\d{1,3})\s*页(?:吧|看看)?$/i;
const EXPORT_ASSET_QUERY_RE =
  /^(?:导出|下载)(?:为|成)?\s*(?:csv|excel|xlsx)?$|((导出|下载).*(当前|这个|这些|全部|所有|筛选结果|搜索结果|查询结果|明细|列表|清单|资产|设备|器械|仪器|台账|csv|excel|xlsx))/i;
const DEPRECIATION_FOLLOW_UP_RE =
  /(那|这些|那些|它们|这个|那个|分析|继续|趋势|明细|详情|统计|汇总|情况|部门|科室|类型|分类|月份|月度)/;
const ANALYSIS_REQUEST_RE =
  /(建议|评价|解读|原因|趋势|预测|方案|策略|优化|诊断|总结|归纳|判断|推荐|对比|比较|是否合理|怎么做|如何做|帮我分析|分析一下|做个分析|进行分析|请分析|分析原因|详细分析|配置分析|情况分析|统计分析|分析)/;
const LIST_QUERY_RE = /(列表|列出|有哪些|哪些|查找|搜索|检索|清单|全部|全量|所有|前\d+|top\s*\d+)/i;
const FULL_LIST_QUERY_RE =
  /(全量(?:查询|检索|搜索|列出)?|(?:查询|检索|搜索|列出).*(全量|全部|所有)|(?:全部|所有)(?:的)?(?:资产|设备|器械|仪器|台账)(?:列表|清单|明细)?|^(?:全部|所有|全量)(?:明细|列表|清单)?$)/i;
const OVERVIEW_QUERY_RE =
  /(统计|总览|概览|概况|概述|情况|数量|多少|总数|总量|在用|闲置|维修|报废|价值|金额|汇总)/;
const DEPRECIATION_GROUP_BY_DEPARTMENT_RE = /(按部门|按科室|各部门|各科室|部门分布|科室分布)/;
const DEPRECIATION_GROUP_BY_TYPE_RE = /(按类型|按分类|按类别|类型分布|分类分布|类别分布)/;
const DEPRECIATION_GROUP_BY_MONTH_RE = /(按月|月份|月度|趋势|最近\d{0,2}个?月)/;
const MENU_QUERY_RE = /(有哪些|可见|能看到|可以看到|权限|访问|显示|入口|列表|清单)/;
const AUDIT_LOG_STATS_RE = /(统计|分布|概况|概览|趋势|分析|汇总)/;
const AUDIT_LOG_LIST_RE = /(最近|前\d+|top\s*\d+|列表|明细|详情|记录|日志)/i;
const MAINTENANCE_DATA_QUERY_RE =
  /(查|查询|统计|总览|概览|概况|概述|情况|数量|多少|总数|总量|列表|列出|看看|看下|详情|明细|最近|前\d+|top\s*\d+|记录|日志|历史|有哪些)/i;
const WORKFLOW_DATA_QUERY_RE =
  /(查|查询|统计|总览|概览|概况|概述|情况|数量|多少|总数|总量|列表|列出|看看|看下|详情|明细|最近|前\d+|top\s*\d+|记录|单|申请|流程|有哪些|清单)/i;
const DETAIL_HINT_RE = /(详情|明细|信息|资料|状态|位置|负责人|编号|编码|asset[_\s-]?code|asset[_\s-]?id)/i;
const QUOTED_VALUE_RE = /[“"'`《](.{1,40})[”"'`》]/;
const GENERIC_QUERY_TERMS = new Set([
  '资产',
  '设备',
  '器械',
  '仪器',
  '记录',
  '申请',
  '调配',
  '调拨',
  '闲置',
  '报废',
  '盘点',
  '维修',
  '维护',
  '工单',
  '列表',
  '详情',
  '明细',
  '信息',
  '状态',
  '当前',
  '当前租户',
  '本租户',
  '这个租户',
  '这个企业',
  '当前企业',
  '所有',
  '全部',
  '有哪些',
  '哪些',
]);

const AUDIT_ACTION_LABELS = {
  login: '登录',
  logout: '退出登录',
  create: '创建',
  update: '修改',
  delete: '删除',
  approve: '审批通过',
  reject: '驳回',
  export: '导出',
  import: '导入',
  view: '查看',
  link: '关联',
  unlink: '取消关联',
};

const AUDIT_MODULE_LABELS = {
  users: '用户管理',
  departments: '部门管理',
  assets: '资产管理',
  inventory: '库存盘点',
  transfer: '资产调配',
  maintenance: '维修管理',
  depreciation: '折旧管理',
  scrapping: '报废管理',
  procurement: '采购管理',
  'roles-permissions': '角色权限',
  'module-configs': '模块配置',
  'technical-documents': '技术资料',
  alerts: '告警管理',
};

function loadBackendBaseUrl() {
  const directValue =
    process.env.AI_LIVE_DATA_BASE_URL ||
    process.env.BACKEND_URL ||
    process.env.VITE_BACKEND_URL ||
    '';

  if (directValue) {
    return String(directValue).replace(/\/+$/, '');
  }

  try {
    const portConfig = require(path.resolve(__dirname, '../../shared/port-config.js'));
    return String(portConfig.getBackendUrl() || 'http://localhost:5183').replace(/\/+$/, '');
  } catch (error) {
    return 'http://localhost:5183';
  }
}

function extractText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    return value.map(item => extractText(item)).filter(Boolean).join('\n');
  }

  if (typeof value === 'object') {
    return (
      extractText(value.text) ||
      extractText(value.content) ||
      extractText(value.message) ||
      extractText(value.parts)
    );
  }

  return '';
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringifyQueryParams(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  return searchParams.toString();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getAuditActionLabel(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  return AUDIT_ACTION_LABELS[normalized] || normalized;
}

function getAuditModuleLabel(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  return AUDIT_MODULE_LABELS[normalized] || normalized;
}

function pickAssetStatus(text) {
  return ASSET_STATUS_OPTIONS.find(status => text.includes(status)) || null;
}

function detectAssetSortPreference(text) {
  const sourceText = String(text || '');
  if (!sourceText) {
    return {
      sortField: null,
      sortOrder: null,
    };
  }

  let sortField = null;
  if (/(当前价值|净值|价值)/.test(sourceText)) {
    sortField = 'current_value';
  } else if (/(原值|购置价|购买价|采购价)/.test(sourceText)) {
    sortField = 'purchase_price';
  } else if (/(名称|名字)/.test(sourceText)) {
    sortField = 'asset_name';
  } else if (/(购置日期|购买日期|采购日期)/.test(sourceText)) {
    sortField = 'purchase_date';
  } else if (/(更新时间|最近更新)/.test(sourceText)) {
    sortField = 'updated_at';
  } else if (/(创建时间|录入时间|新增时间)/.test(sourceText)) {
    sortField = 'created_at';
  }

  if (!sortField) {
    return {
      sortField: null,
      sortOrder: null,
    };
  }

  let sortOrder = null;
  if (/(从高到低|降序|最高|最大|倒序|由高到低)/.test(sourceText)) {
    sortOrder = 'desc';
  } else if (/(从低到高|升序|最低|最小|正序|由低到高)/.test(sourceText)) {
    sortOrder = 'asc';
  } else if (sortField === 'asset_name') {
    sortOrder = 'asc';
  } else {
    sortOrder = 'desc';
  }

  return {
    sortField,
    sortOrder,
  };
}

function extractQuotedValue(text) {
  const match = String(text || '').match(QUOTED_VALUE_RE);
  return match ? match[1].trim() : '';
}

function extractAssetIdentifier(text) {
  const sourceText = String(text || '');
  const patterns = [
    /资产(?:编号|编码|code)\s*[:：]?\s*([A-Za-z0-9_-]{2,64})/i,
    /资产\s*id\s*[:：]?\s*([A-Za-z0-9_-]{1,64})/i,
    /asset[_\s-]?code\s*[:：]?\s*([A-Za-z0-9_-]{2,64})/i,
    /asset[_\s-]?id\s*[:：]?\s*([A-Za-z0-9_-]{1,64})/i,
  ];

  for (const pattern of patterns) {
    const match = sourceText.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  if (!DETAIL_HINT_RE.test(sourceText)) {
    return '';
  }

  const quoted = extractQuotedValue(sourceText);
  if (/^[A-Za-z0-9_-]{2,64}$/.test(quoted)) {
    return quoted;
  }

  const looseToken = sourceText.match(/\b([A-Za-z][A-Za-z0-9_-]{2,63}|\d{6,})\b/);
  return looseToken?.[1] || '';
}

function looksLikeDepartmentName(value) {
  return /(?:科|室|部|中心|病区|门诊)$/.test(String(value || '').trim());
}

function normalizeSearchKeyword(value, options = {}) {
  let candidate = String(value || '').trim();
  if (!candidate) {
    return '';
  }

  candidate = candidate
    .replace(/^[“"'`《「『【]+/, '')
    .replace(/[”"'`》」』】]+$/, '')
    .replace(/^(?:查一下|查一查|查询一下|查询|查找一下|查找|搜索一下|搜索|检索一下|检索|列出|看看|看下|找一下|找找|全量查询|全部查询|全部|所有)\s*/i, '')
    .replace(/^(?:待审批|待审核|已批准|已通过|已完成|已取消|发布中(?:的)?|已分配|鉴定中|评估中|处置中|进行中(?:的)?|处理中(?:的)?|待处理(?:的)?|维修中(?:的)?)\s*/i, '')
    .replace(/\s*相关$/i, '')
    .replace(/\s*(?:关键词|关键字)$/i, '')
    .replace(/\s*(?:类)?的$/i, '')
    .replace(/\s*(?:相关|类)?的?(?:资产|设备|器械|仪器|台账)(?:列表|清单|详情|明细)?$/i, '')
    .replace(/\s*(?:资产|设备|器械|仪器|台账)(?:列表|清单|详情|明细)?$/i, '')
    .replace(/^[：:，,\s]+/, '')
    .replace(/[：:，,\s]+$/, '')
    .trim();

  if (candidate.endsWith('类') && candidate.length > 2) {
    candidate = candidate.slice(0, -1).trim();
  }

  if (!candidate || candidate.length < 2 || GENERIC_QUERY_TERMS.has(candidate)) {
    return '';
  }

  if (options.excludeDepartmentLike && looksLikeDepartmentName(candidate)) {
    return '';
  }

  return candidate;
}

function normalizeDepartmentKeyword(value) {
  let candidate = String(value || '').trim();
  if (!candidate) {
    return '';
  }

  candidate = candidate
    .replace(
      /^(?:请|请帮我|帮我|麻烦|想|需要)?\s*(?:结合|根据|基于|围绕|针对|关于|对于|按|从)?\s*/i,
      '',
    )
    .replace(/^(?:查一下|查一查|查询一下|查询|查找一下|查找|搜索一下|搜索|检索一下|检索|列出|看看|看下|统计一下|统计|分析一下|分析|给出|说明)\s*/i, '')
    .trim();

  if (!candidate || candidate.length < 2 || GENERIC_QUERY_TERMS.has(candidate)) {
    return '';
  }

  return candidate;
}

function extractSearchKeyword(text) {
  const sourceText = String(text || '');
  const quoted = normalizeSearchKeyword(extractQuotedValue(sourceText));
  if (quoted) {
    return quoted;
  }

  const namedPattern =
    /(?:名称|品牌|型号|关键词|编号|编码)\s*[:：]?\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40})/i;
  const namedMatch = sourceText.match(namedPattern);
  const namedKeyword = normalizeSearchKeyword(namedMatch?.[1]);
  if (namedKeyword) {
    return namedKeyword;
  }

  const keywordPatterns = [
    /(?:搜索|检索|查找|查询)\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40})\s*(?:关键词|关键字)/i,
    /(?:查一下|查询一下|查找一下|搜索一下|查找|查询|搜索|检索|列出|看看|看下|全量查询|全部查询|全部|所有)\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40})\s*(?:类)?的?(?:资产|设备|器械|仪器|台账)/i,
    /(?:查一下|查询一下|查找一下|搜索一下|查找|查询|搜索|检索|列出|看看|看下|全量查询|全部查询|全部|所有)\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40})\s*(?:相关)?(?:盘点记录|盘点单|调配记录|调配申请|调拨记录|调拨申请|闲置资产(?:发布|记录)?|报废记录|报废申请|报废单|维修日志|维护日志|维修记录|维护记录|维修工单|维护工单|工单)/i,
    /([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40})\s*(?:关键词|关键字)/i,
    /([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40})\s*(?:类)?的?(?:资产|设备|器械|仪器|台账)/i,
    /([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40})\s*相关(?:盘点记录|盘点单|调配记录|调配申请|调拨记录|调拨申请|闲置资产(?:发布|记录)?|报废记录|报废申请|报废单|维修日志|维护日志|维修记录|维护记录|维修工单|维护工单|工单)/i,
    /([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40})\s*的?(?:盘点记录|盘点单|调配记录|调配申请|调拨记录|调拨申请|闲置资产(?:发布|记录)?|报废记录|报废申请|报废单|维修日志|维护日志|维修记录|维护记录|维修工单|维护工单|工单)/i,
  ];

  for (const pattern of keywordPatterns) {
    const match = sourceText.match(pattern);
    const candidate = normalizeSearchKeyword(match?.[1], { excludeDepartmentLike: true });
    if (candidate) {
      return candidate;
    }
  }

  return '';
}

function extractDepartmentKeyword(text) {
  const sourceText = String(text || '');
  const patterns = [
    /(?:科室|部门|归属部门|所属部门)\s*[:：]?\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40}(?:科|室|部|中心|病区|门诊)?)/i,
    /([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40}(?:科|室|部|中心|病区|门诊))的?(?:资产|设备|器械|仪器)/,
    /(?:资产|设备|器械|仪器).*(?:归属|所属|在)\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40}(?:科|室|部|中心|病区|门诊))/,
    /([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40}(?:科|室|部|中心|病区|门诊))的?(?:盘点记录|盘点单|调配记录|调配申请|调拨记录|调拨申请|闲置资产(?:发布|记录)?|报废记录|报废申请|报废单|维修日志|维护日志|维修记录|维护记录|维修工单|维护工单|工单)/,
    /^(?:只看|只要|仅看|只显示|只列出|筛选为|过滤为|过滤|筛选)?\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40}(?:科|室|部|中心|病区|门诊))(?:的)?$/i,
  ];

  for (const pattern of patterns) {
    const match = sourceText.match(pattern);
    const candidate = normalizeDepartmentKeyword(match?.[1]);
    if (candidate && !GENERIC_QUERY_TERMS.has(candidate)) {
      return candidate;
    }
  }

  // 容错：处理“病理可资产”这类常见输入错误，按“病理科资产”理解。
  const typoMatch = sourceText.match(/([\u4e00-\u9fa5]{2,20})可资产/);
  if (typoMatch?.[1]) {
    const candidate = `${typoMatch[1]}科`;
    if (!GENERIC_QUERY_TERMS.has(candidate)) {
      return candidate;
    }
  }

  return '';
}

function extractLimit(text) {
  const explicitLimit = extractExplicitLimit(text);
  if (explicitLimit !== null) {
    return explicitLimit;
  }

  return DEFAULT_LIST_LIMIT;
}

function extractExplicitLimit(text) {
  const sourceText = String(text || '');
  const patterns = [
    /(?:前|最近|top\s*)(\d{1,3})/i,
    /(?:列出|返回|展示|给我|看)\s*(\d{1,3})\s*(?:条|项|个)/i,
    /(\d{1,3})\s*(?:条|项|个)/i,
  ];

  for (const pattern of patterns) {
    const match = sourceText.match(pattern);
    if (match?.[1]) {
      return clamp(Number.parseInt(match[1], 10), 1, 100);
    }
  }

  return null;
}

function detectExportFormat(text) {
  const sourceText = String(text || '');

  if (/(^|[^a-z])csv([^a-z]|$)|逗号分隔/i.test(sourceText)) {
    return 'csv';
  }

  return 'xlsx';
}

function detectDepreciationGrouping(text) {
  const sourceText = String(text || '');

  if (DEPRECIATION_GROUP_BY_DEPARTMENT_RE.test(sourceText)) {
    return 'department';
  }

  if (DEPRECIATION_GROUP_BY_TYPE_RE.test(sourceText)) {
    return 'type';
  }

  if (DEPRECIATION_GROUP_BY_MONTH_RE.test(sourceText)) {
    return 'month';
  }

  return 'overview';
}

function detectDirectoryIntent(latestUserMessage = '') {
  const sourceText = String(latestUserMessage || '');
  const limit = extractLimit(sourceText);
  const searchKeyword = extractSearchKeyword(sourceText);
  const asksForDirectoryData =
    DIRECTORY_DATA_QUERY_RE.test(sourceText) ||
    LIST_QUERY_RE.test(sourceText) ||
    OVERVIEW_QUERY_RE.test(sourceText);

  if (
    USER_DIRECTORY_KEYWORD_RE.test(sourceText) &&
    (LIST_QUERY_RE.test(sourceText) ||
      /前\d{1,2}个?用户/.test(sourceText) ||
      /top\s*\d{1,2}.*用户/i.test(sourceText) ||
      /用户.*(列表|清单|详情|明细|情况|数量|多少|总数)/.test(sourceText))
  ) {
    return {
      domain: 'user',
      latestUserMessage: sourceText,
      limit,
      searchKeyword: searchKeyword || null,
    };
  }

  if (ROLE_KEYWORD_RE.test(sourceText) && asksForDirectoryData) {
    return {
      domain: 'role',
      latestUserMessage: sourceText,
      limit,
      searchKeyword: searchKeyword || null,
    };
  }

  if (
    DEPARTMENT_DIRECTORY_KEYWORD_RE.test(sourceText) &&
    asksForDirectoryData &&
    !ASSET_KEYWORD_RE.test(sourceText)
  ) {
    return {
      domain: 'department',
      latestUserMessage: sourceText,
      limit,
      searchKeyword: searchKeyword || null,
    };
  }

  return null;
}

function detectOperationalIntent(latestUserMessage = '') {
  const sourceText = String(latestUserMessage || '');
  const limit = extractLimit(sourceText);
  const searchKeyword = extractSearchKeyword(sourceText);
  const departmentKeyword = extractDepartmentKeyword(sourceText);

  if (PROCUREMENT_RECORD_KEYWORD_RE.test(sourceText) && WORKFLOW_DATA_QUERY_RE.test(sourceText)) {
    let status = null;
    if (/(待审批|待审核|pending)/i.test(sourceText)) {
      status = 'pending';
    } else if (/(已批准|已通过|approved)/i.test(sourceText)) {
      status = 'approved';
    } else if (/(已驳回|拒绝|rejected)/i.test(sourceText)) {
      status = 'rejected';
    } else if (/(执行中|处理中|executing)/i.test(sourceText)) {
      status = 'executing';
    } else if (/(已完成|completed)/i.test(sourceText)) {
      status = 'completed';
    }

    return {
      domain: 'procurement',
      latestUserMessage: sourceText,
      limit,
      searchKeyword: searchKeyword || null,
      departmentKeyword: departmentKeyword || null,
      status,
    };
  }

  if (
    MANAGED_DEPARTMENT_QUERY_RE.test(sourceText) &&
    !ASSET_KEYWORD_RE.test(sourceText)
  ) {
    return {
      domain: 'managed_department',
      latestUserMessage: sourceText,
      limit,
    };
  }

  if (MENU_KEYWORD_RE.test(sourceText) && MENU_QUERY_RE.test(sourceText)) {
    return {
      domain: 'menu',
      latestUserMessage: sourceText,
      limit,
    };
  }

  if (MODULE_QUERY_RE.test(sourceText)) {
    return {
      domain: 'module',
      latestUserMessage: sourceText,
      limit,
    };
  }

  if (AUDIT_LOG_KEYWORD_RE.test(sourceText) && (AUDIT_LOG_LIST_RE.test(sourceText) || AUDIT_LOG_STATS_RE.test(sourceText))) {
    return {
      domain: 'audit_log',
      latestUserMessage: sourceText,
      limit,
      wantsStats: AUDIT_LOG_STATS_RE.test(sourceText),
      wantsList: !AUDIT_LOG_STATS_RE.test(sourceText) || AUDIT_LOG_LIST_RE.test(sourceText),
      module: pickAuditModule(sourceText),
      actionType: pickAuditActionType(sourceText),
      keyword: searchKeyword || null,
    };
  }

  return null;
}

function pickAuditActionType(text) {
  const sourceText = String(text || '');
  const mappings = [
    { value: 'login', patterns: [/登录/] },
    { value: 'logout', patterns: [/退出|登出/] },
    { value: 'create', patterns: [/创建|新增|新建/] },
    { value: 'update', patterns: [/更新|修改|编辑/] },
    { value: 'delete', patterns: [/删除/] },
    { value: 'approve', patterns: [/审批通过|批准|通过/] },
    { value: 'reject', patterns: [/驳回|拒绝|拒批/] },
    { value: 'export', patterns: [/导出/] },
    { value: 'import', patterns: [/导入/] },
    { value: 'view', patterns: [/查看|浏览/] },
  ];

  const match = mappings.find(item => item.patterns.some(pattern => pattern.test(sourceText)));
  return match?.value || null;
}

function pickAuditModule(text) {
  const sourceText = String(text || '');
  const mappings = [
    { value: 'assets', patterns: [/资产/] },
    { value: 'users', patterns: [/用户/] },
    { value: 'departments', patterns: [/部门|科室/] },
    { value: 'roles-permissions', patterns: [/角色|权限/] },
    { value: 'transfer', patterns: [/调配|调拨/] },
    { value: 'inventory', patterns: [/盘点|库存/] },
    { value: 'maintenance', patterns: [/维修|维护/] },
    { value: 'depreciation', patterns: [/折旧/] },
    { value: 'technical-documents', patterns: [/资料|文档/] },
  ];

  const match = mappings.find(item => item.patterns.some(pattern => pattern.test(sourceText)));
  return match?.value || null;
}

function pickMaintenanceLogStatus(text) {
  const sourceText = String(text || '');
  const mappings = [
    { value: '进行中', patterns: [/进行中|处理中|维修中/] },
    { value: '已完成', patterns: [/已完成|完成|结束/] },
    { value: '已取消', patterns: [/已取消|取消/] },
  ];

  const match = mappings.find(item => item.patterns.some(pattern => pattern.test(sourceText)));
  return match?.value || null;
}

function pickMaintenanceType(text) {
  const sourceText = String(text || '');
  const mappings = [
    { value: '故障维修', patterns: [/故障维修|故障/] },
    { value: '预防性维护', patterns: [/预防性维护|预防维护/] },
    { value: '定期保养', patterns: [/定期保养|保养/] },
    { value: '日常维护', patterns: [/日常维护/] },
  ];

  const match = mappings.find(item => item.patterns.some(pattern => pattern.test(sourceText)));
  return match?.value || null;
}

function pickInventoryStatus(text) {
  const sourceText = String(text || '');
  const mappings = [
    { value: '进行中', patterns: [/进行中|盘点中/] },
    { value: '已完成', patterns: [/已完成|完成/] },
    { value: '已取消', patterns: [/已取消|取消/] },
  ];

  const match = mappings.find(item => item.patterns.some(pattern => pattern.test(sourceText)));
  return match?.value || null;
}

function pickTransferStatus(text) {
  const sourceText = String(text || '');
  const mappings = [
    { value: '待审批', patterns: [/待审批|待审核|审批中/] },
    { value: '已批准', patterns: [/已批准|已通过|审批通过/] },
    { value: '已取消', patterns: [/已取消|已驳回|已拒绝|取消/] },
    { value: '已完成', patterns: [/已完成/] },
  ];

  const match = mappings.find(item => item.patterns.some(pattern => pattern.test(sourceText)));
  return match?.value || null;
}

function pickIdleStatus(text) {
  const sourceText = String(text || '');
  const mappings = [
    { value: '发布中', patterns: [/发布中|发布的|在发布/] },
    { value: '已分配', patterns: [/已分配|分配完成/] },
    { value: '已取消', patterns: [/已取消|取消/] },
  ];

  const match = mappings.find(item => item.patterns.some(pattern => pattern.test(sourceText)));
  return match?.value || null;
}

function pickScrappingStatus(text) {
  const sourceText = String(text || '');
  const mappings = [
    { value: 'pending', patterns: [/待审批|待审核|待处理/] },
    { value: 'appraising', patterns: [/鉴定中|评估中/] },
    { value: 'approved', patterns: [/已批准|已通过|审批通过/] },
    { value: 'rejected', patterns: [/已驳回|已拒绝|拒绝/] },
    { value: 'disposing', patterns: [/处置中/] },
    { value: 'completed', patterns: [/已完成|完成/] },
  ];

  const match = mappings.find(item => item.patterns.some(pattern => pattern.test(sourceText)));
  return match?.value || null;
}

function pickWorkOrderStatus(text) {
  const sourceText = String(text || '');
  const mappings = [
    { value: 'pending_acceptance', patterns: [/待验收/] },
    { value: 'in_progress', patterns: [/进行中|处理中|维修中/] },
    { value: 'assigned', patterns: [/已分配|待处理/] },
    { value: 'pending', patterns: [/待分配|待派单|新建工单/] },
    { value: 'completed', patterns: [/已完成|完成/] },
    { value: 'closed', patterns: [/已关闭|关闭/] },
    { value: 'cancelled', patterns: [/已取消|取消/] },
  ];

  const match = mappings.find(item => item.patterns.some(pattern => pattern.test(sourceText)));
  return match?.value || null;
}

function pickWorkOrderPriority(text) {
  const sourceText = String(text || '');
  const mappings = [
    { value: 'urgent', patterns: [/紧急|特急/] },
    { value: 'high', patterns: [/高优先级|高优先/] },
    { value: 'medium', patterns: [/中优先级|普通优先级|普通/] },
    { value: 'low', patterns: [/低优先级|低优先/] },
  ];

  const match = mappings.find(item => item.patterns.some(pattern => pattern.test(sourceText)));
  return match?.value || null;
}

function detectMaintenanceIntent(latestUserMessage = '') {
  const sourceText = String(latestUserMessage || '');
  const limit = extractLimit(sourceText);
  const maintenanceKeywordMatch = sourceText.match(
    /(?:列出|查询|搜索|检索|查看|看看|查找)?\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40})\s*相关(?:维修日志|维护日志|维修记录|维护记录|维修历史|维护历史|维修工单|维护工单|工单)/i,
  );
  const searchKeyword =
    extractSearchKeyword(sourceText) ||
    normalizeSearchKeyword(maintenanceKeywordMatch?.[1], { excludeDepartmentLike: true });
  const assetIdentifier = extractAssetIdentifier(sourceText);
  const asksForMaintenanceData =
    MAINTENANCE_DATA_QUERY_RE.test(sourceText) ||
    LIST_QUERY_RE.test(sourceText) ||
    OVERVIEW_QUERY_RE.test(sourceText);

  if (
    MAINTENANCE_LOG_KEYWORD_RE.test(sourceText) &&
    (asksForMaintenanceData ||
      Boolean(searchKeyword) ||
      Boolean(assetIdentifier) ||
      /进行中|已完成|已取消|故障|保养|维护/.test(sourceText))
  ) {
    return {
      domain: 'maintenance_log',
      latestUserMessage: sourceText,
      limit,
      searchKeyword: searchKeyword || null,
      assetIdentifier: assetIdentifier || null,
      status: pickMaintenanceLogStatus(sourceText),
      maintenanceType: pickMaintenanceType(sourceText),
    };
  }

  if (
    WORKORDER_KEYWORD_RE.test(sourceText) &&
    (asksForMaintenanceData ||
      Boolean(searchKeyword) ||
      Boolean(assetIdentifier) ||
      /待处理|待分配|进行中|已完成|高优先级|紧急|优先级/.test(sourceText))
  ) {
    return {
      domain: 'maintenance_workorder',
      latestUserMessage: sourceText,
      limit,
      searchKeyword: searchKeyword || null,
      assetIdentifier: assetIdentifier || null,
      status: pickWorkOrderStatus(sourceText),
      priority: pickWorkOrderPriority(sourceText),
    };
  }

  return null;
}

function detectWorkflowIntent(latestUserMessage = '') {
  const sourceText = String(latestUserMessage || '');
  const limit = extractLimit(sourceText);
  const departmentKeyword = extractDepartmentKeyword(sourceText);
  const assetIdentifier = extractAssetIdentifier(sourceText);
  let searchKeyword = extractSearchKeyword(sourceText);

  if (searchKeyword && (searchKeyword === departmentKeyword || searchKeyword === assetIdentifier)) {
    searchKeyword = '';
  }

  const asksForWorkflowData =
    WORKFLOW_DATA_QUERY_RE.test(sourceText) ||
    LIST_QUERY_RE.test(sourceText) ||
    Boolean(searchKeyword) ||
    Boolean(departmentKeyword) ||
    Boolean(assetIdentifier) ||
    /进行中|已完成|已取消|待审批|待审核|已批准|发布中|已分配|鉴定中|评估中|处置中/.test(
      sourceText,
    );

  if (INVENTORY_RECORD_KEYWORD_RE.test(sourceText) && asksForWorkflowData) {
    return {
      domain: 'inventory',
      latestUserMessage: sourceText,
      limit,
      searchKeyword: searchKeyword || null,
      status: pickInventoryStatus(sourceText),
    };
  }

  if (TRANSFER_RECORD_KEYWORD_RE.test(sourceText) && asksForWorkflowData) {
    return {
      domain: 'transfer',
      latestUserMessage: sourceText,
      limit,
      searchKeyword: searchKeyword || null,
      departmentKeyword: departmentKeyword || null,
      assetIdentifier: assetIdentifier || null,
      status: pickTransferStatus(sourceText),
    };
  }

  if (IDLE_RECORD_KEYWORD_RE.test(sourceText) && asksForWorkflowData) {
    return {
      domain: 'idle',
      latestUserMessage: sourceText,
      limit,
      searchKeyword: searchKeyword || null,
      departmentKeyword: departmentKeyword || null,
      assetIdentifier: assetIdentifier || null,
      status: pickIdleStatus(sourceText),
    };
  }

  if (SCRAPPING_RECORD_KEYWORD_RE.test(sourceText) && asksForWorkflowData) {
    return {
      domain: 'scrapping',
      latestUserMessage: sourceText,
      limit,
      searchKeyword: searchKeyword || null,
      departmentKeyword: departmentKeyword || null,
      assetIdentifier: assetIdentifier || null,
      status: pickScrappingStatus(sourceText),
    };
  }

  return null;
}

function collectContextualHints(userMessages = [], latestIndex) {
  const hints = {
    departmentKeyword: null,
    searchKeyword: null,
    assetIdentifier: null,
    status: null,
    sortField: null,
    sortOrder: null,
  };

  for (let index = latestIndex - 1; index >= 0; index -= 1) {
    const message = userMessages[index] || '';
    const departmentKeyword = extractDepartmentKeyword(message);
    const searchKeyword = extractSearchKeyword(message);
    const assetIdentifier = extractAssetIdentifier(message);
    const status = pickAssetStatus(message);
    const sortPreference = detectAssetSortPreference(message);

    if (!hints.departmentKeyword && departmentKeyword) {
      hints.departmentKeyword = departmentKeyword;
    }
    if (!hints.searchKeyword && searchKeyword) {
      hints.searchKeyword = searchKeyword;
    }
    if (!hints.assetIdentifier && assetIdentifier) {
      hints.assetIdentifier = assetIdentifier;
    }
    if (!hints.status && status) {
      hints.status = status;
    }
    if (!hints.sortField && sortPreference.sortField) {
      hints.sortField = sortPreference.sortField;
      hints.sortOrder = sortPreference.sortOrder || null;
    }

    if (
      hints.departmentKeyword &&
      hints.searchKeyword &&
      hints.assetIdentifier &&
      hints.status &&
      hints.sortField
    ) {
      break;
    }
  }

  return hints;
}

function shouldInheritContextForAssetFollowUp(
  latestUserMessage = '',
  recentContext = '',
  hasPriorAssetScope = false,
) {
  const sourceText = String(latestUserMessage || '').trim();
  if (!sourceText) {
    return false;
  }

  if (!ASSET_KEYWORD_RE.test(String(recentContext || '')) && !hasPriorAssetScope) {
    return false;
  }

  return (
    ASSET_FOLLOW_UP_RE.test(sourceText) ||
    ASSET_REFINE_FOLLOW_UP_RE.test(sourceText) ||
    FULL_LIST_QUERY_RE.test(sourceText) ||
    NEXT_PAGE_QUERY_RE.test(sourceText) ||
    PREVIOUS_PAGE_QUERY_RE.test(sourceText) ||
    EXPLICIT_PAGE_QUERY_RE.test(sourceText) ||
    EXPORT_ASSET_QUERY_RE.test(sourceText) ||
    /^(全部|所有|全部明细|全部列表|完整明细|完整列表|全量明细|全量列表)$/i.test(sourceText)
  );
}

function collectAssistantPaginationHints(messages = []) {
  if (!Array.isArray(messages)) {
    return null;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (item?.role !== 'assistant') {
      continue;
    }

    const text = extractText(item?.content);
    if (!text || !/资产/.test(text)) {
      continue;
    }

    const pageMatch = text.match(/第\s*(\d{1,3})\s*页/);
    const pageSizeMatch = text.match(/每页\s*(\d{1,3})\s*项/);
    const displayRangeMatch = text.match(/第\s*(\d{1,6})\s*-\s*(\d{1,6})\s*项/);
    const totalMatch = text.match(/共\s*(\d{1,9})\s*项/);
    const hasPaginationHint = Boolean(pageMatch || pageSizeMatch || displayRangeMatch);

    if (!hasPaginationHint && !totalMatch) {
      continue;
    }

    const page = hasPaginationHint ? clamp(parseInteger(pageMatch?.[1]) || 1, 1, 999) : null;
    const pageSize = hasPaginationHint
      ? clamp(
          parseInteger(pageSizeMatch?.[1]) ||
            (displayRangeMatch
              ? parseInteger(displayRangeMatch[2]) - parseInteger(displayRangeMatch[1]) + 1
              : DEFAULT_LIST_LIMIT),
          1,
          100,
        ) || DEFAULT_LIST_LIMIT
      : null;

    return {
      page,
      pageSize,
      total: parseInteger(totalMatch?.[1]),
    };
  }

  return null;
}

function getRecentUserMessages(messages = []) {
  return Array.isArray(messages)
    ? messages
        .filter(item => item?.role === 'user')
        .map(item => extractText(item?.content))
        .filter(Boolean)
    : [];
}

function detectIntent(messages = []) {
  const userMessages = getRecentUserMessages(messages);
  const latestUserMessage = userMessages[userMessages.length - 1] || '';
  if (!latestUserMessage) {
    return null;
  }

  const recentContext = userMessages.slice(-3).join('\n');
  const isAnalysisRequest = ANALYSIS_REQUEST_RE.test(latestUserMessage);
  const isDepreciationQuery =
    DEPRECIATION_KEYWORD_RE.test(latestUserMessage) ||
    (DEPRECIATION_KEYWORD_RE.test(recentContext) &&
      (DEPRECIATION_FOLLOW_UP_RE.test(latestUserMessage) || isAnalysisRequest));
  let departmentKeyword = extractDepartmentKeyword(latestUserMessage);
  let searchKeyword = extractSearchKeyword(latestUserMessage);
  const contextualHints = collectContextualHints(userMessages, userMessages.length - 1);
  const assistantPaginationHints = collectAssistantPaginationHints(messages);
  const hasPriorAssetScope = Boolean(
    assistantPaginationHints ||
      contextualHints.departmentKeyword ||
      contextualHints.searchKeyword ||
      contextualHints.assetIdentifier ||
      contextualHints.status ||
      contextualHints.sortField,
  );
  const isAssetFollowUp = shouldInheritContextForAssetFollowUp(
    latestUserMessage,
    recentContext,
    hasPriorAssetScope,
  );

  if (
    isDepreciationQuery &&
    (DEPRECIATION_DATA_QUERY_RE.test(latestUserMessage) ||
      (DEPRECIATION_KEYWORD_RE.test(latestUserMessage) &&
        /(多少|情况|统计|汇总|数据|明细|详情|列表|列出|趋势|分析)/.test(latestUserMessage)) ||
      (DEPRECIATION_KEYWORD_RE.test(recentContext) && isAnalysisRequest))
  ) {
    let status = pickAssetStatus(latestUserMessage);

    if (isAnalysisRequest) {
      departmentKeyword = departmentKeyword || contextualHints.departmentKeyword;
      searchKeyword = searchKeyword || contextualHints.searchKeyword;
      status = status || contextualHints.status;
    }

    return {
      domain: 'depreciation',
      latestUserMessage,
      wantsOverview: false,
      wantsList: false,
      wantsDetail: false,
      wantsAnalysis: isAnalysisRequest,
      depreciationGroupBy: detectDepreciationGrouping(latestUserMessage),
      departmentKeyword: departmentKeyword || null,
      searchKeyword: searchKeyword || null,
      status: status || null,
      limit: extractLimit(latestUserMessage),
    };
  }

  const hasAssetDomain =
    ASSET_KEYWORD_RE.test(latestUserMessage) ||
    (hasPriorAssetScope && isAssetFollowUp) ||
    (ASSET_KEYWORD_RE.test(recentContext) &&
      (ASSET_FOLLOW_UP_RE.test(latestUserMessage) || isAnalysisRequest || isAssetFollowUp));
  const hasImplicitDepartmentListIntent = Boolean(
    departmentKeyword || (isAnalysisRequest && contextualHints.departmentKeyword),
  );
  const maintenanceIntent = detectMaintenanceIntent(latestUserMessage);
  const workflowIntent = detectWorkflowIntent(latestUserMessage);
  const directoryIntent = detectDirectoryIntent(latestUserMessage);
  const operationalIntent = detectOperationalIntent(latestUserMessage);
  const hasImplicitSearchListIntent = Boolean(searchKeyword && !directoryIntent && !operationalIntent);
  const hasExplicitKeywordAssetSearch = Boolean(
    searchKeyword &&
      /(关键词|关键字)/.test(latestUserMessage) &&
      !directoryIntent &&
      !operationalIntent,
  );

  if (
    (!hasAssetDomain && !hasExplicitKeywordAssetSearch) ||
    (!ASSET_DATA_QUERY_RE.test(latestUserMessage) &&
      !hasImplicitDepartmentListIntent &&
      !hasImplicitSearchListIntent &&
      !hasExplicitKeywordAssetSearch &&
      !isAssetFollowUp)
  ) {
    return maintenanceIntent || workflowIntent || operationalIntent || directoryIntent;
  }

  if (workflowIntent) {
    return workflowIntent;
  }

  let assetIdentifier = extractAssetIdentifier(latestUserMessage);
  let status = pickAssetStatus(latestUserMessage);
  let { sortField, sortOrder } = detectAssetSortPreference(latestUserMessage);
  if (status === '维修' && /(维修情况|维护情况|维修记录|维护记录|维修日志|维护日志|维修工单|维护工单)/.test(latestUserMessage)) {
    status = null;
  }

  if (isAnalysisRequest) {
    departmentKeyword = departmentKeyword || contextualHints.departmentKeyword;
    searchKeyword = searchKeyword || contextualHints.searchKeyword;
    assetIdentifier = assetIdentifier || contextualHints.assetIdentifier;
    status = status || contextualHints.status;
    sortField = sortField || contextualHints.sortField;
    sortOrder = sortOrder || contextualHints.sortOrder;
  }

  const wantsDetail = Boolean(assetIdentifier);
  const wantsFullList = FULL_LIST_QUERY_RE.test(latestUserMessage);
  const wantsExport = EXPORT_ASSET_QUERY_RE.test(latestUserMessage);
  const shouldMergeListContext =
    !isAnalysisRequest &&
    !wantsDetail &&
    isAssetFollowUp;

  let requestedPage = 1;
  const explicitLimit = extractExplicitLimit(latestUserMessage);
  let resolvedLimit = extractLimit(latestUserMessage);

  if (shouldMergeListContext) {
    departmentKeyword = departmentKeyword || contextualHints.departmentKeyword || null;
    searchKeyword = searchKeyword || contextualHints.searchKeyword || null;
    status = status || contextualHints.status || null;
    sortField = sortField || contextualHints.sortField || null;
    sortOrder = sortOrder || contextualHints.sortOrder || null;

    if (
      explicitLimit === null &&
      assistantPaginationHints?.pageSize &&
      !NEXT_PAGE_QUERY_RE.test(latestUserMessage) &&
      !PREVIOUS_PAGE_QUERY_RE.test(latestUserMessage) &&
      !EXPLICIT_PAGE_QUERY_RE.test(latestUserMessage)
    ) {
      resolvedLimit = assistantPaginationHints.pageSize;
    }

    if (NEXT_PAGE_QUERY_RE.test(latestUserMessage) && assistantPaginationHints?.pageSize) {
      requestedPage = assistantPaginationHints.page + 1;
      resolvedLimit = assistantPaginationHints.pageSize;
    } else if (PREVIOUS_PAGE_QUERY_RE.test(latestUserMessage) && assistantPaginationHints?.pageSize) {
      requestedPage = Math.max(1, assistantPaginationHints.page - 1);
      resolvedLimit = assistantPaginationHints.pageSize;
    } else {
      const explicitPageMatch = latestUserMessage.match(EXPLICIT_PAGE_QUERY_RE);
      if (explicitPageMatch?.[1]) {
        requestedPage = clamp(Number.parseInt(explicitPageMatch[1], 10), 1, 999);
        resolvedLimit = assistantPaginationHints?.pageSize || resolvedLimit;
      }
    }

    if (
      wantsFullList &&
      explicitLimit === null &&
      !assistantPaginationHints?.pageSize &&
      !NEXT_PAGE_QUERY_RE.test(latestUserMessage) &&
      !PREVIOUS_PAGE_QUERY_RE.test(latestUserMessage)
    ) {
      resolvedLimit = ASSET_FOLLOW_UP_FULL_LIST_LIMIT;
    } else if (
      explicitLimit === null &&
      assistantPaginationHints?.pageSize &&
      requestedPage > 1
    ) {
      resolvedLimit = assistantPaginationHints.pageSize;
    }
  }

  const wantsList =
    !wantsExport &&
    (wantsFullList ||
      LIST_QUERY_RE.test(latestUserMessage) ||
      Boolean((searchKeyword || departmentKeyword || sortField) && !wantsDetail));
  const wantsAnalysis = isAnalysisRequest;
  const wantsOverview =
    (!wantsExport &&
      !wantsAnalysis &&
      OVERVIEW_QUERY_RE.test(latestUserMessage)) ||
    (!wantsExport && !wantsAnalysis && !wantsList && !wantsDetail);

  return {
    domain: 'asset',
    latestUserMessage,
    wantsOverview,
    wantsList,
    wantsFullList,
    wantsExport,
    wantsDetail,
    wantsAnalysis,
    assetIdentifier: assetIdentifier || null,
    searchKeyword: searchKeyword || null,
    departmentKeyword: departmentKeyword || null,
    status: status || null,
    sortField: sortField || null,
    sortOrder: sortOrder || null,
    page: requestedPage,
    limit: resolvedLimit,
    exportFormat: wantsExport ? detectExportFormat(latestUserMessage) : null,
    totalHint: assistantPaginationHints?.total ?? null,
  };
}

function buildHeaders(authContext = {}) {
  const headers = {};

  if (authContext.authHeader) {
    headers.Authorization = authContext.authHeader;
  }

  if (authContext.tenantId) {
    headers['X-Tenant-ID'] = String(authContext.tenantId);
  }

  return headers;
}

async function requestBackend(pathname, authContext = {}, params = undefined) {
  const response = await axios.get(`${loadBackendBaseUrl()}${pathname}`, {
    headers: buildHeaders(authContext),
    params,
    timeout: resolveTimeoutForPath(pathname),
    validateStatus: () => true,
  });

  if (response.status === 404) {
    return {
      notFound: true,
      data: response.data || null,
    };
  }

  if (response.status >= 400) {
    const error = new Error(response.data?.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.body = response.data || null;
    throw error;
  }

  return {
    notFound: false,
    data: response.data,
  };
}

function resolveTimeoutForPath(pathname = '') {
  const normalizedPath = String(pathname || '');

  if (normalizedPath === '/api/assets/all') {
    return FULL_ASSET_LIST_TIMEOUT_MS;
  }

  if (normalizedPath === '/api/assets') {
    return ASSET_LIST_TIMEOUT_MS;
  }

  if (
    normalizedPath === '/api/maintenance/logs' ||
    normalizedPath === '/api/maintenance/workorders'
  ) {
    return MAINTENANCE_QUERY_TIMEOUT_MS;
  }

  return DEFAULT_TIMEOUT_MS;
}

function isTimeoutError(error) {
  return (
    error?.code === 'ECONNABORTED' ||
    /timeout/i.test(String(error?.message || ''))
  );
}

async function requestBackendAllPages(pathname, authContext = {}, params = {}, options = {}) {
  const getItems =
    typeof options.getItems === 'function'
      ? options.getItems
      : payload => (Array.isArray(payload?.data) ? payload.data : []);
  const getPagination =
    typeof options.getPagination === 'function'
      ? options.getPagination
      : payload => payload?.pagination || payload?.data?.pagination || null;
  const pageSize = clamp(parseInteger(options.pageSize) || 200, 20, 500);
  const maxPages = clamp(parseInteger(options.maxPages) || 50, 1, 100);

  const items = [];
  let total = null;
  let page = 1;
  let truncated = false;

  while (page <= maxPages) {
    const result = await requestBackend(pathname, authContext, {
      ...params,
      page,
      pageSize,
    });
    const pageItems = getItems(result.data);
    const pagination = getPagination(result.data) || {};

    items.push(...pageItems);
    total = parseInteger(pagination.total) ?? total;

    const totalPages =
      parseInteger(pagination.totalPages) ?? (total ? Math.ceil(total / pageSize) : null);
    const hasMore = totalPages ? page < totalPages : pageItems.length >= pageSize;

    if (!hasMore) {
      break;
    }

    page += 1;
  }

  if (page >= maxPages && total !== null && items.length < total) {
    truncated = true;
  }

  return {
    items,
    total: total ?? items.length,
    truncated,
  };
}

function buildScope(authContext = {}) {
  return {
    tenantId: parseInteger(authContext.tenantId),
    userId: authContext.userId ? String(authContext.userId) : null,
    username: authContext.username || null,
    role: authContext.role || null,
  };
}

function buildRestrictions() {
  return [
    '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
    '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
  ];
}

function buildContextWarnings(scope, authContext = {}) {
  const warnings = [];

  if (!authContext.authHeader) {
    warnings.push('当前请求缺少 Authorization，无法按当前登录用户实时查询 AssetHub 数据。');
  }

  if (!scope.tenantId) {
    warnings.push('当前请求未携带有效租户，无法生成当前租户实时数据。');
  }

  return warnings;
}

function buildLightContextPayload({ messages = [], authContext = {} } = {}) {
  const intent = detectIntent(messages);
  if (!intent) {
    return null;
  }

  const scope = buildScope(authContext);
  const warnings = buildContextWarnings(scope, authContext);

  return {
    source: 'assethub-backend-proxy',
    authoritative: true,
    generatedAt: new Date().toISOString(),
    scope,
    intent,
    restrictions:
      warnings.length > 0
        ? [
            '没有当前登录用户或当前租户的实时数据时，不要用共享 MCP 账号替代回答租户敏感数据。',
            '此时应明确提示用户重新登录或选择企业空间。',
          ]
        : buildRestrictions(),
    warnings,
    data: {},
  };
}

function normalizeFilterText(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesKeyword(value, keyword) {
  const normalizedKeyword = normalizeFilterText(keyword);
  if (!normalizedKeyword) {
    return true;
  }

  return normalizeFilterText(value).includes(normalizedKeyword);
}

function matchesAnyKeyword(item, fields = [], keyword) {
  const normalizedKeyword = normalizeFilterText(keyword);
  if (!normalizedKeyword) {
    return true;
  }

  return fields.some(field => matchesKeyword(item?.[field], normalizedKeyword));
}

function matchesDepartmentValue(value, departmentKeyword) {
  const normalizedDepartment = normalizeFilterText(departmentKeyword);
  if (!normalizedDepartment) {
    return true;
  }

  return normalizeFilterText(value).includes(normalizedDepartment);
}

function filterTransferItems(items = [], filters = {}) {
  return items.filter(item => {
    if (filters.status && item?.status !== filters.status) {
      return false;
    }

    if (
      filters.assetCode &&
      !(matchesKeyword(item?.asset_code, filters.assetCode) || matchesKeyword(item?.asset_name, filters.assetCode))
    ) {
      return false;
    }

    if (
      filters.department &&
      !(
        matchesDepartmentValue(item?.from_department, filters.department) ||
        matchesDepartmentValue(item?.to_department, filters.department)
      )
    ) {
      return false;
    }

    if (
      filters.keyword &&
      !matchesAnyKeyword(
        item,
        [
          'transfer_no',
          'asset_code',
          'asset_name',
          'from_department',
          'to_department',
          'status',
          'transfer_reason',
          'applicant',
          'approved_by',
          'remark',
        ],
        filters.keyword,
      )
    ) {
      return false;
    }

    return true;
  });
}

function filterInventoryItems(items = [], filters = {}) {
  return items.filter(item => {
    if (filters.status && item?.status !== filters.status) {
      return false;
    }

    if (
      filters.keyword &&
      !matchesAnyKeyword(
        item,
        ['inventory_no', 'inventory_type', 'inventory_person', 'status', 'remark'],
        filters.keyword,
      )
    ) {
      return false;
    }

    return true;
  });
}

function filterIdleItems(items = [], filters = {}) {
  return items.filter(item => {
    if (filters.status && item?.status !== filters.status) {
      return false;
    }

    if (
      filters.assetCode &&
      !(matchesKeyword(item?.asset_code, filters.assetCode) || matchesKeyword(item?.asset_name, filters.assetCode))
    ) {
      return false;
    }

    if (filters.department && !matchesDepartmentValue(item?.department, filters.department)) {
      return false;
    }

    if (
      filters.keyword &&
      !matchesAnyKeyword(
        item,
        [
          'asset_code',
          'asset_name',
          'department',
          'location',
          'brand',
          'model',
          'specification',
          'asset_status',
          'status',
          'remark',
        ],
        filters.keyword,
      )
    ) {
      return false;
    }

    return true;
  });
}

function filterScrappingItems(items = [], filters = {}) {
  return items.filter(item => {
    if (filters.status && item?.current_status !== filters.status) {
      return false;
    }

    if (
      filters.assetCode &&
      !(matchesKeyword(item?.asset_code, filters.assetCode) || matchesKeyword(item?.asset_name, filters.assetCode))
    ) {
      return false;
    }

    if (filters.department && !matchesDepartmentValue(item?.department, filters.department)) {
      return false;
    }

    if (
      filters.keyword &&
      !matchesAnyKeyword(
        item,
        [
          'asset_code',
          'asset_name',
          'department',
          'applicant',
          'scrapping_reason',
          'remark',
          'current_status',
        ],
        filters.keyword,
      )
    ) {
      return false;
    }

    return true;
  });
}

function summarizeOverview(payload) {
  const overview = payload?.data?.overview || {};

  return {
    totalCount: parseInteger(overview.total_count),
    totalValue: parseNumber(overview.total_value),
    inUseCount: parseInteger(overview.in_use_count),
    idleCount: parseInteger(overview.idle_count),
    repairCount: parseInteger(overview.repair_count),
    scrapCount: parseInteger(overview.scrap_count),
    transferCount: parseInteger(overview.transfer_count),
  };
}

function summarizeAssetList(payload, filters = {}) {
  const list = Array.isArray(payload?.data?.list) ? payload.data.list : [];
  const pagination = payload?.data?.pagination || {};
  const page = parseInteger(pagination.page) || 1;
  const pageSize = parseInteger(pagination.pageSize) || list.length || DEFAULT_LIST_LIMIT;
  const total = parseInteger(pagination.total) ?? list.length;
  const displayStart = list.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const displayEnd = list.length > 0 ? displayStart + list.length - 1 : 0;

  return {
    total,
    returnedCount: list.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / Math.max(pageSize, 1))),
    displayStart,
    displayEnd,
    filters,
    sortField: filters.sortField || null,
    sortOrder: filters.sortOrder || null,
    items: list.map(item => ({
      id: item.id ?? null,
      assetCode: item.asset_code || null,
      assetName: item.asset_name || null,
      status: item.status || null,
      categoryName: item.category_name || null,
      departmentName: item.department_name || item.department_new || null,
      location: item.location || item.latest_location?.location || null,
      brand: item.brand || null,
      model: item.model || null,
      responsiblePersonName: item.responsible_person_name || null,
      purchasePrice: parseNumber(item.purchase_price),
      currentValue: parseNumber(item.current_value),
    })),
  };
}

function summarizeFullAssetList(payload, filters = {}, options = DEFAULT_LIST_LIMIT) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  const normalizedOptions =
    typeof options === 'number'
      ? { page: 1, pageSize: options }
      : options && typeof options === 'object'
      ? options
      : {};
  const pageSize = clamp(parseInteger(normalizedOptions.pageSize) || DEFAULT_LIST_LIMIT, 1, 100);
  const total = parseInteger(payload?.total) ?? list.length;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
  const page = clamp(parseInteger(normalizedOptions.page) || 1, 1, totalPages);
  const startIndex = (page - 1) * pageSize;
  const sampledItems = list.slice(startIndex, startIndex + pageSize);
  const displayStart = sampledItems.length > 0 ? startIndex + 1 : 0;
  const displayEnd = sampledItems.length > 0 ? startIndex + sampledItems.length : 0;

  return {
    total,
    returnedCount: sampledItems.length,
    page,
    pageSize,
    totalPages,
    displayStart,
    displayEnd,
    filters,
    sortField: filters.sortField || null,
    sortOrder: filters.sortOrder || null,
    fullDataset: true,
    items: sampledItems.map(item => ({
      id: item.id ?? null,
      assetCode: item.asset_code || null,
      assetName: item.asset_name || null,
      status: item.status || null,
      categoryName: item.category_name || null,
      departmentName: item.department_name || item.department_new || null,
      location: item.location || item.latest_location?.location || null,
      brand: item.brand || null,
      model: item.model || null,
      responsiblePersonName: item.responsible_person_name || null,
      purchasePrice: parseNumber(item.purchase_price),
      currentValue: parseNumber(item.current_value),
    })),
  };
}

function summarizeAssetExport(filters = {}, options = {}) {
  const normalizedFilters = {
    search: filters.search || null,
    department: filters.department || null,
    status: filters.status || null,
  };
  const format = detectExportFormat(options.format);
  const alternateFormat = format === 'csv' ? 'xlsx' : 'csv';
  const buildQueryString = targetFormat =>
    stringifyQueryParams({
      format: targetFormat,
      search: normalizedFilters.search,
      department: normalizedFilters.department,
      status: normalizedFilters.status,
      sortField: options.sortField || null,
      sortOrder: options.sortOrder || null,
    });
  const queryString = buildQueryString(format);
  const alternateQueryString = buildQueryString(alternateFormat);

  return {
    format,
    alternateFormat,
    total: parseInteger(options.total) || null,
    filters: normalizedFilters,
    sortField: options.sortField || null,
    sortOrder: options.sortOrder || null,
    apiPath: `/assets/export${queryString ? `?${queryString}` : ''}`,
    downloadUrl: `assethub://assets-export${queryString ? `?${queryString}` : ''}`,
    alternateApiPath: `/assets/export${alternateQueryString ? `?${alternateQueryString}` : ''}`,
    alternateDownloadUrl: `assethub://assets-export${alternateQueryString ? `?${alternateQueryString}` : ''}`,
  };
}

function summarizeAssetDetail(payload) {
  const asset = payload?.data || {};

  return {
    id: asset.id ?? null,
    assetCode: asset.asset_code || null,
    assetName: asset.asset_name || null,
    status: asset.status || null,
    categoryName: asset.category_name || null,
    departmentName: asset.department_name || asset.department_new || null,
    location: asset.location || asset.latest_location?.location || null,
    brand: asset.brand || null,
    model: asset.model || null,
    specification: asset.specification || null,
    purchaseDate: asset.purchase_date || null,
    purchasePrice: parseNumber(asset.purchase_price),
    currentValue: parseNumber(asset.current_value),
    responsiblePersonName: asset.responsible_person_name || null,
    responsiblePersonEmail: asset.responsible_person_email || null,
    responsiblePersonPhone: asset.responsible_person_phone || null,
    maintenanceStats: asset.maintenance_stats || null,
    qualityStats: asset.quality_stats || null,
  };
}

function summarizeAssetAnalysis(payload, filters = {}) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  const byStatusMap = new Map();
  const byCategoryMap = new Map();
  const byLocationMap = new Map();
  let totalValue = 0;
  let missingDepartmentCount = 0;
  let missingResponsibleCount = 0;

  list.forEach(item => {
    const status = item.status || '未知';
    const category = item.category_name || '未分类';
    const location = item.location || item.latest_location?.location || '未标记位置';
    const currentValue = parseNumber(item.current_value);
    const purchaseValue = parseNumber(item.purchase_price);
    const normalizedValue = currentValue ?? purchaseValue ?? 0;

    byStatusMap.set(status, (byStatusMap.get(status) || 0) + 1);
    byCategoryMap.set(category, (byCategoryMap.get(category) || 0) + 1);
    byLocationMap.set(location, (byLocationMap.get(location) || 0) + 1);
    totalValue += normalizedValue;

    if (!(item.department_name || item.department_new || item.department)) {
      missingDepartmentCount += 1;
    }

    if (!(item.responsible_person_name || item.responsible_person)) {
      missingResponsibleCount += 1;
    }
  });

  const toTopItems = (map, keyName) =>
    Array.from(map.entries())
      .map(([name, count]) => ({ [keyName]: name, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);

  return {
    total: list.length,
    totalValue,
    filters,
    byStatus: toTopItems(byStatusMap, 'status'),
    topCategories: toTopItems(byCategoryMap, 'category'),
    topLocations: toTopItems(byLocationMap, 'location'),
    missingDepartmentCount,
    missingResponsibleCount,
  };
}

function summarizeDepreciationOverview(payload, filters = {}) {
  const data = payload?.data || {};
  const summary = data.summary || {};
  const assets = Array.isArray(data.assets) ? data.assets : [];

  return {
    totalAssets: parseInteger(summary.totalAssets) ?? assets.length,
    totalPurchasePrice: parseNumber(summary.totalPurchasePrice),
    totalAccumulatedDepreciation: parseNumber(summary.totalAccumulatedDepreciation),
    totalBookValue: parseNumber(summary.totalBookValue),
    averageDepreciationRate: parseNumber(summary.averageDepreciationRate),
    asOfDate: data.asOfDate || null,
    methodLabel: data.methodLabel || null,
    filters,
    items: assets.slice(0, DEFAULT_LIST_LIMIT).map(item => ({
      id: item.id ?? null,
      assetCode: item.asset_code || null,
      assetName: item.asset_name || null,
      departmentName: item.department_display || item.department || item.department_new || null,
      purchasePrice: parseNumber(item.depreciation?.purchasePrice ?? item.purchase_price),
      accumulatedDepreciation: parseNumber(item.depreciation?.accumulatedDepreciation),
      currentBookValue: parseNumber(item.depreciation?.currentBookValue),
      depreciationRate: parseNumber(item.depreciation?.depreciationRate),
    })),
  };
}

function summarizeDepreciationGroup(payload, groupBy, filters = {}) {
  const data = payload?.data || {};

  if (groupBy === 'month') {
    const trend = Array.isArray(data.trend) ? data.trend : [];
    return {
      groupBy,
      months: parseInteger(data.months) ?? trend.length,
      asOfDate: data.asOfDate || null,
      methodLabel: data.methodLabel || null,
      filters,
      items: trend.map(item => ({
        month: item.month || null,
        totalPurchasePrice: parseNumber(item.totalPurchasePrice),
        totalAccumulatedDepreciation: parseNumber(item.totalAccumulatedDepreciation),
        totalBookValue: parseNumber(item.totalBookValue),
        averageDepreciationRate: parseNumber(item.averageDepreciationRate),
      })),
    };
  }

  const summaries = Array.isArray(data.summaries) ? data.summaries : [];
  const nameKey = groupBy === 'department' ? 'departmentName' : 'assetType';

  return {
    groupBy,
    asOfDate: data.asOfDate || null,
    methodLabel: data.methodLabel || null,
    filters,
    items: summaries.map(item => ({
      name: item[nameKey] || '未分类',
      assetCount: parseInteger(item.assetCount) || 0,
      totalPurchasePrice: parseNumber(item.totalPurchasePrice),
      totalAccumulatedDepreciation: parseNumber(item.totalAccumulatedDepreciation),
      totalBookValue: parseNumber(item.totalBookValue),
      depreciationRate: parseNumber(item.depreciationRate),
    })),
  };
}

function summarizeRoleList(payload, options = {}) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  const limit = clamp(parseInteger(options.limit) || DEFAULT_LIST_LIMIT, 1, 20);
  const items = list.slice(0, limit);

  return {
    total: list.length,
    returnedCount: items.length,
    items: items.map(item => ({
      roleCode: item.role_code || item.role || item.value || null,
      roleName: item.role_name || item.label || item.role || item.value || null,
      description: item.description || null,
    })),
  };
}

function flattenMenuDefinitions(value, parentKey = null, collector = []) {
  if (!Array.isArray(value)) {
    return collector;
  }

  value.forEach(item => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const menuKey = item.menu_key || item.key || null;
    const menuLabel = item.menu_label || item.label || null;
    const nextParentKey = item.parent_key || parentKey || null;

    if (menuKey) {
      collector.push({
        menuKey,
        menuLabel,
        parentKey: nextParentKey,
      });
    }

    if (Array.isArray(item.children) && item.children.length > 0) {
      flattenMenuDefinitions(item.children, menuKey || nextParentKey, collector);
    }
  });

  return collector;
}

function summarizeManagedDepartmentList(items = [], departmentCodes = []) {
  const codes = Array.isArray(departmentCodes) ? departmentCodes.filter(Boolean) : [];
  const allItems = Array.isArray(items) ? items : [];
  const filteredItems =
    codes.includes('*') || codes.length === 0
      ? allItems
      : allItems.filter(item => codes.includes(item.departmentCode));

  return {
    total: filteredItems.length,
    returnedCount: filteredItems.length,
    items: filteredItems.map(item => ({
      departmentCode: item.departmentCode || null,
      departmentName: item.departmentName || null,
      level: item.level ?? null,
    })),
  };
}

function summarizeMenuVisibility(visibleKeys = [], payload, options = {}) {
  const limit = clamp(parseInteger(options.limit) || DEFAULT_LIST_LIMIT, 1, 20);
  const normalizedKeys = Array.isArray(visibleKeys) ? Array.from(new Set(visibleKeys.filter(Boolean))) : [];
  const definitions = flattenMenuDefinitions(payload?.data || payload?.data?.menus || []);
  const definitionMap = new Map(definitions.map(item => [item.menuKey, item]));
  const items = normalizedKeys.map(menuKey => {
    const definition = definitionMap.get(menuKey) || {};
    const parentDefinition = definition.parentKey ? definitionMap.get(definition.parentKey) || {} : {};
    let topDefinition = definition.menuKey ? definition : { menuKey, menuLabel: definition.menuLabel || menuKey };
    let currentParentKey = definition.parentKey || null;
    let guard = 0;

    while (currentParentKey && definitionMap.has(currentParentKey) && guard < 10) {
      topDefinition = definitionMap.get(currentParentKey) || topDefinition;
      currentParentKey = topDefinition.parentKey || null;
      guard += 1;
    }

    return {
      menuKey,
      menuLabel: definition.menuLabel || menuKey,
      parentKey: definition.parentKey || null,
      parentLabel: parentDefinition.menuLabel || null,
      topGroupKey: topDefinition.menuKey || menuKey,
      topGroupLabel: topDefinition.menuLabel || definition.menuLabel || menuKey,
    };
  });

  return {
    total: items.length,
    returnedCount: Math.min(items.length, limit),
    source: payload?.data?.source || null,
    items: items.slice(0, limit),
  };
}

function summarizeEnabledModules(moduleIds = [], payload, options = {}) {
  const limit = clamp(parseInteger(options.limit) || DEFAULT_LIST_LIMIT, 1, 50);
  const normalized = Array.isArray(moduleIds)
    ? Array.from(new Set(moduleIds.map(item => String(item || '').trim()).filter(Boolean)))
    : [];
  const definitions = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  const definitionMap = new Map(
    definitions
      .map(item => {
        const moduleId = String(item?.module_id || item?.id || '').trim();
        if (!moduleId) {
          return null;
        }

        return [
          moduleId,
          {
            moduleName: item?.name || item?.module_info?.name || null,
            category: item?.category || item?.module_info?.category || null,
          },
        ];
      })
      .filter(Boolean),
  );

  return {
    total: normalized.length,
    returnedCount: Math.min(normalized.length, limit),
    items: normalized.slice(0, limit).map(moduleId => ({
      moduleId,
      moduleName: definitionMap.get(moduleId)?.moduleName || null,
      category: definitionMap.get(moduleId)?.category || null,
    })),
  };
}

function summarizeAuditLogList(payload, filters = {}) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  const pagination = payload?.pagination || {};
  const normalizedFilters = {
    ...filters,
    moduleLabel: getAuditModuleLabel(filters.module),
    actionLabel: getAuditActionLabel(filters.actionType),
  };

  return {
    total: parseInteger(pagination.total) ?? list.length,
    returnedCount: list.length,
    page: parseInteger(pagination.page) || 1,
    pageSize: parseInteger(pagination.pageSize) || list.length,
    filters: normalizedFilters,
    items: list.map(item => ({
      id: item.id ?? null,
      username: item.username || null,
      realName: item.real_name || null,
      actionType: item.action_type || null,
      actionLabel: getAuditActionLabel(item.action_type),
      module: item.module || null,
      moduleLabel: getAuditModuleLabel(item.module),
      resourceType: item.resource_type || null,
      resourceName: item.resource_name || null,
      actionDescription: item.action_description || null,
      responseStatus: parseInteger(item.response_status),
      createdAt: item.created_at || null,
    })),
  };
}

function summarizeAuditStats(payload) {
  const data = payload?.data || {};

  const normalizeItems = (items, getLabel = null) =>
    (Array.isArray(items) ? items : []).map(item => ({
      name:
        item.action_type ||
        item.module ||
        item.username ||
        item.real_name ||
        item.date ||
        '未知',
      label:
        typeof getLabel === 'function'
          ? getLabel(item)
          : item.action_type ||
            item.module ||
            item.username ||
            item.real_name ||
            item.date ||
            '未知',
      count: parseInteger(item.count) || 0,
      date: item.date || null,
      username: item.username || null,
      realName: item.real_name || null,
    }));

  return {
    actionTypeStats: normalizeItems(data.action_type_stats, item =>
      getAuditActionLabel(item.action_type || '未知'),
    ),
    moduleStats: normalizeItems(data.module_stats, item =>
      getAuditModuleLabel(item.module || '未知'),
    ),
    userStats: normalizeItems(data.user_stats),
    dailyStats: normalizeItems(data.daily_stats),
  };
}

function summarizeMaintenanceLogList(payload, filters = {}) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  const pagination = payload?.pagination || {};

  return {
    total: parseInteger(pagination.total) ?? list.length,
    returnedCount: list.length,
    page: parseInteger(pagination.page) || 1,
    pageSize: parseInteger(pagination.pageSize) || list.length,
    filters,
    items: list.map(item => ({
      id: item.id ?? null,
      assetCode: item.asset_code || null,
      assetName: item.asset_name || null,
      maintenanceType: item.maintenance_type || null,
      maintenanceDate: item.maintenance_date || null,
      maintenancePerson: item.maintenance_person || null,
      status: item.status || null,
      department: item.department || null,
      location: item.location || null,
      maintenanceContent: item.maintenance_content || null,
      maintenanceCost: parseNumber(item.maintenance_cost),
    })),
  };
}

function summarizeWorkOrderList(payload, filters = {}) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  const pagination = payload?.pagination || {};

  return {
    total: parseInteger(pagination.total) ?? list.length,
    returnedCount: list.length,
    page: parseInteger(pagination.page) || 1,
    pageSize: parseInteger(pagination.pageSize) || list.length,
    filters,
    items: list.map(item => ({
      id: item.id ?? null,
      workOrderNo: item.work_order_no || null,
      title: item.title || null,
      assetCode: item.asset_code || null,
      assetName: item.asset_name || null,
      status: item.status || null,
      priority: item.priority || null,
      sourceType: item.source_type || null,
      assignedTo: item.assigned_to || null,
      createdAt: item.created_at || null,
    })),
  };
}

function summarizeNamedCounts(counter, key) {
  return Array.from(counter.entries())
    .map(([name, count]) => ({ [key]: name, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
}

function normalizeWorkOrderPriority(value) {
  return String(value || '').trim().toLowerCase();
}

function summarizeDepartmentOperationalAnalysis({
  assets = [],
  maintenancePayload = null,
  workOrderPayload = null,
  filters = {},
} = {}) {
  const statusMap = new Map();
  const categoryMap = new Map();
  let totalCurrentValue = 0;
  let missingResponsibleCount = 0;
  let missingLocationCount = 0;

  const assetCodeSet = new Set();
  assets.forEach(item => {
    const status = item.status || '未知';
    const category = item.category_name || '未分类';
    const currentValue = parseNumber(item.current_value);
    const purchaseValue = parseNumber(item.purchase_price);

    statusMap.set(status, (statusMap.get(status) || 0) + 1);
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    totalCurrentValue += currentValue ?? purchaseValue ?? 0;

    if (item.asset_code) {
      assetCodeSet.add(item.asset_code);
    }

    if (!(item.responsible_person_name || item.responsible_person)) {
      missingResponsibleCount += 1;
    }

    if (!(item.location || item.latest_location?.location)) {
      missingLocationCount += 1;
    }
  });

  const maintenanceItems = Array.isArray(maintenancePayload?.data) ? maintenancePayload.data : [];
  const maintenanceStatusMap = new Map();
  const maintenanceTypeMap = new Map();
  let faultRepairCount = 0;
  let matchedMaintenanceCount = 0;

  maintenanceItems.forEach(item => {
    const assetCode = item.asset_code || '';
    if (assetCodeSet.size > 0 && !assetCodeSet.has(assetCode)) {
      return;
    }

    matchedMaintenanceCount += 1;
    const status = item.status || '未知';
    const maintenanceType = item.maintenance_type || '未分类';
    maintenanceStatusMap.set(status, (maintenanceStatusMap.get(status) || 0) + 1);
    maintenanceTypeMap.set(maintenanceType, (maintenanceTypeMap.get(maintenanceType) || 0) + 1);

    if (/(故障|抢修|修复)/.test(maintenanceType)) {
      faultRepairCount += 1;
    }
  });

  const workOrderItems = Array.isArray(workOrderPayload?.data) ? workOrderPayload.data : [];
  const workOrderStatusMap = new Map();
  const workOrderPriorityMap = new Map();
  let pendingWorkOrderCount = 0;
  let urgentWorkOrderCount = 0;
  let matchedWorkOrderCount = 0;

  workOrderItems.forEach(item => {
    const assetCode = item.asset_code || '';
    if (assetCodeSet.size > 0 && !assetCodeSet.has(assetCode)) {
      return;
    }

    matchedWorkOrderCount += 1;
    const status = item.status || 'unknown';
    const priority = item.priority || 'unknown';
    const normalizedPriority = normalizeWorkOrderPriority(priority);

    workOrderStatusMap.set(status, (workOrderStatusMap.get(status) || 0) + 1);
    workOrderPriorityMap.set(priority, (workOrderPriorityMap.get(priority) || 0) + 1);

    if (['pending', 'assigned', 'in_progress', 'pending_acceptance'].includes(String(status))) {
      pendingWorkOrderCount += 1;
    }

    if (['urgent', 'high', '紧急', '高'].includes(normalizedPriority) || /(紧急|高)/.test(priority)) {
      urgentWorkOrderCount += 1;
    }
  });

  return {
    filters,
    assetSummary: {
      total: assets.length,
      totalCurrentValue,
      statusDistribution: summarizeNamedCounts(statusMap, 'status'),
      topCategories: summarizeNamedCounts(categoryMap, 'category'),
      missingResponsibleCount,
      missingLocationCount,
    },
    maintenanceSummary: {
      matchedRecords: matchedMaintenanceCount,
      faultRepairCount,
      statusDistribution: summarizeNamedCounts(maintenanceStatusMap, 'status'),
      topMaintenanceTypes: summarizeNamedCounts(maintenanceTypeMap, 'type'),
    },
    workOrderSummary: {
      matchedRecords: matchedWorkOrderCount,
      pendingCount: pendingWorkOrderCount,
      urgentCount: urgentWorkOrderCount,
      statusDistribution: summarizeNamedCounts(workOrderStatusMap, 'status'),
      priorityDistribution: summarizeNamedCounts(workOrderPriorityMap, 'priority'),
    },
  };
}

function summarizeInventoryList(items = [], filters = {}, options = {}) {
  const limit = clamp(parseInteger(options.limit) || DEFAULT_LIST_LIMIT, 1, 20);
  const sampledItems = items.slice(0, limit);

  return {
    total: parseInteger(options.total) ?? items.length,
    returnedCount: sampledItems.length,
    page: 1,
    pageSize: sampledItems.length,
    fullDataset: options.fullDataset === true,
    filters,
    items: sampledItems.map(item => ({
      id: item.id ?? null,
      inventoryNo: item.inventory_no || null,
      inventoryDate: item.inventory_date || null,
      inventoryType: item.inventory_type || null,
      inventoryPerson: item.inventory_person || null,
      status: item.status || null,
      remark: item.remark || null,
      createdAt: item.created_at || null,
    })),
  };
}

function summarizeTransferList(items = [], filters = {}, options = {}) {
  const limit = clamp(parseInteger(options.limit) || DEFAULT_LIST_LIMIT, 1, 20);
  const sampledItems = items.slice(0, limit);

  return {
    total: parseInteger(options.total) ?? items.length,
    returnedCount: sampledItems.length,
    page: 1,
    pageSize: sampledItems.length,
    fullDataset: options.fullDataset === true,
    filters,
    items: sampledItems.map(item => ({
      id: item.id ?? null,
      transferNo: item.transfer_no || null,
      assetCode: item.asset_code || null,
      assetName: item.asset_name || null,
      fromDepartment: item.from_department || null,
      toDepartment: item.to_department || null,
      transferDate: item.transfer_date || null,
      status: item.status || null,
      transferReason: item.transfer_reason || null,
      applicant: item.applicant || null,
      approvedBy: item.approved_by || null,
      approvedAt: item.approved_at || null,
      remark: item.remark || null,
      createdAt: item.created_at || null,
    })),
  };
}

function summarizeIdleAssetList(items = [], filters = {}, options = {}) {
  const limit = clamp(parseInteger(options.limit) || DEFAULT_LIST_LIMIT, 1, 20);
  const sampledItems = items.slice(0, limit);

  return {
    total: parseInteger(options.total) ?? items.length,
    returnedCount: sampledItems.length,
    page: 1,
    pageSize: sampledItems.length,
    fullDataset: options.fullDataset === true,
    filters,
    items: sampledItems.map(item => ({
      id: item.id ?? null,
      assetCode: item.asset_code || null,
      assetName: item.asset_name || null,
      department: item.department || null,
      location: item.location || null,
      assetStatus: item.asset_status || null,
      publishStatus: item.status || null,
      brand: item.brand || null,
      model: item.model || null,
      specification: item.specification || null,
      publishDate: item.publish_date || null,
      publishPerson: item.publish_person || null,
      remark: item.remark || null,
    })),
  };
}

function summarizeScrappingList(items = [], filters = {}, options = {}) {
  const limit = clamp(parseInteger(options.limit) || DEFAULT_LIST_LIMIT, 1, 20);
  const sampledItems = items.slice(0, limit);

  return {
    total: parseInteger(options.total) ?? items.length,
    returnedCount: sampledItems.length,
    page: 1,
    pageSize: sampledItems.length,
    fullDataset: options.fullDataset === true,
    filters,
    items: sampledItems.map(item => ({
      id: item.id ?? null,
      assetCode: item.asset_code || null,
      assetName: item.asset_name || null,
      department: item.department || null,
      applicant: item.applicant || null,
      applyDate: item.apply_date || null,
      scrappingReason: item.scrapping_reason || null,
      estimatedValue: parseNumber(item.estimated_value),
      currentStatus: item.current_status || null,
      remark: item.remark || null,
    })),
  };
}

function summarizeProcurementList(items = [], filters = {}, options = {}) {
  const limit = clamp(parseInteger(options.limit) || DEFAULT_LIST_LIMIT, 1, 20);
  const sampledItems = items.slice(0, limit);

  return {
    total: parseInteger(options.total) ?? items.length,
    returnedCount: sampledItems.length,
    page: 1,
    pageSize: sampledItems.length,
    fullDataset: options.fullDataset === true,
    filters,
    items: sampledItems.map(item => ({
      id: item.id ?? null,
      requestCode: item.request_code || item.request_no || null,
      title: item.title || null,
      department: item.department || null,
      requesterName: item.requester_name || item.applicant || null,
      requestDate: item.request_date || null,
      status: item.status || null,
      budgetAmount: parseNumber(item.budget_amount ?? item.budget),
      approvalComments: item.approval_comments || null,
    })),
  };
}

function summarizeDepartmentList(payload, filters = {}) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  const pagination = payload?.pagination || {};

  return {
    total: parseInteger(pagination.total) ?? list.length,
    returnedCount: list.length,
    page: parseInteger(pagination.page) || 1,
    pageSize: parseInteger(pagination.pageSize) || list.length,
    filters,
    items: list.map(item => ({
      id: item.id ?? null,
      departmentCode: item.department_code || null,
      departmentName: item.department_name || null,
      parentCode: item.parent_code || null,
      level: parseInteger(item.level),
    })),
  };
}

function summarizeUserList(payload, filters = {}) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  const pagination = payload?.pagination || {};

  return {
    total: parseInteger(pagination.total) ?? list.length,
    returnedCount: list.length,
    page: parseInteger(pagination.page) || 1,
    pageSize: parseInteger(pagination.pageSize) || list.length,
    filters,
    items: list.map(item => ({
      id: item.id ?? null,
      username: item.username || null,
      realName: item.real_name || null,
      role: item.role || null,
      status: item.status || null,
      departmentCode: item.department_code || null,
      email: item.email || null,
      phone: item.phone || null,
    })),
  };
}

function formatDatasetError(label, error) {
  if (error?.status === 403) {
    return `当前登录用户没有权限获取${label}实时数据。`;
  }

  if (error?.status === 401) {
    return `当前登录用户认证已失效，无法获取${label}实时数据。`;
  }

  const detailCandidates = [
    error?.message,
    error?.body?.message,
    error?.body?.error,
  ]
    .map(item => String(item || '').trim())
    .filter(Boolean);
  const detail = Array.from(new Set(detailCandidates)).join('；');

  return `获取${label}实时数据失败：${detail || '未知错误'}`;
}

const aiLiveDataContextService = {
  async buildLightContext({ messages = [], authContext = {} } = {}) {
    return buildLightContextPayload({ messages, authContext });
  },

  async buildContext({ messages = [], authContext = {} } = {}) {
    const previewContext = buildLightContextPayload({ messages, authContext });
    if (!previewContext) {
      return null;
    }

    const { intent, scope } = previewContext;
    const warnings = [...previewContext.warnings];
    const data = {};

    if (warnings.length > 0) {
      return previewContext;
    }

    if (intent.domain === 'depreciation') {
      try {
        const filters = {};

        if (intent.searchKeyword) {
          filters.keyword = intent.searchKeyword;
        }

        if (intent.departmentKeyword) {
          filters.department = intent.departmentKeyword;
        }

        if (intent.status) {
          filters.status = intent.status;
        }

        if (intent.depreciationGroupBy === 'department') {
          const result = await requestBackend('/api/depreciation/summary/by-department', authContext, filters);
          data.depreciationGroup = summarizeDepreciationGroup(result.data, 'department', {
            keyword: intent.searchKeyword || null,
            department: intent.departmentKeyword || null,
            status: intent.status || null,
          });
        } else if (intent.depreciationGroupBy === 'type') {
          const result = await requestBackend('/api/depreciation/summary/by-type', authContext, filters);
          data.depreciationGroup = summarizeDepreciationGroup(result.data, 'type', {
            keyword: intent.searchKeyword || null,
            department: intent.departmentKeyword || null,
            status: intent.status || null,
          });
        } else if (intent.depreciationGroupBy === 'month') {
          const result = await requestBackend('/api/depreciation/summary/by-month', authContext, filters);
          data.depreciationGroup = summarizeDepreciationGroup(result.data, 'month', {
            keyword: intent.searchKeyword || null,
            department: intent.departmentKeyword || null,
            status: intent.status || null,
          });
        } else {
          const result = await requestBackend('/api/depreciation', authContext, filters);
          data.depreciationOverview = summarizeDepreciationOverview(result.data, {
            keyword: intent.searchKeyword || null,
            department: intent.departmentKeyword || null,
            status: intent.status || null,
          });
        }
      } catch (error) {
        warnings.push(formatDatasetError('折旧数据', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'role') {
      try {
        const result = await requestBackend('/api/roles-permissions/roles', authContext);
        data.roleList = summarizeRoleList(result.data, {
          limit: intent.limit,
        });
      } catch (error) {
        warnings.push(formatDatasetError('角色列表', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'managed_department') {
      try {
        const managedDepartmentCodes = Array.isArray(authContext.managedDepartments)
          ? authContext.managedDepartments
          : [];
        const result = await requestBackend('/api/departments', authContext, {
          page: 1,
          pageSize: 500,
        });
        const departmentList = summarizeDepartmentList(result.data, {});
        data.managedDepartmentList = summarizeManagedDepartmentList(
          departmentList.items,
          managedDepartmentCodes,
        );
      } catch (error) {
        warnings.push(formatDatasetError('管理科室列表', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'menu') {
      try {
        const visibleKeysPayload = await requestBackend('/api/roles-permissions/user/menus', authContext);
        const visibleMenuKeys = Array.isArray(visibleKeysPayload?.data?.data)
          ? visibleKeysPayload.data.data
          : [];
        const menuPayload = await requestBackend('/api/roles-permissions/menus/list', authContext);
        data.menuVisibility = summarizeMenuVisibility(visibleMenuKeys, menuPayload.data, {
          limit: intent.limit,
        });
      } catch (error) {
        warnings.push(formatDatasetError('菜单权限', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'module') {
      let moduleDefinitions = null;
      try {
        const result = await requestBackend('/api/tenant-module-config/modules', authContext);
        if (!result.notFound) {
          moduleDefinitions = result.data;
        }
      } catch (error) {
        moduleDefinitions = null;
      }

      data.enabledModules = summarizeEnabledModules(authContext.enabledModules, moduleDefinitions, {
        limit: intent.limit,
      });

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'audit_log') {
      try {
        if (intent.wantsStats) {
          const result = await requestBackend('/api/audit-logs/stats', authContext, {});
          if (result.notFound) {
            warnings.push('当前系统暂无可用的审计日志统计接口。');
          } else {
            data.auditLogStats = summarizeAuditStats(result.data);
          }
        } else {
          const filters = {
            page: 1,
            pageSize: intent.limit || DEFAULT_LIST_LIMIT,
          };

          if (intent.keyword) {
            filters.keyword = intent.keyword;
          }
          if (intent.module) {
            filters.module = intent.module;
          }
          if (intent.actionType) {
            filters.action_type = intent.actionType;
          }

          const result = await requestBackend('/api/audit-logs', authContext, filters);
          data.auditLogList = summarizeAuditLogList(result.data, {
            keyword: intent.keyword || null,
            module: intent.module || null,
            actionType: intent.actionType || null,
          });
        }
      } catch (error) {
        warnings.push(formatDatasetError('审计日志', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'maintenance_log') {
      try {
        const filters = {
          page: intent.page || 1,
          pageSize: intent.limit || DEFAULT_LIST_LIMIT,
        };

        if (intent.assetIdentifier) {
          filters.asset_code = intent.assetIdentifier;
        }
        if (intent.searchKeyword) {
          filters.keyword = intent.searchKeyword;
        }
        if (intent.status) {
          filters.status = intent.status;
        }
        if (intent.maintenanceType) {
          filters.maintenance_type = intent.maintenanceType;
        }

        const result = await requestBackend('/api/maintenance/logs', authContext, filters);
        data.maintenanceLogList = summarizeMaintenanceLogList(result.data, {
          assetCode: intent.assetIdentifier || null,
          keyword: intent.searchKeyword || null,
          status: intent.status || null,
          maintenanceType: intent.maintenanceType || null,
        });
      } catch (error) {
        warnings.push(formatDatasetError('维修日志', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'maintenance_workorder') {
      try {
        const filters = {
          page: 1,
          pageSize: intent.limit || DEFAULT_LIST_LIMIT,
        };

        if (intent.assetIdentifier) {
          filters.asset_code = intent.assetIdentifier;
        }
        if (intent.searchKeyword) {
          filters.keyword = intent.searchKeyword;
        }
        if (intent.status) {
          filters.status = intent.status;
        }
        if (intent.priority) {
          filters.priority = intent.priority;
        }

        const result = await requestBackend('/api/maintenance/workorders', authContext, filters);
        data.workOrderList = summarizeWorkOrderList(result.data, {
          assetCode: intent.assetIdentifier || null,
          keyword: intent.searchKeyword || null,
          status: intent.status || null,
          priority: intent.priority || null,
        });
      } catch (error) {
        warnings.push(formatDatasetError('维护工单', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'inventory') {
      try {
        const routeFilters = {};
        if (intent.status) {
          routeFilters.status = intent.status;
        }

        const result = await requestBackendAllPages('/api/inventory', authContext, routeFilters, {
          getItems: payload => (Array.isArray(payload?.data) ? payload.data : []),
          getPagination: payload => payload?.pagination || null,
        });
        const filteredItems = filterInventoryItems(result.items, {
          keyword: intent.searchKeyword || null,
          status: intent.status || null,
        });
        data.inventoryList = summarizeInventoryList(
          filteredItems,
          {
            keyword: intent.searchKeyword || null,
            status: intent.status || null,
          },
          {
            total: filteredItems.length,
            limit: intent.limit,
            fullDataset: true,
          },
        );

        if (result.truncated) {
          warnings.push('盘点记录数据量较大，当前仅扫描了部分分页结果。');
        }
      } catch (error) {
        warnings.push(formatDatasetError('盘点记录', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'transfer') {
      try {
        const routeFilters = {};
        if (intent.status) {
          routeFilters.status = intent.status;
        }

        const result = await requestBackendAllPages('/api/transfer', authContext, routeFilters, {
          getItems: payload => (Array.isArray(payload?.data) ? payload.data : []),
          getPagination: payload => payload?.pagination || null,
        });
        const filteredItems = filterTransferItems(result.items, {
          keyword: intent.searchKeyword || null,
          department: intent.departmentKeyword || null,
          assetCode: intent.assetIdentifier || null,
          status: intent.status || null,
        });
        data.transferList = summarizeTransferList(
          filteredItems,
          {
            keyword: intent.searchKeyword || null,
            department: intent.departmentKeyword || null,
            assetCode: intent.assetIdentifier || null,
            status: intent.status || null,
          },
          {
            total: filteredItems.length,
            limit: intent.limit,
            fullDataset: true,
          },
        );

        if (result.truncated) {
          warnings.push('调配记录数据量较大，当前仅扫描了部分分页结果。');
        }
      } catch (error) {
        warnings.push(formatDatasetError('调配记录', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'idle') {
      try {
        const routeFilters = {};
        if (intent.status) {
          routeFilters.status = intent.status;
        }

        const result = await requestBackendAllPages('/api/idle', authContext, routeFilters, {
          getItems: payload => (Array.isArray(payload?.data) ? payload.data : []),
          getPagination: payload => payload?.pagination || null,
        });
        const filteredItems = filterIdleItems(result.items, {
          keyword: intent.searchKeyword || null,
          department: intent.departmentKeyword || null,
          assetCode: intent.assetIdentifier || null,
          status: intent.status || null,
        });
        data.idleAssetList = summarizeIdleAssetList(
          filteredItems,
          {
            keyword: intent.searchKeyword || null,
            department: intent.departmentKeyword || null,
            assetCode: intent.assetIdentifier || null,
            status: intent.status || null,
          },
          {
            total: filteredItems.length,
            limit: intent.limit,
            fullDataset: true,
          },
        );

        if (result.truncated) {
          warnings.push('闲置资产发布记录数据量较大，当前仅扫描了部分分页结果。');
        }
      } catch (error) {
        warnings.push(formatDatasetError('闲置资产记录', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'scrapping') {
      try {
        const routeFilters = {};
        if (intent.status) {
          routeFilters.status = intent.status;
        }
        if (intent.assetIdentifier) {
          routeFilters.asset_code = intent.assetIdentifier;
        }

        const result = await requestBackendAllPages('/api/scrapping', authContext, routeFilters, {
          getItems: payload =>
            Array.isArray(payload?.data?.records) ? payload.data.records : [],
          getPagination: payload => payload?.data?.pagination || null,
        });
        const filteredItems = filterScrappingItems(result.items, {
          keyword: intent.searchKeyword || null,
          department: intent.departmentKeyword || null,
          assetCode: intent.assetIdentifier || null,
          status: intent.status || null,
        });
        data.scrappingList = summarizeScrappingList(
          filteredItems,
          {
            keyword: intent.searchKeyword || null,
            department: intent.departmentKeyword || null,
            assetCode: intent.assetIdentifier || null,
            status: intent.status || null,
          },
          {
            total: filteredItems.length,
            limit: intent.limit,
            fullDataset: true,
          },
        );

        if (result.truncated) {
          warnings.push('报废记录数据量较大，当前仅扫描了部分分页结果。');
        }
      } catch (error) {
        warnings.push(formatDatasetError('报废记录', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'procurement') {
      try {
        const routeFilters = {
          page: 1,
          pageSize: intent.limit || DEFAULT_LIST_LIMIT,
        };

        if (intent.searchKeyword) {
          routeFilters.keyword = intent.searchKeyword;
        }
        if (intent.departmentKeyword) {
          routeFilters.department = intent.departmentKeyword;
        }
        if (intent.status) {
          routeFilters.status = intent.status;
        }

        const result = await requestBackend('/api/procurement/requests', authContext, routeFilters);
        const payload = result.data || {};
        const items = Array.isArray(payload.data) ? payload.data : [];
        data.procurementList = summarizeProcurementList(
          items,
          {
            keyword: intent.searchKeyword || null,
            department: intent.departmentKeyword || null,
            status: intent.status || null,
          },
          {
            total: parseInteger(payload.pagination?.total) ?? items.length,
            limit: intent.limit,
            fullDataset: false,
          },
        );
      } catch (error) {
        warnings.push(formatDatasetError('采购申请', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'department') {
      try {
        const filters = {
          page: 1,
          pageSize: intent.limit || DEFAULT_LIST_LIMIT,
        };

        if (intent.searchKeyword) {
          filters.keyword = intent.searchKeyword;
        }

        const result = await requestBackend('/api/departments', authContext, filters);
        data.departmentList = summarizeDepartmentList(result.data, {
          keyword: intent.searchKeyword || null,
        });
      } catch (error) {
        warnings.push(formatDatasetError('部门列表', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.domain === 'user') {
      try {
        const filters = {
          page: 1,
          pageSize: intent.limit || DEFAULT_LIST_LIMIT,
        };

        if (intent.searchKeyword) {
          filters.keyword = intent.searchKeyword;
        }

        const result = await requestBackend('/api/users', authContext, filters);
        data.userList = summarizeUserList(result.data, {
          keyword: intent.searchKeyword || null,
        });
      } catch (error) {
        warnings.push(formatDatasetError('用户列表', error));
      }

      if (Object.keys(data).length === 0 && warnings.length === 0) {
        return null;
      }

      return {
        source: 'assethub-backend-proxy',
        authoritative: true,
        generatedAt: new Date().toISOString(),
        scope,
        intent,
        restrictions: [
          '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
          '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
        ],
        warnings,
        data,
      };
    }

    if (intent.wantsOverview) {
      try {
        const result = await requestBackend('/api/assets/statistics/overview', authContext);
        data.assetOverview = summarizeOverview(result.data);
      } catch (error) {
        warnings.push(formatDatasetError('资产概览', error));
      }
    }

    if (intent.wantsDetail && intent.assetIdentifier) {
      try {
        const result = await requestBackend(
          `/api/assets/${encodeURIComponent(intent.assetIdentifier)}`,
          authContext,
        );
        if (result.notFound) {
          warnings.push(`当前租户下未找到资产 ${intent.assetIdentifier}。`);
        } else {
          data.assetDetail = summarizeAssetDetail(result.data);
        }
      } catch (error) {
        if (error?.status === 404) {
          warnings.push(`当前租户下未找到资产 ${intent.assetIdentifier}。`);
        } else {
          warnings.push(formatDatasetError('资产详情', error));
        }
      }
    }

    if (intent.wantsList) {
      try {
        const normalizedFilters = {
          search: intent.searchKeyword || null,
          department: intent.departmentKeyword || null,
          status: intent.status || null,
          sortField: intent.sortField || null,
          sortOrder: intent.sortOrder || null,
        };
        const filters = {
          page: intent.page || 1,
          pageSize: intent.limit || DEFAULT_LIST_LIMIT,
        };

        if (intent.searchKeyword) {
          filters.search = intent.searchKeyword;
        }

        if (intent.departmentKeyword) {
          filters.department = intent.departmentKeyword;
        }

        if (intent.status) {
          filters.status = intent.status;
        }
        if (intent.sortField) {
          filters.sortField = intent.sortField;
        }
        if (intent.sortOrder) {
          filters.sortOrder = intent.sortOrder;
        }

        if (intent.wantsFullList && (intent.searchKeyword || intent.departmentKeyword || intent.status)) {
          try {
            const result = await requestBackend('/api/assets/all', authContext, filters);
            data.assetList = summarizeFullAssetList(
              result.data,
              normalizedFilters,
              {
                page: intent.page || 1,
                pageSize: intent.limit || DEFAULT_LIST_LIMIT,
              },
            );
          } catch (error) {
            const canFallbackToPagedList =
              isTimeoutError(error) &&
              (intent.departmentKeyword || intent.searchKeyword || intent.status);

            if (!canFallbackToPagedList) {
              throw error;
            }

            const fallbackResult = await requestBackend('/api/assets', authContext, filters);
            data.assetList = {
              ...summarizeAssetList(fallbackResult.data, normalizedFilters),
              fullDataset: false,
            };
            warnings.push('全量资产明细查询超时，已自动回退为分页结果。');
          }
        } else {
          try {
            const result = await requestBackend('/api/assets', authContext, filters);
            data.assetList = summarizeAssetList(result.data, normalizedFilters);
          } catch (error) {
            const canRetryWithFullDataset =
              isTimeoutError(error) &&
              (intent.departmentKeyword || intent.searchKeyword || intent.status);

            if (!canRetryWithFullDataset) {
              throw error;
            }

            const retryResult = await requestBackend('/api/assets/all', authContext, filters);
            data.assetList = {
              ...summarizeFullAssetList(
                retryResult.data,
                normalizedFilters,
                {
                  page: intent.page || 1,
                  pageSize: intent.limit || DEFAULT_LIST_LIMIT,
                },
              ),
              fullDataset: false,
            };
          }
        }
      } catch (error) {
        warnings.push(formatDatasetError('资产列表', error));
      }
    }

    if (intent.wantsExport) {
      data.assetExport = summarizeAssetExport(
        {
          search: intent.searchKeyword || null,
          department: intent.departmentKeyword || null,
          status: intent.status || null,
        },
        {
          format: intent.exportFormat || 'xlsx',
          total: intent.totalHint || null,
          sortField: intent.sortField || null,
          sortOrder: intent.sortOrder || null,
        },
      );
    }

    if (intent.wantsAnalysis && (intent.departmentKeyword || intent.searchKeyword || intent.status)) {
      try {
        const filters = {};

        if (intent.searchKeyword) {
          filters.search = intent.searchKeyword;
        }

        if (intent.departmentKeyword) {
          filters.department = intent.departmentKeyword;
        }

        if (intent.status) {
          filters.status = intent.status;
        }

        const result = await requestBackend('/api/assets/all', authContext, filters);
        const assetItems = Array.isArray(result?.data?.data) ? result.data.data : [];
        data.assetAnalysis = summarizeAssetAnalysis(result.data, {
          search: intent.searchKeyword || null,
          department: intent.departmentKeyword || null,
          status: intent.status || null,
        });

        if (
          intent.departmentKeyword &&
          /(维修|维护|工单|保养)/.test(String(intent.latestUserMessage || ''))
        ) {
          try {
            const [maintenanceResult, workOrderResult] = await Promise.all([
              requestBackend('/api/maintenance/logs', authContext, {
                page: 1,
                pageSize: 100,
              }),
              requestBackend('/api/maintenance/workorders', authContext, {
                page: 1,
                pageSize: 100,
              }),
            ]);

            data.departmentOperationalAnalysis = summarizeDepartmentOperationalAnalysis({
              assets: assetItems,
              maintenancePayload: maintenanceResult.data,
              workOrderPayload: workOrderResult.data,
              filters: {
                search: intent.searchKeyword || null,
                department: intent.departmentKeyword || null,
                status: intent.status || null,
              },
            });
          } catch (error) {
            warnings.push(formatDatasetError('科室资产运维分析', error));
          }
        }
      } catch (error) {
        warnings.push(formatDatasetError('资产分析', error));
      }
    }

    if (Object.keys(data).length === 0 && warnings.length === 0) {
      return null;
    }

    return {
      source: 'assethub-backend-proxy',
      authoritative: true,
      generatedAt: new Date().toISOString(),
      scope,
      intent,
      restrictions: [
        '该上下文由 AssetHub 后端代理基于当前 Web 登录用户与当前租户实时生成。',
        '如果与 OpenCode 内置共享 MCP 账号结果冲突，必须以该上下文为准。',
      ],
      warnings,
      data,
    };
  },
};

module.exports = aiLiveDataContextService;
