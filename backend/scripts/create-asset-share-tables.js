const db = require('../config/database');

async function createAssetShareTables() {
  try {
    console.log('开始创建资产分享链接相关表...');

    // 资产分享链接表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_shares (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT NOT NULL COMMENT '资产ID',
        share_token VARCHAR(100) NOT NULL UNIQUE COMMENT '分享令牌',
        share_url VARCHAR(500) COMMENT '分享URL',
        expires_at DATETIME COMMENT '过期时间',
        max_uploads INT DEFAULT 5 COMMENT '最大上传次数（用于外部上传技术资料）',
        current_uploads INT DEFAULT 0 COMMENT '当前上传次数',
        created_by VARCHAR(50) COMMENT '创建人',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否激活',
        remark TEXT COMMENT '备注（如：厂家工程师姓名、联系方式等）',
        supplier_name VARCHAR(200) COMMENT '供应商/厂家名称',
        supplier_contact VARCHAR(200) COMMENT '供应商联系方式',
        INDEX idx_asset (asset_id),
        INDEX idx_share_token (share_token),
        INDEX idx_expires_at (expires_at),
        INDEX idx_is_active (is_active),
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产分享链接表';
    `);
    console.log('✅ 资产分享链接表创建成功');

    console.log('✅ 所有资产分享链接相关表创建完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 创建表失败:', error);
    process.exit(1);
  }
}

createAssetShareTables();
