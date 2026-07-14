const extractFieldsFromAIResponse = (content) => {
  const extractedFields = {};
  const patterns = [
    { regex: /资产编号[：:]\s*([A-Za-z0-9-]+)/, field: 'asset_code' },
    { regex: /资产名称[：:]\s*([^\n]+)/, field: 'asset_name' },
    { regex: /维护类型[：:]\s*([^\n]+)/, field: 'maintenance_type' },
    { regex: /维护日期[：:]\s*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/, field: 'maintenance_date' },
    { regex: /维护人员[：:]\s*([^\n]+)/, field: 'maintenance_person' },
    { regex: /维护内容[：:]\s*([^\n]+)/, field: 'maintenance_content' },
    { regex: /维护成本[：:]\s*([\d.]+)/, field: 'maintenance_cost' },
    { regex: /维护时长[：:]\s*([\d.]+)/, field: 'maintenance_duration' },
    { regex: /维护地点[：:]\s*([^\n]+)/, field: 'maintenance_location' },
    { regex: /更换部件[：:]\s*([^\n]+)/, field: 'parts_replaced' },
    { regex: /状态[：:]\s*([^\n]+)/, field: 'status' },
    { regex: /备注[：:]\s*([^\n]+)/, field: 'remark' },
    { regex: /下次维护日期[：:]\s*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/, field: 'next_maintenance_date' },
    { regex: /调出部门[：:]\s*([^\n]+)/, field: 'from_department' },
    { regex: /调入部门[：:]\s*([^\n]+)/, field: 'to_department' },
    { regex: /调配日期[：:]\s*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/, field: 'transfer_date' },
    { regex: /调配原因[：:]\s*([^\n]+)/, field: 'reason' },
    { regex: /故障描述[：:]\s*([^\n]+)/, field: 'fault_description' },
    { regex: /故障级别[：:]\s*([^\n]+)/, field: 'fault_level' },
    { regex: /报修部门[：:]\s*([^\n]+)/, field: 'request_department' },
    { regex: /联系电话[：:]\s*([^\n]+)/, field: 'contact_phone' },
    { regex: /期望修复日期[：:]\s*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/, field: 'expected_repair_date' },
    { regex: /发布人[：:]\s*([^\n]+)/, field: 'publish_person' },
    { regex: /发布日期[：:]\s*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/, field: 'publish_date' },
    { regex: /部门[：:]\s*([^\n]+)/, field: 'department' },
    { regex: /申请人[：:]\s*([^\n]+)/, field: 'applicant' },
    { regex: /报废原因[：:]\s*([^\n]+)/, field: 'scrapping_reason' },
    { regex: /预估残值[：:]\s*([\d.]+)/, field: 'estimated_value' },
    { regex: /型号[：:]\s*([^\n]+)/, field: 'asset_model' },
    { regex: /盘点单号[：:]\s*([^\n]+)/, field: 'inventory_no' },
    { regex: /盘点日期[：:]\s*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/, field: 'inventory_date' },
    { regex: /盘点类型[：:]\s*([^\n]+)/, field: 'inventory_type' },
    { regex: /盘点人[：:]\s*([^\n]+)/, field: 'inventory_person' },
  ];

  for (const { regex, field } of patterns) {
    const match = content.match(regex);
    if (match) {
      extractedFields[field] = match[1].trim();
    }
  }

  return extractedFields;
};

const REQUIRED_BY_INTENT = {
  maintenance_log: ['asset_code', 'maintenance_type', 'maintenance_date', 'maintenance_person', 'maintenance_content'],
  transfer: ['asset_code', 'to_department', 'reason'],
  repair_request: ['asset_code', 'fault_description'],
  idle_publish: ['publish_person'],
  scrapping: ['asset_code', 'asset_name', 'applicant', 'scrapping_reason'],
  asset_query: [],
  help: [],
  pending_requests: [],
  inventory_query: [],
  inventory_create: ['inventory_no', 'inventory_date', 'inventory_type', 'inventory_person'],
  repair_history: [],
  maintenance_plan_query: [],
  maintenance_stats: [],
  acceptance_query: [],
  technical_doc_query: [],
  adverse_event_query: [],
  metrology_query: [],
  org_query: [],
  department_query: [],
  transfer_approve: [],
};

const FIELD_LABELS = {
  asset_code: '资产编号',
  asset_name: '资产名称',
  maintenance_type: '维护类型',
  maintenance_date: '维护日期',
  maintenance_person: '维护人员',
  maintenance_content: '维护内容',
  maintenance_cost: '维护成本',
  maintenance_duration: '维护时长',
  maintenance_location: '维护地点',
  parts_replaced: '更换部件',
  next_maintenance_date: '下次维护日期',
  remark: '备注',
  from_department: '调出部门',
  to_department: '调入部门',
  transfer_date: '调配日期',
  reason: '调配原因',
  transfer_reason: '调配原因',
  fault_description: '故障描述',
  fault_level: '故障级别',
  request_department: '报修部门',
  contact_phone: '联系电话',
  expected_repair_date: '期望修复日期',
  publish_person: '发布人',
  publish_date: '发布日期',
  department: '部门',
  applicant: '申请人',
  scrapping_reason: '报废原因',
  estimated_value: '预估残值',
  asset_model: '型号',
  inventory_no: '盘点单号',
  inventory_date: '盘点日期',
  inventory_type: '盘点类型',
  inventory_person: '盘点人',
};

const validateFormData = (formData, intent) => {
  const requiredFields = REQUIRED_BY_INTENT[intent] || REQUIRED_BY_INTENT.maintenance_log;
  const missingFields = [];
  const invalidFields = [];

  for (const field of requiredFields) {
    const value = formData[field];
    if (value === undefined || value === null || value === '') {
      missingFields.push(field);
    } else if (typeof value === 'string' && value.trim() === '') {
      missingFields.push(field);
    }
  }

  const dateFields = ['maintenance_date', 'next_maintenance_date', 'transfer_date', 'publish_date', 'request_date', 'expected_repair_date', 'inventory_date'];
  for (const field of dateFields) {
    if (formData[field]) {
      const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/;
      if (!datePattern.test(formData[field])) {
        invalidFields.push({ field, reason: '日期格式不正确' });
      }
    }
  }

  const numberFields = ['maintenance_cost', 'maintenance_duration', 'estimated_value'];
  for (const field of numberFields) {
    if (formData[field] !== undefined && formData[field] !== null) {
      if (isNaN(Number(formData[field]))) {
        invalidFields.push({ field, reason: '必须是数字' });
      }
    }
  }

  return {
    isValid: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields,
  };
};

const generateFieldPrompt = (missingFields) => {
  if (missingFields.length === 0) return '';

  const fieldLabels = missingFields.map(field => FIELD_LABELS[field] || field);
  return `请提供以下信息：${fieldLabels.join('、')}`;
};

module.exports = {
  extractFieldsFromAIResponse,
  REQUIRED_BY_INTENT,
  FIELD_LABELS,
  validateFormData,
  generateFieldPrompt,
};
