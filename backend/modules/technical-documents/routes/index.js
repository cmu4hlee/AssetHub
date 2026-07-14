const express = require('express');
const router = express.Router();
const technicalDocumentsRouter = require('./technical-documents');

router.use('/', technicalDocumentsRouter);

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'technical-documents module is running', timestamp: new Date().toISOString() });
});

module.exports = router;
