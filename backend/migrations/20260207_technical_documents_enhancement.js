const db = require('../config/database');

async function migrate() {
  console.log('开始创建资料管理增强功能表...');

  try {
    // 1. 创建资料分类表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_document_categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        category_code VARCHAR(50) NOT NULL COMMENT '分类代码',
        category_name VARCHAR(100) NOT NULL COMMENT '分类名称',
        parent_id INT DEFAULT 0 COMMENT '父分类ID',
        description TEXT NULL COMMENT '分类描述',
        icon VARCHAR(50) NULL COMMENT '分类图标',
        sort_order INT DEFAULT 0 COMMENT '排序',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        created_by VARCHAR(50) NULL COMMENT '创建人',
        UNIQUE KEY uk_tenant_code (tenant_id, category_code),
        INDEX idx_parent_id (parent_id),
        INDEX idx_tenant_id (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资料分类表'
    `);
    console.log('✓ 创建 technical_document_categories 表成功');

    // 2. 创建资料标签表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_document_tags (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        tag_name VARCHAR(50) NOT NULL COMMENT '标签名称',
        tag_color VARCHAR(20) DEFAULT '#1890ff' COMMENT '标签颜色',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_tenant_tag (tenant_id, tag_name),
        INDEX idx_tenant_id (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资料标签表'
    `);
    console.log('✓ 创建 technical_document_tags 表成功');

    // 3. 创建资料标签关联表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_document_tag_relations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        document_id INT NOT NULL COMMENT '资料ID',
        tag_id INT NOT NULL COMMENT '标签ID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_doc_tag (document_id, tag_id),
        INDEX idx_document_id (document_id),
        INDEX idx_tag_id (tag_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资料标签关联表'
    `);
    console.log('✓ 创建 technical_document_tag_relations 表成功');

    // 4. 创建资料版本表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_document_versions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        document_id INT NOT NULL COMMENT '资料ID',
        version_number VARCHAR(20) NOT NULL COMMENT '版本号',
        file_path VARCHAR(500) NOT NULL COMMENT '文件路径',
        file_size BIGINT DEFAULT 0 COMMENT '文件大小',
        file_hash VARCHAR(64) NULL COMMENT '文件哈希',
        change_log TEXT NULL COMMENT '版本变更说明',
        created_by VARCHAR(50) NULL COMMENT '创建人',
        created_by_id INT NULL COMMENT '创建人ID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_document_id (document_id),
        INDEX idx_version (document_id, version_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资料版本表'
    `);
    console.log('✓ 创建 technical_document_versions 表成功');

    // 5. 创建资料收藏表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_document_favorites (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '用户ID',
        document_id INT NOT NULL COMMENT '资料ID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_doc (user_id, document_id),
        INDEX idx_user_id (user_id),
        INDEX idx_document_id (document_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资料收藏表'
    `);
    console.log('✓ 创建 technical_document_favorites 表成功');

    // 6. 创建资料访问历史表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_document_history (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '用户ID',
        document_id INT NOT NULL COMMENT '资料ID',
        action_type VARCHAR(20) NOT NULL COMMENT '操作类型: view/download/share/edit',
        ip_address VARCHAR(45) NULL COMMENT 'IP地址',
        user_agent TEXT NULL COMMENT 'User Agent',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_document_id (document_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资料访问历史表'
    `);
    console.log('✓ 创建 technical_document_history 表成功');

    // 7. 创建资料评论表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_document_comments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        document_id INT NOT NULL COMMENT '资料ID',
        user_id INT NOT NULL COMMENT '用户ID',
        user_name VARCHAR(100) NULL COMMENT '用户姓名',
        content TEXT NOT NULL COMMENT '评论内容',
        parent_id INT DEFAULT 0 COMMENT '父评论ID',
        is_resolved TINYINT(1) DEFAULT 0 COMMENT '是否已解决',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        INDEX idx_document_id (document_id),
        INDEX idx_user_id (user_id),
        INDEX idx_parent_id (parent_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资料评论表'
    `);
    console.log('✓ 创建 technical_document_comments 表成功');

    // 8. 创建资料模板表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_document_templates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        template_name VARCHAR(100) NOT NULL COMMENT '模板名称',
        template_description TEXT NULL COMMENT '模板描述',
        category_id INT NULL COMMENT '默认分类ID',
        template_fields TEXT NULL COMMENT '模板字段配置',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        created_by VARCHAR(50) NULL COMMENT '创建人',
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_category_id (category_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资料模板表'
    `);
    console.log('✓ 创建 technical_document_templates 表成功');

    // 9. 创建资料统计表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_document_stats (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        stat_date DATE NOT NULL COMMENT '统计日期',
        total_documents INT DEFAULT 0 COMMENT '资料总数',
        total_downloads INT DEFAULT 0 COMMENT '下载次数',
        total_views INT DEFAULT 0 COMMENT '浏览次数',
        total_shares INT DEFAULT 0 COMMENT '分享次数',
        storage_used BIGINT DEFAULT 0 COMMENT '存储使用量(bytes)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_tenant_date (tenant_id, stat_date),
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_stat_date (stat_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资料统计表'
    `);
    console.log('✓ 创建 technical_document_stats 表成功');

    // 10. 创建资料提醒表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_document_reminders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        document_id INT NOT NULL COMMENT '资料ID',
        user_id INT NOT NULL COMMENT '提醒用户ID',
        reminder_type VARCHAR(20) NOT NULL COMMENT '提醒类型: expiry/update_review',
        reminder_date DATETIME NOT NULL COMMENT '提醒日期',
        message TEXT NULL COMMENT '提醒消息',
        is_sent TINYINT(1) DEFAULT 0 COMMENT '是否已发送',
        sent_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_document_id (document_id),
        INDEX idx_user_id (user_id),
        INDEX idx_reminder_date (reminder_date),
        INDEX idx_is_sent (is_sent)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资料提醒表'
    `);
    console.log('✓ 创建 technical_document_reminders 表成功');

    // 插入默认分类
    const defaultCategories = [
      [1, 'manual', '使用手册', null, '设备使用说明书和操作指南'],
      [1, 'maintenance', '维护手册', null, '设备维护保养指南'],
      [1, 'repair', '维修手册', null, '设备维修指南和技术规范'],
      [1, 'safety', '安全规程', null, '安全操作规程和注意事项'],
      [1, 'warranty', '保修资料', null, '保修卡和保修政策'],
      [1, 'certificate', '证书资质', null, '设备证书和资质文件'],
      [1, 'other', '其他资料', null, '其他技术资料'],
    ];

    for (const [tenantId, code, name, parentId, desc] of defaultCategories) {
      try {
        await db.execute(
          `INSERT INTO technical_document_categories 
           (tenant_id, category_code, category_name, parent_id, description)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE category_name = ?`,
          [tenantId, code, name, parentId || 0, desc, name],
        );
      } catch (e) {
        console.log(`  分类 ${code} 可能已存在`);
      }
    }
    console.log('✓ 插入默认分类成功');

    // 插入默认标签
    const defaultTags = [
      ['重要', '#ff4d4f'],
      ['紧急', '#faad14'],
      ['待审核', '#1890ff'],
      ['已验证', '#52c41a'],
      ['参考', '#722ed1'],
      ['废旧', '#8c8c8c'],
    ];

    for (const [tagName, tagColor] of defaultTags) {
      try {
        await db.execute(
          `INSERT INTO technical_document_tags (tenant_id, tag_name, tag_color)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE tag_color = ?`,
          [1, tagName, tagColor, tagColor],
        );
      } catch (e) {
        console.log(`  标签 ${tagName} 可能已存在`);
      }
    }
    console.log('✓ 插入默认标签成功');

    console.log('\n✅ 资料管理增强功能表创建完成！');
    console.log('\n新表列表:');
    console.log('  - technical_document_categories: 资料分类表');
    console.log('  - technical_document_tags: 资料标签表');
    console.log('  - technical_document_tag_relations: 资料标签关联表');
    console.log('  - technical_document_versions: 资料版本表');
    console.log('  - technical_document_favorites: 资料收藏表');
    console.log('  - technical_document_history: 资料访问历史表');
    console.log('  - technical_document_comments: 资料评论表');
    console.log('  - technical_document_templates: 资料模板表');
    console.log('  - technical_document_stats: 资料统计表');
    console.log('  - technical_document_reminders: 资料提醒表');

  } catch (error) {
    console.error('创建资料管理增强功能表失败:', error);
    throw error;
  }
}

migrate()
  .then(() => {
    console.log('\n迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移失败:', error);
    process.exit(1);
  });
