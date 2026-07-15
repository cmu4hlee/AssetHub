/**
 * 知识库模块 - 路由
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { authenticate } = require('../../../middleware/auth');
const { fileSecurity } = require('../../../middleware/fileSecurity');
const ctrl = require('../controllers/knowledge-base.controller');

// 文件存储
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadPath = path.join(__dirname, '../../../uploads/knowledge-base');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename(req, file, cb) {
    const ts = Date.now();
    const rand = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname) || '';
    cb(null, `${ts}-${rand}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.pdf', '.docx', '.doc', '.txt', '.md', '.markdown', '.log', '.html', '.htm'];
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${ext || file.mimetype}。支持: ${allowedExts.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 }, // 50MB
});

const handleMulterError = (err, req, res, next) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '文件大小不能超过 50MB' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

// ---------- 知识库 CRUD ----------
router.get('/knowledge-bases', authenticate, ctrl.listKnowledgeBases);
router.post('/knowledge-bases', authenticate, ctrl.createKnowledgeBase);
router.get('/knowledge-bases/:id', authenticate, ctrl.getKnowledgeBase);
router.put('/knowledge-bases/:id', authenticate, ctrl.updateKnowledgeBase);
router.delete('/knowledge-bases/:id', authenticate, ctrl.deleteKnowledgeBase);

// ---------- 文档 ----------
router.get('/documents', authenticate, ctrl.listDocuments);
router.get('/documents/:id', authenticate, ctrl.getDocument);
router.post(
  '/documents/upload',
  authenticate,
  upload.single('file'),
  handleMulterError,
  fileSecurity(),
  ctrl.uploadDocument
);
router.put('/documents/:id', authenticate, ctrl.updateDocument);
router.delete('/documents/:id', authenticate, ctrl.deleteDocument);
router.post('/documents/:id/reparse', authenticate, ctrl.reparseDocument);
router.get('/documents/:id/download', authenticate, ctrl.downloadDocument);

// ---------- 检索 / 问答 ----------
router.post('/search', authenticate, ctrl.search);
router.post('/ask', authenticate, ctrl.ask);
router.post('/ask-stream', authenticate, ctrl.askStream);

// ---------- 问答记录 ----------
router.get('/qa-records', authenticate, ctrl.listQaRecords);

// ---------- 设置 ----------
router.get('/settings', authenticate, ctrl.getSettings);
router.put('/settings', authenticate, ctrl.updateSettings);

module.exports = router;
