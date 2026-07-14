# OpenClaw 设备监测与故障上报说明

本文档专门说明 AssetHub 里“设备监测 / 资产监测”这组接口怎么调用，以及如何让 OpenClaw 正确接收：

- 设备错误码
- 错误信息
- 错误分析
- 错误截图

先说结论：

1. 当前项目已经有可用的设备监测接收接口，主入口是 `POST /api/iot/asset-monitoring/ingest`。
2. 当前实现里，`error_code` 是一等字段，会单独入库。
3. `error_message`、`error_analysis`、`screenshot_url` 这类扩展字段，当前虽然不是一等列，但可以跟随原始 JSON 一起进入 `payload_json`，不会丢失。
4. 当前没有单独的“设备监测截图 multipart 上传接口”，所以截图更适合用“先上传图片，再传 URL”或“临时传 base64”的方式接入。

---

## 1. 当前已经实现的接口

### 1.1 设备监测上报

- 单条上报：`POST /api/iot/asset-monitoring/ingest`
- 批量上报：`POST /api/iot/asset-monitoring/ingest/batch`

### 1.2 设备监测查询

- 查某设备最新监测：`GET /api/iot/asset-monitoring/devices/{deviceId}/latest`
- 查某资产最新监测：`GET /api/iot/asset-monitoring/assets/{assetCode}/latest`
- 查某资产监测时序：`GET /api/iot/asset-monitoring/assets/{assetCode}/series`
- 查管道说明：`GET /api/iot/asset-monitoring/pipeline/docs`
- 查管道健康：`GET /api/iot/asset-monitoring/pipeline/health`

### 1.3 一个关键例外：它不是普通业务登录接口

这组接口和 `/api/assets`、`/api/maintenance` 不一样。

设备监测上报通常不是“用户登录后带 JWT 调”的用户态业务接口，而是“硬件网关 / 设备代理”带 IoT Token 直接上报：

- 推荐请求头：`x-iot-token: <YOUR_TOKEN>`
- 兼容：`Authorization: Bearer <YOUR_TOKEN>`
- 也兼容 query token：`?token=<YOUR_TOKEN>`

所以 OpenClaw 看到“设备自动上报错误 / 网关上报监测数据”这类任务时，不应该先强制走 `/api/users/login`，而应该切换到 IoT 设备上报模式。

---

## 2. 如何准备调用凭证

设备监测建议使用企业级 IoT Token，scope 设为：

- `asset-monitoring`

相关接口：

- 查看支持的 scope：`GET /api/system-config/iot-tokens/scopes`
- 生成 Token：`POST /api/system-config/iot-tokens/generate`
- 校验 Token：`POST /api/system-config/iot-tokens/verify`
- 查看使用说明：`GET /api/system-config/iot-tokens/usage-guide?scope=asset-monitoring`

生成 Token 请求示例：

```json
{
  "token_name": "device-monitor-gateway",
  "scopes": ["asset-monitoring"],
  "expires_in_days": 90
}
```

返回里会给出明文 `token`，这个值只会展示一次，应该保存到设备网关配置里。

---

## 3. 当前后端真正要求的最小字段

当前实现并不是“只要传任意 JSON 就会收”。它至少要求：

- `device_id` 必填
- 下列监测字段至少提供一个：
  - `runtime_state`
  - `signal_strength`
  - `battery_level`
  - `cpu_usage`
  - `memory_usage`
  - `error_code`

也就是说：

- 如果你只是想上报“错误信息文字”，但没有 `error_code`，当前实现会认为“监测参数不能为空”
- 所以建议故障类上报至少带：`device_id + error_code`

建议同时补充：

- `asset_code`
- `event_time`
- `runtime_state`
- `error_message`
- `error_analysis`
- `severity`
- `screenshot_url`

其中：

- `asset_code` 当前不是强制，但如果不传，系统会尝试按 `device_id` 去资产绑定关系里反查
- `event_time` 不传时会自动用当前时间

