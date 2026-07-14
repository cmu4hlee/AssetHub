const fs = require('fs');
const path = require('path');

const projectRoot = '/Volumes/移动硬盘（500）/AssetHub';
const outputDir = path.join(projectRoot, '软著申请材料');

const softwareName = 'AssetHost智能资产管理平台';
const version = 'V1.0';
const linesPerPage = 50;
const pagesPerPart = 30;
const totalLinesRequired = linesPerPage * pagesPerPart * 2;

const sourceDirs = [
  { dir: 'frontend/src', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  { dir: 'backend', ext: ['.js'] }
];

const excludeDirs = [
  'node_modules', 'test', 'tests', 'docs', 'scripts', '.git',
  '.claude', 'dist', 'build', '__tests__', 'coverage'
];
const excludeFiles = [
  '.env', '.env.example', '.env.sms', '.env.sms.example',
  '.eslintrc.js', '.prettierrc', 'package.json', 'package-lock.json'
];

const sensitivePatterns = [
  { regex: /(password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key)\s*[:=]\s*['"`][^'"`]+['"`]/gi, replace: '$1: "***"' },
  { regex: /(DB_PASSWORD|DATABASE_URL|JWT_SECRET|REDIS_PASSWORD)\s*=\s*.+/gi, replace: '$1=***' }
];

function shouldInclude(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  for (const dir of excludeDirs) {
    if (normalized.includes(`/${dir}/`)) return false;
  }
  for (const f of excludeFiles) {
    if (normalized.endsWith(`/${f}`) || path.basename(normalized) === f) return false;
  }
  const ext = path.extname(filePath).toLowerCase();
  return sourceDirs.some(s => s.ext.includes(ext));
}

function walk(dir, files) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (excludeDirs.includes(entry.name)) continue;
      walk(fullPath, files);
    } else if (shouldInclude(fullPath)) {
      files.push(fullPath);
    }
  }
}

function collectFiles() {
  const files = [];
  for (const { dir } of sourceDirs) {
    walk(path.join(projectRoot, dir), files);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function desensitize(content) {
  let result = content;
  for (const p of sensitivePatterns) {
    result = result.replace(p.regex, p.replace);
  }
  return result;
}

function buildAllLines(files) {
  const allLines = [];
  for (const file of files) {
    const relativePath = path.relative(projectRoot, file).replace(/\\/g, '/');
    let content;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch (e) {
      continue;
    }
    content = desensitize(content);
    allLines.push(`// ===== FILE: ${relativePath} =====`);
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      allLines.push(line);
    }
    allLines.push('');
  }
  return allLines;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateHtml(lines, totalAvailable) {
  let frontLines, backLines;
  if (totalAvailable <= totalLinesRequired) {
    frontLines = lines;
    backLines = [];
  } else {
    frontLines = lines.slice(0, linesPerPage * pagesPerPart);
    backLines = lines.slice(-linesPerPage * pagesPerPart);
  }

  const pages = [];
  let currentPage = [];

  function flushPage() {
    if (currentPage.length > 0) {
      pages.push([...currentPage]);
      currentPage = [];
    }
  }

  for (const line of frontLines) {
    currentPage.push(line);
    if (currentPage.length >= linesPerPage) {
      flushPage();
    }
  }
  if (backLines.length > 0) {
    flushPage();
    for (const line of backLines) {
      currentPage.push(line);
      if (currentPage.length >= linesPerPage) {
        flushPage();
      }
    }
  }
  flushPage();

  const htmlParts = [];
  htmlParts.push(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${softwareName} 源代码</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: "Courier New", Consolas, monospace; font-size: 10pt; line-height: 1.2; margin: 0; padding: 0; }
  .page { width: 210mm; min-height: 277mm; padding: 15mm; box-sizing: border-box; page-break-after: always; position: relative; }
  .page:last-child { page-break-after: auto; }
  .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 10px; font-family: "SimSun", serif; font-size: 10.5pt; }
  .header .title { font-weight: bold; }
  .code { white-space: pre-wrap; word-break: break-all; }
  .footer { position: absolute; bottom: 10mm; left: 0; right: 0; text-align: center; font-family: "SimSun", serif; font-size: 10pt; }
  .line-num { display: inline-block; width: 30px; color: #666; text-align: right; margin-right: 10px; user-select: none; }
</style>
</head>
<body>`);

  pages.forEach((pageLines, idx) => {
    const pageNo = idx + 1;
    htmlParts.push(`<div class="page">`);
    htmlParts.push(`<div class="header"><span class="title">${softwareName} 源代码</span>　版本：${version}</div>`);
    htmlParts.push(`<div class="code">`);
    pageLines.forEach((line, lineIdx) => {
      const escaped = escapeHtml(line);
      htmlParts.push(`<span class="line-num">${lineIdx + 1}</span>${escaped}`);
    });
    htmlParts.push(`</div>`);
    htmlParts.push(`<div class="footer">第 ${pageNo} 页</div>`);
    htmlParts.push(`</div>`);
  });

  htmlParts.push(`</body></html>`);
  return htmlParts.join('\n');
}

function main() {
  console.log('正在扫描源代码文件...');
  const files = collectFiles();
  console.log(`共扫描到 ${files.length} 个源代码文件`);

  const allLines = buildAllLines(files);
  const totalAvailable = allLines.length;
  console.log(`源代码总行数（含文件标记）：${totalAvailable}`);

  if (totalAvailable < totalLinesRequired) {
    console.log(`注意：源代码不足 ${totalLinesRequired} 行，将提交全部代码。`);
  }

  const html = generateHtml(allLines, totalAvailable);
  const outputPath = path.join(outputDir, '01-源代码.html');
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`已生成：${outputPath}`);
}

main();
