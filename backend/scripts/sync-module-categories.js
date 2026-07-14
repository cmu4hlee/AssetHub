const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '../.env');
const parentEnvPath = path.join(__dirname, '../../.env');

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else if (fs.existsSync(parentEnvPath)) {
  require('dotenv').config({ path: parentEnvPath });
} else {
  require('dotenv').config();
}

const db = require('../config/database');
const { getModuleMenuDefinitions } = require('../services/module-menu.service');

const normalizeText = value => (value == null ? '' : String(value).trim());

const buildMenuMap = async () => {
  const [rows] = await db.execute(
    `SELECT menu_key, menu_label, parent_key
     FROM menu_definitions
     WHERE is_active = 1`,
  );
  const map = new Map();
  for (const row of rows || []) {
    if (!row?.menu_key) continue;
    map.set(row.menu_key, row);
  }
  return map;
};

const getTopLevelMenu = (menuKey, menuMap) => {
  if (!menuKey || !menuMap?.size) return null;
  const visited = new Set();
  let currentKey = menuKey;
  while (currentKey && !visited.has(currentKey)) {
    visited.add(currentKey);
    const current = menuMap.get(currentKey);
    if (!current) return null;
    if (!current.parent_key) return current;
    currentKey = current.parent_key;
  }
  return null;
};

const deriveCategoryFromMenus = (menus, menuMap) => {
  if (!Array.isArray(menus) || menus.length === 0) {
    return null;
  }

  const counter = new Map();
  for (const menu of menus) {
    if (!menu?.menu_key) continue;
    const topLevel = getTopLevelMenu(menu.menu_key, menuMap);
    const topKey = topLevel?.menu_key;
    if (!topKey) continue;
    const prev = counter.get(topKey) || { count: 0, label: topLevel.menu_label || topKey };
    prev.count += 1;
    counter.set(topKey, prev);
  }

  let selected = null;
  for (const value of counter.values()) {
    if (!selected || value.count > selected.count) {
      selected = value;
    }
  }
  return selected?.label || null;
};

async function syncModuleCategories({ dryRun }) {
  const menuMap = await buildMenuMap();
  const [modules] = await db.execute(
    'SELECT id, name, category FROM system_modules ORDER BY category, name',
  );

  let scanned = 0;
  let updated = 0;
  const skipped = [];

  for (const module of modules || []) {
    scanned += 1;
    const menus = await getModuleMenuDefinitions(module.id);
    const derivedCategory = normalizeText(deriveCategoryFromMenus(menus, menuMap));
    const currentCategory = normalizeText(module.category);

    if (!derivedCategory) {
      skipped.push(`${module.id}(${module.name})`);
      continue;
    }

    if (derivedCategory === currentCategory) {
      continue;
    }

    if (!dryRun) {
      await db.execute(
        'UPDATE system_modules SET category = ?, updated_at = NOW() WHERE id = ?',
        [derivedCategory, module.id],
      );
    }

    updated += 1;
    console.log(
      `[${dryRun ? 'DRY-RUN' : 'UPDATED'}] ${module.id}: "${currentCategory || '未分类'}" -> "${derivedCategory}"`,
    );
  }

  console.log('----------------------------------------');
  console.log(`扫描模块数: ${scanned}`);
  console.log(`待更新/已更新: ${updated}`);
  console.log(`无法推导分类(保留原值): ${skipped.length}`);
  if (skipped.length > 0) {
    console.log(`跳过模块: ${skipped.join(', ')}`);
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  try {
    await syncModuleCategories({ dryRun });
  } catch (error) {
    console.error('同步模块分类失败:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = syncModuleCategories;
