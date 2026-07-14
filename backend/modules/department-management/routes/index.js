const express = require('express');
const router = express.Router();
const departmentsRouter = require('./departments');

router.use('/', departmentsRouter);

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'department-management module is running', timestamp: new Date().toISOString() });
});

module.exports = router;