---

## 4. 当前实现对错误信息、错误分析、截图的支持方式

### 4.1 错误码 `error_code`

这是当前实现里的标准字段，会进入时序表独立列，适合做筛选、统计、风险分析。

推荐示例：

```json
{
  "device_id": "MON-001",
  "asset_code": "ASSET-001",
  "runtime_state": "error",
  "error_code": "E101",
  "event_time": "2026-03-25T10:30:00+08:00"
}
```

### 4.2 错误信息 `error_message`

当前代码没有单独的 `error_message` 数据列，但因为原始 payload 会整体写入 `payload_json`，所以可以直接这样传：

```json
{
  "device_id": "MON-001",
  "asset_code": "ASSET-001",
  "runtime_state": "error",
  "error_code": "E101",
  "error_message": "高压模块过温，设备已自动停机",
  "event_time": "2026-03-25T10:30:00+08:00"
}
```

这样做的效果是：

- `error_code` 进入标准列
- `error_message` 会保留在 `payload_json` 中
- 后续 OpenClaw 查询最新记录或时序记录时，可以从 `payload_json` 里提取它

### 4.3 错误分析 `error_analysis`

当前也没有独立列，但同样可以跟着原始 payload 传入：

```json
{
  "device_id": "MON-001",
  "asset_code": "ASSET-001",
  "runtime_state": "error",
  "error_code": "E101",
  "error_message": "高压模块过温，设备已自动停机",
  "error_analysis": "初步判断为散热风扇异常或通风口堵塞，建议先停机检查风道",
  "severity": "high",
  "event_time": "2026-03-25T10:30:00+08:00"
}
```

### 4.4 错误截图 `screenshot`

当前没有 `multipart/form-data` 的专用截图上报接口，所以建议分两种策略：

#### 推荐方案：传截图 URL

最稳定的做法是：

1. 先把截图上传到对象存储 / 文件服务 / 资产图片接口
2. 再在设备监测上报里传 `screenshot_url`

示例：

```json
{
  "device_id": "MON-001",
  "asset_code": "ASSET-001",
  "runtime_state": "error",
  "error_code": "E101",
  "error_message": "高压模块过温，设备已自动停机",
  "error_analysis": "初步判断为散热异常",
  "screenshot_url": "/uploads/device-errors/mon-001-20260325103000.png",
  "event_time": "2026-03-25T10:30:00+08:00"
}
```

#### 过渡方案：传 base64

如果设备侧暂时没有独立文件上传能力，也可以临时传：

- `screenshot_base64`
- `screenshot_mime_type`
- `screenshot_name`

示例：

```json
{
  "device_id": "MON-001",
  "asset_code": "ASSET-001",
  "runtime_state": "error",
  "error_code": "E101",
  "error_message": "高压模块过温，设备已自动停机",
  "screenshot_name": "error-screen.png",
  "screenshot_mime_type": "image/png",
  "screenshot_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "event_time": "2026-03-25T10:30:00+08:00"
}
```

但是要注意：

- 这会显著增大请求体
- 当前项目虽然 JSON body limit 是 `50mb`，但不适合长期把大图片直接塞进监测时序表原始 JSON
- 更适合短期联调，不适合长期生产方案

所以正式环境还是建议“图片上传 + URL 回填”。

---

## 5. 单条上报调用示例

### 5.1 最推荐的故障上报格式

```bash
curl -X POST "https://<host>/api/iot/asset-monitoring/ingest" \
  -H "Content-Type: application/json" \
  -H "x-iot-token: <YOUR_IOT_TOKEN>" \
  -d '{
    "device_id": "MON-001",
    "asset_code": "ASSET-001",
    "runtime_state": "error",
    "error_code": "E101",
    "error_message": "高压模块过温，设备已自动停机",
    "error_analysis": "疑似风扇卡滞或散热孔堵塞，建议停机检查散热模组",
    "severity": "high",
    "screenshot_url": "/uploads/device-errors/mon-001-20260325103000.png",
    "event_time": "2026-03-25T10:30:00+08:00"
  }'
```

