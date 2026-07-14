/**
 * 为 technical_document_shares 表添加 tenant_id 字段和索引
 */

const db = require('../config/database');

async function addTenantIdToTechnicalDocumentShares() {
  try {
    console.log('开始为 technical_document_shares 表添加 tenant_id 字段...');

    // 检查表是否存在
    try {
      await db.execute('SELECT 1 FROM technical_document_shares LIMIT 1');
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('⚠️ technical_document_shares 表不存在，跳过添加字段');
        process.exit(0);
      } else {
        throw error;
      }
    }

    // 检查 tenant_id 字段是否已存在
    try {
      const [columns] = await db.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'technical_document_shares' AND COLUMN_NAME = 'tenant_id'",
      );
      if (columns.length > 0) {
        console.log('✅ tenant_id 字段已存在，跳过添加');
      } else {
        // 添加 tenant_id 字段
        await db.execute(`
          ALTER TABLE technical_document_shares 
          ADD COLUMN tenant_id INT NOT NULL COMMENT '租户ID' AFTER id
        `);
        console.log('✅ tenant_id 字段添加成功');

        // 添加索引
        await db.execute(`
          ALTER TABLE technical_document_shares 
          ADD INDEX idx_tenant_id (tenant_id)
        `);
        console.log('✅ tenant_id 索引添加成功');

        // 添加外键约束
        try {
          await db.execute(`
            ALTER TABLE technical_document_shares 
            ADD CONSTRAINT fk_technical_document_shares_tenant 
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
          `);
          console.log('✅ 外键约束添加成功');
        } catch (fkError) {
          if (fkError.code === 'ER_DUP_KEY' || fkError.code === 'ER_CANNOT_ADD_FOREIGN') {
            console.warn('⚠️ 外键约束可能已存在或添加失败，继续执行');
          } else {
            throw fkError;
          }
        }
      }
    } catch (error) {
      console.error('❌ 检查或添加字段失败:', error);
      throw error;
    }

    // 更新现有记录的 tenant_id（从关联的文档获取）
    try {
      await db.execute(`
        UPDATE technical_document_shares tds
        INNER JOIN technical_documents td ON tds.document_id = td.id
        SET tds.tenant_id = td.tenant_id
        WHERE tds.tenant_id IS NULL AND td.tenant_id IS NOT NULL
      `);
      console.log('✅ 已更新现有记录的 tenant_id（从关联文档获取）');
    } catch (updateError) {
      console.warn('⚠️ 更新现有记录失败:', updateError.message);
    }

    console.log('✅ technical_document_shares 表 tenant_id 字段添加完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 添加 tenant_id 字段失败:', error);
    process.exit(1);
  }
}

// 执行脚本
addTenantIdToTechnicalDocumentShares();
