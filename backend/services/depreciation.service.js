/**
 * 折旧方法 - 符合《企业会计准则第4号—固定资产》及《医院会计制度》
 * 中国会计准则规定：
 * 1. 直线法（年限平均法）- 最常用，适用于一般固定资产
 * 2. 双倍余额递减法 - 加速折旧法之一，需在后期转换为直线法
 * 3. 年数总和法 - 加速折旧法，适用于技术进步较快的资产
 * 4. 工作量法 - 按实际工作量计提（需资产有可测定的工作量）
 */
const METHOD = {
  STRAIGHT_LINE: 'straight-line',           // 年限平均法（直线法）
  DOUBLE_DECLINING: 'double-declining',     // 双倍余额递减法
  SUM_OF_YEARS_DIGITS: 'sum-of-years-digits', // 年数总和法
  UNITS_OF_PRODUCTION: 'units-of-production', // 工作量法
  NONE: 'none',                            // 不计提折旧
};

const METHOD_LABELS = {
  [METHOD.STRAIGHT_LINE]: '年限平均法',
  [METHOD.DOUBLE_DECLINING]: '双倍余额递减法',
  [METHOD.SUM_OF_YEARS_DIGITS]: '年数总和法',
  [METHOD.UNITS_OF_PRODUCTION]: '工作量法',
  [METHOD.NONE]: '不计提折旧',
};

// 别名映射（兼容多种输入格式）
const METHOD_ALIASES = {
  // 年限平均法（直线法）别名
  'straight-line': METHOD.STRAIGHT_LINE,
  'straightline': METHOD.STRAIGHT_LINE,
  'linear': METHOD.STRAIGHT_LINE,
  'line': METHOD.STRAIGHT_LINE,
  '年限平均法': METHOD.STRAIGHT_LINE,
  '直线法': METHOD.STRAIGHT_LINE,
  '平均年限法': METHOD.STRAIGHT_LINE,
  // 双倍余额递减法别名
  'double-declining': METHOD.DOUBLE_DECLINING,
  'doubledeclining': METHOD.DOUBLE_DECLINING,
  'ddb': METHOD.DOUBLE_DECLINING,
  '双倍余额递减法': METHOD.DOUBLE_DECLINING,
  '双倍余额': METHOD.DOUBLE_DECLINING,
  // 年数总和法别名
  'sum-of-years-digits': METHOD.SUM_OF_YEARS_DIGITS,
  'sum-of-years': METHOD.SUM_OF_YEARS_DIGITS,
  'sumofyearsdigits': METHOD.SUM_OF_YEARS_DIGITS,
  'sumofyears': METHOD.SUM_OF_YEARS_DIGITS,
  'syd': METHOD.SUM_OF_YEARS_DIGITS,
  '年数总和法': METHOD.SUM_OF_YEARS_DIGITS,
  '年数法': METHOD.SUM_OF_YEARS_DIGITS,
  // 工作量法别名
  'units-of-production': METHOD.UNITS_OF_PRODUCTION,
  'units_of_production': METHOD.UNITS_OF_PRODUCTION,
  'units': METHOD.UNITS_OF_PRODUCTION,
  '工作量法': METHOD.UNITS_OF_PRODUCTION,
  // 不计提折旧
  'none': METHOD.NONE,
  '不计提折旧': METHOD.NONE,
  '不提折旧': METHOD.NONE,
};

