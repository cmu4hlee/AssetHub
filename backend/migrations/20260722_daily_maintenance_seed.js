/**
 * 日常保养模板种子数据
 *
 * 目的: 给临床科室常见医疗设备预置 一级 / 二级 保养模板, 节省工程师时间
 *
 * 保养级别定义 (项目惯例):
 *   level1 (一级保养): 使用人员日常/每周, 简单清洁 + 外观检查 + 基本功能验证
 *                      责任方: 使用科室护士/技师, 不需要专业工具
 *                      周期: 按天 / 按周
 *   level2 (二级保养): 临床工程师定期 (月度/季度), 性能检测 + 精度校准 + 易损件更换
 *                      责任方: 临床工程部工程师, 需要专业工具/计量设备
 *                      周期: 按月 / 按季度
 *
 * 执行: cd backend && node migrations/20260722_daily_maintenance_seed.js
 * 已运行会跳过 (按 code 唯一索引去重)
 */

const db = require('../config/database');
const logger = require('../config/logger');

const SEED_TENANT = 2; // admin 用户的租户
const BUILTIN_TENANT = 1; // 跨租户共享的"通用"模板, 但当前 DB 没存
// 实际: admin tenant=2, 我们给 tenant_id=2 注入 (用户登录后能看到)
// 想跨租户共享: 后续可加 tenant_id=1 通用模板, 不同租户可引用
const ACTUAL_TENANT = SEED_TENANT;

