#!/usr/bin/env node

/**
 * Full data redundancy audit (read-only).
 *
 * What it checks:
 * 1) Schema redundancy: duplicate indexes, prefix-overlapped indexes, tables without PK.
 * 2) Business data duplication: key-level duplicate records on core tables.
 * 3) Identifier duplication scan: *_code / *_no / serial-like fields across tables.
 * 4) "_active" table overlap: duplicated storage between base and active tables.
 * 5) Asset deep dive: normalized asset_code and likely duplicated assets.
 *
 * Output:
 * - analysis/data-redundancy-audit-<timestamp>.json
 * - analysis/data-redundancy-audit-<timestamp>.md
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const STRING_TYPES = new Set([
  'char',
  'varchar',
  'text',
  'tinytext',
  'mediumtext',
  'longtext',
  'enum',
  'set',
]);

const IDENTIFIER_COLUMN_RE =
  /(^|_)(code|no|number|sn|serial|identifier|username|email|phone|mobile|device_id)$/i;

function quoteId(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}

function makeStamp(date = new Date()) {
  const pad = num => String(num).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

function isStringType(type) {
  return STRING_TYPES.has(String(type || '').toLowerCase());
}

function normalizeExpr(columnName, dataType) {
  const c = quoteId(columnName);
  if (isStringType(dataType)) {
    return `UPPER(TRIM(${c}))`;
  }
  return `${c}`;
}

function nonEmptyCondition(columnName, dataType) {
  const c = quoteId(columnName);
  if (isStringType(dataType)) {
    return `${c} IS NOT NULL AND TRIM(${c}) <> ''`;
  }
  return `${c} IS NOT NULL`;
}

function startsWithColumns(shortCols, longCols) {
  if (shortCols.length >= longCols.length) {
    return false;
  }
  for (let i = 0; i < shortCols.length; i += 1) {
    if (shortCols[i] !== longCols[i]) {
      return false;
    }
  }
  return true;
}

function hasColumns(columnMapByTable, table, columns) {
  const tableColumns = columnMapByTable[table];
  if (!tableColumns) {
    return false;
  }
  return columns.every(col => Object.prototype.hasOwnProperty.call(tableColumns, col));
}

async function loadSchemaMetadata(conn) {
  const [columns] = await conn.query(
    `
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
      ORDER BY table_name, ordinal_position
    `,
  );

  const columnMapByTable = {};
  for (const row of columns) {
    if (!columnMapByTable[row.table_name]) {
      columnMapByTable[row.table_name] = {};
    }
    columnMapByTable[row.table_name][row.column_name] = row.data_type;
  }

  const [tableRowsRaw] = await conn.query(
    `
      SELECT table_name, table_rows
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
    `,
  );

  const tableRows = {};
  for (const row of tableRowsRaw) {
    tableRows[row.table_name] = Number(row.table_rows || 0);
  }

  return { columnMapByTable, tableRows };
}

async function runCompositeDuplicateCheck(conn, columnMapByTable, config) {
  const { name, table, columns } = config;
  if (!hasColumns(columnMapByTable, table, columns)) {
    return {
      name,
      table,
      columns,
      skipped: true,
      reason: 'table_or_columns_missing',
    };
  }

  const typeMap = columnMapByTable[table];
  const exprs = columns.map(col => normalizeExpr(col, typeMap[col]));
  const whereParts = columns.map(col => nonEmptyCondition(col, typeMap[col]));
  const whereClause = whereParts.join(' AND ');
  const groupByClause = exprs.join(', ');

  const [summaryRows] = await conn.query(
    `
      SELECT
        COUNT(*) AS duplicate_groups,
        COALESCE(SUM(cnt) - COUNT(*), 0) AS duplicate_rows,
        COALESCE(MAX(cnt), 0) AS max_group_size
      FROM (
        SELECT ${groupByClause}, COUNT(*) AS cnt
        FROM ${quoteId(table)}
        WHERE ${whereClause}
        GROUP BY ${groupByClause}
        HAVING COUNT(*) > 1
      ) d
    `,
  );

  const summary = summaryRows[0] || {
    duplicate_groups: 0,
    duplicate_rows: 0,
    max_group_size: 0,
  };

  const result = {
    name,
    table,
    columns,
    duplicate_groups: Number(summary.duplicate_groups || 0),
    duplicate_rows: Number(summary.duplicate_rows || 0),
    max_group_size: Number(summary.max_group_size || 0),
    samples: [],
  };

  if (result.duplicate_groups > 0) {
    const selectAliased = exprs.map((expr, index) => `${expr} AS k${index}`).join(', ');
    const [sampleRows] = await conn.query(
      `
        SELECT ${selectAliased}, COUNT(*) AS cnt
        FROM ${quoteId(table)}
        WHERE ${whereClause}
        GROUP BY ${groupByClause}
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC
        LIMIT 5
      `,
    );

    result.samples = sampleRows.map(row => {
      const values = {};
      columns.forEach((column, index) => {
        values[column] = row[`k${index}`];
      });
      return {
        values,
        count: Number(row.cnt || 0),
      };
    });
  }

  return result;
}

async function auditSchemaRedundancy(conn) {
  const [indexRows] = await conn.query(
    `
      SELECT
        table_name,
        index_name,
        non_unique,
        seq_in_index,
        column_name
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
      ORDER BY table_name, index_name, seq_in_index
    `,
  );

  const byTable = {};
  for (const row of indexRows) {
    if (!byTable[row.table_name]) {
      byTable[row.table_name] = {};
    }
    if (!byTable[row.table_name][row.index_name]) {
      byTable[row.table_name][row.index_name] = {
        table: row.table_name,
        index: row.index_name,
        nonUnique: Number(row.non_unique),
        columns: [],
      };
    }
    byTable[row.table_name][row.index_name].columns.push(row.column_name);
  }

  const duplicateIndexes = [];
  const prefixOverlaps = [];
  const indexCountByTable = [];

  for (const [table, indexesObj] of Object.entries(byTable)) {
    const indexes = Object.values(indexesObj).sort((a, b) => a.index.localeCompare(b.index));
    indexCountByTable.push({ table, index_count: indexes.length });

    for (let i = 0; i < indexes.length; i += 1) {
      for (let j = i + 1; j < indexes.length; j += 1) {
        const a = indexes[i];
        const b = indexes[j];

        if (
          a.nonUnique === b.nonUnique &&
          a.columns.length === b.columns.length &&
          a.columns.every((col, idx) => col === b.columns[idx])
        ) {
          duplicateIndexes.push({
            table,
            index_a: a.index,
            index_b: b.index,
            non_unique: a.nonUnique,
            columns: a.columns,
          });
        }

        if (a.index === 'PRIMARY' || b.index === 'PRIMARY') {
          continue;
        }
        if (a.nonUnique !== 1 || b.nonUnique !== 1) {
          continue;
        }

        if (startsWithColumns(a.columns, b.columns)) {
          prefixOverlaps.push({
            table,
            redundant_index: a.index,
            covering_index: b.index,
            redundant_columns: a.columns,
            covering_columns: b.columns,
          });
        } else if (startsWithColumns(b.columns, a.columns)) {
          prefixOverlaps.push({
            table,
            redundant_index: b.index,
            covering_index: a.index,
            redundant_columns: b.columns,
            covering_columns: a.columns,
          });
        }
      }
    }
  }

  const [missingPkRows] = await conn.query(
    `
      SELECT t.table_name
      FROM information_schema.tables t
      LEFT JOIN information_schema.table_constraints c
        ON c.table_schema = t.table_schema
       AND c.table_name = t.table_name
       AND c.constraint_type = 'PRIMARY KEY'
      WHERE t.table_schema = DATABASE()
        AND t.table_type = 'BASE TABLE'
        AND c.constraint_name IS NULL
      ORDER BY t.table_name
    `,
  );

  const heavyIndexTables = indexCountByTable
    .filter(row => row.index_count >= 8)
    .sort((a, b) => b.index_count - a.index_count)
    .slice(0, 20);

  return {
    duplicate_indexes_count: duplicateIndexes.length,
    duplicate_indexes_top: duplicateIndexes.slice(0, 20),
    prefix_overlaps_count: prefixOverlaps.length,
    prefix_overlaps_top: prefixOverlaps.slice(0, 20),
    heavy_index_tables: heavyIndexTables,
    tables_without_primary_key: missingPkRows.map(row => row.table_name),
  };
}

async function auditCoreBusinessDuplicates(conn, columnMapByTable) {
  const checks = [
    { name: 'assets tenant+asset_code', table: 'assets', columns: ['tenant_id', 'asset_code'] },
    {
      name: 'assets_active tenant+asset_code',
      table: 'assets_active',
      columns: ['tenant_id', 'asset_code'],
    },
    {
      name: 'assets likely duplicate (name+dept+date+price)',
      table: 'assets',
      columns: ['tenant_id', 'asset_name', 'department_new', 'purchase_date', 'purchase_price'],
    },
    {
      name: 'asset_categories tenant+name',
      table: 'asset_categories',
      columns: ['tenant_id', 'name'],
    },
    {
      name: 'departments tenant+department_code',
      table: 'departments',
      columns: ['tenant_id', 'department_code'],
    },
    {
      name: 'departments tenant+department_name',
      table: 'departments',
      columns: ['tenant_id', 'department_name'],
    },
    {
      name: 'role_menu_permissions role+menu_key',
      table: 'role_menu_permissions',
      columns: ['role', 'menu_key'],
    },
    {
      name: 'user_permissions user+tenant+permission',
      table: 'user_permissions',
      columns: ['user_id', 'tenant_id', 'permission'],
    },
    {
      name: 'user_tenant_roles user+tenant+role',
      table: 'user_tenant_roles',
      columns: ['user_id', 'tenant_id', 'role'],
    },
    {
      name: 'user_menu_permissions user+tenant+menu_key',
      table: 'user_menu_permissions',
      columns: ['user_id', 'tenant_id', 'menu_key'],
    },
    {
      name: 'tenant_module_configs tenant+module',
      table: 'tenant_module_configs',
      columns: ['tenant_id', 'module_id'],
    },
    {
      name: 'tenant_module_menus tenant+module+menu',
      table: 'tenant_module_menus',
      columns: ['tenant_id', 'module_id', 'menu_key'],
    },
    {
      name: 'technical_document_asset_relations doc+asset',
      table: 'technical_document_asset_relations',
      columns: ['document_id', 'asset_code'],
    },
    {
      name: 'inventory_details tenant+inventory+asset',
      table: 'inventory_details',
      columns: ['tenant_id', 'inventory_id', 'asset_code'],
    },
    {
      name: 'inventory_details_active tenant+inventory+asset',
      table: 'inventory_details_active',
      columns: ['tenant_id', 'inventory_id', 'asset_code'],
    },
  ];

  const results = [];
  for (const check of checks) {
    const result = await runCompositeDuplicateCheck(conn, columnMapByTable, check);
    results.push(result);
  }

  const duplicated = results.filter(item => !item.skipped && item.duplicate_groups > 0);
  const scanned = results.filter(item => !item.skipped).length;

  return {
    scanned,
    duplicated_count: duplicated.length,
    duplicated_checks: duplicated.sort((a, b) => b.duplicate_rows - a.duplicate_rows),
    all_checks: results,
  };
}

async function auditIdentifierColumns(conn, columnMapByTable, tableRows) {
  const findings = [];
  const tables = Object.keys(columnMapByTable).sort((a, b) => (tableRows[b] || 0) - (tableRows[a] || 0));

  let scannedColumns = 0;
  for (const table of tables) {
    const rowCount = Number(tableRows[table] || 0);
    if (rowCount === 0) {
      continue;
    }

    const cols = columnMapByTable[table];
    const hasTenant = Object.prototype.hasOwnProperty.call(cols, 'tenant_id');
    const candidateColumns = Object.entries(cols)
      .filter(([columnName, dataType]) => isStringType(dataType) && IDENTIFIER_COLUMN_RE.test(columnName))
      .map(([columnName]) => columnName)
      .filter(columnName => columnName !== 'tenant_id');

    for (const columnName of candidateColumns) {
      const checkColumns = hasTenant ? ['tenant_id', columnName] : [columnName];
      scannedColumns += 1;
      const result = await runCompositeDuplicateCheck(conn, columnMapByTable, {
        name: `${table} ${checkColumns.join('+')}`,
        table,
        columns: checkColumns,
      });
      if (!result.skipped && result.duplicate_groups > 0) {
        findings.push({
          table,
          columns: checkColumns,
          duplicate_groups: result.duplicate_groups,
          duplicate_rows: result.duplicate_rows,
          max_group_size: result.max_group_size,
          samples: result.samples,
        });
      }
    }
  }

  findings.sort((a, b) => {
    if (b.duplicate_rows !== a.duplicate_rows) {
      return b.duplicate_rows - a.duplicate_rows;
    }
    return b.duplicate_groups - a.duplicate_groups;
  });

  return {
    scanned_columns: scannedColumns,
    columns_with_duplicates: findings.length,
    top_findings: findings.slice(0, 30),
  };
}

function detectActivePairs(columnMapByTable) {
  const pairs = [];
  const tables = Object.keys(columnMapByTable);
  for (const table of tables) {
    if (!table.endsWith('_active')) {
      continue;
    }
    const base = table.slice(0, -'_active'.length);
    if (columnMapByTable[base]) {
      pairs.push({ base, active: table });
    }
  }
  return pairs.sort((a, b) => a.base.localeCompare(b.base));
}

function pickJoinKeys(columns) {
  const combos = [
    ['tenant_id', 'asset_code'],
    ['tenant_id', 'record_no'],
    ['tenant_id', 'report_no'],
    ['tenant_id', 'inventory_no'],
    ['tenant_id', 'inventory_id', 'asset_code'],
    ['tenant_id', 'request_no'],
    ['tenant_id', 'work_order_no'],
    ['tenant_id', 'transfer_no'],
  ];

  for (const combo of combos) {
    if (combo.every(col => columns.includes(col))) {
      return combo;
    }
  }

  const codeLike = columns.find(col => /(_code|_no|_number)$/i.test(col));
  if (codeLike && columns.includes('tenant_id')) {
    return ['tenant_id', codeLike];
  }

  return null;
}

async function countDistinctKeys(conn, table, keyColumns, typeMap) {
  const exprs = keyColumns.map(col => normalizeExpr(col, typeMap[col]));
  const conditions = keyColumns.map(col => nonEmptyCondition(col, typeMap[col]));
  const whereClause = conditions.join(' AND ');
  const selectExpr = exprs.join(', ');
  const groupByExpr = exprs.join(', ');
  const [rows] = await conn.query(
    `
      SELECT COUNT(*) AS cnt
      FROM (
        SELECT ${selectExpr}
        FROM ${quoteId(table)}
        WHERE ${whereClause}
        GROUP BY ${groupByExpr}
      ) s
    `,
  );
  return Number(rows[0]?.cnt || 0);
}

async function countOverlapKeys(conn, baseTable, activeTable, keyColumns, baseTypes, activeTypes) {
  const baseExprs = keyColumns.map((col, idx) => `${normalizeExpr(col, baseTypes[col])} AS k${idx}`);
  const activeExprs = keyColumns.map((col, idx) => `${normalizeExpr(col, activeTypes[col])} AS k${idx}`);
  const baseConditions = keyColumns.map(col => nonEmptyCondition(col, baseTypes[col]));
  const activeConditions = keyColumns.map(col => nonEmptyCondition(col, activeTypes[col]));
  const joinOn = keyColumns.map((_, idx) => `b.k${idx} = a.k${idx}`).join(' AND ');

  const [rows] = await conn.query(
    `
      SELECT COUNT(*) AS cnt
      FROM (
        SELECT ${baseExprs.join(', ')}
        FROM ${quoteId(baseTable)}
        WHERE ${baseConditions.join(' AND ')}
        GROUP BY ${keyColumns.map((_, idx) => `k${idx}`).join(', ')}
      ) b
      INNER JOIN (
        SELECT ${activeExprs.join(', ')}
        FROM ${quoteId(activeTable)}
        WHERE ${activeConditions.join(' AND ')}
        GROUP BY ${keyColumns.map((_, idx) => `k${idx}`).join(', ')}
      ) a
        ON ${joinOn}
    `,
  );

  return Number(rows[0]?.cnt || 0);
}

async function auditActiveTableOverlap(conn, columnMapByTable) {
  const pairs = detectActivePairs(columnMapByTable);
  const results = [];

  for (const pair of pairs) {
    const baseColumns = Object.keys(columnMapByTable[pair.base] || {});
    const activeColumns = Object.keys(columnMapByTable[pair.active] || {});
    const sameColumns =
      baseColumns.length === activeColumns.length &&
      [...baseColumns].sort().every((col, idx) => col === [...activeColumns].sort()[idx]);

    const commonColumns = baseColumns.filter(col => activeColumns.includes(col));
    const joinKeys = pickJoinKeys(commonColumns);

    const record = {
      base_table: pair.base,
      active_table: pair.active,
      same_columns: sameColumns,
      join_keys: joinKeys,
      overlap_distinct_keys: null,
      base_distinct_keys: null,
      active_distinct_keys: null,
      active_only_distinct_keys: null,
      base_only_distinct_keys: null,
    };

    if (joinKeys) {
      const baseTypes = columnMapByTable[pair.base];
      const activeTypes = columnMapByTable[pair.active];
      const baseDistinct = await countDistinctKeys(conn, pair.base, joinKeys, baseTypes);
      const activeDistinct = await countDistinctKeys(conn, pair.active, joinKeys, activeTypes);
      const overlapDistinct = await countOverlapKeys(
        conn,
        pair.base,
        pair.active,
        joinKeys,
        baseTypes,
        activeTypes,
      );

      record.base_distinct_keys = baseDistinct;
      record.active_distinct_keys = activeDistinct;
      record.overlap_distinct_keys = overlapDistinct;
      record.active_only_distinct_keys = Math.max(0, activeDistinct - overlapDistinct);
      record.base_only_distinct_keys = Math.max(0, baseDistinct - overlapDistinct);
    }

    results.push(record);
  }

  return {
    pair_count: results.length,
    pairs: results,
  };
}

async function auditAssetsDeep(conn) {
  const [overviewRows] = await conn.query(
    `
      SELECT
        COUNT(*) AS total_rows,
        SUM(asset_code IS NULL OR TRIM(asset_code) = '') AS empty_code_rows,
        COUNT(DISTINCT UPPER(TRIM(asset_code))) AS distinct_normalized_codes
      FROM assets
    `,
  );

  const [dupWithinTenantRows] = await conn.query(
    `
      SELECT
        COUNT(*) AS duplicate_groups,
        COALESCE(SUM(cnt) - COUNT(*), 0) AS duplicate_rows,
        COALESCE(MAX(cnt), 0) AS max_group_size
      FROM (
        SELECT tenant_id, UPPER(TRIM(asset_code)) AS normalized_code, COUNT(*) AS cnt
        FROM assets
        WHERE asset_code IS NOT NULL
          AND TRIM(asset_code) <> ''
        GROUP BY tenant_id, normalized_code
        HAVING COUNT(*) > 1
      ) d
    `,
  );

  const [dupWithinTenantTop] = await conn.query(
    `
      SELECT
        tenant_id,
        UPPER(TRIM(asset_code)) AS normalized_code,
        COUNT(*) AS cnt
      FROM assets
      WHERE asset_code IS NOT NULL
        AND TRIM(asset_code) <> ''
      GROUP BY tenant_id, normalized_code
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT 10
    `,
  );

  const [crossTenantReuseRows] = await conn.query(
    `
      SELECT
        COUNT(*) AS reused_codes,
        COALESCE(MAX(tenant_cnt), 0) AS max_tenant_count
      FROM (
        SELECT UPPER(TRIM(asset_code)) AS normalized_code, COUNT(DISTINCT tenant_id) AS tenant_cnt
        FROM assets
        WHERE asset_code IS NOT NULL
          AND TRIM(asset_code) <> ''
        GROUP BY normalized_code
        HAVING COUNT(DISTINCT tenant_id) > 1
      ) x
    `,
  );

  const [crossTenantReuseTop] = await conn.query(
    `
      SELECT
        UPPER(TRIM(asset_code)) AS normalized_code,
        COUNT(DISTINCT tenant_id) AS tenant_cnt,
        COUNT(*) AS row_cnt
      FROM assets
      WHERE asset_code IS NOT NULL
        AND TRIM(asset_code) <> ''
      GROUP BY normalized_code
      HAVING COUNT(DISTINCT tenant_id) > 1
      ORDER BY tenant_cnt DESC, row_cnt DESC
      LIMIT 10
    `,
  );

  const [likelyDupRows] = await conn.query(
    `
      SELECT
        COUNT(*) AS duplicate_groups,
        COALESCE(SUM(cnt) - COUNT(*), 0) AS duplicate_rows,
        COALESCE(MAX(cnt), 0) AS max_group_size
      FROM (
        SELECT
          tenant_id,
          UPPER(TRIM(asset_name)) AS normalized_name,
          UPPER(TRIM(COALESCE(department_new, ''))) AS normalized_department,
          purchase_date,
          purchase_price,
          COUNT(*) AS cnt
        FROM assets
        WHERE asset_name IS NOT NULL
          AND TRIM(asset_name) <> ''
        GROUP BY tenant_id, normalized_name, normalized_department, purchase_date, purchase_price
        HAVING COUNT(*) > 1
      ) d
    `,
  );

  const [likelyDupTop] = await conn.query(
    `
      SELECT
        tenant_id,
        UPPER(TRIM(asset_name)) AS normalized_name,
        UPPER(TRIM(COALESCE(department_new, ''))) AS normalized_department,
        purchase_date,
        purchase_price,
        COUNT(*) AS cnt
      FROM assets
      WHERE asset_name IS NOT NULL
        AND TRIM(asset_name) <> ''
      GROUP BY tenant_id, normalized_name, normalized_department, purchase_date, purchase_price
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT 10
    `,
  );

  return {
    overview: {
      total_rows: Number(overviewRows[0]?.total_rows || 0),
      empty_code_rows: Number(overviewRows[0]?.empty_code_rows || 0),
      distinct_normalized_codes: Number(overviewRows[0]?.distinct_normalized_codes || 0),
    },
    duplicate_asset_code_within_tenant: {
      duplicate_groups: Number(dupWithinTenantRows[0]?.duplicate_groups || 0),
      duplicate_rows: Number(dupWithinTenantRows[0]?.duplicate_rows || 0),
      max_group_size: Number(dupWithinTenantRows[0]?.max_group_size || 0),
      top: dupWithinTenantTop.map(row => ({
        tenant_id: Number(row.tenant_id),
        normalized_code: row.normalized_code,
        count: Number(row.cnt || 0),
      })),
    },
    cross_tenant_asset_code_reuse: {
      reused_codes: Number(crossTenantReuseRows[0]?.reused_codes || 0),
      max_tenant_count: Number(crossTenantReuseRows[0]?.max_tenant_count || 0),
      top: crossTenantReuseTop.map(row => ({
        normalized_code: row.normalized_code,
        tenant_count: Number(row.tenant_cnt || 0),
        row_count: Number(row.row_cnt || 0),
      })),
    },
    likely_duplicate_assets: {
      duplicate_groups: Number(likelyDupRows[0]?.duplicate_groups || 0),
      duplicate_rows: Number(likelyDupRows[0]?.duplicate_rows || 0),
      max_group_size: Number(likelyDupRows[0]?.max_group_size || 0),
      top: likelyDupTop.map(row => ({
        tenant_id: Number(row.tenant_id),
        normalized_name: row.normalized_name,
        normalized_department: row.normalized_department,
        purchase_date: row.purchase_date,
        purchase_price: row.purchase_price,
        count: Number(row.cnt || 0),
      })),
    },
  };
}

function collectHeadlineFindings(report) {
  const findings = [];

  if (report.assets.duplicate_asset_code_within_tenant.duplicate_groups > 0) {
    findings.push({
      level: 'high',
      title: 'Duplicate asset_code within tenant',
      detail: `${report.assets.duplicate_asset_code_within_tenant.duplicate_groups} groups, ${report.assets.duplicate_asset_code_within_tenant.duplicate_rows} extra rows`,
    });
  }

  if (report.core_duplicates.duplicated_count > 0) {
    const top = report.core_duplicates.duplicated_checks[0];
    findings.push({
      level: 'high',
      title: 'Core business duplicates detected',
      detail: `${report.core_duplicates.duplicated_count} key checks failed; top: ${top.name} (${top.duplicate_rows} extra rows)`,
    });
  }

  if (report.schema.duplicate_indexes_count > 0 || report.schema.prefix_overlaps_count > 0) {
    findings.push({
      level: 'medium',
      title: 'Index redundancy detected',
      detail: `${report.schema.duplicate_indexes_count} exact duplicates, ${report.schema.prefix_overlaps_count} prefix overlaps`,
    });
  }

  const activeOverlap = report.active_pairs.pairs.filter(
    pair =>
      pair.overlap_distinct_keys !== null &&
      pair.overlap_distinct_keys > 0 &&
      pair.active_only_distinct_keys === 0 &&
      pair.base_only_distinct_keys === 0,
  );
  if (activeOverlap.length > 0) {
    findings.push({
      level: 'medium',
      title: 'Active/base table full overlap',
      detail: `${activeOverlap.length} _active table pairs appear fully duplicated by key`,
    });
  }

  if (report.identifier_scan.columns_with_duplicates > 0) {
    findings.push({
      level: 'medium',
      title: 'Identifier duplicates across tables',
      detail: `${report.identifier_scan.columns_with_duplicates} identifier columns contain duplicates`,
    });
  }

  if (report.schema.tables_without_primary_key.length > 0) {
    findings.push({
      level: 'medium',
      title: 'Tables without primary key',
      detail: `${report.schema.tables_without_primary_key.length} tables have no primary key`,
    });
  }

  return findings;
}

function toMarkdown(report) {
  const lines = [];
  lines.push('# Data Redundancy Audit Report');
  lines.push('');
  lines.push(`- Generated at (UTC): ${report.generated_at_utc}`);
  lines.push(`- Database: ${report.database.name}`);
  lines.push(`- MySQL version: ${report.database.version}`);
  lines.push(`- Base table count: ${report.database.table_count}`);
  lines.push('');

  lines.push('## Headline Findings');
  if (report.headline_findings.length === 0) {
    lines.push('- No high-risk redundancy finding detected in this run.');
  } else {
    for (const finding of report.headline_findings) {
      lines.push(`- [${finding.level}] ${finding.title}: ${finding.detail}`);
    }
  }
  lines.push('');

  lines.push('## Schema Redundancy');
  lines.push(`- Exact duplicate indexes: ${report.schema.duplicate_indexes_count}`);
  lines.push(`- Prefix-overlapped non-unique indexes: ${report.schema.prefix_overlaps_count}`);
  lines.push(`- Tables without primary key: ${report.schema.tables_without_primary_key.length}`);
  lines.push('');
  if (report.schema.heavy_index_tables.length > 0) {
    lines.push('### Heavy Index Tables (Top)');
    for (const row of report.schema.heavy_index_tables.slice(0, 10)) {
      lines.push(`- ${row.table}: ${row.index_count} indexes`);
    }
    lines.push('');
  }

  lines.push('## Core Duplicate Checks');
  lines.push(`- Checks scanned: ${report.core_duplicates.scanned}`);
  lines.push(`- Checks with duplicates: ${report.core_duplicates.duplicated_count}`);
  for (const item of report.core_duplicates.duplicated_checks.slice(0, 12)) {
    lines.push(
      `- ${item.name}: groups=${item.duplicate_groups}, extra_rows=${item.duplicate_rows}, max_group=${item.max_group_size}`,
    );
  }
  lines.push('');

  lines.push('## Identifier Duplicate Scan');
  lines.push(`- Identifier columns scanned: ${report.identifier_scan.scanned_columns}`);
  lines.push(`- Columns with duplicates: ${report.identifier_scan.columns_with_duplicates}`);
  for (const row of report.identifier_scan.top_findings.slice(0, 12)) {
    lines.push(
      `- ${row.table}.${row.columns.join('+')}: groups=${row.duplicate_groups}, extra_rows=${row.duplicate_rows}, max_group=${row.max_group_size}`,
    );
  }
  lines.push('');

  lines.push('## Active Table Overlap');
  lines.push(`- Pair count: ${report.active_pairs.pair_count}`);
  for (const pair of report.active_pairs.pairs) {
    const overlap = pair.overlap_distinct_keys === null ? 'n/a' : pair.overlap_distinct_keys;
    const activeOnly = pair.active_only_distinct_keys === null ? 'n/a' : pair.active_only_distinct_keys;
    const baseOnly = pair.base_only_distinct_keys === null ? 'n/a' : pair.base_only_distinct_keys;
    lines.push(
      `- ${pair.base_table} <-> ${pair.active_table}: keys=${(pair.join_keys || []).join('+') || 'n/a'}, overlap=${overlap}, active_only=${activeOnly}, base_only=${baseOnly}`,
    );
  }
  lines.push('');

  lines.push('## Assets Deep Dive');
  lines.push(`- Total rows: ${report.assets.overview.total_rows}`);
  lines.push(`- Empty asset_code rows: ${report.assets.overview.empty_code_rows}`);
  lines.push(`- Distinct normalized asset_code: ${report.assets.overview.distinct_normalized_codes}`);
  lines.push(
    `- Duplicate asset_code within tenant: groups=${report.assets.duplicate_asset_code_within_tenant.duplicate_groups}, extra_rows=${report.assets.duplicate_asset_code_within_tenant.duplicate_rows}`,
  );
  lines.push(
    `- Cross-tenant asset_code reuse: reused_codes=${report.assets.cross_tenant_asset_code_reuse.reused_codes}, max_tenant_count=${report.assets.cross_tenant_asset_code_reuse.max_tenant_count}`,
  );
  lines.push(
    `- Likely duplicated assets (name+dept+date+price): groups=${report.assets.likely_duplicate_assets.duplicate_groups}, extra_rows=${report.assets.likely_duplicate_assets.duplicate_rows}`,
  );
  lines.push('');

  return lines.join('\n');
}

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection(DB_CONFIG);

    const [metaRows] = await conn.query('SELECT DATABASE() AS name, VERSION() AS version');
    const meta = metaRows[0] || { name: DB_CONFIG.database, version: 'unknown' };

    const { columnMapByTable, tableRows } = await loadSchemaMetadata(conn);
    const tableCount = Object.keys(columnMapByTable).length;

    const schema = await auditSchemaRedundancy(conn);
    const coreDuplicates = await auditCoreBusinessDuplicates(conn, columnMapByTable);
    const identifierScan = await auditIdentifierColumns(conn, columnMapByTable, tableRows);
    const activePairs = await auditActiveTableOverlap(conn, columnMapByTable);
    const assets = await auditAssetsDeep(conn);

    const report = {
      generated_at_utc: new Date().toISOString(),
      database: {
        name: meta.name,
        version: meta.version,
        table_count: tableCount,
      },
      schema,
      core_duplicates: coreDuplicates,
      identifier_scan: identifierScan,
      active_pairs: activePairs,
      assets,
    };

    report.headline_findings = collectHeadlineFindings(report);

    const stamp = makeStamp();
    const analysisDir = path.resolve(__dirname, '../../analysis');
    fs.mkdirSync(analysisDir, { recursive: true });
    const jsonPath = path.join(analysisDir, `data-redundancy-audit-${stamp}.json`);
    const mdPath = path.join(analysisDir, `data-redundancy-audit-${stamp}.md`);

    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(mdPath, `${toMarkdown(report)}\n`, 'utf8');

    console.log('Full data redundancy audit completed.');
    console.log(`JSON: ${jsonPath}`);
    console.log(`Markdown: ${mdPath}`);
    console.log(
      `Summary: headline_findings=${report.headline_findings.length}, core_duplicate_checks_failed=${report.core_duplicates.duplicated_count}, identifier_columns_with_duplicates=${report.identifier_scan.columns_with_duplicates}`,
    );
  } catch (error) {
    console.error('Data redundancy audit failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

main();

