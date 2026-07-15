# AssetHub 通知系统 - 完整运维文档

> 适用于：系统管理员、运维工程师、二次开发人员
> 最后更新：2026-07-15
> 关联版本：AssetHub 通知体系 v1.0（飞书 + 站内双通道 + 配置化 + 勿扰）

---

## 1. 整体架构

```
                      业务事件（EventBus）
                             ↓
              ┌──────────────┴──────────────┐
              ↓                              ↓
       飞书通知服务                    站内通知服务
              ↓                              ↓
       resolveRecipients             makeHandler
              ↓                              ↓
       recipient_strategies          recipient_strategies
       （接收人策略）                  （接收人策略）
              ↓                              ↓
       filterUsersByPreferences      filterUsersByPreferences
       （DND + 紧急度）                （DND + 紧急度）
              ↓                              ↓
       lookupOpenIds（飞书）          in_app_notifications
              ↓                              ↓
       飞书卡片推送                   pushToUsers
                                            ↓
                                      app:notification
```

**两个通道共享**：接收人策略 + 用户偏好。两套机制独立运行（飞书关了不影响站内，反之亦然）。

---

## 2. 4 个核心表

| 表 | 作用 | 关键字段 |
|---|---|---|
| `in_app_notifications` | 站内消息持久化 | user_id, event_code, urgency, is_read, expires_at |
| `recipient_strategies` | 接收人策略（管理员配置） | event_code, strategy_type, strategy_value, priority, enabled |
| `notification_preferences` | 用户偏好（用户自配） | user_id, event_code, dnd_*, urgency_threshold, enabled |
| `notification_logs` | 飞书/邮件发送记录 | event_code, channel, status, sent_count |

> 注：4 张表均随 server 启动自动创建，无需手动迁移。

---

## 3. 接收人策略（管理员）

### 3.1 什么是接收人策略

解决"这个事件到底推给谁"的问题。原来是硬编码在 `in-app-notification.service.js` 里，现在可以可视化配置。

### 3.2 10 种策略类型

| 类型 | 用途 | 是否需要值 |
|---|---|---|
| `user` | 指定用户（多 userId） | 是 |
| `role` | 角色全员（如 `maintenance_admin`） | 是（role 名） |
| `applicant` | 发起人 | 否（读 payload.applicantId） |
| `approver` | 审批人 | 否 |
| `assignee` | 被指派人 | 否 |
| `requester` | 报修人 | 否 |
| `operator` | 操作人 | 否 |
| `tenant_admin` | 租户管理员 | 否 |
| `engineer` | 维修工程师 | 否 |
| `department` | 部门成员 | 是（department_code） |

### 3.3 配置入口

**前端 UI**：`/notification-config` → 「接收人策略」Tab（第 4 个）

**REST API**：

```bash
# 元数据（策略类型 + 已知事件）
GET /api/recipient-strategies/meta

# 列表
GET /api/recipient-strategies?eventCode=xxx&page=1&pageSize=20

# 查某事件的所有策略
GET /api/recipient-strategies/event/:eventCode

# 新增
POST /api/recipient-strategies
{
  "event_code": "scrapping:created",
  "strategy_type": "role",
  "strategy_value": "system_admin",
  "priority": 10,
  "remark": "报废申请只通知系统管理员"
}

# 修改
PUT /api/recipient-strategies/:id
{ "enabled": false }

# 删除
DELETE /api/recipient-strategies/:id
POST /api/recipient-strategies/batch-delete  # 批量
{ "ids": [1, 2, 3] }

# 预览：在指定 payload 下会推给哪些用户
POST /api/recipient-strategies/preview
{ "eventCode": "scrapping:created", "payload": {...} }
```

### 3.4 解析优先级

每条事件触发的接收人解析顺序：

1. 查 `recipient_strategies` 表（5min 内存缓存）
2. 命中 → 按 `priority DESC` 顺序执行所有启用的策略，结果 union 去重
3. 未命中 → 走 `in-app-notification.service.js` 里的硬编码默认逻辑
4. 全部无接收人 → 跳过该事件

