package main

// Tool definition helpers for IoT/Device Management

func iotDeviceToolDefinition(name string) Tool {
	switch name {
	case "list_iot_devices":
		return Tool{
			Name:        "list_iot_devices",
			Description: "获取IoT设备列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":        map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":       map[string]interface{}{"type": "integer", "description": "每页数量"},
					"keyword":     map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"device_type": map[string]interface{}{"type": "string", "description": "设备类型"},
					"status":      map[string]interface{}{"type": "string", "description": "状态"},
					"location":    map[string]interface{}{"type": "string", "description": "位置"},
				},
			},
		}
	case "get_device":
		return Tool{
			Name:        "get_device",
			Description: "获取设备详情",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":          map[string]interface{}{"type": "integer", "description": "设备主键ID"},
					"device_id":   map[string]interface{}{"type": "string", "description": "设备业务ID"},
					"device_code": map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 device_id"},
				},
				"anyOf": []map[string]interface{}{
					{"required": []string{"id"}},
					{"required": []string{"device_id"}},
					{"required": []string{"device_code"}},
				},
			},
		}
	case "register_device":
		return Tool{
			Name:        "register_device",
			Description: "注册IoT设备",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"device_id":        map[string]interface{}{"type": "string", "description": "设备业务ID，推荐使用"},
					"device_code":      map[string]interface{}{"type": "string", "description": "兼容旧参数，等同于 device_id"},
					"device_name":      map[string]interface{}{"type": "string", "description": "设备名称"},
					"device_type":      map[string]interface{}{"type": "string", "description": "设备类型"},
					"manufacturer":     map[string]interface{}{"type": "string", "description": "制造商"},
					"model":            map[string]interface{}{"type": "string", "description": "设备型号"},
					"serial_number":    map[string]interface{}{"type": "string", "description": "序列号"},
					"mac_address":      map[string]interface{}{"type": "string", "description": "MAC 地址"},
					"firmware_version": map[string]interface{}{"type": "string", "description": "固件版本"},
					"status":           map[string]interface{}{"type": "string", "description": "设备状态"},
					"remark":           map[string]interface{}{"type": "string", "description": "备注"},
					"asset_code":       map[string]interface{}{"type": "string", "description": "创建设备后自动关联的资产编号"},
				},
				"allOf": []map[string]interface{}{
					map[string]interface{}{"required": []string{"device_name", "device_type"}},
				},
				"anyOf": []map[string]interface{}{
					map[string]interface{}{"required": []string{"device_id"}},
					map[string]interface{}{"required": []string{"device_code"}},
				},
			},
		}
	case "update_device_status":
		return Tool{
			Name:        "update_device_status",
			Description: "更新设备状态",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":     map[string]interface{}{"type": "integer", "description": "设备ID"},
					"status": map[string]interface{}{"type": "string", "description": "新状态"},
				},
				"required": []string{"id", "status"},
			},
		}
	}
	return Tool{}
}

