const db = require('../config/database');

async function createTechnicalDocumentsTables() {
  try {
    console.log('开始创建技术资料相关表...');

    // 1. 技术资料表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_documents (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(500) NOT NULL COMMENT '资料标题',
        description TEXT COMMENT '资料描述',
        file_name VARCHAR(500) NOT NULL COMMENT '文件名',
        file_path VARCHAR(1000) NOT NULL COMMENT '文件路径',
        file_type VARCHAR(100) COMMENT '文件类型（MIME类型）',
        file_size BIGINT COMMENT '文件大小（字节）',
        category VARCHAR(100) COMMENT '资料分类（如：使用手册、维修手册、技术规范等）',
        asset_type VARCHAR(100) COMMENT '关联资产类型',
        brand VARCHAR(100) COMMENT '关联品牌',
        model VARCHAR(200) COMMENT '关联型号',
        version VARCHAR(50) COMMENT '版本号',
        language VARCHAR(50) DEFAULT 'zh-CN' COMMENT '语言',
        upload_source ENUM('内部上传', '外部上传') DEFAULT '内部上传' COMMENT '上传来源',
        upload_token VARCHAR(100) COMMENT '外部上传令牌（用于分享链接）',
        token_expires_at DATETIME COMMENT '令牌过期时间',
        uploaded_by VARCHAR(50) COMMENT '上传人',
        upload_date DATETIME COMMENT '上传日期',
        download_count INT DEFAULT 0 COMMENT '下载次数',
        view_count INT DEFAULT 0 COMMENT '查看次数',
        is_public TINYINT(1) DEFAULT 0 COMMENT '是否公开（1=公开，0=仅内部）',
        status ENUM('active', 'archived', 'deleted') DEFAULT 'active' COMMENT '状态',
        remark TEXT COMMENT '备注',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL DEFAULT NULL,
        INDEX idx_category (category),
        INDEX idx_asset_type (asset_type),
        INDEX idx_brand (brand),
        INDEX idx_upload_token (upload_token),
        INDEX idx_status (status),
        INDEX idx_upload_date (upload_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技术资料表';
    `);
    console.log('✅ 技术资料表创建成功');

    // 2. 技术资料下载记录表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_document_downloads (
        id INT PRIMARY KEY AUTO_INCREMENT,
        document_id INT NOT NULL COMMENT '资料ID',
        downloaded_by VARCHAR(50) COMMENT '下载人',
        download_date DATETIME COMMENT '下载日期',
        download_ip VARCHAR(50) COMMENT '下载IP地址',
        user_agent TEXT COMMENT '用户代理',
        INDEX idx_document (document_id),
        INDEX idx_download_date (download_date),
        FOREIGN KEY (document_id) REFERENCES technical_documents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技术资料下载记录表';
    `);
    console.log('✅ 技术资料下载记录表创建成功');

    // 3. 技术资料分享链接表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_document_shares (
        id INT PRIMARY KEY AUTO_INCREMENT,
        document_id INT NOT NULL COMMENT '资料ID',
        share_token VARCHAR(100) NOT NULL UNIQUE COMMENT '分享令牌',
        share_url VARCHAR(500) COMMENT '分享URL',
        expires_at DATETIME COMMENT '过期时间',
        max_uploads INT DEFAULT 1 COMMENT '最大上传次数（用于外部上传）',
        current_uploads INT DEFAULT 0 COMMENT '当前上传次数',
        created_by VARCHAR(50) COMMENT '创建人',
        created_at DATETIME,
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否激活',
        remark TEXT COMMENT '备注',
        INDEX idx_document (document_id),
        INDEX idx_share_token (share_token),
        INDEX idx_expires_at (expires_at),
        FOREIGN KEY (document_id) REFERENCES technical_documents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技术资料分享链接表';
    `);
    console.log('✅ 技术资料分享链接表创建成功');

    console.log('✅ 所有技术资料相关表创建完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 创建表失败:', error);
    process.exit(1);
  }
}

createTechnicalDocumentsTables();
