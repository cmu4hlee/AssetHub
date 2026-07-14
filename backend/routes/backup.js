const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const db = require('../config/database');
const { logAudit } = require('../middleware/auditLogger');
const jwt = require('jsonwebtoken');

const execPromise = util.promisify(exec);

// 备份文件存储目录
const BACKUP_DIR = path.join(__dirname, '../backups');
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'zcgl',
};

// 检查必要的配置
if (!DB_CONFIG.password) {
  console.warn('⚠️  警告：数据库密码未设置，备份功能可能无法正常工作');
  console.warn('请设置环境变量 DB_PASSWORD 或创建 .env 文件');
}

// 确保备份目录存在
async function ensureBackupDir() {
  try {
    await fsPromises.access(BACKUP_DIR);
  } catch {
    await fsPromises.mkdir(BACKUP_DIR, { recursive: true });
  }
}

// 初始化备份目录
ensureBackupDir();

const normalizeTenantId = value => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getSystemAdminBackupAccessError = (req, backup, action) => {
  if (req.user?.role !== 'system_admin') {
    return null;
  }

  if (!backup?.tenant_id) {
    return `系统管理员无法${action}全库备份`;
  }

  if (backup.tenant_id !== req.user.tenant_id) {
    return `权限不足，只能${action}自己租户的备份`;
  }

  return null;
};