func locationTrackingToolDefinition(name string) Tool {
	switch name {
	case "get_asset_location":
		return Tool{
			Name:        "get_asset_location",
			Description: "获取资产位置信息",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
				},
				"required": []string{"asset_code"},
			},
		}
	case "get_location_history":
		return Tool{
			Name:        "get_location_history",
			Description: "获取资产位置历史",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"start_time": map[string]interface{}{"type": "string", "description": "开始时间"},
					"end_time":   map[string]interface{}{"type": "string", "description": "结束时间"},
				},
				"required": []string{"asset_code"},
			},
		}
	case "list_assets_in_area":
		return Tool{
			Name:        "list_assets_in_area",
			Description: "查询指定区域内的资产",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"minLatitude":  map[string]interface{}{"type": "number", "description": "区域最小纬度"},
					"maxLatitude":  map[string]interface{}{"type": "number", "description": "区域最大纬度"},
					"minLongitude": map[string]interface{}{"type": "number", "description": "区域最小经度"},
					"maxLongitude": map[string]interface{}{"type": "number", "description": "区域最大经度"},
					"building_name": map[string]interface{}{
						"type":        "string",
						"description": "建筑物名称，可与楼层组合过滤",
					},
					"floor_number": map[string]interface{}{"type": "integer", "description": "楼层号"},
				},
				"anyOf": []map[string]interface{}{
					{"required": []string{"building_name"}},
					{"required": []string{"floor_number"}},
					{"required": []string{"minLatitude", "maxLatitude"}},
					{"required": []string{"minLongitude", "maxLongitude"}},
				},
			},
		}
	case "report_device_location_data":
		return Tool{
			Name:        "report_device_location_data",
			Description: "上报设备定位数据到资产位置服务",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"device_id":       map[string]interface{}{"type": "string", "description": "设备业务ID"},
					"latitude":        map[string]interface{}{"type": "number", "description": "纬度"},
					"longitude":       map[string]interface{}{"type": "number", "description": "经度"},
					"altitude":        map[string]interface{}{"type": "number", "description": "海拔"},
					"signal_strength": map[string]interface{}{"type": "integer", "description": "信号强度"},
					"battery_level":   map[string]interface{}{"type": "integer", "description": "电量百分比"},
					"other_data":      map[string]interface{}{"type": "object", "description": "扩展原始数据"},
				},
				"required": []string{"device_id"},
			},
		}
	case "report_beacon_location":
		return Tool{
			Name:        "report_beacon_location",
			Description: "上报 Beacon 设备当前位置编码",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"device_id":     map[string]interface{}{"type": "string", "description": "信标设备业务ID"},
					"location_code": map[string]interface{}{"type": "string", "description": "位置编码"},
				},
				"required": []string{"device_id", "location_code"},
			},
		}
	case "list_beacon_assets":
		return Tool{
			Name:        "list_beacon_assets",
			Description: "获取已关联 Beacon 设备的资产列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":        map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":       map[string]interface{}{"type": "integer", "description": "每页数量"},
					"keyword":     map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"device_type": map[string]interface{}{"type": "string", "description": "设备类型"},
					"status":      map[string]interface{}{"type": "string", "description": "设备状态"},
				},
			},
		}
	}
	return Tool{}
}

func locationCodeToolDefinition(name string) Tool {
	switch name {
	case "list_location_codes":
		return Tool{
			Name:        "list_location_codes",
			Description: "获取位置编码列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":      map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":     map[string]interface{}{"type": "integer", "description": "每页数量"},
					"keyword":   map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"is_active": map[string]interface{}{"type": "boolean", "description": "是否激活"},
				},
			},
		}
	case "get_location_code":
		return Tool{
			Name:        "get_location_code",
			Description: "获取位置编码详情",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "位置编码ID"},
				},
				"required": []string{"id"},
			},
		}
	case "create_location_code":
		return Tool{
			Name:        "create_location_code",
			Description: "创建位置编码",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"location_code": map[string]interface{}{"type": "string", "description": "位置编号"},
					"location_name": map[string]interface{}{"type": "string", "description": "位置名称"},
					"description":   map[string]interface{}{"type": "string", "description": "位置描述"},
					"building_name": map[string]interface{}{"type": "string", "description": "建筑物名称"},
					"floor_number":  map[string]interface{}{"type": "integer", "description": "楼层号"},
					"room_number":   map[string]interface{}{"type": "string", "description": "房间号"},
					"area_name":     map[string]interface{}{"type": "string", "description": "区域名称"},
					"latitude":      map[string]interface{}{"type": "number", "description": "纬度"},
					"longitude":     map[string]interface{}{"type": "number", "description": "经度"},
					"is_active":     map[string]interface{}{"type": "boolean", "description": "是否激活"},
				},
				"required": []string{"location_code", "location_name"},
			},
		}
	case "update_location_code":
		return Tool{
			Name:        "update_location_code",
			Description: "更新位置编码",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":            map[string]interface{}{"type": "integer", "description": "位置编码ID"},
					"location_code": map[string]interface{}{"type": "string", "description": "位置编号"},
					"location_name": map[string]interface{}{"type": "string", "description": "位置名称"},
					"description":   map[string]interface{}{"type": "string", "description": "位置描述"},
					"building_name": map[string]interface{}{"type": "string", "description": "建筑物名称"},
					"floor_number":  map[string]interface{}{"type": "integer", "description": "楼层号"},
					"room_number":   map[string]interface{}{"type": "string", "description": "房间号"},
					"area_name":     map[string]interface{}{"type": "string", "description": "区域名称"},
					"latitude":      map[string]interface{}{"type": "number", "description": "纬度"},
					"longitude":     map[string]interface{}{"type": "number", "description": "经度"},
					"is_active":     map[string]interface{}{"type": "boolean", "description": "是否激活"},
				},
				"required": []string{"id"},
			},
		}
	case "delete_location_code":
		return Tool{
			Name:        "delete_location_code",
			Description: "删除位置编码",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "位置编码ID"},
				},
				"required": []string{"id"},
			},
		}
	}
	return Tool{}
}

