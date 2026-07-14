const db = require('../config/database');

// 初始化资产报废相关数据库表
async function initScrappingTables() {
  try {
    console.log('🔄 开始初始化资产报废相关数据库表...');

    // 1. 资产报废记录表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_scrapping_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        asset_code VARCHAR(50) NOT NULL COMMENT '资产编码',
        asset_name VARCHAR(255) NOT NULL COMMENT '资产名称',
        asset_model VARCHAR(255) COMMENT '资产型号',
        department VARCHAR(100) COMMENT '使用部门',
        applicant VARCHAR(100) NOT NULL COMMENT '申请人',
        applicant_id INT COMMENT '申请人ID',
        apply_date DATETIME NOT NULL COMMENT '申请日期',
        scrapping_reason TEXT NOT NULL COMMENT '报废原因',
        estimated_value DECIMAL(10,2) COMMENT '预估残值',
        current_status VARCHAR(50) NOT NULL DEFAULT 'pending' COMMENT '当前状态: pending, appraising, approved, rejected, disposing, completed',
        appraiser VARCHAR(100) COMMENT '鉴定人',
        appraisal_date DATETIME COMMENT '鉴定日期',
        appraisal_result TEXT COMMENT '鉴定结果',
        approver VARCHAR(100) COMMENT '审批人',
        approval_date DATETIME COMMENT '审批日期',
        approval_comment TEXT COMMENT '审批意见',
        disposer VARCHAR(100) COMMENT '处置人',
        disposal_date DATETIME COMMENT '处置日期',
        disposal_method VARCHAR(100) COMMENT '处置方式',
        disposal_result TEXT COMMENT '处置结果',
        actual_value DECIMAL(10,2) COMMENT '实际残值',
        remark TEXT COMMENT '备注',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at DATETIME NOT NULL COMMENT '更新时间',
        tenant_id INT NOT NULL COMMENT '租户ID',
        INDEX idx_asset_code (asset_code),
        INDEX idx_status (current_status),
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_apply_date (apply_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产报废记录表'
    `);
    console.log('✅ 资产报废记录表创建成功');

    // 2. 资产报废审批表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_scrapping_approvals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scrapping_id INT NOT NULL COMMENT '报废记录ID',
        approver VARCHAR(100) NOT NULL COMMENT '审批人',
        approver_id INT COMMENT '审批人ID',
        approval_level INT NOT NULL DEFAULT 1 COMMENT '审批级别',
        approval_status VARCHAR(50) NOT NULL DEFAULT 'pending' COMMENT '审批状态: pending, approved, rejected',
        approval_comment TEXT COMMENT '审批意见',
        approval_date DATETIME COMMENT '审批日期',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at DATETIME NOT NULL COMMENT '更新时间',
        INDEX idx_scrapping_id (scrapping_id),
        INDEX idx_approval_status (approval_status),
        FOREIGN KEY (scrapping_id) REFERENCES asset_scrapping_records(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产报废审批表'
    `);
    console.log('✅ 资产报废审批表创建成功');

    // 3. 资产报废鉴定表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_scrapping_appraisals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scrapping_id INT NOT NULL COMMENT '报废记录ID',
        appraiser VARCHAR(100) NOT NULL COMMENT '鉴定人',
        appraiser_id INT COMMENT '鉴定人ID',
        appraisal_date DATETIME NOT NULL COMMENT '鉴定日期',
        technical_condition VARCHAR(100) COMMENT '技术状况',
        scrapping_necessity VARCHAR(100) COMMENT '报废必要性',
        estimated_value DECIMAL(10,2) COMMENT '预估残值',
        appraisal_result TEXT NOT NULL COMMENT '鉴定结果',
        appraisal_attachments TEXT COMMENT '鉴定附件',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at DATETIME NOT NULL COMMENT '更新时间',
        INDEX idx_scrapping_id (scrapping_id),
        FOREIGN KEY (scrapping_id) REFERENCES asset_scrapping_records(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产报废鉴定表'
    `);
    console.log('✅ 资产报废鉴定表创建成功');

    // 4. 资产报废处置表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_scrapping_disposals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scrapping_id INT NOT NULL COMMENT '报废记录ID',
        disposer VARCHAR(100) NOT NULL COMMENT '处置人',
        disposer_id INT COMMENT '处置人ID',
        disposal_date DATETIME NOT NULL COMMENT '处置日期',
        disposal_method VARCHAR(100) NOT NULL COMMENT '处置方式',
        disposal_company VARCHAR(255) COMMENT '处置公司',
        actual_value DECIMAL(10,2) COMMENT '实际残值',
        disposal_result TEXT NOT NULL COMMENT '处置结果',
        disposal_attachments TEXT COMMENT '处置附件',
        disposal_certificate VARCHAR(255) COMMENT '处置证明',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at DATETIME NOT NULL COMMENT '更新时间',
        INDEX idx_scrapping_id (scrapping_id),
        FOREIGN KEY (scrapping_id) REFERENCES asset_scrapping_records(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产报废处置表'
    `);
    console.log('✅ 资产报废处置表创建成功');

    // 5. 资产报废文件表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_scrapping_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scrapping_id INT NOT NULL COMMENT '报废记录ID',
        file_type VARCHAR(50) NOT NULL COMMENT '文件类型: application, appraisal, approval, disposal',
        file_name VARCHAR(255) NOT NULL COMMENT '文件名',
        file_path VARCHAR(500) NOT NULL COMMENT '文件路径',
        file_size BIGINT COMMENT '文件大小',
        mime_type VARCHAR(100) COMMENT '文件类型',
        uploaded_by VARCHAR(100) NOT NULL COMMENT '上传人',
        uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
        INDEX idx_scrapping_id (scrapping_id),
        INDEX idx_file_type (file_type),
        FOREIGN KEY (scrapping_id) REFERENCES asset_scrapping_records(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产报废文件表'
    `);
    console.log('✅ 资产报废文件表创建成功');

    // 6. 资产报废统计视图
    await db.execute(`
      CREATE OR REPLACE VIEW asset_scrapping_statistics AS
      SELECT
        current_status,
        COUNT(*) as count,
        SUM(estimated_value) as total_estimated_value,
        SUM(actual_value) as total_actual_value,
        tenant_id
      FROM asset_scrapping_records
      GROUP BY current_status, tenant_id
    `);
    console.log('✅ 资产报废统计视图创建成功');

    console.log('🎉 资产报废相关数据库表初始化完成！');
    return true;
  } catch (error) {
    console.error('❌ 初始化资产报废数据库表失败:', error.message);
    console.error('错误堆栈:', error.stack);
    return false;
  }
}

// 运行初始化
if (require.main === module) {
  initScrappingTables()
    .then(success => {
      if (success) {
        console.log('✅ 初始化完成');
      } else {
        console.log('❌ 初始化失败');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 初始化过程中发生错误:', error);
      process.exit(1);
    });
}

module.exports = initScrappingTables;
