-- ============================================================
-- AssetHub 测试流程数据
-- ============================================================
SET NAMES utf8mb4;

-- ============================================================
-- 2) 资产验收流程
-- ============================================================

-- 2.1 验收申请 (acceptance_applications)
INSERT INTO acceptance_applications
  (application_no, company_name, company_contact, company_phone, company_email,
   purchase_department, use_department,
   asset_name, asset_code, asset_brand, asset_model,
   purchase_date, purchase_amount, status, reviewer,
   review_date, remark, tenant_id)
VALUES
  ('TEST-ACC-2024-001', '联想（北京）有限公司', '王经理', '13800001001', 'wang@lenovo.cn',
   '信息技术部', '信息技术部',
   '联想 ThinkPad X1 Carbon 笔记本电脑', 'TEST-IT-001', 'Lenovo', 'X1 Carbon Gen 11',
   '2024-03-15', 12800.00, '已通过', 'admin',
   '2024-03-18', '高端商务本采购', 1),

  ('TEST-ACC-2024-002', '深圳迈瑞生物医疗电子股份有限公司', '李经理', '13800001002', 'li@mindray.com',
   '医疗设备科', '内科',
   'Mindray N15 患者监护仪', 'TEST-MED-002', '迈瑞', 'N15',
   '2024-05-08', 32000.00, '已通过', 'admin',
   '2024-05-12', 'ICU 床旁监护采购', 1),

  ('TEST-ACC-2024-003', '中国惠普有限公司', '陈经理', '13800001003', 'chen@hp.com',
   '行政部', '行政部',
   'HP LaserJet Pro M404dn 激光打印机', 'TEST-OFF-002', 'HP', 'LaserJet Pro M404dn',
   '2024-04-15', 2800.00, '审核中', 'admin',
   NULL, '批量采购办公设备', 1),

  ('TEST-ACC-2024-004', '思科（中国）有限公司', '刘经理', '13800001004', 'liu@cisco.com',
   '信息技术部', '信息技术部',
   'Cisco Catalyst 9300 核心交换机', 'TEST-IT-003', 'Cisco', 'Catalyst 9300-48UXM',
   '2024-03-25', 78000.00, '已验收', 'admin',
   '2024-04-02', '核心机房升级', 1),

  ('TEST-ACC-2024-005', '苹果电脑贸易（上海）有限公司', '黄经理', '13800001005', 'huang@apple.com',
   '研发部', '设计中心',
   'Apple MacBook Pro 14 笔记本电脑', 'TEST-IT-004', 'Apple', 'MacBook Pro 14 M3 Pro',
   '2024-07-12', 19999.00, '已通过', 'admin',
   '2024-07-18', '设计师专用设备', 1);

-- 2.2 申请-资产关联表 (acceptance_application_assets)
INSERT INTO acceptance_application_assets
  (application_id, asset_name, asset_code, asset_brand, asset_model, asset_specification,
   purchase_date, purchase_amount, order_index, tenant_id)
SELECT id, asset_name, asset_code, asset_brand, asset_model, asset_specification,
       purchase_date, purchase_amount, 1, tenant_id
FROM acceptance_applications
WHERE application_no LIKE 'TEST-ACC-%';

-- 2.3 验收记录 (asset_acceptance_records)
INSERT INTO asset_acceptance_records
  (asset_code, asset_name, supplier, acceptance_date, acceptance_person,
   department, functional_department, status, remark, tenant_id, created_by)