// 模板定义: code, name, level, category, asset_type, cycle, items, hours, materials
const TEMPLATES = [
  // ==================== 一级保养 (level1) ====================
  {
    code: 'L1-MONITOR-001',
    template_name: '监护仪日常保养 (一级)',
    maintenance_level: 'level1',
    category: '生命支持类',
    asset_type: '监护仪',
    cycle_type: '按周',
    cycle_value: 1,
    estimated_hours: 0.25,
    maintenance_items: JSON.stringify([
      '外观清洁: 用 75% 酒精棉球擦拭外壳、屏幕、按键 (避免液体进入内部)',
      '电源线/导联线检查: 无破损/无老化, 接头牢固',
      '电池状态检查: 充满电后断开电源能持续工作 ≥2 小时',
      '屏幕显示检查: 无坏点/无划痕, 触摸响应正常',
      '报警功能测试: 触发心电/血氧/血压报警, 声光同时响应',
      '附件清点: 心电导联线 / 血氧探头 / 血压袖带齐全',
      '记录上次校准日期, 距下次校准 ≥30 天时通知工程部',
    ]),
    maintenance_content: '使用科室护士/技师日常维护, 重点是清洁 + 外观 + 基本功能验证, 异常立即报告工程部',
    required_materials: JSON.stringify(['75% 酒精', '无尘布', '记录本']),
    description: '适用于多参数监护仪 (心电/血氧/血压/体温), 建议每周 1 次',
    status: '启用',
  },
  {
    code: 'L1-VENT-001',
    template_name: '呼吸机日常保养 (一级)',
    maintenance_level: 'level1',
    category: '生命支持类',
    asset_type: '呼吸机',
    cycle_type: '按天',
    cycle_value: 1,
    estimated_hours: 0.3,
    maintenance_items: JSON.stringify([
      '外观清洁: 75% 酒精擦拭外壳/屏幕/按键, 避免液体进入通气口',
      '管路检查: 主机管路无破损/无冷凝水积聚, 集水杯 ≤1/2 满',
      '过滤器状态: 细菌过滤器 / 进气过滤器外观无变色, 使用时长 ≤30 天',
      '氧气源检查: 氧气压力表 0.35-0.4 MPa, 接头无漏气',
      '电源与电池: 充电指示正常, 断电后能持续工作 ≥30 分钟',
      '报警自检: 触发气道压/分钟通气量/氧浓度报警, 声光响应',
      '湿化器水位: 加无菌蒸馏水至上下限之间, 温度 35-37℃',
    ]),
    maintenance_content: '使用科室每班次检查, 重点是管路/过滤器/气源/报警, 异常立即更换管路并报工程部',
    required_materials: JSON.stringify(['75% 酒精', '无菌蒸馏水', '备用细菌过滤器', '记录本']),
    description: '适用于有创/无创呼吸机, 建议每班次检查 (1 日 3 次)',
    status: '启用',
  },
  {
    code: 'L1-DEFIB-001',
    template_name: '除颤仪日常保养 (一级)',
    maintenance_level: 'level1',
    category: '急救设备',
    asset_type: '除颤仪',
    cycle_type: '按周',
    cycle_value: 1,
    estimated_hours: 0.2,
    maintenance_items: JSON.stringify([
      '外观清洁: 75% 酒精擦拭外壳/屏幕/按键',
      '电池电量: 主电池 ≥80%, 备用电池充满, 充电指示正常',
      '电极板检查: 导电胶无干涸/无脱落, 电缆无破损, 接头牢固',
      '一次性电极片 (Pads) 有效期检查: 距失效 ≥6 个月',
      '自检功能: 每日自动自检通过, 屏幕显示 ✓ 标识',
      '打印功能: 自检打印纸 ≥1 卷, 字迹清晰',
      '附件齐全: 心电导联线 / 血氧探头 / 记录纸',
    ]),
    maintenance_content: '使用科室护士/技师每周检查, 重点是电池/电极板/有效期, 保证随时可用',
    required_materials: JSON.stringify(['75% 酒精', '打印纸', '记录本']),
    description: '适用于手动/自动体外除颤仪 (AED/MACD), 建议每周 1 次',
    status: '启用',
  },
  {
    code: 'L1-INFUSION-001',
    template_name: '输注泵日常保养 (一级)',
    maintenance_level: 'level1',
    category: '治疗设备',
    asset_type: '输注泵',
    cycle_type: '按天',
    cycle_value: 1,
    estimated_hours: 0.1,
    maintenance_items: JSON.stringify([
      '外观清洁: 75% 酒精擦拭外壳/屏幕/按键',
      '管路安装测试: 装好输液管后, 无气泡报警, 流速准确',
      '报警功能: 气泡/阻塞/低电量/完成/KVO 报警声光响应',
      '电池状态: 充电指示正常, 满电后能持续工作 ≥4 小时',
      '屏幕显示: 无坏点, 触摸/旋钮响应准确',
      '附件: 电源线 / 输液管路接口无破损',
    ]),
    maintenance_content: '使用科室每班次检查, 重点是管路/报警/电池, 保证输液安全',
    required_materials: JSON.stringify(['75% 酒精', '无尘布']),
    description: '适用于注射泵/输液泵/营养泵, 建议每班次检查 (1 日 3 次)',
    status: '启用',
  },
  {
    code: 'L1-ANESTH-001',
    template_name: '麻醉机日常保养 (一级)',
    maintenance_level: 'level1',
    category: '生命支持类',
    asset_type: '麻醉机',
    cycle_type: '按天',
    cycle_value: 1,
    estimated_hours: 0.4,
    maintenance_items: JSON.stringify([
      '外观清洁: 75% 酒精擦拭外壳/屏幕/旋钮/手柄',
      '呼吸回路: 钠石灰罐 ≤24h 使用, 变色罐 (紫→白) 立即更换',
      '管路检查: 主机管路无破损/无水气, 集水杯 ≤1/2 满',
      '气源压力: 氧气 0.35-0.4 MPa, 笑气 0.35-0.4 MPa, 空气 0.35-0.4 MPa',
      '挥发罐: 异氟烷/七氟烷液面在上/下限之间, 加注口密封',
      '报警自检: 触发氧浓度/分钟通气量/气道压报警, 声光响应',
      '电源电池: 断电后能持续工作 ≥30 分钟',
      '麻醉废气: 排放系统工作正常, 无堵塞',
    ]),
    maintenance_content: '使用科室麻醉师/护士每班次检查, 重点是气源/钠石灰/挥发罐, 异常立即报告',
    required_materials: JSON.stringify(['75% 酒精', '钠石灰', '记录本']),
    description: '适用于所有吸入麻醉机, 建议每班次检查 (术前必检)',
    status: '启用',
  },
  {
    code: 'L1-US-001',
    template_name: '超声诊断仪日常保养 (一级)',
    maintenance_level: 'level1',
    category: '诊断设备',
    asset_type: '彩超',
    cycle_type: '按周',
    cycle_value: 1,
    estimated_hours: 0.3,
    maintenance_items: JSON.stringify([
      '外观清洁: 75% 酒精擦拭外壳/屏幕/按键/轨迹球',
      '探头清洁: 用无尘布蘸少量耦合剂擦拭, 自然晾干, 无残留',
      '探头线缆: 无破损/无弯折, 接头清洁无氧化',
      '屏幕显示: 图像清晰, 无干扰条纹, 色彩正常',
      '电源/电池: 充电指示正常, 满电后能持续 ≥1 小时',
      '附件齐全: 探头/耦合剂/打印纸/记录笔',
    ]),
    maintenance_content: '使用科室医生/技师每周检查, 重点是探头清洁 + 图像质量, 异常报工程部',
    required_materials: JSON.stringify(['75% 酒精', '无尘布', '耦合剂', '打印纸']),
    description: '适用于便携/台式彩超, 建议每周 1 次',
    status: '启用',
  },
  {
    code: 'L1-XRAY-001',
    template_name: 'X 光机日常保养 (一级)',
    maintenance_level: 'level1',
    category: '诊断设备',
    asset_type: 'X 光机',
    cycle_type: '按周',
    cycle_value: 1,
    estimated_hours: 0.4,
    maintenance_items: JSON.stringify([
      '外观清洁: 75% 酒精擦拭外壳/操作台/控制面板',
      '球管冷却: 冷却油位正常, 无泄漏, 油温 ≤60℃',
      '指示灯: 电源/就绪/曝光指示灯正常',
      '束光器: 灯光野与 X 线野一致 (±2%)',
      '患者支撑: 检查床/立位架无破损, 锁定机构可靠',
      '附件: 铅围裙/铅手套/性腺防护齐全, 有效期 ≥6 个月',
      '环境: 机房温湿度正常 (温度 18-26℃, 湿度 30-70%)',
    ]),
    maintenance_content: '使用科室技师每周检查, 重点是冷却/指示灯/束光器, 异常立即报工程部',
    required_materials: JSON.stringify(['75% 酒精', '无尘布', '记录本']),
    description: '适用于固定/移动 X 光机, 建议每周 1 次',
    status: '启用',
  },

  // ==================== 二级保养 (level2) ====================
  {
    code: 'L2-MONITOR-001',
    template_name: '监护仪定期保养 (二级)',
    maintenance_level: 'level2',
    category: '生命支持类',
    asset_type: '监护仪',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 1.0,
    maintenance_items: JSON.stringify([
      '深度清洁: 拆开外壳清洁内部灰尘, 检查风扇运转正常',
      '电气安全测试: 接地电阻 ≤0.1Ω, 漏电流 ≤0.1mA, 用电气安全分析仪',
      '电池深度充放电: 完全放电后再充满, 容量 ≥原始 80%',
      '心电精度校准: 用心电模拟器, 幅值误差 ≤±5%, 走纸速度误差 ≤±2%',
      '血氧饱和度校准: 用血氧模拟器, SpO2 70%-100% 误差 ≤±2%',
      '血压精度校准: 用无创血压模拟器, 误差 ≤±3 mmHg',
      '体温校准: 用标准温度源, 误差 ≤±0.1℃',
      '报警阈值复核: 重新设置各参数默认报警范围并测试',
      '软件版本: 升级到厂家推荐最新稳定版, 记录版本号',
    ]),
    maintenance_content: '临床工程部工程师每月执行, 重点是电气安全 + 精度校准 + 软件升级, 需专用计量设备',
    required_materials: JSON.stringify(['电气安全分析仪', '心电模拟器', '血氧模拟器', '无创血压模拟器', '标准温度源']),
    description: '适用于多参数监护仪, 建议每月 1 次, 配合厂家计量校准',
    status: '启用',
  },
  {
    code: 'L2-VENT-001',
    template_name: '呼吸机定期保养 (二级)',
    maintenance_level: 'level2',
    category: '生命支持类',
    asset_type: '呼吸机',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 1.5,
    maintenance_items: JSON.stringify([
      '深度清洁: 拆开主机清洁内部灰尘/传感器表面, 检查管路无老化',
      '细菌过滤器更换: 累计使用 30 天强制更换, 记录更换日期',
      '流量传感器校准: 用标准流量计, 误差 ≤±5% (潮气量/分钟通气量)',
      '氧浓度传感器校准: 用纯氧 (≥99.5%) 标定, 误差 ≤±3%',
      '气道压力测试: 用压力表, 误差 ≤±2 cmH2O',
      '报警阈值复核: 全部声光报警逐一测试',
      '电池深度测试: 完全放电后再充满, 容量 ≥原始 80%',
      'PEEP 阀性能: 5/10/15/20 cmH2O 各档位误差 ≤±2 cmH2O',
      '湿化器性能: 输出温度 35-37℃, 湿度 ≥33 mg/L',
      '电气安全测试: 接地 ≤0.1Ω, 漏电流 ≤0.1mA',
      '软件版本: 升级到厂家推荐版',
    ]),
    maintenance_content: '临床工程部工程师每月执行, 重点是传感器校准 + 易损件更换, 需专用流量/压力计量设备',
    required_materials: JSON.stringify(['流量校准仪', '氧浓度标定气', '压力表', '电气安全分析仪', '细菌过滤器 ×2']),
    description: '适用于有创/无创呼吸机, 建议每月 1 次, 配合厂家计量校准',
    status: '启用',
  },
  {
    code: 'L2-DEFIB-001',
    template_name: '除颤仪定期保养 (二级)',
    maintenance_level: 'level2',
    category: '急救设备',
    asset_type: '除颤仪',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 1.0,
    maintenance_items: JSON.stringify([
      '深度清洁: 拆开外壳清洁内部, 检查电容/电池/电路板无腐蚀',
      '放电能量测试: 用除颤能量测试仪, 2J/5J/10J/30J/200J/360J 误差 ≤±15% 或 ±3J',
      '同步模式测试: 同步延迟 ≤60ms, R 波识别准确率 ≥99%',
      '电池容量测试: 满电后放电次数 ≥30 次 (200J 满能量)',
      '充电时间测试: 360J 充电到 360J 放电 ≤7 秒',
      '心电波形精度: 用心电模拟器, 走纸速度误差 ≤±2%, 幅值误差 ≤±5%',
      '打印功能: 字迹清晰, 速度正常',
      '报警功能: 全部报警类型 (低电量/电极脱落/内部故障) 逐一测试',
      '一次性电极片 (Pads): 检查有效期 (≥6 个月), 包装完好',
      '电气安全测试: 接地 ≤0.1Ω, 漏电流 ≤0.1mA',
      '厂家计量: 每年送计量检定机构或厂家校准 1 次',
    ]),
    maintenance_content: '临床工程部工程师每季度执行, 重点是能量精度 + 同步性能 + 电池容量, 需专用除颤分析仪',
    required_materials: JSON.stringify(['除颤能量测试仪', '心电模拟器', '电气安全分析仪', '记录纸']),
    description: '适用于手动/自动体外除颤仪, 建议每季度 1 次, 配合厂家年度计量',
    status: '启用',
  },
  {
    code: 'L2-INFUSION-001',
    template_name: '输注泵定期保养 (二级)',
    maintenance_level: 'level2',
    category: '治疗设备',
    asset_type: '输注泵',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 0.5,
    maintenance_items: JSON.stringify([
      '深度清洁: 拆开外壳清洁内部灰尘, 检查管路槽/推杆无磨损',
      '流速精度校准: 用标准流量天平, 1/5/10/50/100/500 mL/h 各档位误差 ≤±5%',
      '报警测试: 气泡/阻塞/低电量/完成/KVO/管路脱落, 全部声光响应',
      '电池深度充放电: 完全放电后再充满, 容量 ≥原始 80%',
      '推杆行程: 装好注射器后, 推杆无卡顿, 推送平滑',
      '屏幕显示: 无坏点, 触摸/按键响应正常',
      '电气安全: 接地 ≤0.1Ω, 漏电流 ≤0.1mA',
      '软件版本: 升级到厂家推荐版',
    ]),
    maintenance_content: '临床工程部工程师每月执行, 重点是流速精度 + 报警测试, 需流量校准设备',
    required_materials: JSON.stringify(['流量校准天平', '电气安全分析仪', '标准注射器套装']),
    description: '适用于注射泵/输液泵/营养泵, 建议每月 1 次',
    status: '启用',
  },
  {
    code: 'L2-ANESTH-001',
    template_name: '麻醉机定期保养 (二级)',
    maintenance_level: 'level2',
    category: '生命支持类',
    asset_type: '麻醉机',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 2.0,
    maintenance_items: JSON.stringify([
      '深度清洁: 拆开主机清洁内部, 检查钠石灰罐/管路无堵塞/无漏气',
      '流量传感器校准: 误差 ≤±5%, 含潮气量/分钟通气量/新鲜气体流量',
      '氧浓度传感器: 用纯氧标定, 误差 ≤±3%',
      '气道压力测试: 误差 ≤±2 cmH2O',
      '挥发罐输出浓度: 用麻醉气体分析仪, 异氟烷/七氟烷误差 ≤±20%',
      'PEEP 阀: 各档位误差 ≤±2 cmH2O',
      '钠石灰更换: 累计使用 24h 或变色立即更换, 记录更换时间',
      '麻醉废气排放: 排放管路无堵塞, 负压正常',
      '电池容量: 满电后能持续 ≥60 分钟',
      '电气安全: 接地 ≤0.1Ω, 漏电流 ≤0.1mA',
      '报警功能: 全部报警类型 (氧浓度/分钟通气量/气道压/窒息) 测试',
      '软件版本: 升级到厂家推荐版',
    ]),
    maintenance_content: '临床工程部工程师每季度执行, 重点是传感器校准 + 钠石灰更换 + 挥发罐精度, 需麻醉气体分析仪',
    required_materials: JSON.stringify(['麻醉气体分析仪', '流量校准仪', '氧浓度标定气', '压力表', '钠石灰', '电气安全分析仪']),
    description: '适用于所有吸入麻醉机, 建议每季度 1 次, 配合厂家年度计量',
    status: '启用',
  },
  {
    code: 'L2-US-001',
    template_name: '超声诊断仪定期保养 (二级)',
    maintenance_level: 'level2',
    category: '诊断设备',
    asset_type: '彩超',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 1.5,
    maintenance_items: JSON.stringify([
      '深度清洁: 拆开外壳清洁内部灰尘, 检查风扇运转/散热片无堵塞',
      '探头性能测试: 用多普勒/超声模体, 穿透力/分辨率/盲区符合厂家标称',
      '探头线缆: 测绝缘电阻 ≥10 MΩ, 无漏电 (电气安全分析仪)',
      '图像校准: 用超声模体, 距离测量误差 ≤±2%, 面积误差 ≤±5%',
      '彩色血流: 灵敏度/方向/速度标定符合厂家标称',
      '谐波成像: 启停正常, 图像质量稳定',
      '心电同步 (如适用): R 波识别准确率 ≥99%, 触发延迟 ≤50ms',
      '电源/电池: 满电后能持续 ≥2 小时',
      '硬盘: 清理冗余图像, 检查存储空间 ≥20%',
      '软件版本: 升级到厂家推荐版, 记录版本',
      '电气安全: 接地 ≤0.1Ω, 漏电流 ≤0.1mA',
    ]),
    maintenance_content: '临床工程部工程师每季度执行, 重点是探头性能 + 图像校准 + 软件升级, 需超声模体',
    required_materials: JSON.stringify(['超声多普勒模体', '电气安全分析仪', '探头清洁套装']),
    description: '适用于便携/台式彩超, 建议每季度 1 次, 配合厂家年度计量',
    status: '启用',
  },
  {
    code: 'L2-XRAY-001',
    template_name: 'X 光机定期保养 (二级)',
    maintenance_level: 'level2',
    category: '诊断设备',
    asset_type: 'X 光机',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 2.0,
    maintenance_items: JSON.stringify([
      '深度清洁: 拆开控制台/球管罩清洁内部灰尘, 检查高压电缆接头无氧化',
      '球管性能: 用剂量计测输出量, 80kVp/100kVp 各档位与厂家标称误差 ≤±10%',
      '高压发生器: kVp 输出误差 ≤±5%, mA 误差 ≤±10%, 时间误差 ≤±5%',
      '束光器: 灯光野与 X 线野一致 ≤±2%',
      '滤线栅: 无损伤, 振动正常, 中心对齐',
      '探测器 (DR/CR): 暗电流/噪声/响应均匀性符合厂家标称, 用模体检测',
      '机械运动: 检查床/立位架/球管支架运动平滑, 锁定可靠',
      'AEC 自动曝光控制: 厚度模体测试, 输出密度稳定在 ±0.2 OD',
      '环境: 机房温湿度 18-26℃/30-70%, 通风良好',
      '辐射防护: 周围环境剂量率 ≤0.5 μGy/h (门外/操作位)',
      '电气安全: 接地 ≤0.1Ω, 漏电流 ≤0.1mA',
      '厂家计量: 每年送检定机构或厂家校准 1 次',
    ]),
    maintenance_content: '临床工程部工程师每季度执行, 重点是球管/发生器/探测器/辐射防护, 需剂量计+模体+电气安全分析仪',
    required_materials: JSON.stringify(['X 射线剂量计', '厚度模体', '电气安全分析仪', '辐射巡检仪']),
    description: '适用于固定/移动 X 光机, 建议每季度 1 次, 必须配合厂家年度计量',
    status: '启用',
  },
  {
    code: 'L2-DIALYSIS-001',
    template_name: '血液透析机定期保养 (二级)',
    maintenance_level: 'level2',
    category: '生命支持类',
    asset_type: '血液透析机',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 2.0,
    maintenance_items: JSON.stringify([
      '深度清洁消毒: 化学消毒 (柠檬酸/次氯酸钠) 后, 残留物检测合格',
      '电导度校准: 用标准电导液, A 液/B 液误差 ≤±0.5 mS/cm',
      '温度校准: 36.5℃±0.3℃ (透析液温度)',
      '流量校准: 500 mL/min 误差 ≤±5% (透析液流量)',
      '超滤率校准: 用电子秤, 误差 ≤±1% (UF 率)',
      '静脉压校准: 误差 ≤±5 mmHg',
      '跨膜压 (TMP) 校准: 误差 ≤±10 mmHg',
      '透析液浓度 (Na/K/Ca) 检测: 在安全范围内',
      '漏血探测器: 灵敏度测试, 报警阈值正常',
      '气泡探测器: 灵敏度测试, 0.5 mL 气泡能报警',
      '管路/密封圈: 检查无老化/无漏液, 必要时更换',
      '电气安全: 接地 ≤0.1Ω, 漏电流 ≤0.1mA',
      '软件版本: 升级到厂家推荐版',
      '记录: 每次保养必须记录在《血液透析机保养档案》',
    ]),
    maintenance_content: '临床工程部工程师每月执行, 重点是电导度/温度/流量/超滤率校准 + 漏血气泡灵敏度, 需专用计量设备',
    required_materials: JSON.stringify(['电导度标准液', '温度计', '流量计', '电子秤', '漏血测试液', '电气安全分析仪']),
    description: '适用于血液透析/血液滤过机, 建议每月 1 次, 配合厂家季度计量',
    status: '启用',
  },
  {
    code: 'L2-ENDOSCOPE-001',
    template_name: '内窥镜定期保养 (二级)',
    maintenance_level: 'level2',
    category: '诊断设备',
    asset_type: '内窥镜',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 1.0,
    maintenance_items: JSON.stringify([
      '测漏: 用测漏器打压, 弯曲部/插入部/导光接头无漏气 (压力保持 ≥30s)',
      '深度清洁: 全管道酶洗 + 超声清洗, 清除生物膜',
      '高水平消毒: 邻苯二甲醛/戊二醛/过氧乙酸浸泡, 浓度有效',
      '图像质量: 像素数/色彩/亮度符合厂家标称',
      '送水/送气: 流速正常, 无堵塞',
      '吸引/活检通道: 顺畅, 无堵塞, 阀门密封良好',
      '角度钢丝: 上下左右旋转灵活, 无卡顿, 角度 ±180°/±130°',
      '导光束/CCD 接口: 清洁无霉斑, 无水汽',
      '电气安全 (电子内窥镜): 接地 ≤0.1Ω, 漏电流 ≤0.1mA',
      '一次性附件 (一次性活检钳等): 有效期 ≥6 个月, 包装完好',
      '记录: 测漏结果/消毒方式/责任人必须记录',
    ]),
    maintenance_content: '临床工程部工程师每月执行, 重点是测漏 + 图像 + 送水送气 + 角度钢丝, 需测漏器+酶洗设备',
    required_materials: JSON.stringify(['测漏器', '多酶清洗剂', '高水平消毒剂', '记录本']),
    description: '适用于胃镜/肠镜/支气管镜/膀胱镜等软镜, 建议每月 1 次, 配合厂家季度深度维护',
    status: '启用',
  },
  {
    code: 'L2-LAB-001',
    template_name: '检验设备定期保养 (二级)',
    maintenance_level: 'level2',
    category: '检验设备',
    asset_type: '生化分析仪',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 1.5,
    maintenance_items: JSON.stringify([
      '深度清洁: 拆开清洗机构清洁残留物, 检查管路/泵无堵塞/无泄漏',
      '光路系统: 光源灯泡使用时长 ≤2000h (或厂家规定), 波长校准',
      '加样针/试剂针: 无堵塞/无弯折, 定位精度 ≤±0.1mm',
      '比色杯: 清洗后透光率 ≥85% (用标准液测), 无划痕',
      '温控精度: 37℃±0.1℃ (反应盘温度), 校准用标准温度计',
      '泵/阀精度: 用标准液, 加样精度 ≤±2%, 试剂残余 ≤1%',
      '电极 (如适用): K/Na/Cl/Ca 斜率/截距符合厂家标称, 用定值血清',
      '质控品: 用高低值双水平质控, 结果在 ±2SD 内',
      '校准品: 用厂家推荐批号, 定标曲线 r ≥0.999',
      '软件版本: 升级到厂家推荐版',
      '电气安全: 接地 ≤0.1Ω, 漏电流 ≤0.1mA',
      '厂家计量: 关键参数 (波长/温度/加样量) 每半年送检 1 次',
    ]),
    maintenance_content: '临床工程部工程师每月执行, 重点是光路/温控/加样精度 + 质控品, 需标准品+质控品+专用工具',
    required_materials: JSON.stringify(['高低值质控品', '定值血清', '标准温度计', '比色杯检测液', '厂家校准品', '电气安全分析仪']),
    description: '适用于生化/血球/尿液/电解质等检验设备, 建议每月 1 次, 配合厂家半年计量',
    status: '启用',
  },
];

