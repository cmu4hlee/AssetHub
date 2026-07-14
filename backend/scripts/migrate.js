/**
 * 数据库迁移管理器
 * 用于管理和执行数据库结构变更
 */
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

class MigrationManager {
  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
    this.migrationTable = '_migrations';
    this.ensureMigrationTable();
  }

  async ensureMigrationTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    try {
      await db.execute(createTableSQL);
    } catch (error) {
      console.error('Failed to create migration table:', error.message);
    }
  }

  async getAppliedMigrations() {
    try {
      const [rows] = await db.execute(`SELECT name FROM ${this.migrationTable}`);
      return rows.map(row => row.name);
    } catch (error) {
      console.error('Failed to get applied migrations:', error.message);
      return [];
    }
  }

  async getPendingMigrations() {
    const applied = await this.getAppliedMigrations();
    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.js'))
      .sort();

    return files.filter(f => !applied.includes(f.replace('.js', '')));
  }

  async applyMigration(fileName) {
    const migrationPath = path.join(this.migrationsDir, fileName);
    const migrationName = fileName.replace('.js', '');

    console.log(`📦 Applying migration: ${migrationName}`);

    try {
      const migration = require(migrationPath);

      if (typeof migration.up === 'function') {
        await migration.up(db);
      }

      await db.execute(
        `INSERT INTO ${this.migrationTable} (name) VALUES (?)`,
        [migrationName],
      );

      console.log(`✅ Migration applied: ${migrationName}`);
      return true;
    } catch (error) {
      console.error(`❌ Migration failed: ${migrationName}`, error.message);
      throw error;
    }
  }

  async migrateAll() {
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('✅ All migrations already applied');
      return;
    }

    console.log(`📦 Found ${pending.length} pending migrations`);

    for (const file of pending) {
      await this.applyMigration(file);
    }

    console.log('✅ All migrations completed');
  }

  async rollback(migrationName) {
    console.log(`📦 Rolling back migration: ${migrationName}`);

    try {
      const migrationPath = path.join(this.migrationsDir, `${migrationName}.js`);
      const migration = require(migrationPath);

      if (typeof migration.down === 'function') {
        await migration.down(db);
      }

      await db.execute(
        `DELETE FROM ${this.migrationTable} WHERE name = ?`,
        [migrationName],
      );

      console.log(`✅ Migration rolled back: ${migrationName}`);
      return true;
    } catch (error) {
      console.error(`❌ Rollback failed: ${migrationName}`, error.message);
      throw error;
    }
  }

  async status() {
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();

    console.log('\n📊 Migration Status:');
    console.log(`   Applied: ${applied.length}`);
    console.log(`   Pending: ${pending.length}`);

    if (pending.length > 0) {
      console.log('\n   Pending migrations:');
      pending.forEach(m => console.log(`   - ${m}`));
    }

    return { applied, pending };
  }
}

const manager = new MigrationManager();

const command = process.argv[2] || 'status';

(async () => {
  switch (command) {
    case 'up':
    case 'migrate':
      await manager.migrateAll();
      break;
    case 'down':
    case 'rollback':
    {
      const migrationName = process.argv[3];
      if (!migrationName) {
        console.error('Please specify migration name: node migrate.js down <migration_name>');
        process.exit(1);
      }
      await manager.rollback(migrationName);
      break;
    }
    case 'status':
    default:
      await manager.status();
  }
  process.exit(0);
})();

module.exports = MigrationManager;