VALUES
  ('TEST-IT-001', '联想 ThinkPad X1 Carbon 笔记本电脑', '联想（北京）有限公司',
   '2024-03-18', '张三', '信息技术部', '信息技术部', '已验收',
   '型号规格与合同一致，外观完好，硬件测试通过', 1, 'admin'),

  ('TEST-IT-002', 'Dell PowerEdge R750 机架服务器', '戴尔（中国）有限公司',
   '2024-01-25', '李四', '信息技术部', '信息技术部', '已验收',
   '机架安装完成，配置 RAID 通过压力测试', 1, 'admin'),

  ('TEST-MED-001', 'GE Revolution CT 扫描仪', '通用电气医疗（中国）有限公司',
   '2023-11-20', '王五', '放射科', '放射科', '已验收',
   'GE 工程师现场安装调试，扫描图像质量达标', 1, 'admin'),

  ('TEST-MED-002', 'Mindray N15 患者监护仪', '深圳迈瑞生物医疗电子股份有限公司',
   '2024-05-12', '赵六', '内科', '内科', '已验收',
   '床边测试各项参数正常', 1, 'admin'),

  ('TEST-OFF-001', 'Herman Miller Aeron 人体工学椅', 'Herman Miller 中国',
   '2024-03-01', '钱七', '总裁办', '总裁办', '已验收',
   '高端座椅，承重测试通过', 1, 'admin'),

  ('TEST-IT-003', 'Cisco Catalyst 9300 核心交换机', '思科（中国）有限公司',
   '2024-04-02', '李四', '信息技术部', '信息技术部', '已验收',
   '机架安装完成，IOS 升级到 17.09.04a', 1, 'admin'),

  ('TEST-IT-004', 'Apple MacBook Pro 14 笔记本电脑', '苹果电脑贸易（上海）有限公司',
   '2024-07-18', '吴十', '研发部', '设计中心', '已验收',
   '系统镜像部署完成，Final Cut Pro 7 已安装', 1, 'admin'),

  ('TEST-OFF-003', '钢制 4 门更衣柜', '震旦（中国）有限公司',
   '2024-04-25', '孙八', '行政部', '行政部', '已验收',
   '安装完毕，钥匙配齐', 1, 'admin'),

  ('TEST-VEH-001', '丰田 考斯特 中巴车', '一汽丰田汽车销售有限公司',
   '2024-06-05', '周九', '行政部', '行政部', '已验收',
   '车辆上牌完毕，年检通过', 1, 'admin'),

  ('TEST-OFF-002', 'HP LaserJet Pro M404dn 激光打印机', '中国惠普有限公司',
   NULL, NULL, '行政部', '行政部', '待验收',
   '已到货，等待工程师上门安装', 1, 'admin');

-- ============================================================
-- 3) 资产维修流程 (maintenance_requests)
-- ============================================================
INSERT INTO maintenance_requests
  (request_no, asset_code, asset_name, fault_description, fault_level,
   request_date, request_person, request_department, contact_phone,
   expected_repair_date, status, repair_person, repair_start_date,
   repair_end_date, repair_cost, repair_content, parts_replaced, remark, tenant_id, created_by)
VALUES
  ('TEST-MNT-2024-001', 'TEST-IT-003', 'Cisco Catalyst 9300 核心交换机',
   '交换机第 24 口 PoE 供电异常，部分 AP 反复掉线',
   '严重', '2024-05-10', '李四', '信息技术部', '13900001001',
   '2024-05-12', '维修中', '思科现场工程师 王工', '2024-05-12', NULL,
   0.00, NULL, NULL, '思科 TAC 案例 8888-XXXX-XXXX', 1, 'admin'),

  ('TEST-MNT-2024-002', 'TEST-MED-002', 'Mindray N15 患者监护仪',
   '触摸屏局部无响应，需更换触控面板',
   '一般', '2024-06-15', '赵六', '内科', '13900001002',
   '2024-06-20', '已完成', '迈瑞售后 张工', '2024-06-18', '2024-06-19',
   2800.00, '更换 15 寸触控屏组件，校准触点',
   '触控面板组件 SN:TP-N15-20240619',
   '已恢复正常使用', 1, 'admin'),

  ('TEST-MNT-2024-003', 'TEST-IT-001', '联想 ThinkPad X1 Carbon 笔记本电脑',
   '电池续航明显下降，充满后只能用 2 小时',
   '一般', '2024-07-20', '张三', '信息技术部', '13900001003',
   '2024-07-25', '待审批', NULL, NULL, NULL,
   0.00, NULL, NULL, '过保维修', 1, 'admin'),

  ('TEST-MNT-2024-004', 'TEST-OFF-002', 'HP LaserJet Pro M404dn 激光打印机',
   '卡纸频发，定影组件可能磨损',
   '一般', '2024-04-20', '孙八', '行政部', '13900001004',
   NULL, '已拒绝', NULL, NULL, NULL,
   0.00, NULL, NULL, '设备已闲置，建议报废', 1, 'admin'),

  ('TEST-MNT-2024-005', 'TEST-VEH-001', '丰田 考斯特 中巴车',
   '2 万公里保养，更换机油机滤',
   '一般', '2024-08-01', '周九', '行政部', '13900001005',
   '2024-08-03', '已完成', '一汽丰田 4S 店', '2024-08-02', '2024-08-02',
   1280.00, '更换 5W-30 全合成机油 + 机滤 + 空气滤清器',
   '机油 6L/机滤/空滤', '保养完成', 1, 'admin');