func locationAlertToolDefinition(name string) Tool {
	switch name {
	case "list_location_alerts":
		return Tool{
			Name:        "list_location_alerts",
			Description: "获取位置告警列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":        map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":       map[string]interface{}{"type": "integer", "description": "每页数量"},
					"is_handled":  map[string]interface{}{"type": "boolean", "description": "是否已处理"},
					"alert_type":  map[string]interface{}{"type": "string", "description": "告警类型"},
					"alert_level": map[string]interface{}{"type": "string", "description": "告警等级"},
					"asset_code":  map[string]interface{}{"type": "string", "description": "资产编号"},
				},
			},
		}
	case "get_location_alert_stats":
		return Tool{
			Name:        "get_location_alert_stats",
			Description: "获取位置告警统计",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "handle_location_alert":
		return Tool{
			Name:        "handle_location_alert",
			Description: "处理单个位置告警",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":            map[string]interface{}{"type": "integer", "description": "告警ID"},
					"handle_result": map[string]interface{}{"type": "string", "description": "处理结果"},
					"remark":        map[string]interface{}{"type": "string", "description": "备注"},
				},
				"required": []string{"id"},
			},
		}
	case "batch_handle_location_alerts":
		return Tool{
			Name:        "batch_handle_location_alerts",
			Description: "批量处理位置告警",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"ids": map[string]interface{}{
						"type":        "array",
						"description": "告警ID列表",
						"items":       map[string]interface{}{"type": "integer"},
					},
					"handle_result": map[string]interface{}{"type": "string", "description": "处理结果"},
				},
				"required": []string{"ids"},
			},
		}
	case "delete_location_alert":
		return Tool{
			Name:        "delete_location_alert",
			Description: "删除位置告警",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "integer", "description": "告警ID"},
				},
				"required": []string{"id"},
			},
		}
	}
	return Tool{}
}

func environmentMonitoringToolDefinition(name string) Tool {
	switch name {
	case "get_environment_records":
		return Tool{
			Name:        "get_environment_records",
			Description: "旧版占位工具：当前主服务没有通用环境监测记录列表接口，请改用 get_environment_latest_by_device / get_environment_latest_by_asset / get_environment_asset_series",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"zone_id":    map[string]interface{}{"type": "integer", "description": "区域ID"},
					"start_time": map[string]interface{}{"type": "string", "description": "开始时间"},
					"end_time":   map[string]interface{}{"type": "string", "description": "结束时间"},
				},
			},
		}
	case "get_environment_alerts":
		return Tool{
			Name:        "get_environment_alerts",
			Description: "旧版占位工具：当前主服务没有通用环境告警列表接口，请改用位置告警或环境监测新工具",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":     map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":    map[string]interface{}{"type": "integer", "description": "每页数量"},
					"severity": map[string]interface{}{"type": "string", "description": "严重程度"},
					"status":   map[string]interface{}{"type": "string", "description": "状态"},
					"zone_id":  map[string]interface{}{"type": "integer", "description": "区域ID"},
				},
			},
		}
	case "get_environment_latest_by_device":
		return Tool{
			Name:        "get_environment_latest_by_device",
			Description: "按设备获取最新环境监测数据",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"device_id": map[string]interface{}{"type": "string", "description": "设备业务ID"},
				},
				"required": []string{"device_id"},
			},
		}
	case "get_environment_latest_by_asset":
		return Tool{
			Name:        "get_environment_latest_by_asset",
			Description: "按资产获取最新环境监测数据",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
				},
				"required": []string{"asset_code"},
			},
		}
	case "get_environment_asset_series":
		return Tool{
			Name:        "get_environment_asset_series",
			Description: "获取资产环境监测时序数据",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"start_time": map[string]interface{}{"type": "string", "description": "开始时间"},
					"end_time":   map[string]interface{}{"type": "string", "description": "结束时间"},
					"limit":      map[string]interface{}{"type": "integer", "description": "最大返回条数"},
				},
				"required": []string{"asset_code"},
			},
		}
	case "get_environment_pipeline_health":
		return Tool{
			Name:        "get_environment_pipeline_health",
			Description: "获取环境监测管道健康状态",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "get_environment_pipeline_docs":
		return Tool{
			Name:        "get_environment_pipeline_docs",
			Description: "获取环境监测管道接口说明",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	}
	return Tool{}
}

