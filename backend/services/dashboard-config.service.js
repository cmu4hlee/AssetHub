const db = require('../config/database');

async function tableExists(name) {
  const [rows] = await db.execute(
    'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [name],
  );
  return rows.length > 0;
}

function tenantClause(alias, tenantId) {
  const prefix = alias ? `${alias}.` : '';
  return tenantId ? ` AND ${prefix}tenant_id = ?` : '';
}

async function getAssetsCount(tenantId) {
  const where = tenantClause('a', tenantId);
  const params = tenantId ? [tenantId] : [];
  const [rows] = await db.execute(
    `SELECT COUNT(*) as total, COALESCE(SUM(a.purchase_price), 0) as total_value
     FROM assets a WHERE 1=1 ${where}`,
    params,
  );
  return rows[0] || { total: 0, total_value: 0 };
}

async function getAssetsByStatus(tenantId) {
  const where = tenantClause('a', tenantId);
  const params = tenantId ? [tenantId] : [];
  const [rows] = await db.execute(
    `SELECT a.status, COUNT(*) as count
     FROM assets a WHERE 1=1 ${where}
     GROUP BY a.status`,
    params,
  );
  return rows;
}

async function getAssetsByDepartment(tenantId) {
  const where = tenantClause('a', tenantId);
  const params = tenantId ? [tenantId] : [];
  const [rows] = await db.execute(
    `SELECT a.department, COUNT(*) as count
     FROM assets a WHERE a.department IS NOT NULL ${where}
     GROUP BY a.department
     ORDER BY count DESC
     LIMIT 10`,
    params,
  );
  return rows;
}

async function getInventoryStats(tenantId) {
  if (!(await tableExists('inventory_records'))) {
    return { total: 0, in_progress: 0, completed: 0, cancelled: 0 };
  }
  const where = tenantClause('ir', tenantId);
  const params = tenantId ? [tenantId] : [];
  const [rows] = await db.execute(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN ir.status = '进行中' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN ir.status = '已完成' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN ir.status = '已取消' THEN 1 ELSE 0 END) as cancelled
     FROM inventory_records ir WHERE 1=1 ${where}`,
    params,
  );
  return rows[0] || { total: 0, in_progress: 0, completed: 0, cancelled: 0 };
}

async function getTransferStats(tenantId) {
  if (!(await tableExists('asset_transfer_requests'))) {
    return { total: 0, pending: 0, approved: 0, rejected: 0 };
  }
  const where = tenantClause('t', tenantId);
  const params = tenantId ? [tenantId] : [];
  const [rows] = await db.execute(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejected
     FROM asset_transfer_requests t WHERE 1=1 ${where}`,
    params,
  );
  return rows[0] || { total: 0, pending: 0, approved: 0, rejected: 0 };
}

async function getIdleCount(tenantId) {
  if (!(await tableExists('idle_assets'))) {
    return { total: 0 };
  }
  const where = tenantClause('ia', tenantId);
  const params = tenantId ? [tenantId] : [];
  const [rows] = await db.execute(
    `SELECT COUNT(*) as total FROM idle_assets ia WHERE 1=1 ${where}`,
    params,
  );
  return rows[0] || { total: 0 };
}

async function getMaintenanceStats(tenantId) {
  if (!(await tableExists('maintenance_logs'))) {
    return { total: 0, in_progress: 0, completed: 0 };
  }
  const where = tenantClause('ml', tenantId);
  const params = tenantId ? [tenantId] : [];
  const [rows] = await db.execute(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN ml.status = '进行中' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN ml.status = '已完成' THEN 1 ELSE 0 END) as completed
     FROM maintenance_logs ml WHERE 1=1 ${where}`,
    params,
  );
  return rows[0] || { total: 0, in_progress: 0, completed: 0 };
}

const dataSources = {
  'assets.count': getAssetsCount,
  'assets.by_status': getAssetsByStatus,
  'assets.by_department': getAssetsByDepartment,
  'inventory.stats': getInventoryStats,
  'transfer.stats': getTransferStats,
  'idle.count': getIdleCount,
  'maintenance.stats': getMaintenanceStats,
};

async function buildDashboardData(config, tenantId) {
  const widgets = Array.isArray(config?.widgets) ? config.widgets : [];
  const results = [];

  for (const widget of widgets) {
    const {source} = widget;
    let data = null;
    if (source && dataSources[source]) {
      data = await dataSources[source](tenantId, widget);
    }
    if (widget.metric && data && typeof data === 'object' && !Array.isArray(data)) {
      data = data[widget.metric];
    }
    results.push({
      id: widget.id,
      type: widget.type,
      title: widget.title,
      source,
      data,
    });
  }

  return { widgets: results };
}

module.exports = {
  buildDashboardData,
};
