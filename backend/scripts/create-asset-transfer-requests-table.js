const db = require('../config/database');

async function createAssetTransferRequestsTable() {
  try {
    console.log('开始创建 asset_transfer_requests 表...');

    // 创建资产调配申请表
    // 注意：
    //  - 列名必须为 asset_code（原脚本误写为 asset.code，会导致建表失败）。
    //  - 必须包含 tenant_id，否则所有按租户隔离的查询与插入都会失败。
    //  - 状态枚举固定为 pending / approved / rejected，不存在 completed（审批通过即代表调拨完成）。
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_transfer_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        asset_code VARCHAR(100) NOT NULL COMMENT '资产编号',
        asset_name VARCHAR(200) NOT NULL COMMENT '资产名称',
        current_department VARCHAR(100) NOT NULL COMMENT '当前部门',
        target_department VARCHAR(100) NOT NULL COMMENT '目标部门',
        reason TEXT COMMENT '调配原因',
        applicant VARCHAR(50) NOT NULL COMMENT '申请人',
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '申请状态',
        approved_by VARCHAR(50) COMMENT '审批人',
        approved_at DATETIME COMMENT '审批时间',
        comment TEXT COMMENT '审批意见',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL DEFAULT NULL,
        INDEX idx_tenant (tenant_id),
        INDEX idx_asset_code (asset_code),
        INDEX idx_status (status),
        INDEX idx_applicant (applicant)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产调配申请表'
    `);

    console.log('✓ asset_transfer_requests 表创建成功');

    process.exit(0);
  } catch (error) {
    console.error('创建表失败:', error);
    process.exit(1);
  }
}

createAssetTransferRequestsTable();