-- ============================================================
-- 4) 资产调拨流程 (asset_transfers)
-- ============================================================
INSERT INTO asset_transfers
  (transfer_no, asset_code, from_department, to_department,
   from_location, to_location, from_person, to_person,
   transfer_date, transfer_reason, status, approver, approve_date, remark, created_by, tenant_id)
VALUES
  ('TEST-TRF-2024-001', 'TEST-IT-001', '信息技术部', '研发部',
   '总部 5 楼 IT 部', '总部 5 楼 设计部', '张三', '吴十',
   '2024-08-15', '支持新员工入职', '已完成', 'admin', '2024-08-16',
   '已交接，资产编号同步更新', 'admin', 1),

  ('TEST-TRF-2024-002', 'TEST-OFF-002', '信息技术部', '行政部',
   '总部 5 楼 IT 部', '总部 4 楼 文印室', '张三', '孙八',
   '2024-04-15', '闲置设备调拨使用', '已完成', 'admin', '2024-04-16',
   '测试页打印正常', 'admin', 1),

  ('TEST-TRF-2024-003', 'TEST-OFF-003', '总裁办', '行政部',
   '总部 5 楼 501 办公室', '总部 6 楼 茶水间', '钱七', '孙八',
   '2024-04-20', '员工更衣室补充', '已完成', 'admin', '2024-04-21',
   '已重新编号登记', 'admin', 1),

  ('TEST-TRF-2024-004', 'TEST-IT-004', '设计中心', '研发部',
   '总部 5 楼 设计部', '总部 5 楼 研发部', '吴十', '研发部管理员',
   '2024-09-01', '项目组工作需要', '待审批', NULL, NULL,
   '申请审批中', 'admin', 1);

-- ============================================================
-- 5) 资产盘点流程 (inventory_plans / inventory_records / inventory_details)
-- ============================================================

-- 5.1 盘点计划
INSERT INTO inventory_plans
  (plan_no, plan_name, start_date, end_date, status, remark, created_by, tenant_id)
VALUES
  ('TEST-INV-2024-001', '2024 年 Q3 总部 IT 资产盘点', '2024-09-01', '2024-09-30',
   'active', '信息技术部全员盘点', 'admin', 1),

  ('TEST-INV-2024-002', '2024 年 Q4 全公司办公家具盘点', '2024-10-15', '2024-11-15',
   'active', '涵盖所有办公区域', 'admin', 1),

  ('TEST-INV-2024-003', '2024 年年终全量资产盘点', '2024-12-01', '2024-12-31',
   'draft', '年终大盘点', 'admin', 1);

-- 5.2 盘点计划明细
INSERT INTO inventory_plan_details
  (plan_id, department_code, asset_category, location, estimated_count, tenant_id)
SELECT id, 'IT-DEV', '计算机', '总部 5 楼', 4, 1 FROM inventory_plans WHERE plan_no = 'TEST-INV-2024-001';

INSERT INTO inventory_plan_details
  (plan_id, department_code, asset_category, location, estimated_count, tenant_id)
SELECT id, 'OFF-ADMIN', '办公家具', '总部全楼', 50, 1 FROM inventory_plans WHERE plan_no = 'TEST-INV-2024-002';

-- 5.3 盘点记录 (inventory_records)
INSERT INTO inventory_records
  (inventory_no, inventory_date, inventory_type, inventory_person, status,
   self_check_enabled, remark, tenant_id)
VALUES
  ('TEST-INV-R-001', '2024-09-15', '专项盘点', '李四', '已完成', 0,
   '信息技术部 IT 设备专项盘点', 1),

  ('TEST-INV-R-002', '2024-09-20', '抽查盘点', '李四', '进行中', 1,
   '5 楼办公区域抽查', 1),

  ('TEST-INV-R-003', '2024-10-20', '全面盘点', '孙八', '进行中', 1,
   '办公家具全面盘点', 1);

