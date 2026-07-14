-- ============================================================
-- AssetHub 测试数据 - 扩展数据 (Part 2)
-- ============================================================
SET NAMES utf8mb4;

-- ============================================================
-- 清理已有扩展测试数据
-- ============================================================
DELETE FROM audit_logs WHERE request_path LIKE '%TEST-%' OR action_description LIKE '%TEST-%';
DELETE FROM technical_documents WHERE tenant_id=1 AND file_path LIKE '/docs/test/%';
DELETE FROM training_records WHERE certificate_number LIKE 'TEST-%';
DELETE FROM adverse_events WHERE event_code LIKE 'TEST-%';
DELETE FROM safety_inspections WHERE inspection_code LIKE 'TEST-%';
DELETE FROM special_equipment WHERE equipment_code LIKE 'TEST-%';
DELETE FROM risk_assessments WHERE tenant_id=1 AND risk_factors IS NOT NULL;
DELETE FROM quality_control_records WHERE record_no LIKE 'TEST-QC-%';
DELETE FROM metrology_records WHERE record_no LIKE 'TEST-MR-%';
DELETE FROM metrology_devices WHERE device_code LIKE 'TEST-MTR-%';
DELETE FROM asset_scrapping_disposals WHERE tenant_id=1;
DELETE FROM asset_scrapping_approvals WHERE tenant_id=1;
DELETE FROM asset_scrapping_appraisals WHERE tenant_id=1;
DELETE FROM asset_scrapping_records WHERE asset_code LIKE 'TEST-%';
DELETE FROM iot_devices WHERE device_id LIKE 'RFID-%' OR device_id LIKE 'GPS-%' OR device_id LIKE 'BLE-%' OR device_id LIKE 'UWB-%' OR device_id LIKE 'TEST-%';
DELETE FROM asset_location_history WHERE asset_code LIKE 'TEST-%';
DELETE FROM maintenance_workorders WHERE work_order_no LIKE 'TEST-WO-%';
DELETE FROM maintenance_logs WHERE asset_code LIKE 'TEST-%';
DELETE FROM maintenance_plans WHERE asset_code LIKE 'TEST-%';
DELETE FROM idle_assets WHERE asset_code LIKE 'TEST-%';
DELETE FROM asset_change_logs WHERE asset_code LIKE 'TEST-%';
DELETE FROM asset_images WHERE asset_code LIKE 'TEST-%';

-- ============================================================
-- 7) 资产图片 (asset_images)
-- ============================================================
INSERT INTO asset_images (tenant_id, asset_code, file_id, temp_file_url, description)
VALUES
  (1, 'TEST-IT-001', 'file_2024_03_15_laptop_01.jpg', 'https://images.unsplash.com/photo-laptop-1', '资产正视图'),
  (1, 'TEST-IT-001', 'file_2024_03_15_laptop_02.jpg', 'https://images.unsplash.com/photo-laptop-2', '序列号铭牌特写'),
  (1, 'TEST-IT-002', 'file_2024_01_25_server_01.jpg', 'https://images.unsplash.com/photo-server-1', '服务器正面'),
  (1, 'TEST-IT-002', 'file_2024_01_25_server_02.jpg', 'https://images.unsplash.com/photo-server-2', '机架安装现场'),
  (1, 'TEST-MED-001', 'file_2023_11_10_ct_01.jpg', 'https://images.unsplash.com/photo-ct-1', 'CT 设备全景'),
  (1, 'TEST-MED-001', 'file_2023_11_10_ct_02.jpg', 'https://images.unsplash.com/photo-ct-2', '控制室操作台'),
  (1, 'TEST-MED-002', 'file_2024_05_12_monitor_01.jpg', 'https://images.unsplash.com/photo-monitor-1', '监护仪主机'),
  (1, 'TEST-OFF-001', 'file_2024_03_01_chair_01.jpg', 'https://images.unsplash.com/photo-chair-1', '座椅正面'),
  (1, 'TEST-VEH-001', 'file_2024_06_05_bus_01.jpg', 'https://images.unsplash.com/photo-bus-1', '车辆外观'),
  (1, 'TEST-VEH-001', 'file_2024_06_05_bus_02.jpg', 'https://images.unsplash.com/photo-bus-2', '车内空间'),
  (1, 'TEST-IT-003', 'file_2024_04_02_switch_01.jpg', 'https://images.unsplash.com/photo-switch-1', '机柜安装'),
  (1, 'TEST-IT-004', 'file_2024_07_18_macbook_01.jpg', 'https://images.unsplash.com/photo-macbook-1', '设备外观'),
  (1, 'TEST-OFF-002', 'file_2024_04_15_printer_01.jpg', 'https://images.unsplash.com/photo-printer-1', '打印机外观');

-- ============================================================
-- 8) 资产变更日志 (asset_change_logs) - 全链路审计
-- ============================================================
INSERT INTO asset_change_logs (asset_code, field_name, old_value, new_value, changed_by, changed_at, tenant_id)
VALUES
  -- TEST-IT-001: 状态变更 + 调拨 + 位置变更
  ('TEST-IT-001', 'status', '待验收', '在用', 'admin', '2024-03-18 10:30:00', 1),
  ('TEST-IT-001', 'location', '总部 5 楼 IT 部', '总部 5 楼 IT 部', '张三', '2024-03-18 10:31:00', 1),
  ('TEST-IT-001', 'department', '信息技术部', '研发部', 'admin', '2024-08-15 14:00:00', 1),
  ('TEST-IT-001', 'location', '总部 5 楼 IT 部', '总部 5 楼 设计部', 'admin', '2024-08-15 14:01:00', 1),
  ('TEST-IT-001', 'responsible_person', '张三', '吴十', 'admin', '2024-08-15 14:02:00', 1),

  -- TEST-IT-002: 折旧计算
  ('TEST-IT-002', 'current_value', '88000.00', '79200.00', 'system', '2024-12-31 23:59:00', 1),
  ('TEST-IT-002', 'accumulated_depreciation', '0.00', '8800.00', 'system', '2024-12-31 23:59:00', 1),
  ('TEST-IT-002', 'current_value', '79200.00', '70400.00', 'system', '2025-12-31 23:59:00', 1),
  ('TEST-IT-002', 'accumulated_depreciation', '8800.00', '17600.00', 'system', '2025-12-31 23:59:00', 1),

  -- TEST-MED-001: 维修状态变更
  ('TEST-MED-001', 'status', '在用', '故障', 'system', '2024-06-15 09:00:00', 1),
  ('TEST-MED-001', 'status', '故障', '维修', 'admin', '2024-06-15 09:30:00', 1),
  ('TEST-MED-001', 'status', '维修', '在用', 'admin', '2024-06-20 16:00:00', 1),

  -- TEST-MED-002: 维修记录
  ('TEST-MED-002', 'status', '在用', '维修', '赵六', '2024-06-15 14:00:00', 1),
  ('TEST-MED-002', 'status', '维修', '在用', 'admin', '2024-06-19 11:00:00', 1),

  -- TEST-IT-003: 维修中（当前）
  ('TEST-IT-003', 'status', '在用', '维修', '李四', '2024-05-10 11:00:00', 1),

  -- TEST-OFF-002: 调到闲置
  ('TEST-OFF-002', 'status', '在用', '闲置', 'admin', '2024-09-01 09:00:00', 1),

  -- TEST-VEH-001: 调拨记录
  ('TEST-VEH-001', 'responsible_person', '行政司机', '周九', 'admin', '2024-06-05 16:00:00', 1),

  -- TEST-MED-001: 计量检定
  ('TEST-MED-001', 'remark', '医院核心影像设备', '医院核心影像设备 (2024-11 检定合格)', 'system', '2024-11-15 10:00:00', 1);

