/**
 * 知识库文档解析 + 分块服务
 *
 * 支持格式: txt / md / pdf / docx / doc(尽力)
 * 分块策略: 按段落优先,合并/切分到目标字符数,带重叠
 *
 * 不依赖外部向量库 — 通过关键词命中 + 字符级相似度计算相关性,
 * 适用于小到中型知识库(几千到几万 chunk 量级)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let mammoth;
try { mammoth = require('mammoth'); } catch (e) { mammoth = null; }

let pdfParse;
try { pdfParse = require('pdf-parse'); } catch (e) { pdfParse = null; }

const iconv = require('iconv-lite');

// ============================================
// 文本提取
// ============================================

async function extractText(filePath, ext) {
  const normalizedExt = String(ext || path.extname(filePath) || '').toLowerCase();
  const buffer = fs.readFileSync(filePath);

  try {
    if (normalizedExt === '.pdf') {
      if (!pdfParse) throw new Error('pdf-parse 未安装,无法解析 PDF');
      const data = await pdfParse(buffer);
      return cleanText(data.text || '');
    }

    if (normalizedExt === '.docx') {
      if (!mammoth) throw new Error('mammoth 未安装,无法解析 DOCX');
      const result = await mammoth.extractRawText({ buffer });
      return cleanText(result.value || '');
    }

    if (normalizedExt === '.doc') {
      // .doc 是老格式,纯 Node 环境很难完美解析,这里尽力取 UTF-8 文本
      const text = iconv.encodingExists('utf-8') ? buffer.toString('utf-8') : buffer.toString('binary');
      // 抽 ASCII 可读部分
      const readable = (text.match(/[\x20-\x7E\u4E00-\u9FA5\n\r\t]+/g) || []).join('\n');
      return cleanText(readable);
    }

    if (normalizedExt === '.md' || normalizedExt === '.markdown') {
      return cleanText(buffer.toString('utf-8'));
    }

    if (normalizedExt === '.txt' || normalizedExt === '.log') {
      // 尝试 GBK -> UTF8
      const utf8 = buffer.toString('utf-8');
      if (looksLikeText(utf8)) return cleanText(utf8);
      try {
        const gbk = iconv.decode(buffer, 'gbk');
        if (looksLikeText(gbk)) return cleanText(gbk);
      } catch (e) { /* ignore */ }
      return cleanText(utf8);
    }

    if (normalizedExt === '.html' || normalizedExt === '.htm') {
      const html = buffer.toString('utf-8');
      return cleanText(stripHtml(html));
    }

    // 兜底按 utf-8 文本处理
    return cleanText(buffer.toString('utf-8'));
  } catch (err) {
    throw new Error(`文档解析失败: ${err.message}`);
  }
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function looksLikeText(s) {
  if (!s) return false;
  // 如果含大量 replacement char,认为解码失败
  const bad = (s.match(/\uFFFD/g) || []).length;
  return bad / s.length < 0.01;
}

