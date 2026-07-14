# 物联网模块API接口文档

## 1. 概述

本文档详细描述了物联网模块的API接口设计，包括设备管理、数据采集、监控预警等核心功能，以及与现有定位模块的集成接口。所有API接口均遵循RESTful设计风格，支持多租户架构。

## 2. 基础信息

### 2.1 接口前缀

所有物联网模块API接口均以 `/api/iot` 为前缀。

### 2.2 认证方式

- 后台管理接口：使用JWT认证，通过 `Authorization` 头传递token
- 设备数据上报接口：使用设备密钥验证，无需JWT认证

### 2.3 响应格式

所有API响应均采用统一格式：

```json
{
  "success": true/false,
  "message": "响应消息",
  "data": "响应数据",
  "pagination": "分页信息（可选）",
  "error": "错误信息（可选）",
  "errorType": "错误类型（可选）"
}
```

## 3. 核心API接口

### 3.1 设备管理

#### 3.1.1 获取设备列表

- **接口地址**：`GET /api/iot/devices`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | page | number | 否 | 页码，默认1 |
  | pageSize | number | 否 | 每页数量，默认20 |
  | keyword | string | 否 | 搜索关键词（设备ID或名称） |
  | device_type | string | 否 | 设备类型 |
  | status | string | 否 | 设备状态 |

- **响应示例**：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "device_id": "DEV-2024-001",
      "device_name": "温度传感器",
      "device_type": "RFID",
      "manufacturer": "厂商A",
      "model": "TS-100",
      "serial_number": "SN20240001",
      "mac_address": "00:11:22:33:44:55",
      "firmware_version": "v1.0.0",
      "status": "在线",
      "last_online_time": "2024-01-01T12:00:00Z",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "tenant_id": 1
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### 3.1.2 获取设备详情

- **接口地址**：`GET /api/iot/devices/:id`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | id | number | 是 | 设备ID |

- **响应示例**：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "device_id": "DEV-2024-001",
    "device_name": "温度传感器",
    "device_type": "RFID",
    "manufacturer": "厂商A",
    "model": "TS-100",
    "serial_number": "SN20240001",
    "mac_address": "00:11:22:33:44:55",
    "firmware_version": "v1.0.0",
    "status": "在线",
    "last_online_time": "2024-01-01T12:00:00Z",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "tenant_id": 1,
    "linked_assets": [
      {
        "asset_code": "ASSET-2024-001",
        "asset_name": "服务器",
        "last_update_time": "2024-01-01T12:00:00Z"
      }
    ]
  }
}
```

#### 3.1.3 创建设备

- **接口地址**：`POST /api/iot/devices`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | device_id | string | 是 | 设备ID |
  | device_name | string | 是 | 设备名称 |
  | device_type | string | 是 | 设备类型（RFID、GPS、蓝牙、WiFi、UWB、其他） |
  | manufacturer | string | 否 | 厂商 |
  | model | string | 否 | 型号 |
  | serial_number | string | 否 | 序列号 |
  | mac_address | string | 否 | MAC地址 |
  | firmware_version | string | 否 | 固件版本 |
  | status | string | 否 | 设备状态（在线、离线、故障、维护中），默认离线 |
  | remark | string | 否 | 备注 |

- **响应示例**：

```json
{
  "success": true,
  "message": "设备创建成功",
  "data": {
    "id": 1
  }
}
```

#### 3.1.4 更新设备

- **接口地址**：`PUT /api/iot/devices/:id`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | id | number | 是 | 设备ID |
  | device_name | string | 否 | 设备名称 |
  | device_type | string | 否 | 设备类型 |
  | manufacturer | string | 否 | 厂商 |
  | model | string | 否 | 型号 |
  | serial_number | string | 否 | 序列号 |
  | mac_address | string | 否 | MAC地址 |
  | firmware_version | string | 否 | 固件版本 |
  | status | string | 否 | 设备状态 |
  | remark | string | 否 | 备注 |

- **响应示例**：

```json
{
  "success": true,
  "message": "设备更新成功"
}
```

#### 3.1.5 删除设备

- **接口地址**：`DELETE /api/iot/devices/:id`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | id | number | 是 | 设备ID |

- **响应示例**：

```json
{
  "success": true,
  "message": "设备删除成功"
}
```

### 3.2 资产设备关联

#### 3.2.1 关联设备到资产

- **接口地址**：`POST /api/iot/devices/assets/:assetCode/link`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | assetCode | string | 是 | 资产编号 |
  | device_id | string | 是 | 设备ID |
  | device_type | string | 是 | 设备类型 |

- **响应示例**：

```json
{
  "success": true,
  "message": "设备关联成功"
}
```

#### 3.2.2 解绑设备

- **接口地址**：`POST /api/iot/devices/assets/:assetCode/unlink`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | assetCode | string | 是 | 资产编号 |
  | device_id | string | 是 | 设备ID |

- **响应示例**：

```json
{
  "success": true,
  "message": "设备解绑成功"
}
```

#### 3.2.3 获取资产的关联设备

- **接口地址**：`GET /api/iot/devices/assets/:assetCode/devices`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | assetCode | string | 是 | 资产编号 |

- **响应示例**：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "device_id": "DEV-2024-001",
      "device_name": "温度传感器",
      "device_type": "RFID",
      "status": "在线",
      "linked_time": "2024-01-01T12:00:00Z"
    }
  ]
}
```