-- ============================================================
-- 9) 闲置资产发布 (idle_assets)
-- ============================================================
INSERT INTO idle_assets
  (tenant_id, asset_code, asset_id, publish_date, publish_person,
   expected_use, contact_person, contact_phone, status, allocated_to, allocated_date, remark)
VALUES
  (1, 'TEST-OFF-002', NULL, '2024-09-05', '孙八',
   '可调拨至分公司使用', '孙八', '13900001004', '发布中', NULL, NULL,
   '原值 2800 元，功能完好，建议调拨至上海分公司'),

  (1, 'TEST-OFF-003', NULL, '2024-04-21', '孙八',
   '员工更衣柜', '孙八', '13900001004', '已分配', '行政部', '2024-04-21',
   '已重新编号，从总裁办调拨过来');

-- ============================================================
-- 10) 预防性维护计划 (maintenance_plans)
-- ============================================================
INSERT INTO maintenance_plans
  (tenant_id, plan_name, asset_code, asset_name, maintenance_type,
   cycle_type, cycle_value, next_maintenance_date, maintenance_content,
   responsible_person, status, last_maintenance_date, remark, created_by)
VALUES
  (1, 'CT 设备季度预防性维护', 'TEST-MED-001', 'GE Revolution CT 扫描仪', '预防性维护',
   'month', 3, '2024-11-20', '球管校准、探测器检查、机架润滑、图像质量评估',
   '王五', 'active', '2024-08-20', 'GE 工程师远程指导', 'admin'),

  (1, '监护仪半年校准', 'TEST-MED-002', 'Mindray N15 患者监护仪', '定期保养',
   'month', 6, '2024-11-12', '参数校准、电池测试、报警阈值验证',
   '赵六', 'active', '2024-05-12', '迈瑞工程师上门', 'admin'),

  (1, '服务器月度巡检', 'TEST-IT-002', 'Dell PowerEdge R750 机架服务器', '日常维护',
   'month', 1, '2024-09-25', '硬件健康检查、日志审查、固件更新评估',
   '李四', 'active', '2024-08-25', NULL, 'admin'),

  (1, '中巴车定期保养', 'TEST-VEH-001', '丰田 考斯特 中巴车', '定期保养',
   'km', 5000, '2024-12-15', '机油机滤更换、轮胎气压检查、刹车系统检查',
   '周九', 'active', '2024-08-05', '按 5000 公里保养', 'admin'),

  (1, '打印机定期清洁', 'TEST-OFF-002', 'HP LaserJet Pro M404dn 激光打印机', '日常维护',
   'month', 3, '2024-10-15', '硒鼓状态检查、定影组件清洁、纸张通路清理',
   '孙八', 'active', '2024-07-15', '已闲置，本计划作废', 'admin');

-- ============================================================
-- 11) 维护日志 (maintenance_logs)
-- ============================================================
INSERT INTO maintenance_logs
  (tenant_id, asset_code, asset_name, maintenance_type, maintenance_method,
   maintenance_date, maintenance_person, maintenance_location, maintenance_content,
   maintenance_cost, supplier_name, maintenance_duration, parts_replaced,
   warranty_info, next_maintenance_date, status, quality_check, quality_check_person,
   quality_check_date, remark, created_by, labor_cost, material_cost, external_cost, total_cost)
VALUES
  (1, 'TEST-IT-002', 'Dell PowerEdge R750 机架服务器', '日常维护', '现场巡检',
   '2024-07-25', '李四', '总部 3 楼 IDC 机房', '硬件健康检查 + 风扇清洁 + 固件版本审查',
   0.00, NULL, 2.0, NULL, '原厂保修至 2029-01-20', '2024-08-25',
   '已完成', '合格', '李四', '2024-07-25', NULL, 'admin', 0.00, 0.00, 0.00, 0.00),

  (1, 'TEST-IT-002', 'Dell PowerEdge R750 机架服务器', '日常维护', '现场巡检',
   '2024-08-25', '李四', '总部 3 楼 IDC 机房', '硬件健康检查 + RAID 状态确认',
   0.00, NULL, 1.5, NULL, NULL, '2024-09-25',
   '已完成', '合格', '李四', '2024-08-25', NULL, 'admin', 0.00, 0.00, 0.00, 0.00),

  (1, 'TEST-MED-001', 'GE Revolution CT 扫描仪', '预防性维护', 'GE 工程师上门',
   '2024-08-20', 'GE 现场工程师 Tom', '影像楼 1 楼 CT 室',
   '球管校准、探测器清洁、机架润滑、图像质量评估',
   8500.00, '通用电气医疗（中国）有限公司', 8.0, '球管 OQ 校准',
   '球管保修至 2025-06-30', '2024-11-20',
   '已完成', '合格', '王五', '2024-08-20', '工程师出具 PM 报告', 'admin',
   2500.00, 5000.00, 1000.00, 8500.00),

  (1, 'TEST-MED-002', 'Mindray N15 患者监护仪', '故障维修', '现场更换',
   '2024-06-19', '迈瑞售后 张工', '内科 3 楼 305 病房',
   '更换 15 寸触控屏组件，校准触点',
   2800.00, '深圳迈瑞生物医疗电子股份有限公司', 4.0, '触控面板组件 SN:TP-N15-20240619',
   '整体保修至 2026-05-08，触控组件保修 6 个月', NULL,
   '已完成', '合格', '赵六', '2024-06-19', NULL, 'admin',
   600.00, 1800.00, 400.00, 2800.00),

  (1, 'TEST-VEH-001', '丰田 考斯特 中巴车', '定期保养', '4S 店保养',
   '2024-08-02', '一汽丰田 4S 店', '一汽丰田 4S 店',
   '更换 5W-30 全合成机油 + 机滤 + 空气滤清器',
   1280.00, '一汽丰田汽车销售有限公司', 3.0, '机油 6L/机滤/空滤',
   '整车保修至 2027-06-01', '2024-12-15',
   '已完成', '合格', '周九', '2024-08-02', '保养完成', 'admin',
   200.00, 1080.00, 0.00, 1280.00),

  (1, 'TEST-IT-003', 'Cisco Catalyst 9300 核心交换机', '故障维修', '现场维修',
   '2024-05-12', '思科现场工程师 王工', '总部 3 楼 IDC 机房',
   '第 24 口 PoE 控制器重置 + 模块诊断',
   0.00, '思科（中国）有限公司', 6.0, NULL, '保修期内',
   NULL, '进行中', '待检查', NULL, NULL, '思科 TAC 案例 8888-XXXX-XXXX', 'admin',
   0.00, 0.00, 0.00, 0.00),

  (1, 'TEST-OFF-002', 'HP LaserJet Pro M404dn 激光打印机', '日常维护', '内部清洁',
   '2024-07-15', '孙八', '总部 4 楼 文印室',
   '硒鼓状态检查、定影组件清洁',
   0.00, NULL, 1.0, NULL, NULL, '2024-10-15',
   '已完成', '合格', '孙八', '2024-07-15', '设备已闲置', 'admin',
   0.00, 0.00, 0.00, 0.00);