func zoneLocationToolDefinition(name string) Tool {
	switch name {
	case "ingest_zone_location_sample":
		return Tool{
			Name:        "ingest_zone_location_sample",
			Description: "写入区域定位样例数据（管理侧接口，依赖当前登录态和角色权限）",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"events": map[string]interface{}{
						"type":        "array",
						"description": "区域定位事件列表",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"device_id":     map[string]interface{}{"type": "string", "description": "设备业务ID"},
								"asset_code":    map[string]interface{}{"type": "string", "description": "资产编号"},
								"location_code": map[string]interface{}{"type": "string", "description": "位置编码"},
								"area_name":     map[string]interface{}{"type": "string", "description": "区域名称"},
								"building_name": map[string]interface{}{"type": "string", "description": "建筑物名称"},
								"floor_number":  map[string]interface{}{"type": "integer", "description": "楼层号"},
								"rssi":          map[string]interface{}{"type": "integer", "description": "RSSI 信号强度"},
								"accuracy":      map[string]interface{}{"type": "number", "description": "定位精度"},
								"battery_level": map[string]interface{}{"type": "integer", "description": "电量百分比"},
								"event_time":    map[string]interface{}{"type": "string", "description": "事件时间，建议 ISO8601"},
								"payload":       map[string]interface{}{"type": "object", "description": "原始扩展载荷"},
							},
							"required": []string{"device_id"},
						},
					},
				},
				"required": []string{"events"},
			},
		}
	case "ingest_zone_location_batch":
		return Tool{
			Name:        "ingest_zone_location_batch",
			Description: "批量写入区域定位数据（硬件/网关 ingest 接口；常规 Web 登录态通常不可直接替代 IoT 上报 token）",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"events": map[string]interface{}{
						"type":        "array",
						"description": "区域定位事件列表",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"device_id":     map[string]interface{}{"type": "string", "description": "设备业务ID"},
								"asset_code":    map[string]interface{}{"type": "string", "description": "资产编号"},
								"location_code": map[string]interface{}{"type": "string", "description": "位置编码"},
								"area_name":     map[string]interface{}{"type": "string", "description": "区域名称"},
								"building_name": map[string]interface{}{"type": "string", "description": "建筑物名称"},
								"floor_number":  map[string]interface{}{"type": "integer", "description": "楼层号"},
								"rssi":          map[string]interface{}{"type": "integer", "description": "RSSI 信号强度"},
								"accuracy":      map[string]interface{}{"type": "number", "description": "定位精度"},
								"battery_level": map[string]interface{}{"type": "integer", "description": "电量百分比"},
								"event_time":    map[string]interface{}{"type": "string", "description": "事件时间，建议 ISO8601"},
								"payload":       map[string]interface{}{"type": "object", "description": "原始扩展载荷"},
							},
							"required": []string{"device_id"},
						},
					},
					"iot_token": map[string]interface{}{
						"type":        "string",
						"description": "可选。IoT ingest token；若提供将通过 x-iot-token 调用底层上报接口",
					},
				},
				"required": []string{"events"},
			},
		}
	case "get_zone_location_latest_by_device":
		return Tool{
			Name:        "get_zone_location_latest_by_device",
			Description: "按设备获取最新区域定位时序数据",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"device_id": map[string]interface{}{"type": "string", "description": "设备业务ID"},
				},
				"required": []string{"device_id"},
			},
		}
	case "get_zone_location_latest_by_asset":
		return Tool{
			Name:        "get_zone_location_latest_by_asset",
			Description: "按资产获取最新区域定位时序数据",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
				},
				"required": []string{"asset_code"},
			},
		}
	case "get_zone_location_asset_series":
		return Tool{
			Name:        "get_zone_location_asset_series",
			Description: "获取资产区域定位时序数据",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"start_time": map[string]interface{}{"type": "string", "description": "开始时间"},
					"end_time":   map[string]interface{}{"type": "string", "description": "结束时间"},
					"limit":      map[string]interface{}{"type": "integer", "description": "最大返回条数"},
				},
				"required": []string{"asset_code"},
			},
		}
	case "get_zone_location_pipeline_health":
		return Tool{
			Name:        "get_zone_location_pipeline_health",
			Description: "获取区域定位管道健康状态",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	case "get_zone_location_pipeline_docs":
		return Tool{
			Name:        "get_zone_location_pipeline_docs",
			Description: "获取区域定位管道接口说明",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		}
	}
	return Tool{}
}