// 折旧方法详情（符合中国会计准则）
const METHOD_DETAILS = {
  [METHOD.STRAIGHT_LINE]: {
    name: '年限平均法',
    description: '在预计使用年限内按固定金额平均分摊折旧额。',
    formula: '年折旧额 = (原值 - 残值) / 预计使用年限',
    formulaDesc: '月折旧额 = 年折旧额 / 12',
    applicable: '适用于使用情况较为均衡的固定资产，如房屋建筑物、通用设备等。',
    bestFor: '使用情况较为均衡的固定资产，如房屋建筑物、通用设备等。',
    accountingStandard: '《企业会计准则第4号—固定资产》',
  },
  [METHOD.DOUBLE_DECLINING]: {
    name: '双倍余额递减法',
    description: '前期计提更多折旧，后期逐步减少，最后两年改为直线法。',
    formula: '年折旧率 = 2 / 预计使用年限 × 100%；年折旧额 = 年初账面净值 × 年折旧率',
    formulaDesc: '最后两年将账面净值扣除残值后平均分摊',
    applicable: '适用于早期损耗快、技术更新频繁的固定资产，如电子设备、运输设备等。',
    bestFor: '早期损耗快、技术更新频繁的固定资产，如电子设备、运输设备等。',
    accountingStandard: '《企业会计准则第4号—固定资产》第十九条',
  },
  [METHOD.SUM_OF_YEARS_DIGITS]: {
    name: '年数总和法',
    description: '按剩余年限占年数总和的比例进行加速折旧。',
    formula: '年折旧额 = (原值 - 残值) × 剩余年限 / 年数总和',
    formulaDesc: '年数总和 = n(n+1)/2，其中n为预计使用年限',
    applicable: '适用于使用强度前期高后期低的固定资产。',
    bestFor: '使用强度前期高后期低的固定资产。',
    accountingStandard: '《企业会计准则第4号—固定资产》',
  },
  [METHOD.UNITS_OF_PRODUCTION]: {
    name: '工作量法',
    description: '按实际工作量计提折旧。',
    formula: '单位工作量折旧额 = (原值 - 残值) / 预计总工作量',
    formulaDesc: '月折旧额 = 单位工作量折旧额 × 当月工作量',
    applicable: '适用于有明确工作量统计的固定资产，如运输设备、生产设备等。',
    bestFor: '有明确工作量统计的固定资产，如运输设备、生产设备等。',
    accountingStandard: '《企业会计准则第4号—固定资产》',
  },
  [METHOD.NONE]: {
    name: '不计提折旧',
    description: '资产不参与折旧计提。',
    formula: '不适用',
    formulaDesc: '已提足折旧仍继续使用的固定资产和单独计价的土地不计提折旧。',
    applicable: '适用于已提足折旧的资产、土地或按规定不计提折旧的资产。',
    bestFor: '已提足折旧的资产、土地或按规定不计提折旧的资产。',
    accountingStandard: '《企业会计准则第4号—固定资产》第三条',
  },
};

const DEFAULT_USEFUL_LIFE_YEARS = 5;
const DEFAULT_RESIDUAL_RATE = 0.05;

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function round4(value) {
  return Math.round((Number(value) || 0) * 10000) / 10000;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPositiveInt(value, fallback = 0) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeResidualRate(value, fallback = DEFAULT_RESIDUAL_RATE) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = toNumber(value, fallback);
  if (parsed <= 0) {
    return 0;
  }

  if (parsed > 1) {
    return parsed / 100;
  }

  return parsed;
}

function normalizeMethod(value, fallback = METHOD.STRAIGHT_LINE) {
  if (!value) {
    return fallback;
  }

  const key = String(value).trim().toLowerCase();
  return METHOD_ALIASES[key] || METHOD_ALIASES[String(value).trim()] || fallback;
}

function normalizeAsOfDate(value, fallback = new Date()) {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date;
}

function formatDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthLabel(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function fullMonthsBetween(startDate, endDate) {
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) {
    return 0;
  }
  if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  if (endDate < startDate) {
    return 0;
  }

  let months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());

  if (endDate.getDate() < startDate.getDate()) {
    months -= 1;
  }

  return Math.max(months, 0);
}

function parseUsefulLifeYears(asset) {
  const directYears = toPositiveInt(asset.depreciation_years, 0);
  if (directYears > 0) {
    return directYears;
  }
  const altYears = toPositiveInt(asset.useful_life_years, 0);
  if (altYears > 0) {
    return altYears;
  }
  return DEFAULT_USEFUL_LIFE_YEARS;
}

function parseResidualValue(purchasePrice, asset, residualRate) {
  const directResidual = toNumber(asset.residual_value, NaN);
  if (Number.isFinite(directResidual) && directResidual >= 0) {
    return Math.min(directResidual, purchasePrice);
  }

  const assetResidualRate = normalizeResidualRate(asset.residual_rate, residualRate);
  return round2(purchasePrice * assetResidualRate);
}

function calculateStraightLine(depreciableAmount, totalMonths, monthsUsed) {
  if (depreciableAmount <= 0 || totalMonths <= 0 || monthsUsed <= 0) {
    return { accumulatedDepreciation: 0, monthlyDepreciation: 0 };
  }

  const monthlyDepreciation = depreciableAmount / totalMonths;
  const accumulatedDepreciation = Math.min(monthlyDepreciation * monthsUsed, depreciableAmount);

  return {
    accumulatedDepreciation,
    monthlyDepreciation,
  };
}

