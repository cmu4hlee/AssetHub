require('dotenv').config({ path: '../.env' });
const db = require('../config/database');

/**
 * 为验收模块添加新表和字段
 */
async function upgradeAcceptanceTables() {
  try {
    console.log('🔄 开始升级验收管理数据库表...');

    const connection = await db.getConnection();

    // 1. 检查并添加 tenant_id 字段到 asset_acceptance_records
    console.log('检查 asset_acceptance_records.tenant_id...');
    const [cols1] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'asset_acceptance_records' AND COLUMN_NAME = 'tenant_id'"
    );
    if (cols1.length === 0) {
      await connection.execute(
        'ALTER TABLE asset_acceptance_records ADD COLUMN tenant_id INT COMMENT "租户ID" AFTER id'
      );
      await connection.execute(
        'ALTER TABLE asset_acceptance_records ADD INDEX idx_tenant_id (tenant_id)'
      );
      console.log('✅ 已添加 tenant_id 字段');
    } else {
      console.log('⏭️  tenant_id 字段已存在');
    }

    // 2. 检查并添加 tenant_id 字段到 asset_acceptance_files
    console.log('检查 asset_acceptance_files.tenant_id...');
    const [cols2] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'asset_acceptance_files' AND COLUMN_NAME = 'tenant_id'"
    );
    if (cols2.length === 0) {
      await connection.execute(
        'ALTER TABLE asset_acceptance_files ADD COLUMN tenant_id INT COMMENT "租户ID" AFTER id'
      );
      await connection.execute(
        'ALTER TABLE asset_acceptance_files ADD INDEX idx_tenant_id (tenant_id)'
      );
      console.log('✅ 已添加 tenant_id 字段到 files 表');
    } else {
      console.log('⏭️  tenant_id 字段已存在');
    }

    // 3. 创建验收检查清单表
    console.log('创建验收检查清单表 (asset_acceptance_checklist)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS asset_acceptance_checklist (
        id INT PRIMARY KEY AUTO_INCREMENT,
        acceptance_id INT NOT NULL COMMENT '验收记录ID',
        tenant_id INT COMMENT '租户ID',
        category VARCHAR(100) NOT NULL COMMENT '检查类别：外观检查、功能测试、配件核对、资料核对、安装验收、安全验收',
        item_name VARCHAR(200) NOT NULL COMMENT '检查项目名称',
        item_description TEXT COMMENT '检查项目描述',
        is_passed TINYINT(1) DEFAULT NULL COMMENT '是否通过：1-通过, 0-不通过, NULL-未检查',
        remark VARCHAR(500) COMMENT '备注',
        checked_by VARCHAR(100) COMMENT '检查人',
        checked_at TIMESTAMP NULL COMMENT '检查时间',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        INDEX idx_acceptance_id (acceptance_id),
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_category (category),
        INDEX idx_is_passed (is_passed)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='验收检查清单表'
    `);
    console.log('✅ 验收检查清单表创建成功');

    // 4. 创建验收检查项模板表
    console.log('创建验收检查项模板表 (asset_acceptance_templates)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS asset_acceptance_templates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT COMMENT '租户ID',
        asset_category VARCHAR(200) COMMENT '适用的资产类别',
        template_name VARCHAR(200) NOT NULL COMMENT '模板名称',
        category VARCHAR(100) NOT NULL COMMENT '检查类别',
        item_name VARCHAR(200) NOT NULL COMMENT '检查项目名称',
        item_description TEXT COMMENT '检查项目描述',
        is_required TINYINT(1) DEFAULT 1 COMMENT '是否必检项',
        sort_order INT DEFAULT 0 COMMENT '排序',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_category (category),
        INDEX idx_asset_category (asset_category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='验收检查项模板表'
    `);
    console.log('✅ 验收检查项模板表创建成功');

    // 5. 插入默认检查项模板
    console.log('插入默认验收检查项模板...');
    const [count] = await connection.execute(
      'SELECT COUNT(*) as cnt FROM asset_acceptance_templates'
    );
    if (count[0].cnt === 0) {
      const defaultTemplates = [
        ['外观检查', '设备外观', '检查设备外观是否完好，有无破损、划痕、变形', 1, 1],
        ['外观检查', '铭牌标识', '检查设备铭牌、标识是否清晰完整', 1, 2],
        ['外观检查', '包装完整性', '检查外包装是否完整，有无受潮、破损', 1, 3],
        ['配件核对', '主机配件', '核对主机配件是否与清单一致', 1, 10],
        ['配件核对', '随机附件', '核对随机附件是否齐全', 1, 11],
        ['配件核对', '工具配件', '检查专用工具配件是否齐全', 0, 12],
        ['资料核对', '产品合格证', '检查产品合格证是否齐全', 1, 20],
        ['资料核对', '使用说明书', '检查使用说明书是否齐全', 1, 21],
        ['资料核对', '保修卡', '检查保修卡是否齐全', 1, 22],
        ['资料核对', '检测报告', '检查出厂检测报告是否齐全', 0, 23],
        ['功能测试', '开机测试', '检查设备是否能正常开机', 1, 30],
        ['功能测试', '基本功能', '测试设备基本功能是否正常', 1, 31],
        ['功能测试', '参数校验', '校验设备运行参数是否符合要求', 1, 32],
        ['安装验收', '安装环境', '检查安装环境是否符合要求', 1, 40],
        ['安装验收', '安装质量', '检查设备安装质量是否达标', 1, 41],
        ['安装验收', '电气安全', '检查电气连接是否安全可靠', 1, 42],
        ['安全验收', '接地保护', '检查设备接地保护是否正常', 1, 50],
        ['安全验收', '警示标识', '检查安全警示标识是否齐全', 1, 51],
        ['安全验收', '防护装置', '检查安全防护装置是否到位', 1, 52],
      ];

      for (const t of defaultTemplates) {
        await connection.execute(
          'INSERT INTO asset_acceptance_templates (tenant_id, asset_category, template_name, category, item_name, item_description, is_required, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [null, null, '通用验收模板', t[0], t[1], t[2], t[3], t[4]]
        );
      }
      console.log(`✅ 已插入 ${defaultTemplates.length} 条默认检查项模板`);
    } else {
      console.log('⏭️  默认检查项模板已存在');
    }

    connection.release();
    console.log('🎉 验收管理数据库表升级完成');
    return true;
  } catch (error) {
    console.error('升级验收管理数据库表失败:', error);
    return false;
  }
}

if (require.main === module) {
  upgradeAcceptanceTables().then(ok => process.exit(ok ? 0 : 1));
}

module.exports = { upgradeAcceptanceTables };
