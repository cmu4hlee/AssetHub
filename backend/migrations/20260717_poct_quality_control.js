/**
 * POCT 临床科室日常质控管理 - 7 张表初始化
 *
 * 模块:poct-quality-control
 * API 路径:/api/poct-quality-control
 *
 * 7 张表:
 *  1. poct_subjects              监测科目字典
 *  2. poct_department_subjects   科室启用科目配置
 *  3. poct_shifts                班次定义
 *  4. poct_schedules             排班
 *  5. poct_records               质控记录
 *  6. poct_signatures            手写签名
 *  7. poct_reminders             提醒规则
 *
 * 执行: cd backend && node migrations/20260717_poct_quality_control.js
 */

const db = require('../config/database');
const logger = require('../config/logger');

const TABLES = [
  {
    name: 'poct_subjects',
    sql: `
      CREATE TABLE IF NOT EXISTS poct_subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subject_code VARCHAR(50) NOT NULL COMMENT '科目编码(系统预置唯一)',
        subject_name VARCHAR(100) NOT NULL COMMENT '科目名称(血糖/血气/尿常规等)',
        category VARCHAR(50) NULL COMMENT '分类(血糖类/血气类/尿液类/凝血类/心肌标志物等)',
        unit VARCHAR(20) NULL COMMENT '测量单位(mmol/L、mg/dL 等)',
        reference_range VARCHAR(100) NULL COMMENT '参考范围',
        target_value VARCHAR(100) NULL COMMENT '质控靶值',
        tolerance VARCHAR(50) NULL COMMENT '允许偏差(±10% / ±1SD 等)',
        description TEXT NULL COMMENT '备注说明',
        is_builtin TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=系统预置(全局共享) 0=科室自建',
        created_by_dept_id INT NULL COMMENT '科室自建时记录创建科室',
        tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
        status ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT '启用/停用',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_tenant_code (tenant_id, subject_code),
        KEY idx_category (category),
        KEY idx_builtin (is_builtin)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='POCT 监测科目字典'
    `,
  },
  {
    name: 'poct_department_subjects',
    sql: `
      CREATE TABLE IF NOT EXISTS poct_department_subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        department_id INT NOT NULL COMMENT '科室ID',
        subject_id INT NOT NULL COMMENT '科目ID',
        enabled_shifts JSON NULL COMMENT '启用班次代码列表 ["morning","noon","evening"]',
        is_required TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否必做项目',
        sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
        tenant_id INT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_dept_subject (tenant_id, department_id, subject_id),
        KEY idx_dept (department_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='POCT 科室启用科目配置'
    `,
  },
  {
    name: 'poct_shifts',
    sql: `
      CREATE TABLE IF NOT EXISTS poct_shifts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shift_code VARCHAR(20) NOT NULL COMMENT 'morning/noon/evening/night 自定义',
        shift_name VARCHAR(50) NOT NULL COMMENT '早班/中班/晚班 等',
        start_time TIME NOT NULL COMMENT '班次开始时间 06:00:00',
        end_time TIME NOT NULL COMMENT '班次结束时间 14:00:00',
        default_reminder_offset_minutes INT NOT NULL DEFAULT 30 COMMENT '默认班前提醒分钟数',
        color VARCHAR(20) NULL COMMENT 'UI 标识色 #1890ff',
        sort_order INT NOT NULL DEFAULT 0,
        is_builtin TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=系统预置 0=自定义',
        tenant_id INT NOT NULL DEFAULT 1,
        status ENUM('active','inactive') NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_tenant_shift (tenant_id, shift_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='POCT 班次定义(早中晚)'
    `,
  },
  {
    name: 'poct_schedules',
    sql: `
      CREATE TABLE IF NOT EXISTS poct_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        schedule_date DATE NOT NULL COMMENT '排班日期',
        shift_id INT NOT NULL COMMENT '班次ID',
        department_id INT NOT NULL COMMENT '科室ID',
        subject_id INT NOT NULL COMMENT '科目ID',
        operator_id INT NOT NULL COMMENT '操作人 user_id',
        backup_operator_id INT NULL COMMENT '备班人',
        tenant_id INT NOT NULL DEFAULT 1,
        status ENUM('pending','in_progress','completed','missed','skipped') NOT NULL DEFAULT 'pending',
        completed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_schedule (tenant_id, schedule_date, shift_id, department_id, subject_id),
        KEY idx_date_dept (tenant_id, schedule_date, department_id),
        KEY idx_operator (operator_id, schedule_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='POCT 排班表'
    `,
  },
  {
    name: 'poct_records',
    sql: `
      CREATE TABLE IF NOT EXISTS poct_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        record_no VARCHAR(50) NOT NULL COMMENT '质控记录编号 POCT-YYMMDD-XXXX',
        schedule_id INT NULL COMMENT '关联排班ID(可空,允许临时录入)',
        shift_id INT NOT NULL,
        department_id INT NOT NULL,
        subject_id INT NOT NULL,
        operator_id INT NOT NULL COMMENT '操作人',
        record_date DATE NOT NULL,
        record_time DATETIME NOT NULL COMMENT '实际录入时间',
        measured_value VARCHAR(100) NULL COMMENT '实测值',
        target_value VARCHAR(100) NULL COMMENT '质控靶值(冗余,便于历史查询)',
        result ENUM('pass','warn','fail') NOT NULL DEFAULT 'pass' COMMENT '合格/预警/不合格',
        deviation VARCHAR(50) NULL COMMENT '偏差量(自动计算)',
        instrument VARCHAR(100) NULL COMMENT '设备名称/编号',
        reagent_lot VARCHAR(100) NULL COMMENT '试剂批号',
        temperature VARCHAR(20) NULL COMMENT '室温℃',
        humidity VARCHAR(20) NULL COMMENT '湿度%',
        remarks TEXT NULL,
        signature_id INT NULL COMMENT '手写签名ID',
        signed_at DATETIME NULL,
        tenant_id INT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_record_no (tenant_id, record_no),
        KEY idx_date_dept_shift (tenant_id, record_date, department_id, shift_id),
        KEY idx_subject_date (tenant_id, subject_id, record_date),
        KEY idx_operator_date (operator_id, record_date),
        KEY idx_result (result, record_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='POCT 质控记录(早中晚报告)'
    `,
  },
  {
    name: 'poct_signatures',
    sql: `
      CREATE TABLE IF NOT EXISTS poct_signatures (
        id INT AUTO_INCREMENT PRIMARY KEY,
        record_id INT NOT NULL COMMENT '关联 poct_records.id',
        operator_id INT NOT NULL COMMENT '签名人',
        signature_data MEDIUMTEXT NOT NULL COMMENT 'Canvas 手绘签名 base64 PNG',
        sign_ip VARCHAR(50) NULL COMMENT '签名时 IP(留痕)',
        sign_device VARCHAR(50) NULL COMMENT 'pc/mobile',
        signed_at DATETIME NOT NULL,
        tenant_id INT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_record (record_id),
        KEY idx_operator (operator_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='POCT 手写签名(canvas PNG)'
    `,
  },
  {
    name: 'poct_reminders',
    sql: `
      CREATE TABLE IF NOT EXISTS poct_reminders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL COMMENT '规则名称',
        shift_id INT NULL COMMENT '适用班次(NULL=全部)',
        department_id INT NULL COMMENT '适用科室(NULL=全部)',
        offset_minutes INT NOT NULL DEFAULT 30 COMMENT '班前 N 分钟提醒',
        channels JSON NOT NULL COMMENT '通道列表 ["site","feishu","wechat","sms"]',
        recipient_type ENUM('operator','role','user_list') NOT NULL DEFAULT 'operator' COMMENT '接收人类型',
        recipient_ids JSON NULL COMMENT '当 recipient_type=user_list 时的 user_id 列表',
        role_code VARCHAR(50) NULL COMMENT '当 recipient_type=role 时的角色编码',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        tenant_id INT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_tenant_active (tenant_id, is_active),
        KEY idx_dept_shift (department_id, shift_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='POCT 提醒规则'
    `,
  },
];

