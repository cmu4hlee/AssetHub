/**
 * 通知模板种子数据 - 覆盖所有流程类型的关键事件
 * 三种渠道：飞书(feishu)、邮件(email)、站内消息(socket)
 * tenant_id=0 表示系统级模板，所有租户可见
 */
const mysql = require('mysql2/promise');

const TEMPLATES = [
  // ==================== 维修维护 (maintenance) ====================
  {
    code: 'maintenance_request_created_feishu',
    name: '报修申请已创建（飞书）',
    channel: 'feishu',
    title_template: '🔧 新报修申请：{{request_no}}',
    content_template: `【报修申请】
资产编号：{{asset_code}}
资产名称：{{asset_name}}
故障描述：{{fault_description}}
故障级别：{{fault_level}}
报修人：{{request_person}}
报修时间：{{request_time}}
所属部门：{{department}}

请及时处理该报修申请。`,
    variables_json: '["request_no","asset_code","asset_name","fault_description","fault_level","request_person","request_time","department"]',
  },
  {
    code: 'maintenance_request_approved_feishu',
    name: '报修申请已批准（飞书）',
    channel: 'feishu',
    title_template: '✅ 报修申请已批准：{{request_no}}',
    content_template: `【报修申请已批准】
申请编号：{{request_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
故障级别：{{fault_level}}
审批人：{{approver}}
审批时间：{{approved_at}}
${''}
维修工程师：{{repair_person || '待分配'}}
预计开始时间：{{scheduled_time || '待定'}}

请维修工程师及时处理。`,
    variables_json: '["request_no","asset_code","asset_name","fault_level","approver","approved_at","repair_person","scheduled_time"]',
  },
  {
    code: 'maintenance_request_rejected_feishu',
    name: '报修申请已驳回（飞书）',
    channel: 'feishu',
    title_template: '❌ 报修申请已驳回：{{request_no}}',
    content_template: `【报修申请已驳回】
申请编号：{{request_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
驳回原因：{{reject_reason || '未填写'}}
审批人：{{approver}}
审批时间：{{rejected_at}}

如需重新提交，请联系审批人或管理员。`,
    variables_json: '["request_no","asset_code","asset_name","reject_reason","approver","rejected_at"]',
  },
  {
    code: 'maintenance_request_started_feishu',
    name: '维修已开始（飞书）',
    channel: 'feishu',
    title_template: '🔨 维修进行中：{{request_no}}',
    content_template: `【维修已开始】
申请编号：{{request_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
维修工程师：{{repair_person}}
开始时间：{{started_at}}
故障级别：{{fault_level}}

工程师已开始维修工作。`,
    variables_json: '["request_no","asset_code","asset_name","repair_person","started_at","fault_level"]',
  },
  {
    code: 'maintenance_request_completed_feishu',
    name: '维修已完成（飞书）',
    channel: 'feishu',
    title_template: '🎉 维修已完成：{{request_no}}',
    content_template: `【维修已完成】
申请编号：{{request_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
维修工程师：{{repair_person}}
完成时间：{{completed_at}}
处理结果：{{result_description}}
更换配件：{{replaced_parts || '无'}}
维修费用：{{cost || '暂无'}}

请确认维修结果。`,
    variables_json: '["request_no","asset_code","asset_name","repair_person","completed_at","result_description","replaced_parts","cost"]',
  },
  {
    code: 'maintenance_request_cancelled_feishu',
    name: '维修申请已取消（飞书）',
    channel: 'feishu',
    title_template: '⛔ 维修申请已取消：{{request_no}}',
    content_template: `【维修申请已取消】
申请编号：{{request_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
取消原因：{{cancel_reason || '未填写'}}
操作人：{{operator}}
操作时间：{{cancelled_at}}`,
    variables_json: '["request_no","asset_code","asset_name","cancel_reason","operator","cancelled_at"]',
  },
  {
    code: 'workorder_assigned_feishu',
    name: '维修工单已分配（飞书）',
    channel: 'feishu',
    title_template: '📋 维修工单已分配：{{workorder_no}}',
    content_template: `【维修工单已分配】
工单编号：{{workorder_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
故障描述：{{fault_description}}
维修工程师：{{assignee}}
分配时间：{{assigned_at}}
优先级：{{priority || '普通'}}
${''}
请及时处理该工单。`,
    variables_json: '["workorder_no","asset_code","asset_name","fault_description","assignee","assigned_at","priority"]',
  },
  {
    code: 'workorder_completed_feishu',
    name: '维修工单已完成（飞书）',
    channel: 'feishu',
    title_template: '✔️ 维修工单已完成：{{workorder_no}}',
    content_template: `【维修工单已完成】
工单编号：{{workorder_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
处理人：{{operator}}
完成时间：{{completed_at}}
处理结果：{{result_description}}
${''}
工单已关闭。`,
    variables_json: '["workorder_no","asset_code","asset_name","operator","completed_at","result_description"]',
  },

  // ==================== 审批流程 (approval) ====================
  {
    code: 'approval_created_feishu',
    name: '审批已发起（飞书）',
    channel: 'feishu',
    title_template: '📝 新审批待处理：{{approval_no}}',
    content_template: `【审批待处理】
审批编号：{{approval_no}}
审批类型：{{approval_type}}
申请人：{{applicant}}
申请时间：{{created_at}}
申请说明：{{description || '无'}}
${''}
请在审批中心查看详情并处理。`,
    variables_json: '["approval_no","approval_type","applicant","created_at","description"]',
  },
  {
    code: 'approval_approved_feishu',
    name: '审批已通过（飞书）',
    channel: 'feishu',
    title_template: '✅ 审批已通过：{{approval_no}}',
    content_template: `【审批已通过】
审批编号：{{approval_no}}
审批类型：{{approval_type}}
审批人：{{approver}}
审批时间：{{approved_at}}
审批意见：{{comment || '无'}}
${''}
后续流程将自动推进。`,
    variables_json: '["approval_no","approval_type","approver","approved_at","comment"]',
  },
  {
    code: 'approval_rejected_feishu',
    name: '审批已驳回（飞书）',
    channel: 'feishu',
    title_template: '❌ 审批已驳回：{{approval_no}}',
    content_template: `【审批已驳回】
审批编号：{{approval_no}}
审批类型：{{approval_type}}
审批人：{{approver}}
驳回时间：{{rejected_at}}
驳回原因：{{comment || '未填写'}}
${''}
请修改后重新提交。`,
    variables_json: '["approval_no","approval_type","approver","rejected_at","comment"]',
  },
  {
    code: 'approval_completed_feishu',
    name: '审批流程已结束（飞书）',
    channel: 'feishu',
    title_template: '🏁 审批流程结束：{{approval_no}}',
    content_template: `【审批流程结束】
审批编号：{{approval_no}}
审批类型：{{approval_type}}
最终结果：{{result}}
完成时间：{{completed_at}}
${''}
审批流程全部完成。`,
    variables_json: '["approval_no","approval_type","result","completed_at"]',
  },

  // ==================== 资产报废 (scrapping) ====================
  {
    code: 'scrapping_created_feishu',
    name: '报废申请已提交（飞书）',
    channel: 'feishu',
    title_template: '🗑️ 报废申请已提交：{{scrap_no}}',
    content_template: `【报废申请】
申请编号：{{scrap_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
资产原值：{{original_value}}
使用年限：{{usage_years}}年
报废原因：{{reason}}
申请人：{{applicant}}
申请时间：{{created_at}}
${''}
请及时审批。`,
    variables_json: '["scrap_no","asset_code","asset_name","original_value","usage_years","reason","applicant","created_at"]',
  },
  {
    code: 'scrapping_approved_feishu',
    name: '报废申请已批准（飞书）',
    channel: 'feishu',
    title_template: '✅ 报废申请已批准：{{scrap_no}}',
    content_template: `【报废申请已批准】
申请编号：{{scrap_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
审批人：{{approver}}
审批时间：{{approved_at}}
残值处理方式：{{scrap_method || '标准流程'}}
${''}
请执行报废处置。`,
    variables_json: '["scrap_no","asset_code","asset_name","approver","approved_at","scrap_method"]',
  },
  {
    code: 'scrapping_rejected_feishu',
    name: '报废申请已驳回（飞书）',
    channel: 'feishu',
    title_template: '❌ 报废申请已驳回：{{scrap_no}}',
    content_template: `【报废申请已驳回】
申请编号：{{scrap_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
驳回原因：{{reject_reason || '未填写'}}
审批人：{{approver}}
${''}
如需重新提交，请修改后再次申请。`,
    variables_json: '["scrap_no","asset_code","asset_name","reject_reason","approver"]',
  },
  {
    code: 'scrapping_completed_feishu',
    name: '报废处置已完成（飞书）',
    channel: 'feishu',
    title_template: '🏁 报废处置完成：{{scrap_no}}',
    content_template: `【报废处置完成】
申请编号：{{scrap_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
处置方式：{{scrap_method}}
处置时间：{{completed_at}}
残值收入：{{residual_value || '0'}}
经办人：{{operator}}`,
    variables_json: '["scrap_no","asset_code","asset_name","scrap_method","completed_at","residual_value","operator"]',
  },

  // ==================== 资产调配 (transfer) ====================
  {
    code: 'transfer_created_feishu',
    name: '调配申请已提交（飞书）',
    channel: 'feishu',
    title_template: '📦 调配申请已提交：{{transfer_no}}',
    content_template: `【资产调配申请】
申请编号：{{transfer_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
调出部门：{{from_department}}
调入部门：{{to_department}}
调配原因：{{reason}}
申请人：{{applicant}}
申请时间：{{created_at}}
${''}
请及时审批。`,
    variables_json: '["transfer_no","asset_code","asset_name","from_department","to_department","reason","applicant","created_at"]',
  },
  {
    code: 'transfer_approved_feishu',
    name: '调配申请已批准（飞书）',
    channel: 'feishu',
    title_template: '✅ 调配申请已批准：{{transfer_no}}',
    content_template: `【资产调配已批准】
申请编号：{{transfer_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
调出部门：{{from_department}} → 调入部门：{{to_department}}
审批人：{{approver}}
审批时间：{{approved_at}}
${''}
请相关人员进行资产交接。`,
    variables_json: '["transfer_no","asset_code","asset_name","from_department","to_department","approver","approved_at"]',
  },
  {
    code: 'transfer_rejected_feishu',
    name: '调配申请已驳回（飞书）',
    channel: 'feishu',
    title_template: '❌ 调配申请已驳回：{{transfer_no}}',
    content_template: `【资产调配已驳回】
申请编号：{{transfer_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
驳回原因：{{reject_reason || '未填写'}}
审批人：{{approver}}`,
    variables_json: '["transfer_no","asset_code","asset_name","reject_reason","approver"]',
  },
  {
    code: 'transfer_completed_feishu',
    name: '资产调配已完成（飞书）',
    channel: 'feishu',
    title_template: '🏁 资产调配完成：{{transfer_no}}',
    content_template: `【资产调配完成】
申请编号：{{transfer_no}}
资产编号：{{asset_code}}
资产名称：{{asset_name}}
调入部门：{{to_department}}
完成时间：{{completed_at}}
经办人：{{operator}}
${''}
资产信息已更新。`,
    variables_json: '["transfer_no","asset_code","asset_name","to_department","completed_at","operator"]',
  },

  // ==================== 资产盘点 (inventory) ====================
  {
    code: 'inventory_task_created_feishu',
    name: '盘点任务已创建（飞书）',
    channel: 'feishu',
    title_template: '📊 盘点任务已创建：{{task_name}}',
    content_template: `【盘点任务】
任务名称：{{task_name}}
盘点范围：{{scope || '全库'}}
计划时间：{{plan_start}} ~ {{plan_end}}
负责人：{{responsible_person}}
${''}
请在指定时间内完成盘点。`,
    variables_json: '["task_name","scope","plan_start","plan_end","responsible_person"]',
  },
  {
    code: 'inventory_task_cancelled_feishu',
    name: '盘点任务已取消（飞书）',
    channel: 'feishu',
    title_template: '⛔ 盘点任务已取消：{{task_name}}',
    content_template: `【盘点任务已取消】
任务名称：{{task_name}}
取消原因：{{cancel_reason || '未填写'}}
操作人：{{operator}}
操作时间：{{cancelled_at}}`,
    variables_json: '["task_name","cancel_reason","operator","cancelled_at"]',
  },
  {
    code: 'inventory_completed_feishu',
    name: '盘点已完成（飞书）',
    channel: 'feishu',
    title_template: '📋 盘点已完成：{{plan_name}}',
    content_template: `【盘点报告】
计划名称：{{plan_name}}
盘点时间：{{start_time}} ~ {{end_time}}
资产总数：{{total_count}}
已盘点数：{{checked_count}}
盘盈数量：{{surplus_count}}
盘亏数量：{{deficit_count}}
完成人：{{operator}}
${''}
详情请查看盘点报告。`,
    variables_json: '["plan_name","start_time","end_time","total_count","checked_count","surplus_count","deficit_count","operator"]',
  },

  // ==================== 招标采购 (tender) ====================
  {
    code: 'tender_created_feishu',
    name: '招标已创建（飞书）',
    channel: 'feishu',
    title_template: '📢 新招标发布：{{tender_name}}',
    content_template: `【招标公告】
招标编号：{{tender_no}}
招标名称：{{tender_name}}
招标类型：{{tender_type}}
发布人：{{creator}}
发布时间：{{created_at}}
截标时间：{{deadline}}
${''}
请关注并参与投标。`,
    variables_json: '["tender_no","tender_name","tender_type","creator","created_at","deadline"]',
  },
  {
    code: 'tender_published_feishu',
    name: '招标已公开发布（飞书）',
    channel: 'feishu',
    title_template: '📢 招标正式发布：{{tender_no}}',
    content_template: `【招标正式发布】
招标编号：{{tender_no}}
招标名称：{{tender_name}}
发布平台：{{platform || '内部系统'}}
截标时间：{{deadline}}
${''}
欢迎合格供应商参与投标。`,
    variables_json: '["tender_no","tender_name","platform","deadline"]',
  },
  {
    code: 'tender_awarded_feishu',
    name: '招标定标通知（飞书）',
    channel: 'feishu',
    title_template: '🏆 招标定标通知：{{tender_no}}',
    content_template: `【招标定标结果】
招标编号：{{tender_no}}
招标名称：{{tender_name}}
中标供应商：{{winner_name}}
中标金额：{{winner_amount}}
定标时间：{{awarded_at}}
定标人：{{approver}}`,
    variables_json: '["tender_no","tender_name","winner_name","winner_amount","awarded_at","approver"]',
  },
  {
    code: 'tender_completed_feishu',
    name: '招标已完结（飞书）',
    channel: 'feishu',
    title_template: '🏁 招标已完结：{{tender_no}}',
    content_template: `【招标完结通知】
招标编号：{{tender_no}}
招标名称：{{tender_name}}
中标供应商：{{winner_name}}
中标金额：{{winner_amount}}
完成时间：{{completed_at}}`,
    variables_json: '["tender_no","tender_name","winner_name","winner_amount","completed_at"]',
  },
  {
    code: 'bid_submitted_feishu',
    name: '投标已提交（飞书）',
    channel: 'feishu',
    title_template: '📬 新投标提交：{{tender_no}}',
    content_template: `【投标提交通知】
招标编号：{{tender_no}}
招标名称：{{tender_name}}
投标供应商：{{bidder_name}}
投标金额：{{bid_amount}}
投标时间：{{submitted_at}}`,
    variables_json: '["tender_no","tender_name","bidder_name","bid_amount","submitted_at"]',
  },

  // ==================== 验收管理 (acceptance) ====================
  {
    code: 'acceptance_reminder_feishu',
    name: '验收提醒（飞书）',
    channel: 'feishu',
    title_template: '⏰ 验收提醒：{{acceptance_no}}',
    content_template: `【验收提醒】
验收编号：{{acceptance_no}}
采购项目：{{project_name}}
供应商：{{supplier_name}}
预计到货时间：{{expected_delivery}}
验收负责人：{{responsible_person}}
${''}
请做好验收准备。`,
    variables_json: '["acceptance_no","project_name","supplier_name","expected_delivery","responsible_person"]',
  },

  // ==================== 质量管理 (quality) ====================
  {
    code: 'quality_metrology_expiring_feishu',
    name: '计量证书即将到期（飞书）',
    channel: 'feishu',
    title_template: '⚠️ 计量证书即将到期：{{asset_code}}',
    content_template: `【计量证书到期提醒】
资产编号：{{asset_code}}
资产名称：{{asset_name}}
证书编号：{{certificate_no}}
计量类型：{{metrology_type}}
到期日期：{{expiry_date}}
剩余天数：{{remaining_days}}天
${''}
请尽快安排计量检定。`,
    variables_json: '["asset_code","asset_name","certificate_no","metrology_type","expiry_date","remaining_days"]',
  },

  // ==================== 资产状态 (asset) ====================
  {
    code: 'asset_workflow_transition_feishu',
    name: '资产状态变更通知（飞书）',
    channel: 'feishu',
    title_template: '🔄 资产状态变更：{{asset_code}}',
    content_template: `【资产状态变更】
资产编号：{{asset_code}}
资产名称：{{asset_name}}
原状态：{{from_status}}
新状态：{{to_status}}
操作用户：{{operator}}
操作时间：{{transition_time}}
变更原因：{{reason || '系统自动'}}`,
    variables_json: '["asset_code","asset_name","from_status","to_status","operator","transition_time","reason"]',
  },

  // ==================== 用户管理 (user) ====================
  {
    code: 'notification_role_request_feishu',
    name: '角色申请通知（飞书）',
    channel: 'feishu',
    title_template: '👤 角色申请：{{applicant}}',
    content_template: `【角色申请通知】
申请人：{{applicant}}
申请角色：{{requested_role}}
申请原因：{{reason}}
申请时间：{{created_at}}
${''}
请管理员审批处理。`,
    variables_json: '["applicant","requested_role","reason","created_at"]',
  },

  // ==================== 财务管理 (finance) ====================
  {
    code: 'tender_invoice_created_feishu',
    name: '发票已创建（飞书）',
    channel: 'feishu',
    title_template: '🧾 发票已创建：{{invoice_no}}',
    content_template: `【发票通知】
发票编号：{{invoice_no}}
关联合同：{{contract_no}}
供应商：{{supplier_name}}
发票金额：{{amount}}
开票日期：{{invoice_date}}
${''}
请及时处理发票。`,
    variables_json: '["invoice_no","contract_no","supplier_name","amount","invoice_date"]',
  },
  {
    code: 'tender_payment_paid_feishu',
    name: '付款已完成（飞书）',
    channel: 'feishu',
    title_template: '💰 付款已完成：{{payment_no}}',
    content_template: `【付款通知】
付款编号：{{payment_no}}
收款方：{{payee_name}}
付款金额：{{amount}}
付款时间：{{paid_at}}
付款方式：{{payment_method || '银行转账'}}`,
    variables_json: '["payment_no","payee_name","amount","paid_at","payment_method"]',
  },

  // ==================== 邮件模板（关键事件） ====================
  {
    code: 'maintenance_request_approved_email',
    name: '维修申请已批准（邮件）',
    channel: 'email',
    title_template: '【AssetHub】维修申请已批准：{{request_no}}',
    content_template: `<h2>维修申请已批准</h2>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:600px;font-family:Arial,sans-serif;">
<tr><td width="150" style="background:#f5f5f5;"><b>申请编号</b></td><td>{{request_no}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>资产编号</b></td><td>{{asset_code}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>资产名称</b></td><td>{{asset_name}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>故障级别</b></td><td>{{fault_level}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>审批人</b></td><td>{{approver}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>审批时间</b></td><td>{{approved_at}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>维修工程师</b></td><td>{{repair_person || '待分配'}}</td></tr>
</table>
<p>请登录系统查看详情并处理。</p>`,
    variables_json: '["request_no","asset_code","asset_name","fault_level","approver","approved_at","repair_person"]',
  },
  {
    code: 'approval_notification_email',
    name: '审批通知（邮件）',
    channel: 'email',
    title_template: '【AssetHub】审批待处理：{{approval_no}}',
    content_template: `<h2>审批通知</h2>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:600px;font-family:Arial,sans-serif;">
<tr><td width="150" style="background:#f5f5f5;"><b>审批编号</b></td><td>{{approval_no}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>审批类型</b></td><td>{{approval_type}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>申请人</b></td><td>{{applicant}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>申请时间</b></td><td>{{created_at}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>申请说明</b></td><td>{{description || '无'}}</td></tr>
</table>
<p>请登录系统进行审批处理。</p>`,
    variables_json: '["approval_no","approval_type","applicant","created_at","description"]',
  },
  {
    code: 'transfer_notification_email',
    name: '资产调配通知（邮件）',
    channel: 'email',
    title_template: '【AssetHub】资产调配通知：{{transfer_no}}',
    content_template: `<h2>资产调配通知</h2>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:600px;font-family:Arial,sans-serif;">
<tr><td width="150" style="background:#f5f5f5;"><b>调配编号</b></td><td>{{transfer_no}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>资产编号</b></td><td>{{asset_code}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>资产名称</b></td><td>{{asset_name}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>调入部门</b></td><td>{{to_department}}</td></tr>
</table>
<p>请相关部门做好资产交接。</p>`,
    variables_json: '["transfer_no","asset_code","asset_name","to_department"]',
  },
  {
    code: 'quality_expiring_email',
    name: '计量证书到期提醒（邮件）',
    channel: 'email',
    title_template: '【AssetHub】计量证书即将到期：{{asset_code}}',
    content_template: `<h2 style="color:#e67e22;">⚠ 计量证书即将到期</h2>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:600px;font-family:Arial,sans-serif;">
<tr><td width="150" style="background:#f5f5f5;"><b>资产编号</b></td><td>{{asset_code}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>资产名称</b></td><td>{{asset_name}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>证书编号</b></td><td>{{certificate_no}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>到期日期</b></td><td style="color:red;font-weight:bold;">{{expiry_date}}</td></tr>
<tr><td style="background:#f5f5f5;"><b>剩余天数</b></td><td style="color:red;font-weight:bold;">{{remaining_days}}天</td></tr>
</table>
<p style="color:#e67e22;font-weight:bold;">请尽快安排计量检定，避免证书过期。</p>`,
    variables_json: '["asset_code","asset_name","certificate_no","expiry_date","remaining_days"]',
  },

  // ==================== 站内消息模板 ====================
  {
    code: 'general_notification_socket',
    name: '通用通知（站内消息）',
    channel: 'socket',
    title_template: '📢 {{title}}',
    content_template: `【{{type_name}}通知】
{{message}}
${''}
时间：{{time}}
${''}
点击查看详情`,
    variables_json: '["title","type_name","message","time"]',
  },
  {
    code: 'maintenance_reminder_socket',
    name: '维修提醒（站内消息）',
    channel: 'socket',
    title_template: '🔧 维修提醒',
    content_template: `您有新的维修任务：
资产：{{asset_name}}（{{asset_code}}）
故障级别：{{fault_level}}
报修人：{{request_person}}
${''}
请及时处理。`,
    variables_json: '["asset_name","asset_code","fault_level","request_person"]',
  },
  {
    code: 'approval_reminder_socket',
    name: '审批提醒（站内消息）',
    channel: 'socket',
    title_template: '📝 审批提醒',
    content_template: `您有一条待审批事项：
审批编号：{{approval_no}}
审批类型：{{approval_type}}
申请人：{{applicant}}
${''}
请及时处理。`,
    variables_json: '["approval_no","approval_type","applicant"]',
  },
  {
    code: 'inventory_task_reminder_socket',
    name: '盘点任务提醒（站内消息）',
    channel: 'socket',
    title_template: '📊 盘点任务提醒',
    content_template: `您有待完成的盘点任务：
任务名称：{{task_name}}
截止时间：{{plan_end}}
${''}
请按时完成盘点。`,
    variables_json: '["task_name","plan_end"]',
  },
  {
    code: 'asset_expiry_reminder_socket',
    name: '资产到期提醒（站内消息）',
    channel: 'socket',
    title_template: '⚠️ 资产到期提醒',
    content_template: `以下资产即将到期：
资产编号：{{asset_code}}
资产名称：{{asset_name}}
到期日期：{{expiry_date}}
${''}
请及时处理。`,
    variables_json: '["asset_code","asset_name","expiry_date"]',
  },
];

