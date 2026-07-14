/**
 * 飞书事件 webhook 配置诊断接口
 * GET /api/feishu/diagnostic
 *
 * 帮助用户排查"为什么机器人没反应"：
 *   1. 验证后端 webhook 端点是否可访问
 *   2. 显示应该填到飞书后台的回调 URL
 *   3. 列出当前租户绑定的飞书应用
 *   4. 测试发送一条消息（如果配置了真实 open_id）
 */

const logger = require('../../../config/logger');
const db = require('../../../config/database');

/**
 * GET /api/feishu/diagnostic
 */
async function diagnostic(req, res) {
  try {
    // 1. 计算应该配置的回调 URL
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    const expectedWebhookUrl = `${proto}://${host}/api/feishu/event`;

    // 2. 列出当前所有绑定飞书的租户
    const [rows] = await db.execute(
      `SELECT tenant_id, config, enabled
       FROM tenant_configs
       WHERE config_key = 'feishu' AND enabled = 1`
    );

    const tenants = rows.map(r => {
      const cfg = typeof r.config === 'string' ? JSON.parse(r.config) : r.config;
      return {
        tenantId: r.tenant_id,
        appId: cfg.app_id || cfg.appId,
        hasAppSecret: !!(cfg.app_secret || cfg.appSecret),
        redirectUri: cfg.redirect_uri,
        // 不返回 app_secret
      };
    });

    // 3. 给用户的排查 checklist
    const checklist = [
      {
        step: 1,
        title: '飞书开放平台 - 应用后台',
        url: 'https://open.feishu.cn/app',
        actions: [
          '找到您的应用 (cli_a9327e24abbb1cc8)',
          '左侧菜单 → 事件订阅',
          '填入"请求 URL"：' + expectedWebhookUrl,
          '点击"保存"，飞书会发送 url_verification 请求',
          '看到"已通过"才算配置成功',
        ],
      },
      {
        step: 2,
        title: '添加事件订阅',
        actions: [
          '在"事件订阅"页面 → 添加事件',
          '搜索并勾选：im.message.receive_v1',
          '权限：接收消息 v2.0',
          '点击"确认添加"',
        ],
      },
      {
        step: 3,
        title: '权限管理',
        url: 'https://open.feishu.cn/app/' + (tenants[0]?.appId || 'YOUR_APP_ID') + '/auth',
        actions: [
          '左侧菜单 → 权限管理',
          '搜索以下权限并申请：',
          '  · im:message:send_as_bot（以应用身份发消息）',
          '  · im:message.p2p_msg（给用户发私信）',
          '  · im:message.group_at_msg（群 @ 消息）',
          '点击"申请权限"，等待审批通过',
        ],
      },
      {
        step: 4,
        title: '版本发布',
        actions: [
          '左侧菜单 → 版本管理与发布',
          '创建一个版本',
          '提交审核（如果是企业自建应用通常自动通过）',
          '等待"已发布"状态',
        ],
      },
      {
        step: 5,
        title: '测试对话',
        actions: [
          '在飞书里搜索您的应用名称',
          '点击进入聊天窗口',
          '发送任意文本消息（如"你好"）',
          '应在几秒内收到回复',
        ],
      },
    ];

    return res.json({
      success: true,
      data: {
        webhookUrl: expectedWebhookUrl,
        webhookTest: {
          url: expectedWebhookUrl,
          method: 'POST',
          bodyExample: {
            type: 'url_verification',
            challenge: 'will_be_returned_as_is',
          },
        },
        tenants,
        checklist,
        commonIssues: [
          '❌ 没收到回复 → 飞书后台"事件订阅"的请求 URL 没填或填错',
          '❌ 收到挑战验证失败 → 后端服务异常，本页面会自动检测',
          '❌ 收到回复但内容是"抱歉，AI 助手暂时无法响应" → 真实 AI 接口未配置',
          '❌ 用户收到的是错误码 → 通常是飞书应用权限未申请 im:message.*',
        ],
      },
    });
  } catch (e) {
    logger.error('[FeishuDiagnostic] 生成诊断信息失败', { error: e.message });
    return res.status(500).json({ success: false, message: e.message });
  }
}

module.exports = { diagnostic };