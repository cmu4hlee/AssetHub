# 巡检增强 - 运行 & 验证手册

跑完上一轮所有改动后,按下面顺序操作。这一份是"装机清单",做完就能上线。

## 0. 前置检查(5 分钟)

```bash
cd /Volumes/移动硬盘（500）/AssetHub/backend
node -v        # 需要 >= 18
ls node_modules/node-cron node_modules/ejs node_modules/puppeteer  # 三个都要在
```

如果 node-cron 或 ejs 缺,跑一次 `npm install`;puppeteer 体积大,如果服务器网络不好,可能需要 `PUPPETEER_SKIP_DOWNLOAD=true npm install puppeteer-core` + 手动指向系统 Chrome。

## 1. 跑数据库迁移(2 分钟)

```bash
# 先备份!先备份!先备份!
mysqldump -h 192.168.1.111 -u root -p assethub > /tmp/assethub_before_inspection_enh.sql

# 巡检模块
mysql -h 192.168.1.111 -u root -p assethub \
  < backend/modules/inspection-management/migrations/003_enhancements.sql

# 安全检测模块
mysql -h 192.168.1.111 -u root -p assethub \
  < backend/modules/safety-inspection-management/migrations/001_enhancements.sql

# 验证新表都建好了
mysql -h 192.168.1.111 -u root -p assethub -e "
  SHOW TABLES LIKE 'inspection_%';
  SHOW TABLES LIKE 'safety_inspection_issues';
"
```

**预期看到 7 张新表**:`inspection_sequences`、`inspection_plans`、`inspection_routes`、`inspection_route_points`、`inspection_issue_histories`、`inspection_notifications`、`safety_inspection_issues`

如果某张表已存在报错,直接跳过(说明之前手建过),用 `DESCRIBE` 看一下字段是否齐全就行。

## 2. 验证改造结构(2 分钟,纯本地)

```bash
cd /Volumes/移动硬盘（500）/AssetHub
ls backend/modules/inspection-management/scheduler/inspection.scheduler.js
ls backend/modules/inspection-management/services/inspection-extended.service.js
ls frontend/src/components/SignaturePad.jsx
ls frontend/src/pages/inspection/InspectionCalendar.jsx
ls scripts/verify-inspection-enhancements.js
```

六个文件都应该在。

## 3. 重启后端(1 分钟)

```bash
cd backend
# 杀旧的
pkill -f "node.*server.js" || true
sleep 1
# 启新的(后台)
nohup node server.js > /tmp/assethub-backend.log 2>&1 &
sleep 5

# 看启动日志,关注这几行
tail -50 /tmp/assethub-backend.log | grep -E "scheduler|Socket|巡检|inspection"
```

**预期日志**:
- `[inspection] 调度器启动` (或类似)
- 4 个 cron 注册成功
- 没有 EADDRINUSE / 字段不存在的报错

## 4. 自动跑验证(1 分钟)

```bash
# 拿 token
export TOKEN=$(curl -s -X POST http://localhost:5183/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"你的密码"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['data']['token'])")

# 跑验证脚本
cd /Volumes/移动硬盘（500）/AssetHub
node scripts/verify-inspection-enhancements.js
```

**预期 12 项全 ✅**。如果哪项 ❌,看末尾的失败详情 + 后端日志。

## 5. 手动跑关键路径(15-20 分钟)

自动验证只覆盖"接口存活 + 权限通过",业务正确性需要手动过:

### 路径 ① 闭环:逾期自动标记
1. 进 `/inspection`(巡检任务列表)
2. 找一个状态是 `pending` 的任务,把它 `plan_date` 改成昨天(直接改库最快)
3. 等到 02:00 cron 跑,或手动触发:
   ```bash
   node -e "require('./backend/modules/inspection-management/services/inspection-extended.service').runOverdueMark().then(r=>console.log(r))"
   ```
4. 刷新任务列表,该任务状态应变成 `overdue`

### 路径 ② 批量生成
1. 在 `InspectionList` 页点"批量生成"
2. 选 2-3 个资产,选模板,提交
3. 应生成对应任务,任务号形如 `INSP-2026-XXXX`(用行锁序列,不会重复)

### 路径 ③ 模板复制
```bash
curl -X POST http://localhost:5183/api/inspection/templates/1/copy \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"target_name":"模板-副本-test"}'
```
应返回新模板 ID,检查项数与原模板一致。

### 路径 ④ 异常转工单
1. 在 `InspectionRecordForm` 填一份记录单,至少一个检查项标 `abnormal`
2. 提交后系统会自动生成 issue
3. 进 `/inspection/issues` 找到这个 issue,点"转工单"
4. 进维修工单模块,应看到这条工单,描述里引用了 issue_code

### 路径 ⑤ 签名画板 + PDF 导出
1. 在 `InspectionRecordForm` 签名画板上画几下 → 应变成 base64 数据
2. 提交后进 `InspectionRecordDetail`,点"导出 PDF"
3. 应下载 A4 PDF,签名图片出现在底部"巡检人签字"位置

### 路径 ⑥ 巡检计划自动派发
1. 进 `/inspection/plans` 建一个计划,周期 1 天,起始日期今天
2. 手动触发派发:
   ```bash
   curl -X POST http://localhost:5183/api/inspection/plans/1/dispatch \
     -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: 1"
   ```
3. 进 `/inspection` 应看到新生成的、关联该计划的任务

### 路径 ⑦ 安全检测整改
1. 进安全检测页,提交一份 `inspection_result=fail` 的记录
2. 系统应自动创建 `safety_inspection_issues` 一条,状态 `open`
3. 进 `rectification_status=in_progress` 后等过期,02:30 cron 应发提醒

## 6. 上线 checklist

- [ ] 步骤 0-4 全绿
- [ ] 步骤 5 的 7 条路径至少 ①②③④⑥ 都跑通
- [ ] 后端日志 24 小时没新 ERROR
- [ ] scheduler 4 个 cron 都在 `crontab -l` 列表里(或 node-cron 内部 list)
- [ ] 数据库备份保留

## 常见报错速查

| 报错 | 原因 | 解决 |
|------|------|------|
| `Cannot find module 'node-cron'` | 没装 | `cd backend && npm install` |
| `Cannot find module 'puppeteer'` | 跳过下载装的方式不对 | 用 `npm install puppeteer` 重装,或改 `puppeteer-core` + 系统 Chrome |
| `Puppeteer launch failed: libnss3.so` | 服务器缺系统库 | `apt install libnss3 libatk-bridge2.0-0 libgtk-3-0 libxkbcommon0 libgbm1` |
| 迁移 `Duplicate column name 'recurring_plan_id'` | 之前手动加过 | 跳过 ALTER 那行,CREATE TABLE 正常跑 |
| 迁移 `Table 'inspection_sequences' already exists` | 同上 | 跳过 |
| 验证脚本项 2 ❌(status 接口) | 路由没挂上 | 检查 `server.js` 617 行 + 路由文件存在 |
| 验证脚本项 11 ❌(PDF) status 500 | Puppeteer 启动失败 | 看后端日志,系统库问题 |
| 通知一直为空 | 数据库刚迁移没数据 | 触发一次 `runExpiringAlerts(30)` 写一批 |

## 不在本次范围

- 维修工单模块内部通知
- 多租户数据隔离的端到端压测
- 巡检移动端(目前只做了 PC)
- 历史数据回填(只对新数据生效)