-- ============================================================
-- 12) 维护工单 (maintenance_workorders)
-- ============================================================
INSERT INTO maintenance_workorders
  (tenant_id, work_order_no, asset_code, title, description, priority, status,
   planned_start_date, planned_end_date, estimated_hours,
   actual_start_date, actual_end_date, actual_hours,
   assigned_to, assigned_by, assigned_at, completed_by, completed_at,
   work_content, materials, labor_cost, outsourcing_cost, other_cost,
   cancel_reason, created_by)
VALUES
  (1, 'TEST-WO-2024-001', 'TEST-IT-003', '核心交换机 24 口 PoE 故障',
   'Cisco Catalyst 9300 第 24 口 PoE 供电异常，多个 AP 反复掉线，影响 5 楼 WiFi',
   1, 'in_progress',
   '2024-05-12 09:00:00', '2024-05-12 18:00:00', 6.0,
   '2024-05-12 10:00:00', NULL, NULL,
   '思科现场工程师 王工', 'admin', '2024-05-12 08:30:00', NULL, NULL,
   '诊断中，怀疑 PoE 控制器软件问题', '无', 0.00, 0.00, 0.00,
   NULL, 'admin'),

  (1, 'TEST-WO-2024-002', 'TEST-MED-002', '监护仪触摸屏更换',
   'Mindray N15 患者监护仪触摸屏局部无响应，影响正常使用',
   2, 'completed',
   '2024-06-18 09:00:00', '2024-06-19 17:00:00', 8.0,
   '2024-06-18 14:00:00', '2024-06-19 11:00:00', 4.0,
   '迈瑞售后 张工', 'admin', '2024-06-18 09:00:00', '迈瑞售后 张工', '2024-06-19 11:00:00',
   '更换 15 寸触控屏组件，校准触点',
   '触控面板组件 (¥1800) + 校准服务 (¥600)', 600.00, 2200.00, 0.00,
   NULL, 'admin'),

  (1, 'TEST-WO-2024-003', 'TEST-VEH-001', '丰田考斯特 2 万公里保养',
   '车辆到达 20000 公里，需要进行常规保养',
   3, 'completed',
   '2024-08-02 09:00:00', '2024-08-02 17:00:00', 6.0,
   '2024-08-02 09:30:00', '2024-08-02 12:30:00', 3.0,
   '一汽丰田 4S 店', 'admin', '2024-08-01 16:00:00', '一汽丰田 4S 店', '2024-08-02 12:30:00',
   '更换机油机滤 + 空气滤清器 + 车辆检测',
   '5W-30 机油 6L + 机滤 + 空滤', 200.00, 1080.00, 0.00,
   NULL, 'admin'),

  (1, 'TEST-WO-2024-004', 'TEST-IT-001', '笔记本电池更换',
   '联想 X1 Carbon 电池续航明显下降，充满后只能用 2 小时',
   2, 'pending',
   '2024-07-25 09:00:00', '2024-07-25 17:00:00', 4.0,
   NULL, NULL, NULL,
   NULL, 'admin', NULL, NULL, NULL,
   NULL, NULL, 0.00, 0.00, 0.00,
   NULL, 'admin'),

  (1, 'TEST-WO-2024-005', 'TEST-OFF-002', '打印机卡纸问题',
   'HP LaserJet Pro M404dn 卡纸频发，定影组件可能磨损',
   3, 'cancelled',
   NULL, NULL, NULL,
   NULL, NULL, NULL,
   NULL, 'admin', NULL, NULL, NULL,
   NULL, NULL, 0.00, 0.00, 0.00,
   '设备已闲置，建议报废', 'admin');

-- ============================================================
-- 13) IoT 设备 (iot_devices)
-- ============================================================
INSERT INTO iot_devices
  (tenant_id, device_id, device_name, device_type, manufacturer, model, serial_number,
   mac_address, firmware_version, install_date, install_location,
   battery_type, battery_capacity, update_interval, is_active, last_online_time, status, remark)
VALUES
  (1, 'RFID-TEST-IT-001-0001', 'RFID 资产标签 (笔记本)', 'RFID', 'Zebra', 'RFD8500',
   'ZB-RFD8500-00001', '00:1A:2B:3C:4D:01', 'v2.5.1', '2024-03-18',
   '联想 X1 Carbon 底部', '锂锰', 1500, 30, 1, '2026-06-27 14:00:00', '在线',
   '资产定位标签，每 30 秒上报一次位置'),

  (1, 'RFID-TEST-MED-001-0001', 'RFID 资产标签 (CT)', 'RFID', 'Zebra', 'RFD8500',
   'ZB-RFD8500-00002', '00:1A:2B:3C:4D:02', 'v2.5.1', '2023-11-20',
   'CT 设备外壳', '锂锰', 1500, 60, 1, '2026-06-27 14:00:00', '在线',
   '重要设备，每 60 秒上报一次'),

  (1, 'GPS-TEST-VEH-001-0001', 'GPS 定位器 (中巴车)', 'GPS', 'Queclink', 'GV300',
   'QL-GV300-00001', '35:46:AB:CD:EF:01', 'v1.8.0', '2024-06-05',
   '丰田考斯特 引擎舱', '锂聚合物', 5000, 10, 1, '2026-06-27 14:00:00', '在线',
   '车辆 GPS 跟踪 + 油耗监控'),

  (1, 'BLE-TEST-MED-002-0001', '蓝牙资产标签 (监护仪)', '蓝牙', 'Minew', 'B10',
   'MW-B10-00001', 'AC:23:3F:AA:BB:01', 'v3.2.0', '2024-05-12',
   '监护仪背面', '纽扣电池', 240, 120, 1, '2026-06-27 14:00:00', '在线',
   '室内定位，靠近信标时上报位置'),

  (1, 'UWB-TEST-OFF-001-0001', 'UWB 高精度定位 (人体工学椅)', 'UWB', 'Zebra', 'ATR7000',
   'ZB-ATR7000-00001', '11:22:33:44:55:66', 'v2.0.0', '2024-03-01',
   '椅子底座', '锂锰', 3000, 60, 0, '2024-08-15 12:00:00', '离线',
   '电池电量耗尽，待更换');

