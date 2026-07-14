// 加载环境变量
require('dotenv').config({ path: '../.env' });

const db = require('../config/database');

async function createAssetAIAnalysisTables() {
  try {
    console.log('开始创建资产AI分析相关表...');

    // 创建资产AI分析日志表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_ai_analysis_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT COMMENT '资产ID（可选，自定义分析可能没有）',
        dimension VARCHAR(50) COMMENT '分析维度（overview/value/utilization/maintenance/lifecycle/risk/optimization/custom）',
        prompt TEXT NOT NULL COMMENT '用户输入的提示词',
        response TEXT COMMENT 'AI返回的响应',
        sql TEXT COMMENT 'AI生成的SQL语句',
        sql_execution TEXT COMMENT 'SQL执行结果（JSON格式）',
        result_analysis TEXT COMMENT 'AI对结果的分析',
        ai_source VARCHAR(50) COMMENT 'AI模型来源',
        result_analysis_source VARCHAR(50) COMMENT '结果分析AI模型来源',
        user_id INT COMMENT '执行分析的用户ID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        INDEX idx_asset (asset_id),
        INDEX idx_user (user_id),
        INDEX idx_dimension (dimension),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产AI分析日志表';
    `);
    console.log('✅ 资产AI分析日志表创建成功');

    console.log('✅ 所有资产AI分析相关表创建完成！');
  } catch (error) {
    console.error('❌ 创建表失败:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createAssetAIAnalysisTables();
}

module.exports = createAssetAIAnalysisTables;