// 系统预置数据
const BUILTIN_SUBJECTS = [
  { code: 'GLU',    name: '血糖',         category: '血糖类',     unit: 'mmol/L',  range: '3.9-6.1',  target: '5.5',  tolerance: '±10%' },
  { code: 'LACTATE',name: '乳酸',         category: '血气类',     unit: 'mmol/L',  range: '0.5-2.2',  target: '1.2',  tolerance: '±15%' },
  { code: 'PH',     name: '酸碱度',       category: '血气类',     unit: '',        range: '7.35-7.45',target: '7.40', tolerance: '±0.05' },
  { code: 'PCO2',   name: '二氧化碳分压', category: '血气类',     unit: 'mmHg',    range: '35-45',    target: '40',   tolerance: '±5mmHg' },
  { code: 'PO2',    name: '氧分压',       category: '血气类',     unit: 'mmHg',    range: '80-100',   target: '90',   tolerance: '±10mmHg' },
  { code: 'HCT',    name: '红细胞压积',   category: '血液学',     unit: '%',       range: '36-48',    target: '42',   tolerance: '±5%' },
  { code: 'HB',     name: '血红蛋白',     category: '血液学',     unit: 'g/L',     range: '110-160',  target: '135',  tolerance: '±10%' },
  { code: 'INR',    name: '凝血酶原时间国际标准化比值', category: '凝血类', unit: '', range: '0.8-1.2', target: '1.0', tolerance: '±0.2' },
  { code: 'APTT',   name: '活化部分凝血活酶时间', category: '凝血类', unit: 's',     range: '25-35',    target: '30',   tolerance: '±15%' },
  { code: 'CTNI',   name: '肌钙蛋白I',    category: '心肌标志物', unit: 'ng/mL',   range: '<0.04',    target: '0.02', tolerance: '±20%' },
  { code: 'CKMB',   name: '肌酸激酶同工酶', category: '心肌标志物', unit: 'U/L',    range: '<25',      target: '15',   tolerance: '±20%' },
  { code: 'DDIMER', name: 'D-二聚体',     category: '凝血类',     unit: 'mg/L FEU',range: '<0.5',     target: '0.3',  tolerance: '±20%' },
  { code: 'URINE_PH',    name: '尿液酸碱度',       category: '尿液类', unit: '',   range: '5.0-8.0',  target: '6.5', tolerance: '±1.0' },
  { code: 'URINE_GLU',   name: '尿糖',             category: '尿液类', unit: '',   range: '阴性',     target: '阴性', tolerance: '无' },
  { code: 'URINE_PRO',   name: '尿蛋白',           category: '尿液类', unit: '',   range: '阴性',     target: '阴性', tolerance: '无' },
  { code: 'URINE_KET',   name: '尿酮体',           category: '尿液类', unit: '',   range: '阴性',     target: '阴性', tolerance: '无' },
  { code: 'CRP',    name: 'C反应蛋白',    category: '炎症标志物', unit: 'mg/L',    range: '<10',      target: '5',    tolerance: '±20%' },
  { code: 'PCT',    name: '降钙素原',     category: '炎症标志物', unit: 'ng/mL',   range: '<0.05',    target: '0.03', tolerance: '±25%' },
  { code: 'BHB',    name: 'β-羟丁酸',     category: '代谢',       unit: 'mmol/L',  range: '<0.6',     target: '0.3',  tolerance: '±20%' },
  { code: 'NA_K',   name: '电解质(Na/K)', category: '电解质',     unit: 'mmol/L',  range: 'Na 135-145 / K 3.5-5.5', target: 'Na 140 / K 4.0', tolerance: '±3mmol/L' },
];

