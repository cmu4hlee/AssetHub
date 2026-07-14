const express = require('express');
const router = express.Router();
const usersRouter = require('./users');

router.use('/', usersRouter);

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'user-management module is running', timestamp: new Date().toISOString() });
});

module.exports = router;