当前这次请求里：

- 标准字段会被系统识别：`device_id`、`asset_code`、`runtime_state`、`error_code`、`event_time`
- 扩展字段会被一起保存在 `payload_json`：`error_message`、`error_analysis`、`severity`、`screenshot_url`

### 5.2 返回示例

```json
{
  "success": true,
  "message": "资产监测数据接收成功",
  "data": {
    "tenant_id": 2,
    "device_id": "MON-001",
    "asset_code": "ASSET-001",
    "event_time": "2026-03-25T02:30:00.000Z",
    "source": "http"
  }
}
```

---

## 6. 批量上报调用示例

### 6.1 直接传数组

```bash
curl -X POST "https://<host>/api/iot/asset-monitoring/ingest" \
  -H "Content-Type: application/json" \
  -H "x-iot-token: <YOUR_IOT_TOKEN>" \
  -d '[
    {
      "device_id": "MON-001",
      "asset_code": "ASSET-001",
      "runtime_state": "error",
      "error_code": "E101",
      "error_message": "高压模块过温",
      "event_time": "2026-03-25T10:30:00+08:00"
    },
    {
      "device_id": "MON-002",
      "asset_code": "ASSET-002",
      "runtime_state": "warning",
      "error_code": "W201",
      "error_message": "电池电量偏低",
      "battery_level": 15,
      "event_time": "2026-03-25T10:31:00+08:00"
    }
  ]'
```

### 6.2 走 batch 包装格式

```bash
curl -X POST "https://<host>/api/iot/asset-monitoring/ingest/batch" \
  -H "Content-Type: application/json" \
  -H "x-iot-token: <YOUR_IOT_TOKEN>" \
  -d '{
    "events": [
      {
        "device_id": "MON-001",
        "asset_code": "ASSET-001",
        "runtime_state": "error",
        "error_code": "E101",
        "error_message": "高压模块过温"
      },
      {
        "device_id": "MON-002",
        "asset_code": "ASSET-002",
        "runtime_state": "warning",
        "error_code": "W201",
        "battery_level": 15,
        "error_message": "电池电量偏低"
      }
    ]
  }'
```

---

## 7. 上报后如何查询

### 7.1 查某设备最新错误 / 最新监测

```bash
curl -X GET "https://<host>/api/iot/asset-monitoring/devices/MON-001/latest" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "X-Tenant-ID: 2"
```

### 7.2 查某资产最新监测

```bash
curl -X GET "https://<host>/api/iot/asset-monitoring/assets/ASSET-001/latest" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "X-Tenant-ID: 2"
```

### 7.3 查某资产时序记录

```bash
curl -X GET "https://<host>/api/iot/asset-monitoring/assets/ASSET-001/series?limit=50" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "X-Tenant-ID: 2"
```

查询结果会返回整行监测记录，里面包含：

- `error_code`
- `runtime_state`
- `battery_level`
- `cpu_usage`
- `memory_usage`
- `payload_json`

OpenClaw 查询后，应该进一步解析 `payload_json`，提取：

- `error_message`
- `error_analysis`
- `severity`
- `screenshot_url`
- `screenshot_base64`
- 设备自定义诊断字段

---

## 8. “错误分析”应该怎么做

这里可以分成两类：

### 8.1 设备端自带分析

如果硬件本身已经能给出错误判断，最简单的做法就是设备直接上报：

- `error_code`
- `error_message`
- `error_analysis`

这样平台只负责接收、存储、展示、查询。

### 8.2 平台端做风险分析

如果想让平台根据历史监测数据给出更偏“预测性维护”的分析，可以在设备监测数据入库后，进一步调用：

- `POST /api/agent-mesh/intelligence/predictive-maintenance`