const BUILTIN_SHIFTS = [
  { code: 'morning', name: '早班', start: '06:00:00', end: '14:00:00', offset: 30, color: '#1890ff', order: 1 },
  { code: 'noon',    name: '中班', start: '14:00:00', end: '22:00:00', offset: 30, color: '#52c41a', order: 2 },
  { code: 'evening', name: '晚班', start: '22:00:00', end: '06:00:00', offset: 30, color: '#722ed1', order: 3 },
];

async function ensureTable(conn, tableName, sql) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  if (rows[0].cnt > 0) return false;
  await conn.query(sql);
  return true;
}

async function seedBuiltinSubjects(conn) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM poct_subjects WHERE is_builtin = 1 AND tenant_id = 1`,
  );
  if (rows[0].cnt > 0) {
    logger.info(`  - 系统预置科目已存在 (${rows[0].cnt} 条),跳过`);
    return 0;
  }
  let count = 0;
  for (const s of BUILTIN_SUBJECTS) {
    await conn.query(
      `INSERT INTO poct_subjects
         (subject_code, subject_name, category, unit, reference_range, target_value, tolerance, is_builtin, tenant_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 'active')`,
      [s.code, s.name, s.category, s.unit, s.range, s.target, s.tolerance],
    );
    count++;
  }
  return count;
}

async function seedBuiltinShifts(conn) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM poct_shifts WHERE is_builtin = 1 AND tenant_id = 1`,
  );
  if (rows[0].cnt > 0) {
    logger.info(`  - 系统预置班次已存在 (${rows[0].cnt} 条),跳过`);
    return 0;
  }
  let count = 0;
  for (const s of BUILTIN_SHIFTS) {
    await conn.query(
      `INSERT INTO poct_shifts
         (shift_code, shift_name, start_time, end_time, default_reminder_offset_minutes, color, sort_order, is_builtin, tenant_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 'active')`,
      [s.code, s.name, s.start, s.end, s.offset, s.color, s.order],
    );
    count++;
  }
  return count;
}

async function main() {
  const conn = await db.getConnection();
  try {
    logger.info('[poct-quality-control] 开始执行迁移...');

    // 1. 建表
    for (const t of TABLES) {
      const created = await ensureTable(conn, t.name, t.sql);
      logger.info(`  - ${t.name}: ${created ? '已创建' : '已存在'}`);
    }

    // 2. 预置数据
    const subjects = await seedBuiltinSubjects(conn);
    logger.info(`  - 预置科目: ${subjects} 条已插入`);
    const shifts = await seedBuiltinShifts(conn);
    logger.info(`  - 预置班次: ${shifts} 条已插入`);

    logger.info('[poct-quality-control] 迁移完成');
  } catch (e) {
    logger.error('[poct-quality-control] 迁移失败:', e);
    throw e;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  main()
    .then(() => { console.log('\n✅ POCT 迁移完成'); process.exit(0); })
    .catch(e => { console.error('\n❌ POCT 迁移失败:', e); process.exit(1); });
}

module.exports = { main, TABLES, BUILTIN_SUBJECTS, BUILTIN_SHIFTS };