-- ============================================================
-- 14) 资产位置历史 (asset_location_history)
-- ============================================================
INSERT INTO asset_location_history
  (asset_code, device_id, device_type, latitude, longitude, floor_number,
   building_name, room_number, area_name, address, location_accuracy,
   signal_strength, battery_level, record_time, update_source, change_type,
   movement_distance, movement_speed, remark, tenant_id)
VALUES
  ('TEST-IT-001', 'RFID-TEST-IT-001-0001', 'RFID', 41.8089000, 123.4251000, 5,
   '总部大楼', '501 工位', '设计部', '沈阳市和平区南京北街 100 号',
   5.00, -65, 85, '2024-08-15 14:00:00', '设备自动上报', '位置移动',
   0.00, 0.00, '由 IT 部调拨到设计部', 1),

  ('TEST-IT-001', 'RFID-TEST-IT-001-0001', 'RFID', 41.8089000, 123.4251000, 5,
   '总部大楼', '501 工位', '设计部', '沈阳市和平区南京北街 100 号',
   5.00, -68, 82, '2024-08-15 15:00:00', '设备自动上报', '设备上报',
   0.00, 0.00, '设计部工位', 1),

  ('TEST-IT-002', NULL, 'WiFi', NULL, NULL, 3,
   '总部大楼', 'IDC-A03', '信息技术部', '沈阳市和平区南京北街 100 号 IDC 机房',
   NULL, -55, NULL, '2024-08-25 10:00:00', '系统同步', '系统同步',
   0.00, 0.00, '服务器机柜位置', 1),

  ('TEST-MED-001', 'RFID-TEST-MED-001-0001', 'RFID', NULL, NULL, 1,
   '影像楼', 'CT-ROOM-01', '放射科', '沈阳市和平区南京北街 100 号 影像楼 1 楼',
   3.00, -62, 78, '2024-08-20 09:00:00', '设备自动上报', '设备上报',
   0.00, 0.00, 'CT 扫描间', 1),

  ('TEST-MED-001', 'RFID-TEST-MED-001-0001', 'RFID', NULL, NULL, 1,
   '影像楼', 'CT-ROOM-01', '放射科', '沈阳市和平区南京北街 100 号 影像楼 1 楼',
   3.00, -65, 75, '2024-09-20 09:00:00', '设备自动上报', '设备上报',
   0.00, 0.00, '常规位置上报', 1),

  ('TEST-MED-002', 'BLE-TEST-MED-002-0001', '蓝牙', NULL, NULL, 3,
   '内科楼', '305 病房', '内科', '沈阳市和平区南京北街 100 号 内科楼 3 楼',
   2.00, -72, 60, '2024-08-15 14:00:00', '设备自动上报', '设备上报',
   0.00, 0.00, '常规位置', 1),

  ('TEST-VEH-001', 'GPS-TEST-VEH-001-0001', 'GPS', 41.8056230, 123.4318890, NULL,
   NULL, NULL, NULL, '沈阳市和平区南京北街 100 号 (公司停车场)',
   8.00, -88, 92, '2024-07-01 08:30:00', '设备自动上报', '位置移动',
   12.5, 25.0, '车辆启动', 1),

  ('TEST-VEH-001', 'GPS-TEST-VEH-001-0001', 'GPS', 41.7965430, 123.4098760, NULL,
   NULL, NULL, NULL, '沈阳桃仙国际机场',
   8.00, -90, 88, '2024-07-01 11:00:00', '设备自动上报', '位置移动',
   1850.0, 65.0, '机场接送', 1),

  ('TEST-VEH-001', 'GPS-TEST-VEH-001-0001', 'GPS', 41.8056230, 123.4318890, NULL,
   NULL, NULL, NULL, '沈阳市和平区南京北街 100 号 (公司停车场)',
   8.00, -85, 80, '2024-07-01 14:30:00', '设备自动上报', '位置移动',
   1850.0, 70.0, '返程', 1),

  ('TEST-OFF-001', 'UWB-TEST-OFF-001-0001', 'UWB', NULL, NULL, 5,
   '总部大楼', '501 办公室', '总裁办', '沈阳市和平区南京北街 100 号 501 办公室',
   0.30, -75, 0, '2024-08-15 13:00:00', '设备自动上报', '位置移动',
   0.00, 0.00, '电池耗尽前最后位置', 1);

-- ============================================================
-- 15) 资产报废完整流程 (asset_scrapping_records)
-- ============================================================
-- 15.1 报废记录主表
INSERT INTO asset_scrapping_records
  (asset_code, asset_name, asset_model, department, applicant, applicant_id,
   apply_date, scrapping_reason, estimated_value, current_status,
   appraiser, appraiser_id, appraisal_date, appraisal_result,
   approver, approver_id, approval_date, approval_comment,
   disposer, disposer_id, disposal_date, disposal_method,
   disposal_result, actual_value, remark, tenant_id)
VALUES
  ('TEST-OFF-002', 'HP LaserJet Pro M404dn 激光打印机', 'LaserJet Pro M404dn', '行政部',
   '孙八', 5, '2024-09-10 10:00:00',
   '设备老化，使用年限超过 5 年，故障频发，无维修价值', 2380.00, 'disposed',
   '技术鉴定员 王工', 11, '2024-09-12 14:00:00',
   '经技术鉴定，设备主板老化，定影组件磨损严重，无修复价值，建议报废',
   'admin', 1, '2024-09-15 09:00:00', '同意报废',
   '孙八', 5, '2024-09-20 15:00:00', '环保回收',
   '由具备资质的环保回收公司上门回收，出具报废证明', 200.00,
   '回收残值 ¥200', 1);