// 确保数据库备份表存在
async function ensureBackupTableExists() {
  let connection;
  try {
    connection = await db.getConnection();

    // 检查表是否存在
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'database_backups'`,
      [DB_CONFIG.database],
    );

    if (tables.length === 0) {
      console.log('[数据库备份] database_backups 表不存在，创建中...');

      // 创建表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS database_backups (
          id INT PRIMARY KEY AUTO_INCREMENT,
          file_name VARCHAR(255) NOT NULL COMMENT '备份文件名',
          file_path VARCHAR(500) NOT NULL COMMENT '备份文件路径',
          file_size BIGINT NOT NULL COMMENT '文件大小（字节）',
          description TEXT COMMENT '备份描述',
          tenant_id INT NULL COMMENT '租户ID（NULL表示全库备份）',
          tenant_name VARCHAR(100) NULL COMMENT '租户名称',
          created_by VARCHAR(50) COMMENT '创建人',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          restored_by VARCHAR(50) COMMENT '恢复人',
          restored_at TIMESTAMP NULL COMMENT '恢复时间',
          INDEX idx_created_at (created_at),
          INDEX idx_tenant_id (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据库备份记录表'
      `);

      console.log('[数据库备份] database_backups 表创建成功');
      return true;
    }

    // 检查是否需要添加 tenant_id 和 tenant_name 列
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'database_backups' AND COLUMN_NAME IN ('tenant_id', 'tenant_name')
    `, [DB_CONFIG.database]);

    const existingColumns = columns.map(c => c.COLUMN_NAME);

    if (!existingColumns.includes('tenant_id')) {
      try {
        await connection.execute('ALTER TABLE database_backups ADD COLUMN tenant_id INT NULL COMMENT \'租户ID（NULL表示全库备份）\'');
      } catch (alterError) {
        console.warn('[数据库备份] 添加 tenant_id 列失败:', alterError.message);
      }
    }

    if (!existingColumns.includes('tenant_name')) {
      try {
        await connection.execute('ALTER TABLE database_backups ADD COLUMN tenant_name VARCHAR(100) NULL COMMENT \'租户名称\'');
      } catch (alterError) {
        console.warn('[数据库备份] 添加 tenant_name 列失败:', alterError.message);
      }
    }

    return true;
  } catch (error) {
    console.error('[数据库备份] 检查/创建备份表失败:', error.message);
    return false;
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (e) {
        // Ignore release errors
      }
    }
  }
}

/**
 * @swagger
 * /api/backup:
 *   post:
 *     tags:
 *       - 数据库备份
 *     summary: 创建数据库备份
 *     description: 创建数据库备份文件，只有系统管理员可以执行此操作
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 description: 备份描述（可选）
 *     responses:
 *       200:
 *         description: 备份成功
 *       403:
 *         description: 权限不足
 *       500:
 *         description: 备份失败
 */
// 创建数据库备份
router.post('/', authenticate, async (req, res) => {
  try {
    // 权限检查：只有系统管理员可以备份
    // 超级管理员和系统管理员（租户级）可以执行备份操作
    if (req.user.role !== 'super_admin' && req.user.role !== 'system_admin') {
      return res.status(403).json({
        success: false,
        message: '权限不足，只有系统管理员可以创建数据库备份',
      });
    }

    // 自动更新表结构，添加tenant_id和tenant_name字段
    // 使用独立的连接来避免连接状态问题
    let schemaConnection;
    try {
      schemaConnection = await db.getConnection();
      // 先检查列是否存在
      const [columns] = await schemaConnection.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'database_backups' AND COLUMN_NAME IN ('tenant_id', 'tenant_name')
      `, [DB_CONFIG.database]);

      const existingColumns = columns.map(c => c.COLUMN_NAME);

      if (!existingColumns.includes('tenant_id')) {
        try {
          await schemaConnection.execute('ALTER TABLE database_backups ADD COLUMN tenant_id INT NULL COMMENT \'租户ID（NULL表示全库备份）\'');
        } catch (alterError) {
          console.warn('[数据库备份] 添加 tenant_id 列失败:', alterError.message);
        }
      }
      if (!existingColumns.includes('tenant_name')) {
        try {
          await schemaConnection.execute('ALTER TABLE database_backups ADD COLUMN tenant_name VARCHAR(100) NULL COMMENT \'租户名称\'');
        } catch (alterError) {
          console.warn('[数据库备份] 添加 tenant_name 列失败:', alterError.message);
        }
      }
      if (!existingColumns.includes('tenant_id') || !existingColumns.includes('tenant_name')) {
        try {
          await schemaConnection.execute('ALTER TABLE database_backups ADD INDEX idx_tenant_id (tenant_id)');
        } catch (alterError) {
          console.warn('[数据库备份] 添加索引失败:', alterError.message);
        }
      }
    } catch (error) {
      console.warn('[数据库备份] 自动更新表结构失败:', error.message);
    } finally {
      if (schemaConnection) {
        try {
          schemaConnection.release();
        } catch (e) {
          // Ignore
        }
      }
    }

    const { description } = req.body;
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .split('.')[0];

    // 确定备份类型（全库备份或租户备份）
    let isFullBackup = false;
    let tenantId = null;
    let tenantName = null;

    if (req.user.role === 'super_admin') {
      // 超级管理员可以选择全库备份或租户备份
      isFullBackup = req.body.isFullBackup !== false; // 默认全库备份
      tenantId = normalizeTenantId(req.body.tenantId);
      if (!isFullBackup && !tenantId) {
        return res.status(400).json({
          success: false,
          message: '租户备份必须指定有效的 tenantId',
        });
      }
    } else {
      // 系统管理员只能备份自己的租户
      isFullBackup = false;
      tenantId = req.user.tenant_id;
    }

    // 获取租户名称（如果是租户备份）
    if (tenantId) {
      const [tenants] = await db.execute('SELECT tenant_name FROM tenants WHERE id = ?', [
        tenantId,
      ]);
      if (tenants.length === 0) {
        return res.status(404).json({
          success: false,
          message: '租户不存在',
        });
      }
      tenantName = tenants[0]?.tenant_name || null;
    }

    // 生成备份文件名
    let backupFileName;
    if (isFullBackup) {
      backupFileName = `backup_full_${DB_CONFIG.database}_${timestamp}.sql`;
    } else if (tenantId) {
      backupFileName = `backup_tenant_${tenantId}_${timestamp}.sql`;
    } else {
      backupFileName = `backup_${DB_CONFIG.database}_${timestamp}.sql`;
    }

    const backupFilePath = path.join(BACKUP_DIR, backupFileName);

    console.log(`[数据库备份] 开始创建备份: ${backupFileName}`);

    // 执行备份命令
    try {
      if (isFullBackup) {
        // 全库备份
        const mysqldumpCmd = `mysqldump -h ${DB_CONFIG.host} -P ${DB_CONFIG.port} -u ${DB_CONFIG.user} -p${DB_CONFIG.password} ${DB_CONFIG.database} > "${backupFilePath}"`;
        await execPromise(mysqldumpCmd, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer
      } else {
        // 租户备份
        // 使用 Node.js 方式备份（更灵活的租户数据过滤）
        // 确保 tenantId 有有效值
        const effectiveTenantId = tenantId || req.user.tenant_id;
        await backupUsingNodeJS(backupFilePath, effectiveTenantId);
      }
    } catch (error) {
      // 检查是否是 mysqldump 未找到的错误
      if (
        isFullBackup &&
        error.message.includes('mysqldump') &&
        error.message.includes('not found')
      ) {
        console.error('[数据库备份] mysqldump 命令未找到，尝试使用 Node.js 方式备份');
        await backupUsingNodeJS(backupFilePath, tenantId);
      } else {
        throw error;
      }
    }

    // 获取备份文件大小
    const stats = await fsPromises.stat(backupFilePath);
    const fileSize = stats.size;

    // 确保数据库备份表存在
    const tableExists = await ensureBackupTableExists();
    if (!tableExists) {
      throw new Error('数据库备份表创建失败，无法记录备份信息');
    }

    // 保存备份信息到数据库
    let result;
    try {
      // 尝试使用新表结构（带租户字段）
      [result] = await db.execute(
        `INSERT INTO database_backups (
          file_name, file_path, file_size, description, tenant_id, tenant_name, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          backupFileName,
          backupFilePath,
          fileSize,
          description || null,
          tenantId,
          tenantName,
          req.user.real_name || req.user.username || '系统管理员',
        ],
      );
    } catch (error) {
      // 如果新字段不存在，使用旧表结构
      console.warn('[数据库备份] 使用新表结构失败，回退到旧表结构:', error.message);

      try {
        // 尝试使用旧表结构（不带租户字段）
        [result] = await db.execute(
          `INSERT INTO database_backups (
            file_name, file_path, file_size, description, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            backupFileName,
            backupFilePath,
            fileSize,
            description || null,
            req.user.real_name || req.user.username || '系统管理员',
          ],
        );
      } catch (fallbackError) {
        // 如果旧表结构也失败，抛出更详细的错误
        console.error('[数据库备份] 插入备份记录失败:', fallbackError.message);
        console.error('[数据库备份] 备份文件已创建但未记录到数据库:', backupFileName);
        throw new Error(`备份记录保存失败: ${fallbackError.message}。备份文件已保存在: ${backupFilePath}`);
      }
    }

    // 记录操作日志
    await logAudit(req, {
      action_type: 'create',
      module: 'backup',
      resource_type: 'backup',
      resource_id: result.insertId,
      resource_name: backupFileName,
      action_description: `创建数据库备份：${backupFileName} (${formatFileSize(fileSize)})`,
      new_value: {
        file_name: backupFileName,
        file_size: fileSize,
        description,
        tenant_id: tenantId,
        tenant_name: tenantName,
        is_full_backup: isFullBackup,
      },
      response_status: 200,
    });

    console.log(`[数据库备份] ✅ 备份创建成功: ${backupFileName} (${formatFileSize(fileSize)})`);

    res.json({
      success: true,
      message: '数据库备份创建成功',
      data: {
        id: result.insertId,
        file_name: backupFileName,
        file_path: backupFilePath,
        file_size: fileSize,
        file_size_formatted: formatFileSize(fileSize),
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[数据库备份] ❌ 备份失败:', error);
    res.status(500).json({
      success: false,
      message: '数据库备份失败',
      error: error.message,
    });
  }
});