/**
 * 双倍余额递减法计算
 * 符合《企业会计准则第4号—固定资产》:
 * - 年折旧率 = 2 / 预计使用年限
 * - 年折旧额 = 年初账面净值 × 年折旧率
 * - 最后两年改为直线法，将账面净值扣除残值后平均分摊
 */
function calculateDoubleDeclining(purchasePrice, residualValue, usefulLifeYears, monthsUsed) {
  if (purchasePrice <= residualValue || usefulLifeYears <= 0 || monthsUsed <= 0) {
    return { accumulatedDepreciation: 0, monthlyDepreciation: 0 };
  }

  const annualRate = 2 / usefulLifeYears;
  let currentBookValue = purchasePrice;
  let accumulatedDepreciation = 0;
  let monthlyDepreciation = 0;

  // 计算已足额折旧的年份数
  const fullYearsUsed = Math.floor(monthsUsed / 12);
  const remainingMonths = monthsUsed % 12;

  // 最后两年的判断点：当剩余使用年限为2年时，切换为直线法
  for (let year = 1; year <= fullYearsUsed + 1; year++) {
    const remainingYears = usefulLifeYears - year + 1;
    let yearDepreciation = 0;

    if (remainingYears <= 2) {
      // 最后两年，切换为直线法
      // 将账面净值扣除残值后，在剩余年限内平均分摊
      const depreciableAmount = currentBookValue - residualValue;
      yearDepreciation = depreciableAmount / remainingYears;
    } else {
      // 使用双倍余额递减法
      yearDepreciation = currentBookValue * annualRate;
      // 确保不超过可折旧金额
      yearDepreciation = Math.min(yearDepreciation, currentBookValue - residualValue);
    }

    // 处理最后一年的残余月份
    if (year === fullYearsUsed + 1 && remainingMonths > 0) {
      // 这是最后一年，需要按月份计算
      const monthsInFinalYear = remainingMonths;
      yearDepreciation = (yearDepreciation / 12) * monthsInFinalYear;
    }

    // 如果已经达到折旧年限，停止计算
    if (currentBookValue - residualValue <= 0.01) {
      break;
    }

    accumulatedDepreciation += yearDepreciation;
    currentBookValue = Math.max(currentBookValue - yearDepreciation, residualValue);
    monthlyDepreciation = yearDepreciation / 12;
  }

  // 确保不超过可折旧总额
  const depreciableAmount = purchasePrice - residualValue;
  accumulatedDepreciation = Math.min(accumulatedDepreciation, depreciableAmount);

  return {
    accumulatedDepreciation: round2(accumulatedDepreciation),
    monthlyDepreciation: round2(monthlyDepreciation),
  };
}

function calculateSumOfYearsDigits(depreciableAmount, usefulLifeYears, monthsUsed) {
  if (depreciableAmount <= 0 || usefulLifeYears <= 0 || monthsUsed <= 0) {
    return { accumulatedDepreciation: 0, monthlyDepreciation: 0 };
  }

  const denominator = (usefulLifeYears * (usefulLifeYears + 1)) / 2;
  let accumulatedDepreciation = 0;
  let monthlyDepreciation = 0;

  for (let yearIndex = 0; yearIndex < usefulLifeYears; yearIndex += 1) {
    const yearStartMonth = yearIndex * 12;
    const usedInThisYear = Math.min(12, Math.max(monthsUsed - yearStartMonth, 0));
    if (usedInThisYear <= 0) {
      break;
    }

    const remainingYears = usefulLifeYears - yearIndex;
    const annualDepreciation = depreciableAmount * (remainingYears / denominator);
    const plannedMonthly = annualDepreciation / 12;

    accumulatedDepreciation += plannedMonthly * usedInThisYear;
    monthlyDepreciation = plannedMonthly;
  }

  return {
    accumulatedDepreciation: Math.min(accumulatedDepreciation, depreciableAmount),
    monthlyDepreciation,
  };
}