-- 15.2 报废鉴定 (asset_scrapping_appraisals)
INSERT INTO asset_scrapping_appraisals
  (scrapping_id, appraiser, appraiser_id, appraisal_date, technical_condition,
   scrapping_necessity, estimated_value, appraisal_result, appraisal_attachments,
   tenant_id, updated_at)
SELECT id, '技术鉴定员 王工', 11, '2024-09-12 14:00:00',
       '严重老化', '必要', 200.00,
       '经技术鉴定，设备主板老化，定影组件磨损严重，无修复价值，建议报废',
       'appraisal_report_off002_20240912.pdf', 1, NOW()
FROM asset_scrapping_records WHERE asset_code = 'TEST-OFF-002';

-- 15.3 报废审批 (asset_scrapping_approvals) - 多级审批
INSERT INTO asset_scrapping_approvals
  (scrapping_id, approver, approver_id, approval_level, approval_status,
   approval_comment, approval_date, tenant_id, updated_at)
SELECT id, '部门主管 钱七', 8, 1, 'approved',
       '同意部门报废申请', '2024-09-13 10:00:00', 1, NOW()
FROM asset_scrapping_records WHERE asset_code = 'TEST-OFF-002';

INSERT INTO asset_scrapping_approvals
  (scrapping_id, approver, approver_id, approval_level, approval_status,
   approval_comment, approval_date, tenant_id, updated_at)
SELECT id, 'admin', 1, 2, 'approved',
       '审批通过，资产价值已核销', '2024-09-15 09:00:00', 1, NOW()
FROM asset_scrapping_records WHERE asset_code = 'TEST-OFF-002';

-- 15.4 报废处置 (asset_scrapping_disposals)
INSERT INTO asset_scrapping_disposals
  (scrapping_id, disposer, disposer_id, disposal_date, disposal_method,
   disposal_company, actual_value, disposal_result, disposal_attachments,
   disposal_certificate, tenant_id, updated_at)
SELECT id, '孙八', 5, '2024-09-20 15:00:00', '环保回收',
       '辽宁绿环环保科技有限公司', 200.00,
       '由具备资质的环保回收公司上门回收，出具报废证明',
       'disposal_record_off002_20240920.pdf',
       'CERT-2024-0920-0001', 1, NOW()
FROM asset_scrapping_records WHERE asset_code = 'TEST-OFF-002';

-- ============================================================
-- 16) 计量器具与检定记录
-- ============================================================
INSERT INTO metrology_devices
  (device_code, device_name, device_type, asset_id, measurement_range,
   accuracy_class, manufacturer, serial_number, verification_cycle,
   last_verification_date, next_verification_date, status, certificate_number, tenant_id)
VALUES
  ('TEST-MTR-001', 'CT 设备计量校准器', '电离辐射计量仪', NULL,
   '0-100mGy/h', '二级', 'GE Healthcare', 'GE-MTR-CT-2023-001', 12,
   '2024-11-15', '2025-11-15', 'normal', 'CERT-2024-1115-0001', 1),

  ('TEST-MTR-002', '监护仪血氧模拟器', '生理参数模拟器', NULL,
   'SpO2 35-100%', '二级', 'Mindray', 'MR-MTR-N15-2024-001', 6,
   '2024-05-12', '2024-11-12', 'pending', 'CERT-2024-0512-0001', 1),

  ('TEST-MTR-003', '血压计检定仪', '压力计量仪', NULL,
   '0-300 mmHg', '一级', 'Fluke', 'FK-BP-PRO-2024-001', 12,
   '2024-06-10', '2025-06-10', 'normal', 'CERT-2024-0610-0001', 1);

-- 16.2 计量检定记录 (metrology_records)
INSERT INTO metrology_records
  (tenant_id, record_no, asset_code, asset_name, customer_name, specification,
   serial_number, technical_document, conformance_standard, metrology_type,
   metrology_date, next_metrology_date, metrology_agency, certificate_no,
   result, accuracy_level, measurement_range, calibration_environment,
   standard_instrument, standard_certificate_no, standard_validity,
   uncertainty, cost, operator, approver, remark, status, metrology_cycle, created_by)
VALUES
  (1, 'TEST-MR-2024-001', 'TEST-MED-001', 'GE Revolution CT 扫描仪',
   '第四医院', 'Revolution CT', 'GE-CT-2024-0001', 'GB/T 19042-2005',
   'GB 9706.18-2006', '周期检定',
   '2024-11-15', '2025-11-15', '辽宁省计量科学研究院',
   'CERT-2024-1115-0001', '合格', '二级', '0-100mGy/h',
   '温度 22±2°C, 湿度 50±10%',
   '标准电离室', 'PRM-2024-001', '2025-06-30',
   'U=2.5% (k=2)', 3500.00, '王五', 'admin',
   '检定合格，证书有效期 1 年', '已完成', 12, 'admin'),

  (1, 'TEST-MR-2024-002', 'TEST-MED-002', 'Mindray N15 患者监护仪',
   '第四医院', 'N15', 'MR-N15-2024-0023', 'JJG 1163-2019',
   'JJG (浙) 92-2018', '周期检定',
   '2024-05-12', '2024-11-12', '迈瑞医疗检定中心',
   'CERT-2024-0512-0001', '合格', '二级', 'SpO2 35-100%',
   '温度 22±2°C, 湿度 50±10%',
   'FLUKE INDEX 2 生命体征模拟器', 'FK-IDX2-2024', '2025-03-31',
   'U=1.5% (k=2)', 1200.00, '赵六', 'admin',
   '检定合格，即将到期，需 11 月再次检定', '已完成', 6, 'admin'),

  (1, 'TEST-MR-2024-003', 'TEST-MED-002', 'Mindray N15 患者监护仪',
   '第四医院', 'N15', 'MR-N15-2024-0023', 'JJG 1163-2019',
   'JJG (浙) 92-2018', '期间核查',
   '2024-08-15', NULL, '院内自检',
   'INTERNAL-2024-0815-001', '合格', NULL, 'SpO2 35-100%',
   '室温', 'FLUKE INDEX 2', 'FK-IDX2-2024', '2025-03-31',
   'U=2.0% (k=2)', 0.00, '赵六', '王五',
   '维修后期间核查', '已完成', NULL, 'admin'),

  (1, 'TEST-MR-2024-004', 'TEST-MED-001', 'GE Revolution CT 扫描仪',
   '第四医院', 'Revolution CT', 'GE-CT-2024-0001', 'GB/T 19042-2005',
   'GB 9706.18-2006', '首次检定',
   '2023-11-25', '2024-11-25', '辽宁省计量科学研究院',
   'CERT-2023-1125-0001', '合格', '二级', '0-100mGy/h',
   '温度 22±2°C, 湿度 50±10%',
   '标准电离室', 'PRM-2023-001', '2024-06-30',
   'U=2.5% (k=2)', 5500.00, '王五', 'admin',
   '新机首次检定，已完成年度复检', '已完成', 12, 'admin');