/**
 * 使用 Node.js 方式备份数据库（当 mysqldump 不可用时）
 * 使用 db.execute() 自动管理连接池，避免连接超时问题
 * @param {string} backupFilePath - 备份文件路径
 * @param {number|null} tenantId - 租户ID（null表示全库备份）
 */
async function backupUsingNodeJS(backupFilePath, tenantId = null) {
  let backupContent = '';

  try {
    // 获取所有表 - 使用 db.execute() 自动管理连接
    const [tables] = await db.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ?`,
      [DB_CONFIG.database],
    );

    backupContent += '-- Database Backup\n';
    backupContent += `-- Database: ${DB_CONFIG.database}\n`;
    backupContent += `-- Date: ${new Date().toISOString()}\n`;
    if (tenantId) {
      backupContent += `-- Tenant: ${tenantId}\n`;
    } else {
      backupContent += '-- Type: Full Backup\n';
    }
    backupContent += '\n';
    backupContent += 'SET FOREIGN_KEY_CHECKS=0;\n\n';

    // 备份每个表
    for (const table of tables) {
      const tableName = table.TABLE_NAME;

      // 获取表结构 - 使用 db.execute() 自动管理连接
      let createTable;
      try {
        [createTable] = await db.execute(`SHOW CREATE TABLE \`${tableName}\``);
      } catch (tableError) {
        console.warn(`[数据库备份] 无法获取表结构: ${tableName}`, tableError.message);
        continue;
      }

      if (!createTable || !createTable[0] || !createTable[0]['Create Table']) {
        console.warn(`[数据库备份] 无法获取表结构: ${tableName}`);
        continue;
      }

      backupContent += `-- Table structure for table \`${tableName}\`\n`;
      backupContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      backupContent += `${createTable[0]['Create Table']};\n\n`;

      // 检查表是否有tenant_id字段
      const hasTenantIdColumn = createTable[0]['Create Table'].includes('`tenant_id`');

      // 获取表数据 - 使用 db.execute() 自动管理连接
      let rows = [];
      try {
        let query = `SELECT * FROM \`${tableName}\``;
        let params = [];

        if (tenantId != null && hasTenantIdColumn) {
          // 租户备份，且表有tenant_id字段，只导出该租户的数据
          query = `SELECT * FROM \`${tableName}\` WHERE tenant_id = ?`;
          params = [tenantId];
        } else if (tenantId != null && tableName === 'tenants') {
          // 租户备份，导出当前租户的基本信息
          query = `SELECT * FROM \`${tableName}\` WHERE id = ?`;
          params = [tenantId];
        } else if (tenantId != null && tableName === 'users') {
          // 租户备份，导出当前租户的用户信息
          query = `SELECT DISTINCT u.* FROM \`${tableName}\` u
                   INNER JOIN user_tenant_roles ur ON ur.user_id = u.id
                   WHERE ur.tenant_id = ?`;
          params = [tenantId];
        }

        if (params.length > 0) {
          [rows] = await db.execute(query, params);
        } else {
          [rows] = await db.execute(query);
        }
      } catch (queryError) {
        console.warn(`[数据库备份] 查询表 ${tableName} 数据失败:`, queryError.message);
        rows = [];
      }

      if (rows && rows.length > 0) {
        backupContent += `-- Data for table \`${tableName}\`\n`;
        backupContent += `LOCK TABLES \`${tableName}\` WRITE;\n`;

        for (const row of rows) {
          const keys = Object.keys(row);
          const values = keys.map(key => {
            const value = row[key];
            if (value === null) return 'NULL';
            if (typeof value === 'string') {
              return `'${value.replace(/'/g, "''")}'`;
            }
            return value;
          });
          backupContent += `INSERT INTO \`${tableName}\` (\`${keys.join('`, `')}\`) VALUES (${values.join(', ')});\n`;
        }

        backupContent += 'UNLOCK TABLES;\n\n';
      }
    }

    backupContent += 'SET FOREIGN_KEY_CHECKS=1;\n';

    // 写入文件
    await fsPromises.writeFile(backupFilePath, backupContent, 'utf8');
    console.log(`[数据库备份] 文件写入成功: ${backupFilePath}`);
  } catch (error) {
    console.error('[数据库备份] Node.js备份失败:', error);
    throw error;
  }
}