function calculateDepreciation(asset, options = {}) {
  const purchasePrice = Math.max(toNumber(asset.purchase_price, 0), 0);
  const method = normalizeMethod(options.method || asset.depreciation_method);
  const asOfDate = normalizeAsOfDate(options.asOfDate);
  const purchaseDate = normalizeAsOfDate(asset.purchase_date, null);
  const usefulLifeYears = parseUsefulLifeYears(asset);
  const totalMonths = usefulLifeYears * 12;
  const residualRate = normalizeResidualRate(options.residualRate, DEFAULT_RESIDUAL_RATE);
  const residualValue = parseResidualValue(purchasePrice, asset, residualRate);
  const depreciableAmount = Math.max(purchasePrice - residualValue, 0);

  let monthsUsed = fullMonthsBetween(purchaseDate, asOfDate);
  monthsUsed = Math.min(monthsUsed, totalMonths);

  if (!purchaseDate || purchasePrice <= 0 || totalMonths <= 0 || method === METHOD.NONE) {
    const currentBookValue = round2(purchasePrice);
    return {
      method,
      methodLabel: METHOD_LABELS[method] || METHOD_LABELS[METHOD.STRAIGHT_LINE],
      purchasePrice: round2(purchasePrice),
      residualRate: round4(residualRate),
      residualValue: round2(residualValue),
      depreciableAmount: round2(depreciableAmount),
      usefulLifeYears,
      totalMonths,
      monthsUsed: 0,
      remainingMonths: totalMonths,
      monthlyDepreciation: 0,
      accumulatedDepreciation: 0,
      currentBookValue,
      depreciationRate: 0,
      asOfDate: formatDate(asOfDate),
      isFullyDepreciated: false,
    };
  }

  let raw;
  switch (method) {
    case METHOD.DOUBLE_DECLINING:
      raw = calculateDoubleDeclining(purchasePrice, residualValue, usefulLifeYears, monthsUsed);
      break;
    case METHOD.SUM_OF_YEARS_DIGITS:
      raw = calculateSumOfYearsDigits(depreciableAmount, usefulLifeYears, monthsUsed);
      break;
    case METHOD.STRAIGHT_LINE:
    default:
      raw = calculateStraightLine(depreciableAmount, totalMonths, monthsUsed);
      break;
  }

  const accumulatedDepreciation = Math.min(raw.accumulatedDepreciation, depreciableAmount);
  const currentBookValue = Math.max(purchasePrice - accumulatedDepreciation, residualValue);
  const remainingMonths = Math.max(totalMonths - monthsUsed, 0);
  const depreciationRate = purchasePrice > 0 ? (accumulatedDepreciation / purchasePrice) * 100 : 0;

  return {
    method,
    methodLabel: METHOD_LABELS[method] || METHOD_LABELS[METHOD.STRAIGHT_LINE],
    purchasePrice: round2(purchasePrice),
    residualRate: round4(residualRate),
    residualValue: round2(residualValue),
    depreciableAmount: round2(depreciableAmount),
    usefulLifeYears,
    totalMonths,
    monthsUsed,
    remainingMonths,
    monthlyDepreciation: round2(raw.monthlyDepreciation),
    accumulatedDepreciation: round2(accumulatedDepreciation),
    currentBookValue: round2(currentBookValue),
    depreciationRate: round2(depreciationRate),
    asOfDate: formatDate(asOfDate),
    isFullyDepreciated: remainingMonths === 0 || currentBookValue <= residualValue + 0.01,
  };
}

function calculateBatchDepreciation(assets, options = {}) {
  if (!Array.isArray(assets)) {
    return [];
  }

  return assets.map(asset => ({
    ...asset,
    depreciation: calculateDepreciation(asset, options),
  }));
}

function summarizeDepreciation(assetsWithDepreciation) {
  const list = Array.isArray(assetsWithDepreciation) ? assetsWithDepreciation : [];

  const totalAssets = list.length;
  const totalPurchasePrice = list.reduce((sum, item) => {
    return sum + toNumber(item.depreciation?.purchasePrice ?? item.purchase_price, 0);
  }, 0);

  const totalAccumulatedDepreciation = list.reduce((sum, item) => {
    return sum + toNumber(item.depreciation?.accumulatedDepreciation, 0);
  }, 0);

  const totalBookValue = list.reduce((sum, item) => {
    return sum + toNumber(item.depreciation?.currentBookValue, 0);
  }, 0);

  const averageDepreciationRate =
    totalPurchasePrice > 0 ? (totalAccumulatedDepreciation / totalPurchasePrice) * 100 : 0;

  return {
    totalAssets,
    totalPurchasePrice: round2(totalPurchasePrice),
    totalAccumulatedDepreciation: round2(totalAccumulatedDepreciation),
    totalBookValue: round2(totalBookValue),
    averageDepreciationRate: round2(averageDepreciationRate),
  };
}

