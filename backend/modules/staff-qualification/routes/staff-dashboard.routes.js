const express = require('express');
const db = require('../../../config/database');

module.exports = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const isSuperAdmin = req.user.role === 'super_admin';

    let tenantWhere = '';
    const params = [];
    if (!isSuperAdmin && tenantId) {
      tenantWhere = ' AND tenant_id = ?';
      params.push(tenantId);
    }

    const [qualStats] = await db.execute(
      `SELECT qualification_type, COUNT(*) as count 
       FROM staff_qualifications 
       WHERE status IN ('active')${tenantWhere}
       GROUP BY qualification_type`,
      params,
    );

    const expiringParams = [...params];
    const [expiring] = await db.execute(
      `SELECT COUNT(*) as count 
       FROM staff_qualifications 
       WHERE status IN ('active')${tenantWhere}
       AND expiry_date IS NOT NULL
       AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)`,
      expiringParams,
    );

    const expiredParams = [...params];
    const [expired] = await db.execute(
      `SELECT COUNT(*) as count 
       FROM staff_qualifications 
       WHERE expiry_date IS NOT NULL
       AND expiry_date < CURDATE()${tenantWhere}`,
      expiredParams,
    );

    const totalParams = [...params];
    const [total] = await db.execute(
      `SELECT COUNT(*) as count 
       FROM staff_qualifications 
       WHERE 1=1${tenantWhere}`,
      totalParams,
    );

    res.json({
      success: true,
      data: {
        qualification_stats: qualStats,
        expiring_count: expiring[0].count,
        expired_count: expired[0].count,
        total_count: total[0].count,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