/**
 * @swagger
 * /api/backup:
 *   get:
 *     tags:
 *       - 数据库备份
 *     summary: 获取备份列表
 *     description: 获取所有数据库备份文件列表
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 */
// 获取备份列表
router.get('/', authenticate, async (req, res) => {
  try {
    // 权限检查：只有系统管理员可以查看备份列表
    // 超级管理员和系统管理员（租户级）可以执行备份操作
    if (req.user.role !== 'super_admin' && req.user.role !== 'system_admin') {
      return res.status(403).json({
        success: false,
        message: '权限不足，只有系统管理员可以查看备份列表',
      });
    }

    // 构建查询条件
    let query = 'SELECT * FROM database_backups WHERE 1=1';
    const params = [];

    let backups;
    try {
      // 尝试使用新表结构（带租户字段）
      if (req.user.role === 'system_admin') {
        // 系统管理员只能查看自己租户的备份
        query += ' AND tenant_id = ?';
        params.push(req.user.tenant_id);
      }

      query += ' ORDER BY created_at DESC';

      // 从数据库获取备份记录
      [backups] = await db.execute(query, params);
    } catch (error) {
      // 如果新字段不存在，使用旧表结构（不带租户字段）
      console.warn('[数据库备份] 使用新表结构失败，回退到旧表结构:', error.message);

      // 旧表结构中，系统管理员可以查看所有备份（因为没有tenant_id字段）
      const oldQuery = 'SELECT * FROM database_backups ORDER BY created_at DESC';
      const [oldBackups] = await db.execute(oldQuery);

      // 添加默认的租户字段
      backups = oldBackups.map(backup => ({
        ...backup,
        tenant_id: null,
        tenant_name: null,
      }));
    }

    // 检查文件是否存在，并获取实际文件大小
    const backupsWithFileInfo = await Promise.all(
      backups.map(async backup => {
        try {
          const stats = await fsPromises.stat(backup.file_path);
          return {
            ...backup,
            file_exists: true,
            actual_file_size: stats.size,
            actual_file_size_formatted: formatFileSize(stats.size),
          };
        } catch {
          return {
            ...backup,
            file_exists: false,
            actual_file_size: 0,
            actual_file_size_formatted: '0 B',
          };
        }
      }),
    );

    res.json({
      success: true,
      data: backupsWithFileInfo,
    });
  } catch (error) {
    console.error('获取备份列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取备份列表失败',
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/backup/{id}/restore:
 *   post:
 *     tags:
 *       - 数据库备份
 *     summary: 恢复数据库备份
 *     description: 从备份文件恢复数据库，只有系统管理员可以执行此操作。此操作会覆盖现有数据，请谨慎操作。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 备份ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirm
 *             properties:
 *               confirm:
 *                 type: boolean
 *                 description: 确认恢复（必须为 true）
 *     responses:
 *       200:
 *         description: 恢复成功
 *       400:
 *         description: 请求参数无效
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 备份文件不存在
 *       500:
 *         description: 恢复失败
 */
// 恢复数据库备份
router.post('/:id/restore', authenticate, async (req, res) => {
  try {
    // 权限检查：只有系统管理员可以恢复
    // 超级管理员和系统管理员（租户级）可以执行备份操作
    if (req.user.role !== 'super_admin' && req.user.role !== 'system_admin') {
      return res.status(403).json({
        success: false,
        message: '权限不足，只有系统管理员可以恢复数据库备份',
      });
    }

    const { id } = req.params;
    const { confirm } = req.body;

    if (confirm !== true) {
      return res.status(400).json({
        success: false,
        message: '必须确认恢复操作（confirm: true）',
      });
    }

    // 获取备份信息
    const [backups] = await db.execute('SELECT * FROM database_backups WHERE id = ?', [id]);

    if (backups.length === 0) {
      return res.status(404).json({
        success: false,
        message: '备份记录不存在',
      });
    }

    const backup = backups[0];

    // 权限检查：确保系统管理员只能删除自己租户的备份
    if (req.user.role === 'system_admin') {
      const backupAccessError = getSystemAdminBackupAccessError(req, backup, '恢复');
      if (backupAccessError) {
        return res.status(403).json({
          success: false,
          message: backupAccessError,
        });
      }
    }

    // 检查备份文件是否存在
    try {
      await fsPromises.access(backup.file_path);
    } catch {
      return res.status(404).json({
        success: false,
        message: '备份文件不存在',
      });
    }

    console.log(`[数据库恢复] 开始恢复备份: ${backup.file_name}`);

    try {
      if (backup.tenant_id) {
        // 租户备份恢复
        // 总是使用 Node.js 方式恢复，以便更好地控制数据恢复范围
        console.log(`[数据库恢复] 执行租户级恢复，租户ID: ${backup.tenant_id}`);
        await restoreUsingNodeJS(backup.file_path, backup.tenant_id);
      } else {
        // 全库备份恢复
        const restoreCmd = `mysql -h ${DB_CONFIG.host} -P ${DB_CONFIG.port} -u ${DB_CONFIG.user} -p${DB_CONFIG.password} ${DB_CONFIG.database} < "${backup.file_path}"`;
        await execPromise(restoreCmd, { maxBuffer: 10 * 1024 * 1024 });
      }
    } catch (error) {
      // 如果 mysql 命令不可用，使用 Node.js 方式恢复
      if (error.message.includes('mysql') && error.message.includes('not found')) {
        console.log('[数据库恢复] mysql 命令未找到，尝试使用 Node.js 方式恢复');
        await restoreUsingNodeJS(backup.file_path, backup.tenant_id);
      } else {
        throw error;
      }
    }

    // 更新恢复记录
    await db.execute(
      `UPDATE database_backups
       SET restored_by = ?, restored_at = NOW()
       WHERE id = ?`,
      [req.user.real_name || req.user.username || '系统管理员', id],
    );

    // 记录操作日志
    await logAudit(req, {
      action_type: 'import',
      module: 'backup',
      resource_type: 'backup',
      resource_id: parseInt(id),
      resource_name: backup.file_name,
      action_description: `恢复数据库备份：${backup.file_name}`,
      response_status: 200,
    });

    console.log(`[数据库恢复] ✅ 恢复成功: ${backup.file_name}`);

    res.json({
      success: true,
      message: '数据库恢复成功',
    });
  } catch (error) {
    console.error('[数据库恢复] ❌ 恢复失败:', error);
    res.status(500).json({
      success: false,
      message: '数据库恢复失败',
      error: error.message,
    });
  }
});

/**
 * 使用 Node.js 方式恢复数据库（当 mysql 命令不可用时）
 * 使用 db.execute() 自动管理连接池，避免连接超时问题
 * @param {string} backupFilePath - 备份文件路径
 * @param {number|null} tenantId - 租户ID（null表示全库恢复）
 */
async function restoreUsingNodeJS(backupFilePath, tenantId = null) {
  const backupContent = await fsPromises.readFile(backupFilePath, 'utf8');

  // 禁用外键检查 - 使用 db.execute() 自动管理连接
  await db.execute('SET FOREIGN_KEY_CHECKS=0');

  // 按分号分割SQL语句
  const statements = backupContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  // 执行每个SQL语句
  for (const statement of statements) {
    if (statement.length > 0) {
      try {
        if (tenantId) {
          // 租户级恢复，需要对SQL语句进行处理
          if (statement.startsWith('INSERT INTO')) {
            // 对于INSERT语句，确保只插入属于当前租户的数据
            // 检查语句中是否包含tenant_id字段
            if (statement.includes('tenant_id')) {
              // 如果已经包含tenant_id条件，确保它与当前租户ID匹配
              if (!statement.includes(`tenant_id = ${tenantId}`)) {
                // 替换或添加tenant_id条件
                const updatedStatement = statement.replace(
                  /(INSERT INTO `\w+` \([^)]*\) VALUES \([^)]*\);?)/,
                  match => {
                    // 对于包含tenant_id的INSERT语句，确保它使用当前租户ID
                    if (match.includes('tenant_id')) {
                      // 替换tenant_id值
                      return match.replace(/(tenant_id\s*=\s*)([0-9]+)/g, `$1${tenantId}`);
                    }
                    return match;
                  },
                );
                await db.execute(updatedStatement);
              } else {
                await db.execute(statement);
              }
            } else if (statement.includes('`tenants`')) {
              // 对于租户表，只恢复指定租户
              const [, table, fields, values] = statement.match(
                /INSERT INTO `(\w+)` \(([^)]+)\) VALUES \(([^)]+)\)/,
              );

              if (table === 'tenants') {
                // 解析值
                const valueArray = values.split(',').map(v => v.trim());
                // 查找id字段的索引
                const fieldsArray = fields.split(',').map(f => f.trim());
                const idIndex = fieldsArray.findIndex(f => f === '`id`');

                if (idIndex !== -1) {
                  const tenantIdValue = parseInt(valueArray[idIndex].replace(/'/g, ''));
                  // 只恢复当前租户
                  if (tenantIdValue === tenantId) {
                    await db.execute(statement);
                  }
                }
              } else {
                await db.execute(statement);
              }
            } else {
              // 对于不包含tenant_id字段的表，直接执行
              await db.execute(statement);
            }
          } else if (statement.startsWith('DROP TABLE') || statement.startsWith('CREATE TABLE')) {
            // 跳过表结构操作，只恢复数据
            // 因为我们不想删除和重建表结构，只恢复数据
            console.log('[数据库恢复] 跳过表结构操作:', `${statement.substring(0, 50)}...`);
          } else {
            // 其他类型的语句直接执行
            await db.execute(statement);
          }
        } else {
          // 全库恢复，直接执行所有语句
          await db.execute(statement);
        }
      } catch (error) {
        // 忽略某些错误（如表已存在等）
        if (
          !error.message.includes('already exists') &&
          !error.message.includes('Unknown table') &&
          !error.message.includes('Duplicate entry')
        ) {
          console.warn(`[数据库恢复] SQL语句执行警告: ${error.message}`);
        }
      }
    }
  }

  // 启用外键检查
  await db.execute('SET FOREIGN_KEY_CHECKS=1');
}

/**
 * @swagger
 * /api/backup/{id}:
 *   delete:
 *     tags:
 *       - 数据库备份
 *     summary: 删除备份文件
 *     description: 删除指定的备份文件和记录，只有系统管理员可以执行此操作
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 备份ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 备份不存在
 */
// 删除备份
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // 权限检查：只有系统管理员可以删除备份
    // 超级管理员和系统管理员（租户级）可以执行备份操作
    if (req.user.role !== 'super_admin' && req.user.role !== 'system_admin') {
      return res.status(403).json({
        success: false,
        message: '权限不足，只有系统管理员可以删除备份',
      });
    }

    const { id } = req.params;

    // 获取备份信息
    const [backups] = await db.execute('SELECT * FROM database_backups WHERE id = ?', [id]);

    if (backups.length === 0) {
      return res.status(404).json({
        success: false,
        message: '备份记录不存在',
      });
    }

    const backup = backups[0];

    const backupAccessError = getSystemAdminBackupAccessError(req, backup, '删除');
    if (backupAccessError) {
      return res.status(403).json({
        success: false,
        message: backupAccessError,
      });
    }

    // 删除文件
    try {
      await fsPromises.unlink(backup.file_path);
    } catch (error) {
      // 文件不存在时忽略错误
      if (error.code !== 'ENOENT') {
        console.warn(`[删除备份] 删除文件失败: ${error.message}`);
      }
    }

    // 删除数据库记录
    await db.execute('DELETE FROM database_backups WHERE id = ?', [id]);

    // 记录操作日志
    await logAudit(req, {
      action_type: 'delete',
      module: 'backup',
      resource_type: 'backup',
      resource_id: parseInt(id),
      resource_name: backup.file_name,
      action_description: `删除数据库备份：${backup.file_name}`,
      old_value: backup,
      response_status: 200,
    });

    res.json({
      success: true,
      message: '备份删除成功',
    });
  } catch (error) {
    console.error('删除备份失败:', error);
    res.status(500).json({
      success: false,
      message: '删除备份失败',
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/backup/{id}/download:
 *   get:
 *     tags:
 *       - 数据库备份
 *     summary: 下载备份文件
 *     description: 下载指定的备份文件
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 备份ID
 *     responses:
 *       200:
 *         description: 下载成功
 *       404:
 *         description: 备份文件不存在
 */
// 下载备份文件
router.get(
  '/:id/download',
  authenticate,
  async (req, res, next) => {
    try {
      // 权限检查：只有超级管理员可以下载备份
      // 系统管理员只能恢复备份，不能下载备份文件
      if (!req.user || req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '权限不足，只有超级管理员可以下载备份文件',
        });
      }

      // 继续执行下载逻辑
      next();
    } catch (error) {
      console.error('下载备份认证失败:', error);
      res.status(500).json({
        success: false,
        message: '下载备份失败',
        error: error.message,
      });
    }
  },
  async (req, res) => {
    try {
      const { id } = req.params;

      // 获取备份信息
      const [backups] = await db.execute('SELECT * FROM database_backups WHERE id = ?', [id]);

      if (backups.length === 0) {
        return res.status(404).json({
          success: false,
          message: '备份记录不存在',
        });
      }

      const backup = backups[0];

      // 权限检查：确保系统管理员只能下载自己租户的备份
      if (req.user.role === 'system_admin') {
        if (backup.tenant_id && backup.tenant_id !== req.user.tenant_id) {
          return res.status(403).json({
            success: false,
            message: '权限不足，只能下载自己租户的备份',
          });
        }

        // 系统管理员无法下载全库备份
        if (!backup.tenant_id) {
          return res.status(403).json({
            success: false,
            message: '系统管理员无法下载全库备份',
          });
        }
      }

      // 检查文件是否存在
      try {
        await fsPromises.access(backup.file_path);
      } catch {
        return res.status(404).json({
          success: false,
          message: '备份文件不存在',
        });
      }

      // 获取文件大小
      const stats = await fsPromises.stat(backup.file_path);
      const fileSize = stats.size;

      // 处理文件名编码（支持中文文件名）
      const fileName = backup.file_name;
      // ASCII文件名（兼容旧浏览器）
      const asciiFileName = Buffer.from(fileName, 'utf8')
        .toString('ascii')
        .replace(/[^\x20-\x7E]/g, '_');
      // UTF-8编码的文件名（RFC 5987标准）
      const encodedFileName = encodeURIComponent(fileName);

      // 设置响应头（使用RFC 5987标准支持中文文件名）
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`,
      );
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // 处理范围请求（Range requests）- 支持断点续传和部分内容
      const { range } = req.headers;
      if (range) {
        // 解析范围请求
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;

        // 设置206 Partial Content响应头
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunksize);

        // 创建范围读取流
        const fileStream = fs.createReadStream(backup.file_path, {
          start,
          end,
          highWaterMark: 64 * 1024, // 64KB缓冲区
        });

        fileStream.pipe(res);

        fileStream.on('error', err => {
          console.error(`[范围请求流错误] ${backup.file_name}:`, err.message);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: '读取备份文件失败',
              error: err.message,
            });
          } else {
            res.end();
          }
        });

        fileStream.on('end', () => {
          console.log(`[范围请求完成] ${backup.file_name} (${formatFileSize(chunksize)})`);
        });

        return; // 范围请求处理完成，直接返回
      }

      // 完整文件下载 - 使用流式传输，适合大文件
      const fileStream = fs.createReadStream(backup.file_path, {
        highWaterMark: 64 * 1024, // 64KB缓冲区，提高传输效率
      });

      let isDownloading = false;
      let bytesTransferred = 0;

      // 处理客户端断开连接的情况
      req.on('close', () => {
        if (!isDownloading) {
          // 响应头未发送，客户端提前断开
          console.log(`[下载取消] 客户端在传输开始前取消了下载: ${backup.file_name}`);
          if (fileStream && !fileStream.destroyed) {
            fileStream.destroy();
          }
        } else {
          // 响应头已发送，传输过程中断开
          // 这通常是正常的，因为浏览器开始下载后可能会断开连接
          console.log(
            `[下载中断] 客户端在传输过程中断开: ${backup.file_name} (已传输: ${formatFileSize(bytesTransferred)}/${formatFileSize(fileSize)})`,
          );
          if (fileStream && !fileStream.destroyed) {
            fileStream.destroy();
          }
        }
      });

      // 监听数据流传输进度
      fileStream.on('data', chunk => {
        bytesTransferred += chunk.length;
      });

      // 管道传输文件
      fileStream.pipe(res);
      isDownloading = true;

      // 处理流错误
      fileStream.on('error', err => {
        console.error(`[文件流错误] ${backup.file_name}:`, err.message);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: '读取备份文件失败',
            error: err.message,
          });
        } else {
          // 响应头已发送，只能结束响应
          res.end();
        }
        isDownloading = false;
      });

      // 传输完成
      fileStream.on('end', () => {
        console.log(
          `[下载成功] ${backup.file_name} (${formatFileSize(fileSize)}) - 文件已完全传输`,
        );
        isDownloading = false;
      });

      // 监听响应结束
      res.on('finish', () => {
        console.log(`[下载响应完成] ${backup.file_name} - 响应已发送完成`);
        isDownloading = false;
      });

      // 监听响应错误
      res.on('error', err => {
        console.error(`[响应错误] ${backup.file_name}:`, err.message);
        if (fileStream && !fileStream.destroyed) {
          fileStream.destroy();
        }
        isDownloading = false;
      });
    } catch (error) {
      console.error('下载备份失败:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: '下载备份失败',
          error: error.message,
        });
      }
    }
  },
);

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

// =========================================
// API接口：为表添加tenant_id字段
// =========================================
/**
 * @swagger
 * /api/backup/add-tenant-id:
 *   post:
 *     tags:
 *       - 数据库备份
 *     summary: 为表添加tenant_id字段
 *     description: 为指定的表添加tenant_id字段和索引，支持多租户隔离
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 添加成功
 *       403:
 *         description: 权限不足
 *       500:
 *         description: 添加失败
 */
router.post('/add-tenant-id', authenticate, async (req, res) => {
  try {
    // 权限检查：只有超级管理员可以执行此操作
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: '权限不足，只有超级管理员可以执行此操作',
      });
    }

    console.log('🔍 开始为表添加tenant_id字段...');

    // 需要添加tenant_id字段的表
    const tablesToUpdate = [
      'acceptance_application_signatures',
      'adverse_reaction_attachments',
      'asset_acceptance_files',
      'asset_images',
    ];

    const results = [];

    // 为每个表添加tenant_id字段
    for (const tableName of tablesToUpdate) {
      try {
        // 检查表是否存在tenant_id字段
        const [columns] = await db.execute(`SHOW COLUMNS FROM ${tableName} LIKE 'tenant_id'`);

        if (columns.length > 0) {
          results.push({
            table: tableName,
            status: 'skipped',
            message: 'tenant_id字段已存在',
          });
          continue;
        }

        // 添加tenant_id字段
        await db.execute(
          `ALTER TABLE ${tableName}
           ADD COLUMN IF NOT EXISTS tenant_id INT NULL COMMENT '租户ID',
           ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id)`,
        );

        results.push({
          table: tableName,
          status: 'success',
          message: 'tenant_id字段添加成功',
        });
      } catch (error) {
        results.push({
          table: tableName,
          status: 'error',
          message: error.message,
        });
      }
    }

    console.log('🎉 表字段添加完成！');

    return res.json({
      success: true,
      message: '表字段添加操作已完成',
      data: results,
    });
  } catch (error) {
    console.error('❌ 为表添加tenant_id字段失败:', error);
    return res.status(500).json({
      success: false,
      message: '添加tenant_id字段失败',
      error: error.message,
    });
  }
});

module.exports = router;