> 同一事件可配多条策略（多 type），结果 union。

### 3.5 飞书和站内是否都用同一份？

**是的**。两个服务都通过 `recipientStrategy.resolveRecipients(tenantId, eventCode, payload)` 解析，差异只在飞书拿到 userId 后还要查 open_id。

---

## 4. 用户通知偏好（勿扰 + 紧急度阈值）

### 4.1 什么是用户偏好

解决"我什么时候不想被打扰"的问题。每个用户自己配，互不影响。

### 4.2 4 个核心维度

| 维度 | 行为 | 默认 |
|---|---|---|
| `enabled` | 总开关 | 开启 |
| `urgency_threshold` | 紧急度阈值（`low`/`medium`/`high`），低于此值不通知 | `low`（全收） |
| `dnd_enabled` + `dnd_start_time` + `dnd_end_time` | 勿扰时段（支持跨午夜，如 22:00-08:00） | 关闭 |
| `dnd_override_urgency` | DND 期间，紧急度≥此值仍推送 | `high` |
| `desktop_enabled` / `toast_enabled` | 桌面通知 / 顶部气泡（仅站内） | 开启 |

### 4.3 配置入口

**前端 UI**：`/notification-preferences`

**REST API**：

```bash
# 元数据
GET /api/notification-preferences/meta

# 我的所有偏好
GET /api/notification-preferences/me

# 我的合并偏好（单事件覆盖全局）
GET /api/notification-preferences/me/effective?eventCode=xxx

# 新增/更新（upsert by user_id+event_code）
POST /api/notification-preferences
{
  "user_id": 1,
  "event_code": null,            // null=全局
  "enabled": true,
  "urgency_threshold": "low",
  "dnd_enabled": true,
  "dnd_start_time": "22:00:00",
  "dnd_end_time": "08:00:00",
  "dnd_days": "1,2,3,4,5,6,7",
  "dnd_override_urgency": "high"
}

# 删除（恢复默认）
DELETE /api/notification-preferences/:id

# 预览：在指定时间+紧急度下是否推送
POST /api/notification-preferences/preview
{ "userId": 1, "urgency": "high", "now": "2026-07-14T23:00:00" }
```

### 4.4 评估时机

```
deliver(userIds, ...) {
  filterUsersByPreferences(userIds, eventCode, urgency)
    → 仍然落库（不丢历史）
    → 过滤掉的用户不推 Socket / 不发飞书
}
```

> **关键**：被偏好过滤的消息**仍然写入 `in_app_notifications`**，用户可在站内消息 Tab 手动查看。保证不丢历史。

### 4.5 跨午夜时段

开始时间 > 结束时间时视为跨午夜：
- `22:00 - 06:00` → 22:00 起到次日 06:00
- `09:00 - 18:00` → 09:00 到 18:00（同日）

### 4.6 合并策略

`event_code` 为 NULL 表示全局偏好，有 `event_code` 的单事件偏好覆盖全局。

例：
- 全局：`urgency_threshold=low, dnd=22-08`
- 单事件 `maintenance:approved`：`urgency_threshold=high`（只看紧急）
- 实际接收：维修工单只看高紧急，22-08 DND 不生效

---

## 5. 飞书通知（feishu-notification.service）

### 5.1 订阅的事件（共 50+）

- 资产报废 / 调配 / 状态变更 / 领用归还
- 维修申请 / 工单派发完成
- 盘点创建 / 完成 / 任务分配完成
- 招标创建/发布/定标/完成/取消
- 投标 / 中标 / 资质审核 / 邀请
- 发票创建/审核/付款/归档/取消
- 付款单创建/提交/付款/失败/取消
- 验收提醒（到期/超期）
- 预防性维护提醒
- 新用户加入企业

完整列表见 `feishu-notification.service.js` 的 `initFeishuNotification()` 函数。

### 5.2 接收人解析（已配置化）

