const db = require('../config/database');

async function enhanceMaintenanceAnalysis() {
  try {
    console.log('开始增强维护效果评估和历史分析功能...');

    // 创建维护效果评估表
    await createMaintenanceEvaluationTable();

    // 创建维护历史分析视图
    await createMaintenanceAnalysisViews();

    // 创建维护效果分析存储过程
    await createMaintenanceAnalysisProcedures();

    console.log('✅ 维护效果评估和历史分析功能增强完成！');
  } catch (error) {
    console.error('❌ 增强维护分析功能失败:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    // 关闭数据库连接
    if (db && typeof db.end === 'function') {
      await db.end();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

// 创建维护效果评估表
async function createMaintenanceEvaluationTable() {
  try {
    console.log('\n📋 创建维护效果评估表...');

    // 维护效果评估表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_evaluations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        maintenance_log_id INT NOT NULL,
        asset_code VARCHAR(50) NOT NULL,
        maintenance_date DATE NOT NULL,
        maintenance_type VARCHAR(50) NOT NULL,
        effectiveness_score INT CHECK (effectiveness_score BETWEEN 1 AND 10),
        problem_resolved BOOLEAN DEFAULT TRUE,
        downtime_hours DECIMAL(10,2) DEFAULT 0,
        production_impact VARCHAR(255),
        technician_skill_score INT CHECK (technician_skill_score BETWEEN 1 AND 10),
        response_time_score INT CHECK (response_time_score BETWEEN 1 AND 10),
        quality_score INT CHECK (quality_score BETWEEN 1 AND 10),
        overall_score INT CHECK (overall_score BETWEEN 1 AND 10),
        evaluation_date DATETIME,
        evaluator VARCHAR(100),
        evaluation_remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        INDEX idx_maintenance_log (maintenance_log_id),
        INDEX idx_asset_code (asset_code),
        INDEX idx_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ 维护效果评估表创建成功');
  } catch (error) {
    console.error('❌ 创建维护效果评估表失败:', error.message);
    throw error;
  }
}

// 创建维护历史分析视图
async function createMaintenanceAnalysisViews() {
  try {
    console.log('\n📋 创建维护历史分析视图...');

    // 资产维护频率分析视图
    await db.execute(`
      CREATE OR REPLACE VIEW asset_maintenance_frequency AS
      SELECT
        tenant_id,
        asset_code,
        asset_name,
        maintenance_type,
        COUNT(*) AS maintenance_count,
        MIN(maintenance_date) AS first_maintenance_date,
        MAX(maintenance_date) AS last_maintenance_date,
        DATEDIFF(MAX(maintenance_date), MIN(maintenance_date)) AS days_between,
        CASE
          WHEN DATEDIFF(MAX(maintenance_date), MIN(maintenance_date)) > 0
          THEN COUNT(*) / (DATEDIFF(MAX(maintenance_date), MIN(maintenance_date)) / 30.44)
          ELSE 0
        END AS monthly_frequency,
        SUM(maintenance_cost) AS total_cost
      FROM maintenance_logs
      GROUP BY tenant_id, asset_code, asset_name, maintenance_type
      ORDER BY maintenance_count DESC
    `);

    // 维护类型分布视图
    await db.execute(`
      CREATE OR REPLACE VIEW maintenance_type_distribution AS
      SELECT
        tenant_id,
        maintenance_type,
        COUNT(*) AS maintenance_count,
        SUM(maintenance_cost) AS total_cost,
        AVG(maintenance_cost) AS avg_cost,
        MAX(maintenance_cost) AS max_cost,
        MIN(maintenance_cost) AS min_cost
      FROM maintenance_logs
      GROUP BY tenant_id, maintenance_type
      ORDER BY maintenance_count DESC
    `);

    // 维护成本趋势视图
    await db.execute(`
      CREATE OR REPLACE VIEW maintenance_cost_trend AS
      SELECT
        tenant_id,
        DATE_FORMAT(maintenance_date, '%Y-%m') AS month,
        COUNT(*) AS maintenance_count,
        SUM(maintenance_cost) AS total_cost,
        AVG(maintenance_cost) AS avg_cost_per_maintenance
      FROM maintenance_logs
      GROUP BY tenant_id, DATE_FORMAT(maintenance_date, '%Y-%m')
      ORDER BY month
    `);

    // 维护人员绩效视图
    await db.execute(`
      CREATE OR REPLACE VIEW maintenance_technician_performance AS
      SELECT
        tenant_id,
        maintenance_person,
        COUNT(*) AS maintenance_count,
        SUM(maintenance_cost) AS total_cost,
        AVG(maintenance_cost) AS avg_cost,
        MAX(maintenance_cost) AS max_cost,
        MIN(maintenance_cost) AS min_cost
      FROM maintenance_logs
      WHERE maintenance_person IS NOT NULL AND maintenance_person != ''
      GROUP BY tenant_id, maintenance_person
      ORDER BY maintenance_count DESC
    `);

    console.log('✅ 维护历史分析视图创建成功');
  } catch (error) {
    console.error('❌ 创建维护分析视图失败:', error.message);
    throw error;
  }
}

// 创建维护效果分析存储过程
async function createMaintenanceAnalysisProcedures() {
  try {
    console.log('\n📋 创建维护效果分析存储过程...');

    // 1. 获取资产维护历史分析
    try {
      await db.execute('DROP PROCEDURE IF EXISTS get_asset_maintenance_analysis');
      await db.execute(`
        CREATE PROCEDURE get_asset_maintenance_analysis(IN p_tenant_id INT, IN p_asset_code VARCHAR(50))
        BEGIN
          SELECT
            m.*,
            e.effectiveness_score,
            e.overall_score,
            e.problem_resolved
          FROM maintenance_logs m
          LEFT JOIN maintenance_evaluations e ON m.id = e.maintenance_log_id
          WHERE m.tenant_id = p_tenant_id AND m.asset_code = p_asset_code
          ORDER BY m.maintenance_date DESC;
        END
      `);
      console.log('✅ 存储过程1创建成功');
    } catch (error) {
      console.warn('⚠️  存储过程1创建失败（可能已存在）:', error.message);
    }

    // 2. 获取维护效果统计
    try {
      await db.execute('DROP PROCEDURE IF EXISTS get_maintenance_effectiveness_stats');
      await db.execute(`
        CREATE PROCEDURE get_maintenance_effectiveness_stats(IN p_tenant_id INT, IN p_start_date DATE, IN p_end_date DATE)
        BEGIN
          SELECT
            maintenance_type,
            COUNT(*) AS total_maintenance,
            SUM(CASE WHEN problem_resolved THEN 1 ELSE 0 END) AS resolved_count,
            ROUND(SUM(CASE WHEN problem_resolved THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) AS resolution_rate,
            AVG(effectiveness_score) AS avg_effectiveness_score,
            AVG(overall_score) AS avg_overall_score,
            SUM(downtime_hours) AS total_downtime
          FROM maintenance_evaluations e
          JOIN maintenance_logs m ON e.maintenance_log_id = m.id
          WHERE e.tenant_id = p_tenant_id
            AND m.maintenance_date BETWEEN p_start_date AND p_end_date
          GROUP BY maintenance_type
          ORDER BY resolution_rate DESC;
        END
      `);
      console.log('✅ 存储过程2创建成功');
    } catch (error) {
      console.warn('⚠️  存储过程2创建失败（可能已存在）:', error.message);
    }

    // 3. 获取维护成本分析
    try {
      await db.execute('DROP PROCEDURE IF EXISTS get_maintenance_cost_analysis');
      await db.execute(`
        CREATE PROCEDURE get_maintenance_cost_analysis(IN p_tenant_id INT, IN p_period VARCHAR(20))
        BEGIN
          IF p_period = 'monthly' THEN
            SELECT
              DATE_FORMAT(maintenance_date, '%Y-%m') AS period,
              COUNT(*) AS maintenance_count,
              SUM(maintenance_cost) AS total_cost,
              SUM(labor_cost) AS labor_cost,
              SUM(material_cost) AS material_cost,
              SUM(external_cost) AS external_cost
            FROM maintenance_logs
            WHERE tenant_id = p_tenant_id
            GROUP BY DATE_FORMAT(maintenance_date, '%Y-%m')
            ORDER BY period;
          ELSEIF p_period = 'quarterly' THEN
            SELECT
              CONCAT(YEAR(maintenance_date), '-Q', QUARTER(maintenance_date)) AS period,
              COUNT(*) AS maintenance_count,
              SUM(maintenance_cost) AS total_cost,
              SUM(labor_cost) AS labor_cost,
              SUM(material_cost) AS material_cost,
              SUM(external_cost) AS external_cost
            FROM maintenance_logs
            WHERE tenant_id = p_tenant_id
            GROUP BY YEAR(maintenance_date), QUARTER(maintenance_date)
            ORDER BY period;
          ELSEIF p_period = 'yearly' THEN
            SELECT
              YEAR(maintenance_date) AS period,
              COUNT(*) AS maintenance_count,
              SUM(maintenance_cost) AS total_cost,
              SUM(labor_cost) AS labor_cost,
              SUM(material_cost) AS material_cost,
              SUM(external_cost) AS external_cost
            FROM maintenance_logs
            WHERE tenant_id = p_tenant_id
            GROUP BY YEAR(maintenance_date)
            ORDER BY period;
          END IF;
        END
      `);
      console.log('✅ 存储过程3创建成功');
    } catch (error) {
      console.warn('⚠️  存储过程3创建失败（可能已存在）:', error.message);
    }

    console.log('✅ 维护效果分析存储过程创建成功');
  } catch (error) {
    console.error('❌ 创建维护分析存储过程失败:', error.message);
    // 不抛出错误，继续执行
  }
}

// 执行增强操作
enhanceMaintenanceAnalysis();
