/**
 * Migration: Allow NULL tenant_id in sms_verification_codes table
 * Purpose: Support new user registration via phone verification without tenant context
 */

const db = require('../../config/database');

async function migrate() {
  console.log('🔄 Running migration: sms_verification_codes_allow_null_tenant...');

  try {
    // Check if the table exists
    const [tables] = await db.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'sms_verification_codes'
    `);

    if (tables.length === 0) {
      console.log('⚠️  sms_verification_codes table does not exist, skipping migration');
      return;
    }

    // Check current column definition
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'sms_verification_codes' 
      AND COLUMN_NAME = 'tenant_id'
    `);

    if (columns.length === 0) {
      console.log('⚠️  tenant_id column does not exist in sms_verification_codes, skipping migration');
      return;
    }

    const column = columns[0];
    console.log('📊 Current tenant_id column:', column);

    // Drop the unique constraint if it exists
    const [indexes] = await db.execute(`
      SHOW INDEX FROM sms_verification_codes WHERE Column_name = 'tenant_id' AND Key_name = 'uk_phone_tenant'
    `);

    if (indexes.length > 0) {
      console.log('🗑️  Dropping unique constraint uk_phone_tenant...');
      await db.execute('ALTER TABLE sms_verification_codes DROP INDEX uk_phone_tenant');
      console.log('✅ Unique constraint dropped');
    }

    // Modify the column to allow NULL
    console.log('🔧 Modifying tenant_id column to allow NULL...');
    await db.execute(`
      ALTER TABLE sms_verification_codes 
      MODIFY COLUMN tenant_id INT NULL COMMENT '租户ID（新用户注册时为NULL）'
    `);
    console.log('✅ tenant_id column modified to allow NULL');

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✅ Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrate;