func intelligentAlertToolDefinition(name string) Tool {
	switch name {
	case "list_alerts":
		return Tool{
			Name:        "list_alerts",
			Description: "获取智能告警列表",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"page":       map[string]interface{}{"type": "integer", "description": "页码"},
					"limit":      map[string]interface{}{"type": "integer", "description": "每页数量"},
					"alert_type": map[string]interface{}{"type": "string", "description": "告警类型"},
					"severity":   map[string]interface{}{"type": "string", "description": "严重程度"},
					"status":     map[string]interface{}{"type": "string", "description": "状态"},
					"start_date": map[string]interface{}{"type": "string", "description": "开始日期"},
					"end_date":   map[string]interface{}{"type": "string", "description": "结束日期"},
				},
			},
		}
	case "acknowledge_alert":
		return Tool{
			Name:        "acknowledge_alert",
			Description: "确认告警",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{
						"oneOf": []map[string]interface{}{
							{"type": "string"},
							{"type": "integer"},
						},
						"description": "告警ID，兼容字符串告警号和数字ID",
					},
					"comment": map[string]interface{}{"type": "string", "description": "处理说明"},
				},
				"required": []string{"id"},
			},
		}
	case "resolve_alert":
		return Tool{
			Name:        "resolve_alert",
			Description: "解决告警",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{
						"oneOf": []map[string]interface{}{
							{"type": "string"},
							{"type": "integer"},
						},
						"description": "告警ID，兼容字符串告警号和数字ID",
					},
					"comment": map[string]interface{}{"type": "string", "description": "解决说明"},
				},
				"required": []string{"id"},
			},
		}
	}
	return Tool{}
}

func iotPatientVolumeToolDefinition(name string) Tool {
	switch name {
	case "get_patient_volume_records":
		return Tool{
			Name:        "get_patient_volume_records",
			Description: "获取患者使用记录（全量查询）",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"patient_id": map[string]interface{}{"type": "string", "description": "患者ID"},
					"keyword":    map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"start_time": map[string]interface{}{"type": "string", "description": "开始时间"},
					"end_time":   map[string]interface{}{"type": "string", "description": "结束时间"},
					"batch_size": map[string]interface{}{"type": "integer", "description": "每批次查询数量"},
				},
			},
		}
	case "get_asset_usage_stats":
		return Tool{
			Name:        "get_asset_usage_stats",
			Description: "获取资产使用统计（全量查询）",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"asset_code": map[string]interface{}{"type": "string", "description": "资产编号"},
					"keyword":    map[string]interface{}{"type": "string", "description": "搜索关键词"},
					"start_time": map[string]interface{}{"type": "string", "description": "开始时间"},
					"end_time":   map[string]interface{}{"type": "string", "description": "结束时间"},
					"batch_size": map[string]interface{}{"type": "integer", "description": "每批次查询数量"},
				},
			},
		}
	}
	return Tool{}
}