-- ============================================================
-- 17) 质控管理 (quality_control_records)
-- ============================================================
INSERT INTO quality_control_records
  (tenant_id, record_no, asset_code, asset_name, qc_type, qc_date, next_qc_date,
   qc_item, qc_method, qc_person, department, qc_standard, result,
   qc_value, standard_value, actual_value, tolerance, deviation,
   operator, reviewer, review_date, remark, status, qc_cycle)
VALUES
  (1, 'TEST-QC-2024-001', 'TEST-MED-001', 'GE Revolution CT 扫描仪', '日常质控',
   '2024-08-01', '2024-08-02', 'CT 值均匀性测试', '水模扫描',
   '王五', '放射科', 'AAPM Report No.39',
   '合格', 'CT 值 (HU)', '0±5 HU', '-1.5 HU', '±5 HU', '-1.5 HU',
   '王五', 'admin', '2024-08-01', '每日 QC 例行', '已完成', 1),

  (1, 'TEST-QC-2024-002', 'TEST-MED-001', 'GE Revolution CT 扫描仪', '日常质控',
   '2024-08-02', '2024-08-03', 'CT 值均匀性测试', '水模扫描',
   '王五', '放射科', 'AAPM Report No.39',
   '合格', 'CT 值 (HU)', '0±5 HU', '-2.1 HU', '±5 HU', '-2.1 HU',
   '王五', 'admin', '2024-08-02', '每日 QC 例行', '已完成', 1),

  (1, 'TEST-QC-2024-003', 'TEST-MED-002', 'Mindray N15 患者监护仪', '定期质控',
   '2024-08-15', '2025-02-15', 'SpO2 精度测试', 'FLUKE INDEX 2',
   '赵六', '内科', 'JJG 1163-2019',
   '合格', 'SpO2 (%)', '97±2%', '97.5%', '±2%', '0.5%',
   '赵六', '王五', '2024-08-15', '维修后定期 QC', '已完成', 180),

  (1, 'TEST-QC-2024-004', 'TEST-IT-002', 'Dell PowerEdge R750 机架服务器', '专项质控',
   '2024-08-30', '2024-11-30', 'RAID 健康检查',
   'MegaRAID Storage Manager', '李四', '信息技术部', '内部运维规范',
   '合格', '磁盘状态', '全部 Optimal', 'Optimal', '全部 Optimal', NULL,
   '李四', 'admin', '2024-08-30', '季度专项检查', '已完成', 90),

  (1, 'TEST-QC-2024-005', 'TEST-MED-001', 'GE Revolution CT 扫描仪', '专项质控',
   '2024-06-15', NULL, '高对比度分辨率',
   '高对比度模体', '王五', '放射科', 'AAPM Report No.39',
   '不合格', '线对 (LP/cm)', '≥6 LP/cm', '4.5 LP/cm', '≥6 LP/cm', '1.5 LP/cm',
   '王五', 'admin', '2024-06-15', '球管老化，已申请更换', '整改中', 90);

-- ============================================================
-- 18) 风险评估 (risk_assessments)
-- ============================================================
INSERT INTO risk_assessments
  (asset_id, risk_level, risk_score, assessment_date, next_assessment_date,
   assessor_id, risk_factors, mitigation_measures, status, tenant_id)
SELECT id, 'critical', 85, '2024-08-01', '2025-08-01', 1,
       '大型电离辐射设备，运行电压高，辐射风险大',
       '定期维护，操作人员资质管理，安全联锁装置定期检查',
       'active', 1
FROM assets WHERE asset_code = 'TEST-MED-001';

INSERT INTO risk_assessments
  (asset_id, risk_level, risk_score, assessment_date, next_assessment_date,
   assessor_id, risk_factors, mitigation_measures, status, tenant_id)
SELECT id, 'high', 70, '2024-08-15', '2025-02-15', 1,
       '生命支持设备，电池供电，患者生命体征监测关键设备',
       '电池定期测试，双重电源配置，备用监护仪',
       'active', 1
FROM assets WHERE asset_code = 'TEST-MED-002';

INSERT INTO risk_assessments
  (asset_id, risk_level, risk_score, assessment_date, next_assessment_date,
   assessor_id, risk_factors, mitigation_measures, status, tenant_id)
SELECT id, 'medium', 45, '2024-08-20', '2025-08-20', 1,
       '核心交换机故障会影响全公司网络',
       '冗余堆叠配置，定期配置备份',
       'active', 1
FROM assets WHERE asset_code = 'TEST-IT-003';

-- ============================================================
-- 19) 特种设备 (special_equipment) - 关联 CT 设备
-- ============================================================
INSERT INTO special_equipment
  (equipment_code, equipment_name, equipment_type, asset_id,
   registration_code, install_location, next_inspection_date,
   safety_status, status, tenant_id, created_by)
SELECT 'TEST-SE-CT-001', 'CT 扫描仪 (压力容器组件)', 'pressure_vessel',
       id, 'LV-2023-LN-001', '影像楼 1 楼 CT 室',
       '2025-08-15', 'normal', 'in_use', 1, 1
FROM assets WHERE asset_code = 'TEST-MED-001';

-- ============================================================
-- 20) 安全检测 (safety_inspections)
-- ============================================================
INSERT INTO safety_inspections
  (inspection_code, inspection_name, asset_id, inspection_type,
   inspection_date, inspection_org, inspection_result,
   next_inspection_date, status, tenant_id, created_by)
SELECT 'TEST-SI-2024-001', 'CT 设备电气安全年度检测',
       id, 'electrical',
       '2024-08-15', '辽宁省特种设备检测院',
       'pass', '2025-08-15', 'completed', 1, 1
FROM assets WHERE asset_code = 'TEST-MED-001';

INSERT INTO safety_inspections
  (inspection_code, inspection_name, asset_id, inspection_type,
   inspection_date, inspection_org, inspection_result,
   next_inspection_date, status, tenant_id, created_by)
SELECT 'TEST-SI-2024-002', 'CT 设备辐射防护检测',
       id, 'radiation',
       '2024-08-15', '辽宁省疾病预防控制中心',
       'pass', '2025-08-15', 'completed', 1, 1
FROM assets WHERE asset_code = 'TEST-MED-001';

INSERT INTO safety_inspections
  (inspection_code, inspection_name, asset_id, inspection_type,
   inspection_date, inspection_org, inspection_result,
   next_inspection_date, status, tenant_id, created_by)
SELECT 'TEST-SI-2024-003', '服务器机房电气检测',
       id, 'electrical',
       '2024-07-10', '辽宁省电气科学研究院',
       'pass', '2025-07-10', 'completed', 1, 1