async function main() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'Cmu19801008',
    database: 'zcgl',
    waitForConnections: true,
    connectionLimit: 2,
  });

  const conn = await pool.getConnection();

  try {
    // 先检查是否已有数据
    const [existing] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM notification_templates WHERE tenant_id = 0'
    );
    if (existing[0].cnt > 0) {
      console.log(`⚠️ 已存在 ${existing[0].cnt} 条系统模板，将先清空后重新插入`);
      await conn.query('DELETE FROM notification_templates WHERE tenant_id = 0');
    }

    let inserted = 0;
    let skipped = 0;

    for (const tpl of TEMPLATES) {
      // 检查 code 是否已存在
      const [dup] = await conn.query(
        'SELECT id FROM notification_templates WHERE code = ? AND tenant_id = 0',
        [tpl.code]
      );
      if (dup.length > 0) {
        console.log(`  ⊘ 跳过重复: ${tpl.code}`);
        skipped++;
        continue;
      }

      await conn.query(
        `INSERT INTO notification_templates 
         (tenant_id, code, name, channel, title_template, content_template, variables_json, enabled, created_at, updated_at)
         VALUES (0, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [
          tpl.code,
          tpl.name,
          tpl.channel,
          tpl.title_template,
          tpl.content_template,
          tpl.variables_json,
        ]
      );
      inserted++;
      console.log(`  ✓ ${tpl.code}`);
    }

    // 确认总数
    const [total] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM notification_templates WHERE tenant_id = 0'
    );
    console.log(`\n✅ 完成！共插入 ${inserted} 条模板，跳过 ${skipped} 条，当前系统模板总数: ${total[0].cnt}`);

    // 按渠道统计
    const [byChannel] = await conn.query(
      `SELECT channel, COUNT(*) AS cnt FROM notification_templates WHERE tenant_id = 0 GROUP BY channel`
    );
    console.log('\n渠道分布:');
    byChannel.forEach(r => console.log(`  ${r.channel}: ${r.cnt} 条`));
  } catch (err) {
    console.error('❌ 插入失败:', err.message);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
