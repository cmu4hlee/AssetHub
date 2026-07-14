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
const {
  generateMedicalDefaultTemplatesByTenant,
} = require('../services/maintenance/templates.service');

async function run() {
  try {
    const [tenants] = await db.execute(
      'SELECT id, tenant_name AS display_name FROM tenants ORDER BY id ASC',
    );
    if (!tenants.length) {
      console.log('未找到租户，跳过生成。');
      return;
    }

    for (const tenant of tenants) {
      const result = await generateMedicalDefaultTemplatesByTenant(tenant.id, 'system-seed');
      console.log(
        `[tenant:${tenant.id} ${tenant.display_name || ''}] created=${result.data.created_count}, skipped=${result.data.skipped_count}`,
      );
    }
  } catch (error) {
    console.error('生成默认医疗设备维护模板失败:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  run();
}
