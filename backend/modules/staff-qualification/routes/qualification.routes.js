/**
 * 资质管理路由
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../../middleware/auth');

// 所有路由都需要认证
router.use(authenticate);
const db = require('../../../config/database');

router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const [rows] = await db.execute(
      `SELECT sq.*, u.username, u.real_name 
       FROM staff_qualifications sq
       LEFT JOIN users u ON sq.user_id = u.id
       WHERE sq.tenant_id = ?`,
      [tenantId],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { user_id, qualification_type, qualification_name, expiry_date } = req.body;

    const [result] = await db.execute(
      `INSERT INTO staff_qualifications (tenant_id, user_id, qualification_type, qualification_name, expiry_date)
       VALUES (?, ?, ?, ?, ?)`,
      [tenantId, user_id, qualification_type, qualification_name, expiry_date],
    );

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
