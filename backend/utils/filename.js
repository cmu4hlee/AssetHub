/**
 * 纯文件名解码工具——从 multer 的 file.originalname 提取可读文件名。
 *
 * 为什么需要：multer 拿到 multipart 上传的文件名后，浏览器走 latin1 解释中文会乱码；
 * 这里做 latin1→utf8 转换 + replacement ratio 检查 + GBK 编码链 fallback。
 *
 * 跟 utils/text-encoding.js 的 tryDecodeMojibakeText 是互补的：
 *  - tryDecodeMojibakeText 是单值（值里已含 UTF-8 中文但被错误转码）解码
 *  - 本函数是 multer Buffer-from('latin1') 出来的 raw 二进制尝试重新编码
 */

let iconv = null;
try {
  iconv = require('iconv-lite');
} catch (error) {
  iconv = null;
}

const REPLACEMENT_THRESHOLD = 0.3;
const FALLBACK_ENCODINGS = ['gbk', 'gb2312', 'gb18030'];
const CJK_REGEX = /[\u4e00-\u9fa5]/;
const CJK_GLOBAL_REGEX = /[\u4e00-\u9fa5]+/g;
const REPLACEMENT_CHAR_REGEX = /\uFFFD/g;

/**
 * 从 multer 的 file 对象解码出可读文件名。
 * 副作用：无；纯函数。
 * @param {{originalname: string}} file multer 落盘对象
 * @returns {string} 解码后的文件名；解不出就原样返回
 */
function decodeOriginalFileName(file) {
  const original = file && file.originalname;
  if (typeof original !== 'string' || original.length === 0) {
    return original;
  }

  // 已经是中文 → 直接返回
  if (CJK_REGEX.test(original)) {
    return original;
  }

  try {
    const latin1Buffer = Buffer.from(original, 'latin1');
    const utf8Decoded = latin1Buffer.toString('utf8');
    const chineseMatch = utf8Decoded.match(CJK_GLOBAL_REGEX);

    if (chineseMatch && chineseMatch.length > 0) {
      const replacementCount = (utf8Decoded.match(REPLACEMENT_CHAR_REGEX) || []).length;
      const replacementRatio = replacementCount / utf8Decoded.length;
      if (replacementRatio < REPLACEMENT_THRESHOLD) {
        return utf8Decoded;
      }
    }

    if (iconv) {
      for (const encoding of FALLBACK_ENCODINGS) {
        try {
          const decoded = iconv.decode(latin1Buffer, encoding);
          if (CJK_REGEX.test(decoded)) {
            return decoded;
          }
        } catch (_) {
          // ignore — try next encoding
        }
      }
    }
  } catch (_) {
    // ignore
  }

  return original;
}

module.exports = { decodeOriginalFileName };