-- 5.4 盘点任务 (inventory_tasks)
INSERT INTO inventory_tasks
  (inventory_id, task_name, assignee, assignee_name, department_code,
   location, estimated_count, actual_count, status, start_time, end_time, created_by, tenant_id)
SELECT id, '5 楼 IT 工位盘点', '李四', '李四', 'IT-DEV',
       '总部 5 楼', 4, 0, '已完成', '2024-09-15 09:00:00', '2024-09-15 17:00:00', 'admin', 1
FROM inventory_records WHERE inventory_no = 'TEST-INV-R-001';

INSERT INTO inventory_tasks
  (inventory_id, task_name, assignee, assignee_name, department_code,
   location, estimated_count, actual_count, status, start_time, end_time, created_by, tenant_id)
SELECT id, '5 楼办公区域抽查', '李四', '李四', 'OFF-EXEC',
       '总部 5 楼', 6, 0, '进行中', '2024-09-20 09:00:00', NULL, 'admin', 1
FROM inventory_records WHERE inventory_no = 'TEST-INV-R-002';

-- 5.5 盘点明细 (inventory_details)
INSERT INTO inventory_details
  (inventory_id, asset_code, expected_location, actual_location,
   expected_status, actual_status, discrepancy_type, discrepancy_desc,
   checked_by, checked_by_name, checked_at, check_method, tenant_id)
SELECT id, 'TEST-IT-001', '总部 5 楼 设计部', '总部 5 楼 设计部',
       '在用', '在用', '正常', NULL,
       '李四', '李四', '2024-09-15 09:30:00', '扫码', 1
FROM inventory_records WHERE inventory_no = 'TEST-INV-R-001';

INSERT INTO inventory_details
  (inventory_id, asset_code, expected_location, actual_location,
   expected_status, actual_status, discrepancy_type, discrepancy_desc,
   checked_by, checked_by_name, checked_at, check_method, tenant_id)
SELECT id, 'TEST-IT-002', '总部 3 楼 IDC 机房', '总部 3 楼 IDC 机房',
       '在用', '在用', '正常', NULL,
       '李四', '李四', '2024-09-15 10:30:00', '扫码', 1
FROM inventory_records WHERE inventory_no = 'TEST-INV-R-001';

INSERT INTO inventory_details
  (inventory_id, asset_code, expected_location, actual_location,
   expected_status, actual_status, discrepancy_type, discrepancy_desc,
   checked_by, checked_by_name, checked_at, check_method, tenant_id)
SELECT id, 'TEST-IT-004', '总部 5 楼 设计部', '总部 5 楼 设计部',
       '在用', '在用', '正常', NULL,
       '李四', '李四', '2024-09-15 11:00:00', '扫码', 1
FROM inventory_records WHERE inventory_no = 'TEST-INV-R-001';

INSERT INTO inventory_details
  (inventory_id, asset_code, expected_location, actual_location,
   expected_status, actual_status, discrepancy_type, discrepancy_desc,
   checked_by, checked_by_name, checked_at, check_method, tenant_id)
SELECT id, 'TEST-OFF-001', '总部 5 楼 501 办公室', '总部 5 楼 501 办公室',
       '在用', '在用', '正常', NULL,
       '李四', '李四', '2024-09-15 14:00:00', '扫码', 1
FROM inventory_records WHERE inventory_no = 'TEST-INV-R-001';

INSERT INTO inventory_details
  (inventory_id, asset_code, expected_location, actual_location,
   expected_status, actual_status, discrepancy_type, discrepancy_desc,
   checked_by, checked_by_name, checked_at, check_method, tenant_id)
SELECT id, 'TEST-OFF-001', '总部 5 楼 501 办公室', '总部 5 楼 501 办公室',
       '在用', '在用', '正常', NULL,
       '李四', '李四', '2024-09-20 10:00:00', '扫码', 1
FROM inventory_records WHERE inventory_no = 'TEST-INV-R-002';

-- ============================================================
-- 6) 资产使用记录 (asset_usage_records)
-- ============================================================
INSERT INTO asset_usage_records
  (asset_code, asset_name, usage_date, usage_value, usage_type,
   cumulative_value, operator, remark, tenant_id)
