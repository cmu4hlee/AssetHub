/**
 * POCT 临床科室日常质控管理 — 预置数据(seed)
 *
 * 预置(builtin)科目与班次使用共享租户 tenant_id = 1, is_builtin = 1,
 * 经 service 的 (tenant_id = ? OR is_builtin = 1) 查询对所有租户可见。
 *
 * 执行: cd backend && node migrations/20260718_poct_seed.js
 */

const db = require('../config/database');
const logger = require('../config/logger');

const BUILTIN_TENANT = 1;

// 预置班次(早 / 中 / 晚)
const SHIFTS = [
  { shift_code: 'MORNING', shift_name: '早班', start_time: '07:00:00', end_time: '15:00:00', offset: 30, color: '#1890ff', sort: 1 },
  { shift_code: 'AFTERNOON', shift_name: '中班', start_time: '15:00:00', end_time: '23:00:00', offset: 30, color: '#52c41a', sort: 2 },
  { shift_code: 'NIGHT', shift_name: '晚班', start_time: '23:00:00', end_time: '07:00:00', offset: 30, color: '#722ed1', sort: 3 },
];

// 预置监测科目(常见 POCT 项目)
// [code, name, category, unit, reference_range, target, tolerance]
const SUBJECTS = [
  ['GLU', '血糖', '血糖类', 'mmol/L', '3.9-6.1', '5.5', '±15%'],
  ['HbA1c', '糖化血红蛋白', '血糖类', '%', '4.0-6.0', '5.0', '±10%'],
  ['pH', '酸碱度', '血气类', '', '7.35-7.45', '7.40', '±5%'],
  ['pO2', '血氧分压', '血气类', 'mmHg', '80-100', '90', '±10%'],
  ['pCO2', '二氧化碳分压', '血气类', 'mmHg', '35-45', '40', '±10%'],
  ['Lac', '乳酸', '血气类', 'mmol/L', '0.5-2.2', '1.5', '±20%'],
  ['HGB', '血红蛋白', '血液学', 'g/L', '115-150', '135', '±10%'],
  ['WBC', '白细胞计数', '血液学', '10^9/L', '4.0-10.0', '7.0', '±15%'],
  ['PLT', '血小板计数', '血液学', '10^9/L', '100-300', '200', '±15%'],
  ['PT', '凝血酶原时间', '凝血类', 's', '11-14', '12.5', '±15%'],
  ['APTT', '活化部分凝血活酶时间', '凝血类', 's', '25-35', '30', '±15%'],
  ['INR', '国际化比值', '凝血类', '', '0.8-1.2', '1.0', '±15%'],
  ['cTnI', '肌钙蛋白I', '心肌标志物', 'ng/mL', '0-0.04', '0.02', '±20%'],
  ['CKMB', '肌酸激酶同工酶', '心肌标志物', 'ng/mL', '0-5', '2.5', '±20%'],
  ['BNP', '脑钠肽', '心肌标志物', 'pg/mL', '0-100', '50', '±20%'],
  ['PRO', '尿蛋白', '尿液类', '', '阴性', '阴性', '±10%'],
  ['UGLU', '尿糖', '尿液类', '', '阴性', '阴性', '±10%'],
  ['CRP', 'C反应蛋白', '炎症标志物', 'mg/L', '0-10', '5', '±20%'],
  ['PCT', '降钙素原', '炎症标志物', 'ng/mL', '0-0.5', '0.25', '±20%'],
  ['K', '血钾', '电解质', 'mmol/L', '3.5-5.5', '4.5', '±10%'],
  ['Na', '血钠', '电解质', 'mmol/L', '135-145', '140', '±10%'],
  ['Ca', '血钙', '电解质', 'mmol/L', '2.1-2.6', '2.35', '±10%'],
  ['CREA', '肌酐', '代谢', 'μmol/L', '44-106', '75', '±15%'],
  ['UREA', '尿素', '代谢', 'mmol/L', '2.9-8.2', '5.5', '±15%'],
];

async function seedShifts(conn) {
  const [existing] = await conn.query(
    'SELECT COUNT(*) AS c FROM poct_shifts WHERE tenant_id = ? AND is_builtin = 1',
    [BUILTIN_TENANT],
  );
  if (existing[0].c > 0) {
    logger.info(`  - 预置班次已存在(${existing[0].c} 条),跳过`);
    return;
  }
  for (const s of SHIFTS) {
    await conn.query(
      `INSERT INTO poct_shifts
        (shift_code, shift_name, start_time, end_time, default_reminder_offset_minutes, color, sort_order, is_builtin, tenant_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'active')`,
      [s.shift_code, s.shift_name, s.start_time, s.end_time, s.offset, s.color, s.sort, BUILTIN_TENANT],
    );
  }
  logger.info(`  - 预置班次已插入 ${SHIFTS.length} 条`);
}

async function seedSubjects(conn) {
  const [existing] = await conn.query(
    'SELECT COUNT(*) AS c FROM poct_subjects WHERE tenant_id = ? AND is_builtin = 1',
    [BUILTIN_TENANT],
  );
  if (existing[0].c > 0) {
    logger.info(`  - 预置科目已存在(${existing[0].c} 条),跳过`);
    return;
  }
  for (const [code, name, category, unit, ref, target, tol] of SUBJECTS) {
    await conn.query(
      `INSERT INTO poct_subjects
        (subject_code, subject_name, category, unit, reference_range, target_value, tolerance, is_builtin, tenant_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'active')`,
      [code, name, category, unit, ref, target, tol, BUILTIN_TENANT],
    );
  }
  logger.info(`  - 预置科目已插入 ${SUBJECTS.length} 条`);
}

async function main() {
  const conn = await db.getConnection();
  try {
    logger.info('[poct-seed] 开始写入预置数据...');
    await seedShifts(conn);
    await seedSubjects(conn);
    logger.info('[poct-seed] 完成');
  } catch (e) {
    logger.error('[poct-seed] 失败:', e);
    throw e;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  main()
    .then(() => { console.log('\n✅ POCT 预置数据写入完成'); process.exit(0); })
    .catch(e => { console.error('\n❌ POCT 预置数据写入失败:', e); process.exit(1); });
}

module.exports = { main };