function cleanText(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================
// 分块
// ============================================

/**
 * 段落优先分块
 * @param {string} text - 已清洗的全文
 * @param {object} options
 *   - chunkSize: 目标块大小(字符)
 *   - chunkOverlap: 块之间重叠字符
 */
function splitIntoChunks(text, options = {}) {
  const chunkSize = Math.max(200, Math.min(2000, options.chunkSize || 600));
  const chunkOverlap = Math.max(0, Math.min(chunkSize / 2, options.chunkOverlap || 80));

  const normalized = String(text || '').trim();
  if (!normalized) return [];

  // 先按段落切
  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const chunks = [];
  let buffer = '';

  const flushBuffer = () => {
    if (!buffer) return;
    const content = buffer.trim();
    if (content) chunks.push(content);
  };

  for (const para of paragraphs) {
    // 单段超长:硬切
    if (para.length > chunkSize) {
      flushBuffer();
      let cursor = 0;
      while (cursor < para.length) {
        const end = Math.min(para.length, cursor + chunkSize);
        chunks.push(para.slice(cursor, end).trim());
        cursor = end - chunkOverlap;
        if (cursor < 0) cursor = end;
      }
      continue;
    }

    // 累积
    if ((buffer + '\n\n' + para).length > chunkSize) {
      flushBuffer();
      // 把上一块末尾的 overlap 拼回去
      if (chunkOverlap > 0 && chunks.length > 0) {
        const tail = chunks[chunks.length - 1].slice(-chunkOverlap);
        buffer = tail + '\n\n' + para;
        if (buffer.length > chunkSize * 1.2) {
          // overlap 后还是过长,丢掉 overlap
          buffer = para;
        }
      } else {
        buffer = para;
      }
    } else {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    }
  }
  flushBuffer();

  return chunks
    .filter(c => c && c.trim().length >= 20) // 过滤太小的碎块
    .map((content, index) => ({
      chunk_index: index,
      content,
      content_length: content.length,
      keywords: extractKeywords(content, 8),
      tokens_estimate: Math.ceil(content.length / 1.6),
    }));
}

// ============================================
// 关键词提取(简易版)
// ============================================

const STOPWORDS = new Set([
  '的', '了', '和', '是', '在', '我', '有', '不', '这', '也', '就', '都', '而', '及',
  '与', '或', '但', '如果', '因为', '所以', 'the', 'a', 'an', 'is', 'are', 'was', 'were',
  'and', 'or', 'but', 'if', 'then', 'this', 'that', 'these', 'those', 'it', 'its', 'to',
  'of', 'in', 'on', 'for', 'with', 'as', 'be', 'by', 'at', 'from', 'can', 'will',
]);

function extractKeywords(text, maxCount = 8) {
  const tokens = String(text || '')
    .replace(/[^\u4E00-\u9FA5a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length >= 2 && !STOPWORDS.has(t));

  if (tokens.length === 0) return [];

  const freq = new Map();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }

  // 中文:相邻两个汉字也作为一个 bigram 关键词候选
  const cnText = String(text || '').match(/[\u4E00-\u9FA5]+/g) || [];
  for (const seg of cnText) {
    if (seg.length < 2) continue;
    for (let i = 0; i < seg.length - 1; i++) {
      const bi = seg.slice(i, i + 2);
      if (STOPWORDS.has(bi)) continue;
      freq.set(bi, (freq.get(bi) || 0) + 0.5);
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([word]) => word);
}

// ============================================
// 检索(简易 BM25 风格)
// ============================================

/**
 * 检索
 * @param {Array<{id, content, keywords, ...}>} chunks
 * @param {string} question
 * @param {object} options - {topK, minScore}
 */
function searchChunks(chunks, question, options = {}) {
  const topK = options.topK || 5;
  const minScore = options.minScore == null ? 0.02 : Number(options.minScore);

  const queryTokens = tokenize(question);
  if (queryTokens.length === 0) return [];

  const scored = chunks.map(chunk => {
    const score = scoreChunk(chunk, queryTokens);
    return { ...chunk, score };
  }).filter(item => item.score >= minScore);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function tokenize(text) {
  const s = String(text || '').toLowerCase();
  const en = s.match(/[a-z0-9]+/g) || [];
  const cn = s.match(/[\u4E00-\u9FA5]+/g) || [];
  const tokens = [...en];
  for (const seg of cn) {
    for (let i = 0; i < seg.length - 1; i++) {
      tokens.push(seg.slice(i, i + 2));
    }
    if (seg.length >= 2) tokens.push(seg);
  }
  return Array.from(new Set(tokens.filter(t => t && t.length >= 1 && !STOPWORDS.has(t))));
}

function scoreChunk(chunk, queryTokens) {
  const content = String(chunk.content || '').toLowerCase();
  const contentTokens = tokenize(content);
  const contentSet = new Set(contentTokens);
  const contentLen = contentTokens.length || 1;

  const keywordSet = new Set(
    (Array.isArray(chunk.keywords) ? chunk.keywords : [])
      .map(k => String(k).toLowerCase())
  );

  let hits = 0;
  let keywordHits = 0;
  for (const t of queryTokens) {
    if (contentSet.has(t)) {
      hits += 1;
    } else if (keywordSet.has(t)) {
      keywordHits += 1;
    } else if (content.includes(t)) {
      // 子串命中给个小分
      hits += 0.3;
    }
  }

  // 加权:关键词命中权重更高
  const tokenScore = (hits + keywordHits * 1.5) / (queryTokens.length || 1);
  // 长度归一化
  const lengthFactor = 1 / (1 + Math.log10(contentLen / 50));
  return tokenScore * lengthFactor;
}

// ============================================
// 文件 hash
// ============================================

function fileHash(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = {
  extractText,
  splitIntoChunks,
  extractKeywords,
  searchChunks,
  tokenize,
  scoreChunk,
  fileHash,
};