#### 3.2.4 获取设备的关联资产

- **接口地址**：`GET /api/iot/devices/:deviceId/assets`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | deviceId | string | 是 | 设备ID |

- **响应示例**：

```json
{
  "success": true,
  "data": [
    {
      "asset_code": "ASSET-2024-001",
      "asset_name": "服务器",
      "last_update_time": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### 3.3 设备数据上报

#### 3.3.1 设备数据上报

- **接口地址**：`POST /api/iot/devices/:deviceId/data`
- **认证方式**：设备密钥验证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | deviceId | string | 是 | 设备ID |
  | latitude | number | 否 | 纬度 |
  | longitude | number | 否 | 经度 |
  | altitude | number | 否 | 海拔 |
  | signal_strength | number | 否 | 信号强度 |
  | battery_level | number | 否 | 电池电量 |
  | temperature | number | 否 | 温度 |
  | humidity | number | 否 | 湿度 |
  | other_data | object | 否 | 其他数据 |

- **响应示例**：

```json
{
  "success": true,
  "message": "数据上报成功",
  "data": {
    "device_id": "DEV-2024-001",
    "received_at": "2024-01-01T12:00:00Z"
  }
}
```

#### 3.3.2 获取设备数据

- **接口地址**：`GET /api/iot/devices/:deviceId/data`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | deviceId | string | 是 | 设备ID |
  | page | number | 否 | 页码，默认1 |
  | pageSize | number | 否 | 每页数量，默认50 |
  | start_date | string | 否 | 开始日期 |
  | end_date | string | 否 | 结束日期 |

- **响应示例**：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "device_id": "DEV-2024-001",
      "latitude": 39.9042,
      "longitude": 116.4074,
      "altitude": 50,
      "signal_strength": 80,
      "battery_level": 90,
      "temperature": 25,
      "humidity": 60,
      "record_time": "2024-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 1000,
    "totalPages": 20
  }
}
```

### 3.4 监控预警

#### 3.4.1 获取设备监控数据

- **接口地址**：`GET /api/iot/monitoring/devices/:deviceId`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | deviceId | string | 是 | 设备ID |
  | duration | string | 否 | 时间范围（1h, 24h, 7d, 30d），默认24h |

- **响应示例**：

```json
{
  "success": true,
  "data": {
    "device_id": "DEV-2024-001",
    "device_name": "温度传感器",
    "status": "在线",
    "metrics": {
      "temperature": {
        "current": 25,
        "min": 20,
        "max": 30,
        "average": 25,
        "threshold": 35
      },
      "humidity": {
        "current": 60,
        "min": 40,
        "max": 80,
        "average": 60,
        "threshold": 90
      },
      "battery": {
        "current": 90,
        "min": 80,
        "max": 100,
        "average": 90,
        "threshold": 20
      }
    },
    "alerts": [
      {
        "id": 1,
        "type": "温度异常",
        "message": "温度超过阈值",
        "severity": "警告",
        "timestamp": "2024-01-01T10:00:00Z",
        "status": "已处理"
      }
    ]
  }
}
```