FROM assets WHERE asset_code = 'TEST-IT-002';

-- ============================================================
-- 21) 不良事件 (adverse_events)
-- ============================================================
INSERT INTO adverse_events
  (event_code, asset_id, event_type, severity_level, occurrence_date,
   discovery_date, reporter_id, description, immediate_action,
   status, root_cause, corrective_action, preventive_action,
   closed_date, closed_by, tenant_id)
SELECT 'TEST-AE-2024-001', id, '设备故障导致检查中断', 'moderate',
       '2024-06-15 09:00:00', '2024-06-15 09:05:00', 4,
       'CT 设备高压发生器故障，扫描过程中突然停止，患者检查中断',
       '立即切换到备用 CT 室 (3 号机房)，安抚患者，启动紧急维修',
       'closed',
       '高压发生器电容老化，导致击穿',
       '更换高压电容组，校准高压参数',
       '建立每日高压系统点检制度',
       '2024-06-25', 1, 1
FROM assets WHERE asset_code = 'TEST-MED-001';

INSERT INTO adverse_events
  (event_code, asset_id, event_type, severity_level, occurrence_date,
   discovery_date, reporter_id, description, immediate_action,
   status, root_cause, corrective_action, preventive_action,
   closed_date, closed_by, tenant_id)
SELECT 'TEST-AE-2024-002', id, '监护仪报警失效', 'serious',
       '2024-07-20 14:30:00', '2024-07-20 14:35:00', 6,
       'Mindray N15 监护仪血氧饱和度低报警未触发，但患者实际 SpO2 跌至 85%',
       '护士人工巡检发现，立即转 ICU 加强监护',
       'closed',
       '报警音量旋钮故障，无法调到合适音量',
       '更换报警扬声器，校准报警阈值',
       '每月检查报警系统，建立设备报警日志',
       '2024-08-01', 1, 1
FROM assets WHERE asset_code = 'TEST-MED-002';

-- ============================================================
-- 22) 培训记录 (training_records)
-- ============================================================
INSERT INTO training_records
  (user_id, training_name, training_type, training_date, duration_hours,
   training_provider, trainer, certificate_number, tenant_id)
VALUES
  (4, 'CT 设备操作人员资质培训', '岗位培训',
   '2024-01-15', 16, 'GE Healthcare 中国',
   'GE 培训师 Tom', 'GE-OP-CT-2024-004', 1),

  (4, '医疗设备辐射防护培训', '安全培训',
   '2024-03-20', 8, '辽宁省卫生健康委员会',
   '卫健委讲师', 'LN-RAD-2024-015', 1),

  (6, '监护仪使用与维护培训', '设备培训',
   '2024-04-25', 4, '迈瑞医疗',
   '迈瑞工程师 张工', 'MR-N15-OP-2024-008', 1),

  (5, '医疗设备管理信息系统培训', '管理培训',
   '2024-05-15', 8, 'AssetHub 培训中心',
   '李传佳', 'AH-IT-2024-023', 1),

  (8, '医疗设备应急处理演练', '应急培训',
   '2024-06-25', 4, '院内自组织',
   '王五', 'INTERNAL-EMG-2024-007', 1);

-- ============================================================
-- 23) 技术资料 (technical_documents)
-- ============================================================
INSERT INTO technical_documents
  (tenant_id, title, description, file_name, file_path, file_type, file_size,
   category, asset_type, brand, model, version, language,
   upload_source, uploaded_by, upload_date, download_count, view_count,
   is_public, status, remark)
VALUES
  (1, 'GE Revolution CT 设备操作手册', 'CT 扫描仪完整操作指南',
   'GE_CT_Revolution_Manual.pdf', '/docs/test/GE_CT_Revolution_Manual.pdf',
   'pdf', 12582912, '设备操作手册', '影像设备', 'GE', 'Revolution CT',
   'v3.2', 'zh-CN', '内部上传', 'admin', '2023-11-20 10:00:00',
   35, 128, 1, 'active', 'GE 官方中文版手册'),

  (1, 'Mindray N15 监护仪维护指南', 'N15 患者监护仪维护说明书',
   'Mindray_N15_Maintenance.pdf', '/docs/test/Mindray_N15_Maintenance.pdf',
   'pdf', 8388608, '设备维护手册', '监护仪', '迈瑞', 'N15',
   'v2.1', 'zh-CN', '内部上传', 'admin', '2024-05-12 11:00:00',
   22, 87, 1, 'active', '维护保养指南'),

  (1, 'Cisco Catalyst 9300 配置手册', '9300 系列交换机配置指南',
   'Cisco_C9300_Config.pdf', '/docs/test/Cisco_C9300_Config.pdf',
   'pdf', 15728640, '网络设备配置', '交换机', 'Cisco', 'Catalyst 9300',
   'v17.09', 'zh-CN', '内部上传', 'admin', '2024-04-02 14:00:00',
   18, 56, 0, 'active', 'IT 部内部资料'),

  (1, '资产盘点系统使用手册 v2.0', '盘点系统操作流程',
   'Inventory_System_Manual.docx', '/docs/test/Inventory_System_Manual.docx',
   'docx', 2097152, '系统操作手册', '信息系统', NULL, 'AssetHub',
   'v2.0', 'zh-CN', '内部上传', 'admin', '2024-09-01 09:00:00',
   45, 156, 1, 'active', '全员可查'),

  (1, '医疗设备计量检定规程汇编', '计量检定规程汇总',
   'Metrology_Procedures.pdf', '/docs/test/Metrology_Procedures.pdf',
   'pdf', 31457280, '技术规范', '计量器具', NULL, NULL,
   '2024 版', 'zh-CN', '外部上传', 'admin', '2024-04-01 10:00:00',
   12, 34, 1, 'active', '由辽宁省计量院提供');

-- ============================================================
-- 24) 审计日志 (audit_logs)
-- ============================================================
INSERT INTO audit_logs
  (tenant_id, user_id, username, real_name, role, action_type, module,
   resource_type, resource_id, resource_name, action_description,
   old_value, new_value, ip_address, user_agent, request_method,
   request_path, created_at)