VALUES
  -- 医疗设备 CT 扫描使用次数
  ('TEST-MED-001', 'GE Revolution CT 扫描仪', '2024-08-01', 18.00, '使用次数', 18.00, '王五', '周一至周五使用', 1),
  ('TEST-MED-001', 'GE Revolution CT 扫描仪', '2024-08-02', 22.00, '使用次数', 40.00, '王五', NULL, 1),
  ('TEST-MED-001', 'GE Revolution CT 扫描仪', '2024-08-03', 15.00, '使用次数', 55.00, '王五', '周末值班', 1),
  ('TEST-MED-001', 'GE Revolution CT 扫描仪', '2024-08-04', 8.00, '使用次数', 63.00, '王五', '周日', 1),
  ('TEST-MED-001', 'GE Revolution CT 扫描仪', '2024-08-05', 25.00, '使用次数', 88.00, '王五', '周一', 1),
  -- 监护仪使用时长
  ('TEST-MED-002', 'Mindray N15 患者监护仪', '2024-08-01', 24.00, '使用时长(小时)', 24.00, '赵六', '全天监护', 1),
  ('TEST-MED-002', 'Mindray N15 患者监护仪', '2024-08-02', 24.00, '使用时长(小时)', 48.00, '赵六', '全天监护', 1),
  ('TEST-MED-002', 'Mindray N15 患者监护仪', '2024-08-03', 22.00, '使用时长(小时)', 70.00, '赵六', '关机 2 小时维护', 1),
  -- 车辆使用里程
  ('TEST-VEH-001', '丰田 考斯特 中巴车', '2024-07-01', 145.00, '使用里程(公里)', 145.00, '周九', '机场接送', 1),
  ('TEST-VEH-001', '丰田 考斯特 中巴车', '2024-07-05', 320.00, '使用里程(公里)', 465.00, '周九', '团建出行', 1),
  ('TEST-VEH-001', '丰田 考斯特 中巴车', '2024-07-10', 220.00, '使用里程(公里)', 685.00, '周九', '客户接待', 1),
  ('TEST-VEH-001', '丰田 考斯特 中巴车', '2024-07-15', 180.00, '使用里程(公里)', 865.00, '周九', '差旅', 1),
  ('TEST-VEH-001', '丰田 考斯特 中巴车', '2024-08-05', 0.00, '保养里程(公里)', 865.00, '周九', '2 万公里保养', 1),
  -- 打印机打印张数
  ('TEST-OFF-002', 'HP LaserJet Pro M404dn 激光打印机', '2024-06-01', 350.00, '打印张数', 350.00, '孙八', '日常办公', 1),
  ('TEST-OFF-002', 'HP LaserJet Pro M404dn 激光打印机', '2024-06-15', 280.00, '打印张数', 630.00, '孙八', NULL, 1);

-- ============================================================
-- 7) 验证
-- ============================================================
SELECT 'assets' AS table_name, COUNT(*) AS cnt FROM assets WHERE asset_code LIKE 'TEST-%'
UNION ALL
SELECT 'acceptance_applications', COUNT(*) FROM acceptance_applications WHERE application_no LIKE 'TEST-%'
UNION ALL
SELECT 'acceptance_application_assets', COUNT(*) FROM acceptance_application_assets WHERE asset_code LIKE 'TEST-%'
UNION ALL
SELECT 'asset_acceptance_records', COUNT(*) FROM asset_acceptance_records WHERE asset_code LIKE 'TEST-%'
UNION ALL
SELECT 'maintenance_requests', COUNT(*) FROM maintenance_requests WHERE asset_code LIKE 'TEST-%'
UNION ALL
SELECT 'asset_transfers', COUNT(*) FROM asset_transfers WHERE asset_code LIKE 'TEST-%'
UNION ALL
SELECT 'inventory_plans', COUNT(*) FROM inventory_plans WHERE plan_no LIKE 'TEST-%'
UNION ALL
SELECT 'inventory_records', COUNT(*) FROM inventory_records WHERE inventory_no LIKE 'TEST-%'
UNION ALL
SELECT 'inventory_tasks', COUNT(*) FROM inventory_tasks WHERE created_by = 'admin'
UNION ALL
SELECT 'inventory_details', COUNT(*) FROM inventory_details WHERE asset_code LIKE 'TEST-%'
UNION ALL
SELECT 'asset_usage_records', COUNT(*) FROM asset_usage_records WHERE asset_code LIKE 'TEST-%';