#### 3.4.2 获取预警列表

- **接口地址**：`GET /api/iot/alerts`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | page | number | 否 | 页码，默认1 |
  | pageSize | number | 否 | 每页数量，默认20 |
  | severity | string | 否 | 严重程度（信息、警告、错误、严重） |
  | status | string | 否 | 状态（未处理、处理中、已处理） |
  | start_date | string | 否 | 开始日期 |
  | end_date | string | 否 | 结束日期 |

- **响应示例**：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "device_id": "DEV-2024-001",
      "device_name": "温度传感器",
      "type": "温度异常",
      "message": "温度超过阈值",
      "severity": "警告",
      "timestamp": "2024-01-01T10:00:00Z",
      "status": "已处理",
      "handler": "admin",
      "handle_time": "2024-01-01T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

#### 3.4.3 处理预警

- **接口地址**：`PUT /api/iot/alerts/:id/handle`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | id | number | 是 | 预警ID |
  | status | string | 是 | 处理状态（处理中、已处理） |
  | remark | string | 否 | 处理备注 |

- **响应示例**：

```json
{
  "success": true,
  "message": "预警处理成功"
}
```

### 3.5 与定位模块集成

#### 3.5.1 获取资产位置

- **接口地址**：`GET /api/iot/location/assets/:assetCode/location`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | assetCode | string | 是 | 资产编号 |

- **响应示例**：

```json
{
  "success": true,
  "data": {
    "asset_code": "ASSET-2024-001",
    "asset_name": "服务器",
    "latitude": 39.9042,
    "longitude": 116.4074,
    "altitude": 50,
    "floor_number": 1,
    "building_name": "总部大楼",
    "room_number": "A101",
    "area_name": "机房",
    "address": "北京市朝阳区",
    "location_accuracy": 5,
    "last_update_time": "2024-01-01T12:00:00Z",
    "update_source": "设备自动上报",
    "device_id": "DEV-2024-001",
    "device_name": "温度传感器",
    "device_type": "RFID"
  }
}
```

#### 3.5.2 批量获取资产位置

- **接口地址**：`POST /api/iot/location/assets/locations`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | assetCodes | array | 是 | 资产编号列表 |

- **响应示例**：

```json
{
  "success": true,
  "data": [
    {
      "asset_code": "ASSET-2024-001",
      "asset_name": "服务器",
      "latitude": 39.9042,
      "longitude": 116.4074,
      "last_update_time": "2024-01-01T12:00:00Z",
      "device_id": "DEV-2024-001"
    }
  ]
}
```

#### 3.5.3 获取资产位置历史

- **接口地址**：`GET /api/iot/location/assets/:assetCode/history`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | assetCode | string | 是 | 资产编号 |
  | page | number | 否 | 页码，默认1 |
  | pageSize | number | 否 | 每页数量，默认20 |
  | start_date | string | 否 | 开始日期 |
  | end_date | string | 否 | 结束日期 |

- **响应示例**：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "asset_code": "ASSET-2024-001",
      "latitude": 39.9042,
      "longitude": 116.4074,
      "altitude": 50,
      "floor_number": 1,
      "building_name": "总部大楼",
      "room_number": "A101",
      "area_name": "机房",
      "movement_distance": 100,
      "record_time": "2024-01-01T12:00:00Z",
      "update_source": "设备自动上报",
      "device_id": "DEV-2024-001"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### 3.5.4 区域定位接口

- **接口地址**：`POST /api/iot/location/beacon-location`
- **认证方式**：设备密钥验证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | device_id | string | 是 | 信标设备ID |
  | location_code | string | 是 | 位置编号 |

- **响应示例**：

```json
{
  "success": true,
  "message": "位置更新成功",
  "data": {
    "device_id": "DEV-2024-001",
    "location_code": "LOC-A101",
    "location_name": "A101机房",
    "asset_code": "ASSET-2024-001",
    "asset_name": "服务器",
    "movement_distance": 50,
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```

### 3.6 模块管理