VALUES
  (1, 1, 'admin', '系统管理员', 'admin', 'CREATE', 'asset',
   'asset', NULL, 'TEST-IT-001',
   '创建资产: 联想 ThinkPad X1 Carbon 笔记本电脑',
   NULL, '{"asset_code":"TEST-IT-001","asset_name":"联想 ThinkPad X1 Carbon"}',
   '10.0.1.100', 'Mozilla/5.0 (Macintosh)', 'POST',
   '/api/assets', '2024-03-15 09:00:00'),

  (1, 1, 'admin', '系统管理员', 'admin', 'UPDATE', 'asset',
   'asset', NULL, 'TEST-OFF-002',
   '更新资产状态: 在用 → 闲置',
   '在用', '闲置',
   '10.0.1.100', 'Mozilla/5.0 (Macintosh)', 'PUT',
   '/api/assets/TEST-OFF-002/status', '2024-09-01 09:00:00'),

  (1, 1, 'admin', '系统管理员', 'admin', 'CREATE', 'maintenance',
   'maintenance_request', NULL, 'TEST-MNT-2024-001',
   '创建维修工单: Cisco 交换机 24 口 PoE 故障',
   NULL, '{"request_no":"TEST-MNT-2024-001","fault_level":"严重"}',
   '10.0.1.100', 'Mozilla/5.0 (Macintosh)', 'POST',
   '/api/maintenance/requests', '2024-05-10 11:00:00'),

  (1, 5, 'sunba', '孙八', 'staff', 'CREATE', 'maintenance',
   'maintenance_request', NULL, 'TEST-MNT-2024-004',
   '创建维修工单: HP 打印机卡纸问题',
   NULL, '{"request_no":"TEST-MNT-2024-004"}',
   '10.0.1.105', 'Mozilla/5.0', 'POST',
   '/api/maintenance/requests', '2024-04-20 14:30:00'),

  (1, 1, 'admin', '系统管理员', 'admin', 'APPROVE', 'transfer',
   'asset_transfer', NULL, 'TEST-TRF-2024-001',
   '审批通过资产调拨: IT-001 从 IT 部调拨至研发部',
   '待审批', '已完成',
   '10.0.1.100', 'Mozilla/5.0 (Macintosh)', 'POST',
   '/api/transfers/TEST-TRF-2024-001/approve', '2024-08-16 09:00:00'),

  (1, 4, 'wangwu', '王五', 'staff', 'CREATE', 'acceptance',
   'asset_acceptance', NULL, 'TEST-MED-001',
   '资产验收通过: GE Revolution CT 扫描仪',
   NULL, '{"acceptance_status":"已验收"}',
   '10.0.1.110', 'Mozilla/5.0', 'POST',
   '/api/asset-acceptance', '2023-11-20 14:00:00'),

  (1, 1, 'admin', '系统管理员', 'admin', 'CREATE', 'inventory',
   'inventory_plan', NULL, 'TEST-INV-2024-001',
   '创建盘点计划: 2024 Q3 总部 IT 资产盘点',
   NULL, '{"plan_no":"TEST-INV-2024-001"}',
   '10.0.1.100', 'Mozilla/5.0 (Macintosh)', 'POST',
   '/api/inventory-plans', '2024-09-01 09:00:00'),

  (1, 1, 'admin', '系统管理员', 'admin', 'CREATE', 'scrapping',
   'asset_scrapping', NULL, 'TEST-OFF-002',
   '创建资产报废申请',
   NULL, '{"asset_code":"TEST-OFF-002","reason":"设备老化"}',
   '10.0.1.100', 'Mozilla/5.0 (Macintosh)', 'POST',
   '/api/scrapping/requests', '2024-09-10 10:00:00'),

  (1, 1, 'admin', '系统管理员', 'admin', 'LOGIN', 'auth',
   NULL, NULL, NULL,
   '用户登录成功',
   NULL, NULL,
   '10.0.1.100', 'Mozilla/5.0 (Macintosh)', 'POST',
   '/api/users/login', '2026-06-27 08:30:00'),

  (1, 1, 'admin', '系统管理员', 'admin', 'CREATE', 'usage',
   'asset_usage', NULL, 'TEST-MED-001',
   '记录资产使用量: GE CT 使用 18 次',
   NULL, '{"usage_value":18,"usage_type":"使用次数"}',
   '10.0.1.110', 'Mozilla/5.0', 'POST',
   '/api/asset-usage-records', '2024-08-01 18:00:00');

-- ============================================================
-- 25) 验证
-- ============================================================
SELECT 'asset_images' AS tbl, COUNT(*) AS cnt FROM asset_images WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'asset_change_logs', COUNT(*) FROM asset_change_logs WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'idle_assets', COUNT(*) FROM idle_assets WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'maintenance_plans', COUNT(*) FROM maintenance_plans WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'maintenance_logs', COUNT(*) FROM maintenance_logs WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'maintenance_workorders', COUNT(*) FROM maintenance_workorders WHERE work_order_no LIKE 'TEST-WO-%'
UNION ALL SELECT 'asset_location_history', COUNT(*) FROM asset_location_history WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'iot_devices', COUNT(*) FROM iot_devices WHERE device_id LIKE 'TEST-%'
UNION ALL SELECT 'asset_scrapping_records', COUNT(*) FROM asset_scrapping_records WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'asset_scrapping_appraisals', COUNT(*) FROM asset_scrapping_appraisals WHERE tenant_id=1
UNION ALL SELECT 'asset_scrapping_approvals', COUNT(*) FROM asset_scrapping_approvals WHERE tenant_id=1
UNION ALL SELECT 'asset_scrapping_disposals', COUNT(*) FROM asset_scrapping_disposals WHERE tenant_id=1
UNION ALL SELECT 'metrology_devices', COUNT(*) FROM metrology_devices WHERE device_code LIKE 'TEST-MTR-%'
UNION ALL SELECT 'metrology_records', COUNT(*) FROM metrology_records WHERE asset_code LIKE 'TEST-MED-%'
UNION ALL SELECT 'quality_control_records', COUNT(*) FROM quality_control_records WHERE asset_code LIKE 'TEST-%'
UNION ALL SELECT 'risk_assessments', COUNT(*) FROM risk_assessments WHERE tenant_id=1
UNION ALL SELECT 'special_equipment', COUNT(*) FROM special_equipment WHERE equipment_code LIKE 'TEST-%'
UNION ALL SELECT 'safety_inspections', COUNT(*) FROM safety_inspections WHERE inspection_code LIKE 'TEST-%'
UNION ALL SELECT 'adverse_events', COUNT(*) FROM adverse_events WHERE event_code LIKE 'TEST-%'
UNION ALL SELECT 'training_records', COUNT(*) FROM training_records WHERE certificate_number LIKE 'TEST-%' OR training_name LIKE '%CT%' OR training_name LIKE '%监护%'
UNION ALL SELECT 'technical_documents', COUNT(*) FROM technical_documents WHERE tenant_id=1 AND file_path LIKE '/docs/test/%'
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs WHERE (request_path LIKE '%TEST-%' OR action_description LIKE '%TEST-%' OR username='admin') AND action_type IN ('CREATE','UPDATE','APPROVE','LOGIN');