这个接口更适合做：

- 故障风险趋势判断
- 30天故障概率
- 剩余可用天数估算
- 基于 IoT + 维修历史的综合风险信号

它不是“单次截图识别接口”，而是“历史数据 + 维修记录”的分析接口。

所以推荐理解为：

- 当前错误的直接解释：来自 `error_message` / `error_analysis`
- 历史风险与趋势：来自 `predictive-maintenance`

---

## 9. 错误截图的推荐接入方案

### 9.1 最佳方案

最佳做法是拆成两步：

1. 图片先上传到文件服务 / 图床 / 对象存储 / 资产图片接口
2. 设备监测只上报 `screenshot_url`

优点：

- 监测时序数据轻量
- 查询快
- 截图可复用
- 更适合大图、多图、长期归档

### 9.2 如果当前必须落在现有系统内

当前项目里可以复用一个已经存在的图片上传接口：

- `POST /api/assets/{assetId}/images`

它更偏“资产图片”，不是“设备错误截图专用接口”，但如果错误截图和某个资产强关联，可以先把图片传到这里，再把返回的 URL 写进 `screenshot_url`。

### 9.3 不推荐但能临时联调

- 直接把 `screenshot_base64` 放进设备监测上报 JSON

这种方式适合：

- 原型验证
- 内网联调
- 截图很小

不适合：

- 高频设备上报
- 大图
- 长期生产存储

---

## 10. OpenClaw 应该怎么理解这组接口

如果你是 OpenClaw，请按下面规则处理：

1. 当用户说“设备自动上报故障”“接收设备报错”“采集设备运行错误”时，优先走 `/api/iot/asset-monitoring/ingest`。
2. 不要强制先走 `/api/users/login`；这类接口优先检查 IoT Token。
3. 至少确保上报里有 `device_id`，并且有一个监测字段，故障场景建议至少带 `error_code`。
4. 如果用户还给了错误说明、初步判断、截图地址，把它们作为扩展字段一并写入 payload。
5. 写入后，如果需要核验结果，再调用：
   - `GET /api/iot/asset-monitoring/devices/{deviceId}/latest`
   - 或 `GET /api/iot/asset-monitoring/assets/{assetCode}/latest`
6. 查询返回后，不能只看标准列，还要解析 `payload_json` 里的 `error_message`、`error_analysis`、`screenshot_url` 等字段。
7. 如果用户要求“基于历史数据判断故障风险”，再补充调用 `POST /api/agent-mesh/intelligence/predictive-maintenance`。

---

## 11. 如果要把它升级成更正式的“故障接收接口”，推荐这样增强

当前实现已经够接入，但如果你希望“错误信息 / 错误分析 / 截图”都成为一等能力，建议后续把时序表或扩展表再做一次增强。

### 11.1 推荐增强字段

建议新增这些字段中的一部分：

- `error_message`
- `error_analysis`
- `severity`
- `error_type`
- `screenshot_url`
- `screenshot_count`
- `diagnosis_source`（device / gateway / ai / manual）

### 11.2 更推荐的结构

如果截图会很多，建议不要全部塞时序表，而是增加一张附件表，例如：

- `iot_asset_monitor_attachments`

字段可以包括：

- `monitor_id`
- `tenant_id`
- `device_id`
- `asset_code`
- `file_name`
- `file_url`
- `mime_type`
- `file_size`
- `attachment_type`（screenshot / log / dump）
- `created_at`

这样设备监测主表保留监测事实，附件表专门管理截图和错误附件，会更干净。

---

## 12. 一句话结论

当前项目已经能通过 `/api/iot/asset-monitoring/ingest` 接收设备故障上报；`error_code` 是标准字段，`error_message`、`error_analysis`、`screenshot_url` 等扩展字段可以先通过 `payload_json` 透传保存。截图目前更适合“先上传文件，再回填 URL”，而不是直接作为专用二进制接口上报。