#### 3.6.1 获取模块配置

- **接口地址**：`GET /api/iot/module/config`
- **认证方式**：JWT认证
- **响应示例**：

```json
{
  "success": true,
  "data": {
    "module_name": "iot-management",
    "module_version": "1.0.0",
    "dependencies": ["location-management"],
    "device_types": ["RFID", "GPS", "蓝牙", "WiFi", "UWB", "其他"],
    "device_statuses": ["在线", "离线", "故障", "维护中"],
    "monitoring_thresholds": {
      "temperature": 35,
      "humidity": 90,
      "battery": 20
    }
  }
}
```

#### 3.6.2 更新模块配置

- **接口地址**：`PUT /api/iot/module/config`
- **认证方式**：JWT认证
- **请求参数**：
  | 参数名 | 类型 | 必填 | 描述 |
  | --- | --- | --- | --- |
  | device_types | array | 否 | 设备类型列表 |
  | device_statuses | array | 否 | 设备状态列表 |
  | monitoring_thresholds | object | 否 | 监控阈值 |

- **响应示例**：

```json
{
  "success": true,
  "message": "模块配置更新成功"
}
```

## 4. 数据模型

### 4.1 设备表（iot_devices）

| 字段名           | 数据类型     | 约束                                                            | 描述         |
| ---------------- | ------------ | --------------------------------------------------------------- | ------------ |
| id               | INT          | PRIMARY KEY, AUTO_INCREMENT                                     | 设备ID       |
| device_id        | VARCHAR(50)  | UNIQUE, NOT NULL                                                | 设备唯一标识 |
| device_name      | VARCHAR(100) | NOT NULL                                                        | 设备名称     |
| device_type      | VARCHAR(20)  | NOT NULL                                                        | 设备类型     |
| manufacturer     | VARCHAR(100) | NULL                                                            | 厂商         |
| model            | VARCHAR(100) | NULL                                                            | 型号         |
| serial_number    | VARCHAR(100) | NULL                                                            | 序列号       |
| mac_address      | VARCHAR(50)  | NULL                                                            | MAC地址      |
| firmware_version | VARCHAR(50)  | NULL                                                            | 固件版本     |
| status           | VARCHAR(20)  | NOT NULL, DEFAULT '离线'                                        | 设备状态     |
| last_online_time | DATETIME     | NULL                                                            | 最后在线时间 |
| remark           | TEXT         | NULL                                                            | 备注         |
| tenant_id        | INT          | NOT NULL                                                        | 租户ID       |
| created_at       | DATETIME     | NOT NULL, DEFAULT CURRENT_TIMESTAMP                             | 创建时间     |
| updated_at       | DATETIME     | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间     |

### 4.2 设备数据表（iot_device_data）

| 字段名          | 数据类型    | 约束                                | 描述     |
| --------------- | ----------- | ----------------------------------- | -------- |
| id              | INT         | PRIMARY KEY, AUTO_INCREMENT         | 数据ID   |
| device_id       | VARCHAR(50) | NOT NULL                            | 设备ID   |
| latitude        | DOUBLE      | NULL                                | 纬度     |
| longitude       | DOUBLE      | NULL                                | 经度     |
| altitude        | DOUBLE      | NULL                                | 海拔     |
| signal_strength | INT         | NULL                                | 信号强度 |
| battery_level   | INT         | NULL                                | 电池电量 |
| temperature     | DOUBLE      | NULL                                | 温度     |
| humidity        | DOUBLE      | NULL                                | 湿度     |
| other_data      | JSON        | NULL                                | 其他数据 |
| record_time     | DATETIME    | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 记录时间 |
| tenant_id       | INT         | NOT NULL                            | 租户ID   |

### 4.3 预警表（iot_alerts）

