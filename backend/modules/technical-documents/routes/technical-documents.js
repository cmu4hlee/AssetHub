const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { authenticate } = require('../../../middleware/auth');
const { fileSecurity } = require('../../../middleware/fileSecurity');
const docController = require('../controllers/technical-document.controller');

// 文件存储配置
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadPath = path.join(__dirname, '../../../uploads/technical-documents');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename(req, file, cb) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const uuidFragment = crypto.randomBytes(4).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}-${random}-${uuidFragment}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/octet-stream',
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.md', '.zip', '.rar', '.7z', '.jpg', '.jpeg', '.png', '.gif',
  ];

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}。只支持常见文档和图片格式。`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 1,
  },
});

// multer 错误处理中间件
const handleMulterError = (err, req, res, next) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '文件大小不能超过100MB' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: '最多上传1个文件' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

router.get('/', authenticate, (req, res) => docController.getDocuments(req, res));
router.get('/categories', authenticate, (req, res) => docController.getCategories(req, res));
router.get('/pending', authenticate, (req, res) => docController.getPendingDocuments(req, res));
router.get('/:id', authenticate, (req, res) => docController.getDocumentById(req, res));
router.post('/', authenticate, upload.single('file'), handleMulterError, fileSecurity(), (req, res) => docController.createDocument(req, res));
router.put('/:id', authenticate, (req, res) => docController.updateDocument(req, res));
router.delete('/:id', authenticate, (req, res) => docController.deleteDocument(req, res));
router.get('/:id/file', authenticate, (req, res) => docController.downloadDocument(req, res));
router.post('/:id/review', authenticate, (req, res) => docController.reviewDocument(req, res));
router.post('/:id/share', authenticate, (req, res) => docController.createShare(req, res));
router.get('/:id/shares', authenticate, (req, res) => docController.getShares(req, res));
router.delete('/shares/:shareId', authenticate, (req, res) => docController.deleteShare(req, res));

router.get('/upload/:token', (req, res) => docController.verifyUploadToken(req, res));
router.post('/upload/:token', (req, res) => docController.externalUpload(req, res));

router.get('/assets/:assetIdOrCode', authenticate, (req, res) => docController.getAssetDocuments(req, res));
router.post('/assets/:assetIdOrCode/link/:documentId', authenticate, (req, res) => docController.linkDocumentToAsset(req, res));
router.delete('/assets/:assetIdOrCode/link/:documentId', authenticate, (req, res) => docController.unlinkDocumentFromAsset(req, res));

module.exports = router;