1. 查 `recipient_strategies` 表
2. 命中 → 用配置的策略解析 userId
3. 未命中 → 走原逻辑（payload 字段 + 租户审批人兜底）
4. userId → open_id（feishu_bindings + 手机号反查）
5. **DND/紧急度过滤**（同站内）
6. 循环发送飞书卡片

### 5.3 关闭飞书通知

```bash
# 环境变量（不重启也行，运行中的服务会立即生效）
export FEISHU_NOTIFICATION_ENABLED=false

# 完整重启
pkill -f "node.*server.js"
cd /Volumes/移动硬盘（500）/AssetHub/backend
nohup /usr/local/bin/node server.js > logs/backend.log 2>&1 &
```

### 5.4 调试

- 飞书应用凭证：`.env` 中 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_HOST`
- 租户级凭证：`tenant_configs` 表的 `feishu_config` 项
- 飞书绑定：`feishu_bindings` 表，user_id → open_id

---

## 6. 站内通知（in-app-notification.service）

### 6.1 行为

- 落库到 `in_app_notifications`（默认 30 天过期）
- 推 WebSocket 事件 `app:notification`
- 前端 AlertNotification 组件订阅，更新红点 + 桌面通知 + 顶部气泡

### 6.2 关闭站内通知

```bash
export IN_APP_NOTIFICATION_ENABLED=false
```

### 6.3 调整过期时间

```bash
export IN_APP_NOTIFICATION_EXPIRES_DAYS=60   # 默认 30
```

### 6.4 自动清理调度器

`backend/services/in-app-notification.scheduler.js`

| 任务 | Cron | 操作 |
|---|---|---|
| 清理过期 | `0 3 * * *` | 删除 `expires_at < NOW()` 的消息（分批 5000/批） |
| 清理老已读 | `0 4 * * 0` | 删除 90 天前已读消息 |

可调环境变量：
- `IN_APP_NOTIFICATION_EXPIRED_CRON`
- `IN_APP_NOTIFICATION_OLD_READ_CRON`
- `IN_APP_NOTIFICATION_OLD_READ_DAYS`
- `IN_APP_NOTIFICATION_CLEANUP_BATCH`
- `IN_APP_NOTIFICATION_SCHEDULER_DISABLED=true` 关闭整个调度器

### 6.5 手动触发清理

```bash
# 仅管理员
POST /api/in-app-notifications/admin/cleanup
{ "mode": "all" | "expired" | "old_read" }

# 看统计
GET /api/in-app-notifications/admin/stats
```

---

## 7. 通知引擎（notification-send.service）

> 老的可配置通知引擎（基于 notification_rules / notification_templates）
> 跟上面 3 个新组件**并存**。新代码默认走 in-app-notification + 飞书的硬编码逻辑。
> 这个引擎适合复杂的多模板/多场景规则。

详情见 `backend/services/notification-config.service.js`。

---

## 8. 故障排查

### 8.1 事件没触发通知

1. 看后端日志（`/Volumes/移动硬盘（500）/AssetHub/logs/backend.log`）有没有 `[InAppNotify]` 或 `[FeishuNotify]` 输出
2. `tail -f logs/backend.log | grep -E "Notify|filter"`
3. 用 `inAppNotificationAPI._test-publish`（仅 dev）触发测试事件

### 8.2 通知发了但用户收不到

- 检查 DND：让用户访问 `/notification-preferences` 看是否处于勿扰时段
- 飞书未绑：`SELECT * FROM feishu_bindings WHERE user_id = ?`
- 接收人被策略过滤：`POST /api/recipient-strategies/preview` 看解析结果
- 看 `notification_logs` 表（飞书通道）：`SELECT * WHERE event_code = ? ORDER BY created_at DESC`

### 8.3 表不存在

后端启动时自动建表。如果失败：
```sql
-- 手动确认
SHOW TABLES LIKE 'in_app_notifications';
SHOW TABLES LIKE 'recipient_strategies';
SHOW TABLES LIKE 'notification_preferences';
```

### 8.4 缓存问题

策略 / 偏好的 5min 缓存：
```js
// 强制失效（后端）
require('./services/recipient-strategy.service').clearCache(tenantId, eventCode);
require('./services/notification-preference.service').clearCache(userId, eventCode);
```

---

## 9. 常用运维命令

```bash
# 查当前未读消息数
SELECT COUNT(*) FROM in_app_notifications WHERE user_id = 1 AND is_read = 0;