| 字段名      | 数据类型    | 约束                                | 描述     |
| ----------- | ----------- | ----------------------------------- | -------- |
| id          | INT         | PRIMARY KEY, AUTO_INCREMENT         | 预警ID   |
| device_id   | VARCHAR(50) | NOT NULL                            | 设备ID   |
| type        | VARCHAR(50) | NOT NULL                            | 预警类型 |
| message     | TEXT        | NOT NULL                            | 预警消息 |
| severity    | VARCHAR(20) | NOT NULL                            | 严重程度 |
| status      | VARCHAR(20) | NOT NULL, DEFAULT '未处理'          | 处理状态 |
| handler     | VARCHAR(50) | NULL                                | 处理人   |
| handle_time | DATETIME    | NULL                                | 处理时间 |
| remark      | TEXT        | NULL                                | 处理备注 |
| timestamp   | DATETIME    | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 预警时间 |
| tenant_id   | INT         | NOT NULL                            | 租户ID   |

### 4.4 模块配置表（iot_module_config）

| 字段名       | 数据类型    | 约束                                                            | 描述     |
| ------------ | ----------- | --------------------------------------------------------------- | -------- |
| id           | INT         | PRIMARY KEY, AUTO_INCREMENT                                     | 配置ID   |
| module_name  | VARCHAR(50) | NOT NULL                                                        | 模块名称 |
| config_key   | VARCHAR(50) | NOT NULL                                                        | 配置键   |
| config_value | JSON        | NOT NULL                                                        | 配置值   |
| tenant_id    | INT         | NOT NULL                                                        | 租户ID   |
| created_at   | DATETIME    | NOT NULL, DEFAULT CURRENT_TIMESTAMP                             | 创建时间 |
| updated_at   | DATETIME    | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

## 5. 集成与扩展

### 5.1 与现有定位模块集成

物联网模块通过以下方式与现有定位模块集成：

1. **数据共享**：通过资产编号关联，实现设备数据与资产位置数据的共享
2. **接口调用**：提供统一的集成接口，调用现有定位模块的功能
3. **数据同步**：确保设备数据与位置数据的实时同步

### 5.2 扩展能力

物联网模块设计具有良好的扩展性：

1. **设备类型扩展**：支持自定义设备类型
2. **传感器数据扩展**：支持添加新的传感器数据类型
3. **预警规则扩展**：支持自定义预警规则
4. **集成接口扩展**：支持与第三方系统集成

## 6. 安全性

### 6.1 认证与授权

- 所有管理接口均需JWT认证
- 设备数据上报接口使用设备密钥验证
- 基于多租户架构，确保数据隔离

### 6.2 数据安全

- 敏感数据加密存储
- 传输数据使用HTTPS加密
- 设备密钥安全管理

### 6.3 访问控制

- 基于角色的权限控制
- 细粒度的API访问权限
- 操作日志记录

## 7. 性能优化

### 7.1 缓存策略

- 使用Redis缓存设备状态和位置数据
- 缓存热点数据，减少数据库查询

### 7.2 批量处理

- 支持批量设备操作
- 批量数据上报和处理

### 7.3 异步处理

- 设备数据上报采用异步处理
- 预警检测和通知采用异步方式

## 8. 监控与维护

### 8.1 健康检查

- 提供模块健康状态检查接口
- 设备在线状态监控

### 8.2 日志管理

- 详细的操作日志
- 设备数据上报日志
- 预警处理日志

### 8.3 故障排查

- 设备连接状态检测
- 数据传输异常检测
- 系统性能监控

## 9. 版本管理

### 9.1 API版本控制

- 支持API版本控制
- 向后兼容设计

### 9.2 模块版本管理

- 模块化设计，支持独立版本升级
- 版本兼容性检查

## 10. 部署与集成指南

### 10.1 部署方式

- 支持Docker容器化部署
- 支持Kubernetes集群部署

### 10.2 集成步骤

1. 启用物联网模块
2. 配置模块依赖
3. 创建设备和资产关联
4. 配置监控阈值
5. 启动数据采集和监控

### 10.3 最佳实践

- 合理规划设备ID命名规则
- 定期备份设备数据
- 配置适当的预警阈值
- 建立设备维护计划

## 11. 总结

本API接口文档提供了物联网模块的完整接口设计，涵盖了设备管理、数据采集、监控预警等核心功能，以及与现有定位模块的集成接口。通过标准化的API设计，确保了模块的可扩展性和可维护性，同时支持多租户架构和高性能要求。

---

**文档版本**：1.0.0
**最后更新**：2026-01-29
**作者**：系统架构组
