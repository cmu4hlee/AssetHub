#!/usr/bin/env node
// 批量修复: 删掉 'Content-Type': 'multipart/form-data' 这种错误的 header 设置
// 原因: 显式设置 multipart/form-data 但不带 boundary,会让后端 multer 解析失败
// 修复: 让 axios 自动处理(axios 看到 FormData 会自动加 boundary)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'api', 'domains');

const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full);
    else if (extname(entry) === '.js') files.push(full);
  }
}
walk(ROOT);

let totalReplacements = 0;
const touchedFiles = new Set();

// 关键认知: 'multipart/form-data' 后面是 '   },' (closing quote, optional ws, }, comma)
// 不是 '  ,' (closing quote, comma)
const targets = [
  // 多行: 整行删除 'Content-Type': 'multipart/form-data',
  {
    re: /^[ \t]*'Content-Type':\s*'multipart\/form-data',[ \t]*\n/gm,
    replace: '',
  },
  {
    re: /^[ \t]*"Content-Type":\s*"multipart\/form-data",[ \t]*\n/gm,
    replace: '',
  },
  // 单行整段: headers: { 'Content-Type': 'multipart/form-data' },
  // 后面是逗号的话也吃掉
  {
    re: /(\s*)headers:\s*\{\s*'Content-Type':\s*'multipart\/form-data'\s*\},?[ \t]*\n/g,
    replace: '',
  },
  {
    re: /(\s*)headers:\s*\{\s*"Content-Type":\s*"multipart\/form-data"\s*\},?[ \t]*\n/g,
    replace: '',
  },
  // 单行多 header: 保留其他 header,只删 'Content-Type': 'multipart/form-data', 部分
  {
    re: /'Content-Type':\s*'multipart\/form-data',\s*/g,
    replace: '',
  },
  {
    re: /"Content-Type":\s*"multipart\/form-data",\s*/g,
    replace: '',
  },
];

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  const orig = content;

  for (const { re, replace } of targets) {
    content = content.replace(re, replace);
  }

  if (content !== orig) {
    const origMatches = (orig.match(/Content-Type.*multipart.form-data/g) || []).length;
    totalReplacements += origMatches;
    touchedFiles.add(file);
    writeFileSync(file, content, 'utf8');
  }
}

console.log(`Files scanned:  ${files.length}`);
console.log(`Files modified: ${touchedFiles.size}`);
console.log(`Replacements:   ${totalReplacements}`);
for (const f of touchedFiles) {
  console.log(`  - ${f.replace(ROOT + '/', '')}`);
}