# 查某事件最近 7 天的发送量
SELECT event_code, COUNT(*) AS cnt
FROM in_app_notifications
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY event_code
ORDER BY cnt DESC;

# 查飞书发送成功率
SELECT status, COUNT(*) AS cnt
FROM notification_logs
WHERE channel = 'feishu' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY status;

# 重置某用户的偏好（恢复默认）
DELETE FROM notification_preferences WHERE user_id = 1;

# 禁用某事件的所有策略（回退到硬编码）
UPDATE recipient_strategies SET enabled = 0 WHERE event_code = 'scrapping:created';
```

---

## 10. 完整事件清单

> 50+ 事件，覆盖：维修、报废、调配、盘点、招标、发票、付款、验收、预防性维护、用户管理等

| 分类 | 事件 | 飞书 | 站内 | 默认接收人 |
|---|---|---|---|---|
| 维修 | `maintenance:approved` | ✅ | ✅ | engineer + approver |
| 维修 | `maintenance_request:created` | ✅ | ✅ | maintenance_admin + asset_admin |
| 维修 | `maintenance_request:approved` | ✅ | ✅ | request_person_id |
| 维修 | `maintenance_request:rejected` | ✅ | ✅ | request_person_id |
| 维修 | `maintenance_request:started` | ✅ | ✅ | request_person_id + repair_person_id |
| 维修 | `maintenance_request:completed` | ✅ | ✅ | applicantId |
| 维修 | `maintenance_request:cancelled` | ✅ | ✅ | applicantId |
| 维修 | `workorder:assigned` | ✅ | ✅ | assigneeId |
| 维修 | `workorder:completed` | ✅ | ✅ | request_person_id |
| 报废 | `scrapping:created/approved/rejected/completed` | ✅ | ✅ | tenant approver fallback |
| 调配 | `transfer:created/approved/rejected/completed` | ✅ | ✅ | tenant approver fallback |
| 资产 | `asset_workflow:transition` | ✅ | ✅ | operatorId |
| 资产 | `asset_usage:checkout/return` | ✅ | ✅ | payload 字段 |
| 盘点 | `inventory:created/completed` | ✅ | ✅ | tenant approver fallback |
| 盘点 | `inventory_task:created/completed/cancelled` | ✅ | ✅ | payload 字段 |
| 招标 | `tender:created/published/awarded/completed/cancelled` | ✅ | ✅ | createdBy |
| 招标 | `bid:submitted/awarded` | ✅ | ✅ | payload 字段 |
| 招标 | `qualification:reviewed` | ✅ | ✅ | reviewedBy |
| 招标 | `tender:invitation-sent` | ✅ | ✅ | payload 字段 |
| 发票 | `tender:invoice:created/verified/claimed/paid/archived/cancelled` | ✅ | ✅ | payload 字段 |
| 付款 | `tender:payment:created/submitted/paying/paid/failed/cancelled` | ✅ | ✅ | payload 字段 |
| 验收 | `acceptance:reminder` | ✅ | ✅ | target_user_id / tenant approver |
| 预防性维护 | `maintenance_plan:reminder` | ✅ | ✅ | tenant approver |
| 用户 | `notification:role_request` | ✅ | ✅ | admins |

---

## 11. 版本演进

| 版本 | 变更 |
|---|---|
| v0.x | 飞书 + 维修事件通知（原始） |
| v1.0 (2026-07) | 飞书 + 站内双通道 + 接收人策略 + 勿扰偏好 + 清理调度器 |

后续路线图：
- 通知聚合（同一资产 N 分钟内多条合并）
- 模板变量渲染（支持 user/asset/workorder 字段）
- 部门广播（按部门群发）
- 通知统计 Dashboard