async function seed() {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (const t of TEMPLATES) {
    try {
      // 检查是否已存在 (按 code 唯一)
      const [existing] = await db.execute(
        'SELECT id FROM daily_maintenance_templates WHERE code = ? AND tenant_id = ?',
        [t.code, ACTUAL_TENANT],
      );

      if (existing.length > 0) {
        // 更新
        await db.execute(
          `UPDATE daily_maintenance_templates SET
            template_name = ?, maintenance_level = ?, category = ?, asset_type = ?,
            cycle_type = ?, cycle_value = ?, estimated_hours = ?,
            maintenance_items = ?, maintenance_content = ?, required_materials = ?,
            description = ?, status = ?, updated_at = NOW()
           WHERE id = ? AND tenant_id = ?`,
          [
            t.template_name, t.maintenance_level, t.category, t.asset_type,
            t.cycle_type, t.cycle_value, t.estimated_hours,
            t.maintenance_items, t.maintenance_content, t.required_materials,
            t.description, t.status, existing[0].id, ACTUAL_TENANT,
          ],
        );
        updated++;
        logger.info(`[SeedDailyMaint] 更新: ${t.code} ${t.template_name}`);
      } else {
        // 插入
        await db.execute(
          `INSERT INTO daily_maintenance_templates
            (tenant_id, code, template_name, maintenance_level, category, asset_type,
             cycle_type, cycle_value, estimated_hours, maintenance_items, maintenance_content,
             required_materials, description, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed')`,
          [
            ACTUAL_TENANT, t.code, t.template_name, t.maintenance_level, t.category, t.asset_type,
            t.cycle_type, t.cycle_value, t.estimated_hours, t.maintenance_items, t.maintenance_content,
            t.required_materials, t.description, t.status,
          ],
        );
        inserted++;
        logger.info(`[SeedDailyMaint] 插入: ${t.code} ${t.template_name} (${t.maintenance_level})`);
      }
    } catch (err) {
      logger.error(`[SeedDailyMaint] 失败: ${t.code} - ${err.message}`);
      skipped++;
    }
  }
  return { inserted, updated, skipped };
}

async function main() {
  logger.info('[SeedDailyMaint] 开始注入日常保养模板 (一级 + 二级)...');
  logger.info(`[SeedDailyMaint] 目标 tenant_id=${ACTUAL_TENANT} (admin 登录的租户)`);

  const result = await seed();
  logger.info(`[SeedDailyMaint] 完成: 插入 ${result.inserted} / 更新 ${result.updated} / 失败 ${result.skipped}`);

  // 统计
  const [stats] = await db.execute(
    `SELECT maintenance_level, COUNT(*) as n
     FROM daily_maintenance_templates WHERE tenant_id = ?
     GROUP BY maintenance_level`,
    [ACTUAL_TENANT],
  );
  logger.info('[SeedDailyMaint] 统计:');
  stats.forEach(s => logger.info(`  ${s.maintenance_level}: ${s.n} 条`));

  await db.end();
  process.exit(0);
}

main().catch(err => {
  logger.error('[SeedDailyMaint] 异常:', err);
  process.exit(1);
});