function summarizeByGroup(assetsWithDepreciation, getGroupKey, keyName) {
  const groups = new Map();

  for (const asset of assetsWithDepreciation || []) {
    const rawKey = getGroupKey(asset);
    const key = rawKey == null || rawKey === '' ? '未分类' : String(rawKey);

    if (!groups.has(key)) {
      groups.set(key, {
        [keyName]: key,
        assetCount: 0,
        totalPurchasePrice: 0,
        totalAccumulatedDepreciation: 0,
        totalBookValue: 0,
        depreciationRate: 0,
      });
    }

    const target = groups.get(key);
    target.assetCount += 1;
    target.totalPurchasePrice += toNumber(asset.depreciation?.purchasePrice ?? asset.purchase_price, 0);
    target.totalAccumulatedDepreciation += toNumber(asset.depreciation?.accumulatedDepreciation, 0);
    target.totalBookValue += toNumber(asset.depreciation?.currentBookValue, 0);
  }

  const result = Array.from(groups.values()).map(item => {
    const depreciationRate =
      item.totalPurchasePrice > 0
        ? (item.totalAccumulatedDepreciation / item.totalPurchasePrice) * 100
        : 0;
    return {
      ...item,
      totalPurchasePrice: round2(item.totalPurchasePrice),
      totalAccumulatedDepreciation: round2(item.totalAccumulatedDepreciation),
      totalBookValue: round2(item.totalBookValue),
      depreciationRate: round2(depreciationRate),
    };
  });

  result.sort((a, b) => b.totalBookValue - a.totalBookValue);
  return result;
}

function getMonthEnd(date) {
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);
  return monthEnd;
}

function buildMonthlyTrend(assets, options = {}) {
  const months = Math.min(Math.max(toPositiveInt(options.months, 12), 1), 36);
  const asOfDate = normalizeAsOfDate(options.asOfDate);
  const trend = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const cursor = new Date(asOfDate.getFullYear(), asOfDate.getMonth() - i, 1);
    const monthEnd = getMonthEnd(cursor);

    const list = calculateBatchDepreciation(assets, {
      method: options.method,
      asOfDate: monthEnd,
      residualRate: options.residualRate,
    });

    const summary = summarizeDepreciation(list);
    trend.push({
      month: monthLabel(monthEnd),
      asOfDate: formatDate(monthEnd),
      totalAccumulatedDepreciation: summary.totalAccumulatedDepreciation,
      totalBookValue: summary.totalBookValue,
      totalPurchasePrice: summary.totalPurchasePrice,
      averageDepreciationRate: summary.averageDepreciationRate,
    });
  }

  return trend;
}

function toCsv(rows, columns) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeColumns = Array.isArray(columns) ? columns : [];

  const escape = value => {
    if (value == null) {
      return '';
    }
    const text = String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const headers = safeColumns.map(col => escape(col.label)).join(',');
  const dataLines = safeRows.map(row => {
    return safeColumns.map(col => escape(row[col.key])).join(',');
  });

  return [headers, ...dataLines].join('\n');
}

function buildExportRows(assetsWithDepreciation) {
  return (assetsWithDepreciation || []).map(item => ({
    assetCode: item.asset_code || '',
    assetName: item.asset_name || '',
    assetType: item.asset_type || '',
    department: item.department_display || item.department || item.department_new || '',
    purchaseDate: item.purchase_date ? formatDate(new Date(item.purchase_date)) : '',
    purchasePrice: round2(item.depreciation?.purchasePrice || 0),
    residualValue: round2(item.depreciation?.residualValue || 0),
    accumulatedDepreciation: round2(item.depreciation?.accumulatedDepreciation || 0),
    currentBookValue: round2(item.depreciation?.currentBookValue || 0),
    depreciationRate: `${round2(item.depreciation?.depreciationRate || 0)}%`,
    monthsUsed: item.depreciation?.monthsUsed || 0,
    remainingMonths: item.depreciation?.remainingMonths || 0,
    methodLabel: item.depreciation?.methodLabel || '',
  }));
}

module.exports = {
  METHOD,
  METHOD_LABELS,
  METHOD_DETAILS,
  normalizeMethod,
  normalizeAsOfDate,
  calculateDepreciation,
  calculateBatchDepreciation,
  summarizeDepreciation,
  summarizeByGroup,
  buildMonthlyTrend,
  toCsv,
  buildExportRows,
  formatDate,
};
