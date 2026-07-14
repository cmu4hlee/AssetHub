/**
 * 文件安全检查中间件
 * 用于检查上传文件的安全性，防止恶意文件上传
 */

const fs = require('fs');
const path = require('path');

/**
 * 危险的文件扩展名列表
 */
const DANGEROUS_EXTENSIONS = [
  // 可执行文件
  '.exe',
  '.dll',
  '.com',
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.bin',
  // 脚本文件
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.php',
  '.asp',
  '.aspx',
  '.jsp',
  '.jspx',
  '.py',
  '.rb',
  '.pl',
  '.cgi',
  '.lua',
  // Web Shell
  '.php3',
  '.php4',
  '.php5',
  '.phtml',
  '.shtml',
  // 配置文件
  '.env',
  '.config',
  '.conf',
  '.ini',
  // 压缩文件（可能包含恶意脚本）
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.bz2',
  // 其他危险文件
  '.class',
  '.jar',
  '.war',
  '.ear',
  '.swf',
  '.fla',
  '.swc',
];

/**
 * 危险的MIME类型列表
 */
const DANGEROUS_MIME_TYPES = [
  // 可执行文件
  'application/x-executable',
  'application/x-msdownload',
  // 脚本文件
  'application/javascript',
  'text/javascript',
  'application/x-php',
  'application/x-perl',
  'application/x-python',
  'application/x-ruby',
  // Web Shell
  'application/x-httpd-php',
  'application/x-httpd-php-source',
  // 配置文件
  'application/x-ini',
  'text/x-ini',
  // 压缩文件
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/gzip',
  'application/x-bzip2',
];

/**
 * 检查文件扩展名是否安全
 * @param {string} fileName - 文件名
 * @returns {boolean} - 是否安全
 */
const isSafeExtension = fileName => {
  const ext = path.extname(fileName).toLowerCase();
  return !DANGEROUS_EXTENSIONS.includes(ext);
};

/**
 * 检查MIME类型是否安全
 * @param {string} mimeType - MIME类型
 * @returns {boolean} - 是否安全
 */
const isSafeMimeType = mimeType => {
  return !DANGEROUS_MIME_TYPES.includes(mimeType);
};

const cleanupUploadedFiles = files => {
  for (const file of files) {
    if (file && file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (_error) {
        void _error;
      }
    }
  }
};

const rejectUpload = (res, files, message) => {
  cleanupUploadedFiles(files);
  return res.status(400).json({
    success: false,
    message,
  });
};

/**
 * 检查文件内容的Magic Bytes，确保文件类型与声明的MIME类型匹配
 * @param {Buffer} fileBuffer - 文件缓冲区
 * @param {string} expectedMimeType - 预期的MIME类型
 * @returns {boolean} - 是否匹配
 */
const checkMagicBytes = (fileBuffer, expectedMimeType) => {
  // 基本的Magic Bytes检查
  const magicBytes = fileBuffer.slice(0, 12);

  // 简单的Magic Bytes检查
  switch (expectedMimeType) {
    case 'image/jpeg':
      return magicBytes.slice(0, 2).toString('hex') === 'ffd8';
    case 'image/png':
      return magicBytes.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
    case 'image/gif':
      return (
        magicBytes.slice(0, 6).toString() === 'GIF87a' ||
        magicBytes.slice(0, 6).toString() === 'GIF89a'
      );
    case 'image/webp':
      return (
        magicBytes.slice(0, 4).toString('hex') === '52494646' &&
        magicBytes.slice(8, 12).toString('hex') === '57454250'
      );
    case 'application/pdf':
      return magicBytes.slice(0, 4).toString('hex') === '25504446';
    case 'application/msword':
      return magicBytes.slice(0, 8).toString('hex') === 'd0cf11e0a1b11ae1';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return magicBytes.slice(0, 4).toString('hex') === '504b0304';
    default:
      // 对于其他类型，默认通过检查
      return true;
  }
};

/**
 * 文件安全检查中间件
 * @param {Object} options - 配置选项
 * @param {boolean} options.checkExtension - 是否检查文件扩展名
 * @param {boolean} options.checkMimeType - 是否检查MIME类型
 * @param {boolean} options.checkMagicBytes - 是否检查Magic Bytes
 * @returns {Function} - Express中间件
 */
const fileSecurity = (options = {}) => {
  const {
    checkExtension = true,
    checkMimeType = true,
    checkMagicBytes: checkMagicBytesFlag = true,
  } = options;

  return (req, res, next) => {
    // 如果没有文件上传，直接通过
    if (!req.files && !req.file) {
      return next();
    }

    // 处理多个文件
    const files = req.files ? Object.values(req.files).flat() : [req.file];

    for (const file of files) {
      const { originalname, mimetype, buffer, path: filePath } = file;

      // 检查文件扩展名
      if (checkExtension && !isSafeExtension(originalname)) {
        const ext = path.extname(originalname).toLowerCase();
        return rejectUpload(res, files, `禁止上传的文件类型: ${ext}`);
      }

      // 检查MIME类型
      if (checkMimeType && !isSafeMimeType(mimetype)) {
        return res.status(400).json({
          success: false,
          message: `禁止上传的MIME类型: ${mimetype}`,
        });
      }

      // 检查Magic Bytes
      if (checkMagicBytesFlag) {
        let fileBuffer = buffer;

        if (!fileBuffer && filePath && fs.existsSync(filePath)) {
          const fd = fs.openSync(filePath, 'r');
          try {
            const headerBuffer = Buffer.alloc(12);
            const bytesRead = fs.readSync(fd, headerBuffer, 0, 12, 0);
            fileBuffer = headerBuffer.slice(0, bytesRead);
          } finally {
            fs.closeSync(fd);
          }
        }

        if (fileBuffer && !checkMagicBytes(fileBuffer, mimetype)) {
          return rejectUpload(res, files, '文件类型不匹配，可能是恶意文件');
        }
      }
    }

    next();
  };
};

module.exports = {
  fileSecurity,
  isSafeExtension,
  isSafeMimeType,
  checkMagicBytes,
  DANGEROUS_EXTENSIONS,
  DANGEROUS_MIME_TYPES,
};
