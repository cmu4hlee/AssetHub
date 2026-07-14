#!/usr/bin/env node
// 自动修复两类 import 错误:
//  A) `import { useIsMobile } '../hooks';` -> `import { useIsMobile } from '../hooks';`
//  B) antd 多行 import 块未闭合(最后一项以 `,` 结尾,后跟空行/新 import,缺 `} from 'antd';`)
//
// 跑法: node scripts/fix-imports.mjs
import { readFileSync, writeFileSync, readdirSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, extname, relative, dirname } from 'node:path';

const ROOT = join(process.cwd(), 'src');
const BACKUP = join(process.cwd(), 'scripts', 'import-fix-backup');
mkdirSync(BACKUP, { recursive: true });

const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      walk(full);
    } else if (extname(entry) === '.jsx' || extname(entry) === '.js') {
      files.push(full);
    }
  }
}
walk(ROOT);

// ---- Pattern A 修复 ----
// 匹配: import { ... } 'path';   (缺 from)
function fixPatternA(content) {
  // 限制:行首的 import {, 后面跟 }, 紧跟单引号路径
  return content.replace(
    /(^|\n)([ \t]*)(import\s*\{[^}]+\})\s+(['"][^'"]+['"])\s*;/g,
    (m, prefix, indent, head, path) => `${prefix}${indent}${head} from ${path};`
  );
}

// ---- Pattern B 修复 ----
// 找到每个 import { ... } from 'antd'; 块。如果一个 import { 块开始后,在
// 下一个 import 关键字或文件结束前都没找到 } from X; ,则补一个 } from 'antd';
function fixPatternB(content) {
  const lines = content.split('\n');
  const out = [];
  const insertAfter = new Set(); // 行号 -> 要插入的字符串

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 行首(允许前导空白) import {
    const m = /^[ \t]*import\s*\{/.test(line);
    if (!m) {
      out.push(line);
      continue;
    }

    // 单行 import { a, b } from 'x';
    if (/^[ \t]*import\s*\{[^}]*\}\s*from\s+['"][^'"]+['"]\s*;?\s*$/.test(line)) {
      out.push(line);
      continue;
    }

    // 多行 import { 块开始,找对应的 } from
    let j = i;
    let foundEnd = false;
    while (j < lines.length) {
      // 跳过起始行
      const cur = lines[j];
      if (j > i && /^[ \t]*\}\s+from\s+['"][^'"]+['"]\s*;?\s*$/.test(cur)) {
        foundEnd = true;
        break;
      }
      // 遇到另一个 import (不是这个块的延伸) - 说明这个 import 块没闭合
      if (j > i && /^[ \t]*import\s/.test(cur)) {
        break;
      }
      j++;
    }

    if (foundEnd) {
      // 完整块,原样输出
      for (let k = i; k <= j; k++) out.push(lines[k]);
      i = j;
      continue;
    }

    // 未闭合:在 i+1..j-1 之间找以 `,` 结尾的最后一行,把 } from 'antd'; 插在它后面
    let commaEnd = -1;
    for (let k = j - 1; k > i; k--) {
      const t = lines[k].trim();
      if (t === '') continue;
      if (t.endsWith(',')) {
        commaEnd = k;
        break;
      }
      // 找到不以逗号结尾的非空行,说明这是异常情况
      break;
    }
    if (commaEnd === -1) {
      // 找不到合适的逗号行,放弃修复这个块
      out.push(line);
      continue;
    }
    // 把 i..commaEnd 原样输出
    for (let k = i; k <= commaEnd; k++) out.push(lines[k]);
    // 在 commaEnd 后插入闭合
    out.push("} from 'antd';");
    // j 行(空行 + 新 import) 继续
    i = commaEnd;
  }

  return out.join('\n');
}

// ---- 处理每个文件 ----
let fixedFiles = 0;
let totalA = 0;
let totalB = 0;
const errors = [];

for (const file of files) {
  const rel = relative(process.cwd(), file);
  const orig = readFileSync(file, 'utf8');
  let content = orig;

  // Pattern A
  const beforeA = content;
  content = fixPatternA(content);
  if (content !== beforeA) totalA++;

  // Pattern B
  const beforeB = content;
  content = fixPatternB(content);
  if (content !== beforeB) totalB++;

  if (content !== orig) {
    // 备份原文件
    const backupPath = join(BACKUP, rel);
    mkdirSync(dirname(backupPath), { recursive: true });
    copyFileSync(file, backupPath);
    // 写入修复后的内容
    writeFileSync(file, content, 'utf8');
    fixedFiles++;
  }
}

console.log(`Files scanned:  ${files.length}`);
console.log(`Files modified: ${fixedFiles}`);
console.log(`  - Pattern A fixes (missing 'from'): ${totalA}`);
console.log(`  - Pattern B fixes (unclosed antd block): ${totalB}`);
console.log(`Backup dir:      ${relative(process.cwd(), BACKUP)}`);
