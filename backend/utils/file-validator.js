
/**
 * 文件验证工具
 * 提供安全的文件上传验证功能
 */

const ALLOWED_EXTENSIONS = new Set([
  // 文档类型
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'rtf', 'odt', 'ods', 'odp',
  // 图片类型
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp',
  // 压缩文件
  'zip', 'rar', '7z',
  // 其他安全格式
  'csv', 'json', 'xml',
]);

const ALLOWED_MIME_TYPES = new Set([
  // PDF
  'application/pdf',
  // Microsoft Office
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // 文档
  'text/plain', 'text/rtf', 'text/csv', 'text/xml',
  // OpenDocument
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  // 图片
  'image/jpeg', 'image/png', 'image/gif', 'image/bmp',
  'image/svg+xml', 'image/webp',
  // 压缩文件
  'application/zip', 'application/x-rar-compressed',
  'application/x-7z-compressed',
  // 其他
  'application/json', 'application/xml',
]);

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB

class FileValidator {
  /**
   * 验证文件
   * @param {Object} file - multer 文件对象
   * @param {Object} options - 验证选项
   * @returns {Object} - 验证结果 { valid: boolean, message: string }
   */
  static validate(file, options = {}) {
    if (!file) {
      return { valid: false, message: '文件不能为空' };
    }

    const {
      allowedExtensions = ALLOWED_EXTENSIONS,
      allowedMimeTypes = ALLOWED_MIME_TYPES,
      maxSize = DEFAULT_MAX_SIZE,
    } = options;

    // 验证文件大小
    if (file.size > maxSize) {
      const sizeMB = (maxSize / 1024 / 1024).toFixed(1);
      return {
        valid: false,
        message: `文件大小不能超过 ${sizeMB}MB`,
      };
    }

    // 验证文件扩展名
    if (!this.validateExtension(file.originalname, allowedExtensions)) {
      return {
        valid: false,
        message: `不允许的文件类型，请使用以下格式: ${Array.from(allowedExtensions).join(', ')}`,
      };
    }

    // 验证MIME类型
    if (!this.validateMimeType(file.mimetype, allowedMimeTypes)) {
      return {
        valid: false,
        message: `不允许的文件MIME类型: ${file.mimetype}`,
      };
    }

    return { valid: true, message: '文件验证通过' };
  }

  /**
   * 验证文件扩展名
   * @param {string} filename - 文件名
   * @param {Set} allowedExtensions - 允许的扩展名集合
   * @returns {boolean}
   */
  static validateExtension(filename, allowedExtensions = ALLOWED_EXTENSIONS) {
    const ext = filename.toLowerCase().split('.').pop();
    return allowedExtensions.has(ext);
  }

  /**
   * 验证MIME类型
   * @param {string} mimeType - MIME类型
   * @param {Set} allowedMimeTypes - 允许的MIME类型集合
   * @returns {boolean}
   */
  static validateMimeType(mimeType, allowedMimeTypes = ALLOWED_MIME_TYPES) {
    return allowedMimeTypes.has(mimeType);
  }

  /**
   * 获取安全的文件扩展名
   * @param {string} filename - 文件名
   * @returns {string} - 安全的扩展名
   */
  static getSafeExtension(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      return ext;
    }
    return 'dat'; // 默认扩展名
  }

  /**
   * 生成安全的文件名
   * @param {string} originalName - 原始文件名
   * @param {string} prefix - 前缀（可选）
   * @returns {string} - 安全的文件名
   */
  static generateSafeFilename(originalName, prefix = '') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 8);
    const ext = this.getSafeExtension(originalName);

    const safeName = originalName
      .replace(/[^\w.\u4e00-\u9fa5-]/g, '_') // 保留中文、英文、数字、下划线、连字符、点
      .replace(/\s+/g, '_'); // 空格替换为下划线

    const baseName = safeName.includes('.')
      ? safeName.substring(0, safeName.lastIndexOf('.'))
      : safeName;

    return `${prefix ? `${prefix  }_` : ''}${baseName}_${timestamp}_${random}.${ext}`;
  }
}

module.exports = {
  FileValidator,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  DEFAULT_MAX_SIZE,
};
