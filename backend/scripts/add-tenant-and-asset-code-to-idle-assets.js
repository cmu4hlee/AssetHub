/**
 * 为 idle_assets 表添加 tenant_id、asset_code 字段（若不存在）
 * 便于多租户隔离及与 assets 表按编号关联（兼容临时资产用 asset_code 存 TEMP_xxx）
 * 用法：cd backend && node scripts/add-tenant-and-asset-code-to-idle-assets.js
 */

require('dotenv').config();
const db = require('../config/database');

async function main() {
  try {
    const [cols] = await db.execute(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'idle_assets'",
    );
    const names = (cols || []).map(c => c.COLUMN_NAME);

    if (names.length === 0) {
      console.log('idle_assets 表不存在，跳过');
      process.exit(0);
      return;
    }

    if (names.includes('tenant_id') && names.includes('asset_code')) {
      console.log('idle_assets 已包含 tenant_id、asset_code，无需迁移');
      process.exit(0);
      return;
    }

    if (!names.includes('tenant_id')) {
      await db.execute(
        "ALTER TABLE idle_assets ADD COLUMN tenant_id INT NULL COMMENT '租户ID' AFTER id",
      );
      await db.execute('CREATE INDEX idx_idle_tenant_id ON idle_assets(tenant_id)');
      console.log('已添加 tenant_id 及索引');
    }

    if (!names.includes('asset_code')) {
      await db.execute(
        "ALTER TABLE idle_assets ADD COLUMN asset_code VARCHAR(100) NULL COMMENT '资产编号或临时标识' AFTER tenant_id",
      );
      await db.execute('CREATE INDEX idx_idle_asset_code ON idle_assets(asset_code)');
      console.log('已添加 asset_code 及索引');
    }

    if (names.includes('asset_id')) {
      await db.execute("ALTER TABLE idle_assets MODIFY COLUMN asset_id INT NULL COMMENT '资产ID（现有资产时填写，临时资产可空）'");
      console.log('已将 asset_id 改为可空');
    }

    // 若原有 asset_id 存在，可回填 asset_code（从 assets 查）
    if (names.includes('asset_id')) {
      const [rows] = await db.execute(
        'SELECT id, asset_id FROM idle_assets WHERE asset_id IS NOT NULL AND (asset_code IS NULL OR asset_code = "")',
      );
      if (rows.length > 0) {
        for (const row of rows) {
          const [a] = await db.execute('SELECT asset_code FROM assets WHERE id = ?', [row.asset_id]);
          if (a.length > 0) {
            await db.execute('UPDATE idle_assets SET asset_code = ? WHERE id = ?', [a[0].asset_code, row.id]);
          }
        }
        console.log(`已回填 ${rows.length} 条记录的 asset_code`);
      }
    }

    console.log('idle_assets 表结构迁移完成');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
