/**
 * 物联网模块通用常量（单一数据源，与 module.config 及 device.service 共用）
 */

/** 设备类型列表（type 用于存储与校验，name 用于展示） */
const DEVICE_TYPES = [
  { type: 'RFID', name: 'RFID标签', description: '射频识别标签' },
  { type: 'GPS', name: 'GPS设备', description: '全球定位系统设备' },
  { type: '蓝牙', name: '蓝牙信标', description: '蓝牙低功耗信标' },
  { type: 'WiFi', name: 'WiFi设备', description: 'WiFi网络设备' },
  { type: 'UWB', name: 'UWB设备', description: '超宽带定位设备' },
  { type: 'sensor', name: '传感器设备', description: '环境传感器设备' },
  { type: 'camera', name: '摄像头设备', description: '视频监控设备' },
  { type: 'other', name: '其他设备', description: '其他类型的物联网设备' },
];

/** 设备类型 code 列表，用于校验（与 DEVICE_TYPES 的 type 一致；兼容历史数据中的「其他」） */
const DEVICE_TYPE_CODES = [
  ...DEVICE_TYPES.map((t) => t.type),
  '其他', // 兼容旧数据，新建/更新建议使用 other
];

/** 设备状态列表 */
const DEVICE_STATUSES = ['在线', '离线', '故障', '维护中'];

module.exports = {
  DEVICE_TYPES,
  DEVICE_TYPE_CODES,
  DEVICE_STATUSES,
};
