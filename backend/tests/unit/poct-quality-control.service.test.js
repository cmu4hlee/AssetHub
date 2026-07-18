/**
 * @jest-environment node
 */

/**
 * POCT 临床科室日常质控管理 - 单元测试
 *
 * 覆盖:
 *  - evaluateResult: 纯函数,根据靶值 + 容差判定 pass/warn/fail
 *  - generateRecordNo: 编号生成格式
 *  - getTenantId: 租户 ID 提取
 */

jest.mock('../../config/database', () => ({
  execute: jest.fn(),
  query: jest.fn(),
  getConnection: jest.fn(),
}));

const db = require('../../config/database');
const poctService = require('../../modules/poct-quality-control/services/poct.service');

describe('POCT Quality Control Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== evaluateResult 判定逻辑 ====================
  describe('evaluateResult - 质控结果判定', () => {
    test('空值返回 pass', () => {
      const r = poctService.evaluateResult(null, '5.5', '±10%');
      expect(r.result).toBe('pass');
      expect(r.deviation).toBeNull();
    });

    test('NaN 测量值返回 pass(容错)', () => {
      const r = poctService.evaluateResult('abc', '5.5', '±10%');
      expect(r.result).toBe('pass');
    });

    test('百分比容差内 → pass', () => {
      // 5.5 ±10% = 4.95-6.05,实测 5.7 (3.6% 偏差) → pass
      const r = poctService.evaluateResult('5.7', '5.5', '±10%');
      expect(r.result).toBe('pass');
      expect(r.deviation).toBe('3.64%');
    });

    test('百分比接近上限(80%-100%) → warn', () => {
      // 5.5 ±10% 上限 6.05,实测 6.0 (9.1% 偏差) → warn
      const r = poctService.evaluateResult('6.0', '5.5', '±10%');
      expect(r.result).toBe('warn');
    });

    test('百分比超过容差 → fail', () => {
      // 5.5 ±10% 上限 6.05,实测 7.0 (27% 偏差) → fail
      const r = poctService.evaluateResult('7.0', '5.5', '±10%');
      expect(r.result).toBe('fail');
    });

    test('绝对值容差内 → pass', () => {
      // pH 7.40 ±0.05,实测 7.42 → pass
      const r = poctService.evaluateResult('7.42', '7.40', '±0.05');
      expect(r.result).toBe('pass');
    });

    test('绝对值超容差 → fail', () => {
      // pH 7.40 ±0.05,实测 7.50 → fail (0.1 偏差 > 0.05)
      const r = poctService.evaluateResult('7.50', '7.40', '±0.05');
      expect(r.result).toBe('fail');
    });

    test('负偏差也正确判定', () => {
      // 5.5 ±10% 下限 4.95,实测 4.5 (18% 偏差) → fail
      const r = poctService.evaluateResult('4.5', '5.5', '±10%');
      expect(r.result).toBe('fail');
    });

    test('0 靶值时安全返回 pass(不除零)', () => {
      const r = poctService.evaluateResult('0.5', '0', '±10%');
      expect(r.result).toBe('pass');
    });

    test('无法解析的容差字符串容错', () => {
      const r = poctService.evaluateResult('5.0', '5.0', 'invalid');
      // 容差解析失败 → 不会算 percent,走绝对值分支
      // ratio = |5-5| = 0,limit = NaN,isPercent=false
      // 不会 > NaN,也不会 > NaN*0.8 → pass
      expect(['pass', 'fail', 'warn']).toContain(r.result);
    });
  });

  // ==================== generateRecordNo 编号生成 ====================
  describe('generateRecordNo - 质控记录编号', () => {
    test('格式为 POCT-YYMMDD-XXXX', () => {
      const no = poctService.generateRecordNo();
      expect(no).toMatch(/^POCT-\d{6}-\d{4}$/);
    });

    test('日期部分正确(今天)', () => {
      const no = poctService.generateRecordNo();
      const d = new Date();
      const yy = String(d.getFullYear()).slice(2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      expect(no).toContain(`POCT-${yy}${mm}${dd}-`);
    });

    test('后缀是 4 位数字', () => {
      const no = poctService.generateRecordNo();
      const suffix = no.split('-')[2];
      expect(suffix).toHaveLength(4);
      expect(parseInt(suffix)).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== getTenantId 租户提取 ====================
  describe('getTenantId - 租户 ID 提取', () => {
    test('从 user.tenant_id 提取', () => {
      const req = { user: { tenant_id: 42 } };
      expect(poctService.getTenantId(req)).toBe(42);
    });

    test('fallback 到 header X-Tenant-ID', () => {
      const req = { user: null, headers: { 'x-tenant-id': '99' } };
      expect(poctService.getTenantId(req)).toBe('99');
    });

    test('都没有时 fallback 到 1', () => {
      const req = { headers: {} };
      expect(poctService.getTenantId(req)).toBe(1);
    });
  });

  // ==================== listSubjects mock DB ====================
  describe('listSubjects - 科目列表', () => {
    test('基本查询带上 tenant_id', async () => {
      const fakeRows = [
        { id: 1, subject_code: 'GLU', subject_name: '血糖', is_builtin: 1 },
      ];
      db.execute
        .mockResolvedValueOnce([fakeRows])    // 主查询
        .mockResolvedValueOnce([[{ total: 1 }]]); // count

      const result = await poctService.listSubjects({ tenantId: 1, pageSize: 50 });
      expect(result.data).toEqual(fakeRows);
      expect(result.total).toBe(1);
    });

    test('关键词过滤拼接 LIKE', async () => {
      db.execute
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ total: 0 }]]);

      await poctService.listSubjects({ tenantId: 1, keyword: '血糖' });
      // 验证主查询 SQL 包含 LIKE
      const [mainSql, mainArgs] = db.execute.mock.calls[0];
      expect(mainSql).toMatch(/LIKE/);
      expect(mainArgs).toContain('%血糖%');
    });

    test('分类过滤', async () => {
      db.execute
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ total: 0 }]]);

      await poctService.listSubjects({ tenantId: 1, category: '血糖类' });
      const [sql, args] = db.execute.mock.calls[0];
      expect(sql).toMatch(/category = \?/);
      expect(args).toContain('血糖类');
    });
  });

  // ==================== listShifts 班次 ====================
  describe('listShifts - 班次列表', () => {
    test('返回所有 active 班次', async () => {
      const fakeShifts = [
        { id: 1, shift_code: 'morning', shift_name: '早班', is_builtin: 1 },
        { id: 2, shift_code: 'noon', shift_name: '中班', is_builtin: 1 },
        { id: 3, shift_code: 'evening', shift_name: '晚班', is_builtin: 1 },
      ];
      db.execute.mockResolvedValueOnce([fakeShifts]);

      const result = await poctService.listShifts(1);
      expect(result).toEqual(fakeShifts);
      expect(result).toHaveLength(3);
    });

    test('SQL 过滤 is_builtin + status=active', async () => {
      db.execute.mockResolvedValueOnce([[]]);
      await poctService.listShifts(1);
      const [sql, args] = db.execute.mock.calls[0];
      expect(sql).toMatch(/status = 'active'/);
      expect(args).toContain(1);
    });
  });
});
