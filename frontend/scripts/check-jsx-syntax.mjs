#!/usr/bin/env node
// 列出所有 syntax 错误的文件 + 错误行的代码片段
import { parse } from '@babel/parser';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = process.argv[2] || 'src';
const errors = [];
let total = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      walk(full);
    } else if (extname(entry) === '.jsx' || extname(entry) === '.js') {
      total++;
      check(full);
    }
  }
}

function check(file) {
  let code;
  try {
    code = readFileSync(file, 'utf8');
  } catch (e) {
    return;
  }
  try {
    parse(code, {
      sourceType: 'module',
      plugins: ['jsx'],
      errorRecovery: false,
    });
  } catch (e) {
    const lines = code.split('\n');
    const errLine = e.loc?.line || 0;
    const start = Math.max(1, errLine - 2);
    const end = Math.min(lines.length, errLine + 2);
    const context = [];
    for (let i = start; i <= end; i++) {
      const marker = i === errLine ? '>' : ' ';
      context.push(`    ${marker} ${i}: ${lines[i - 1] ?? ''}`);
    }
    errors.push({
      file: relative('.', file),
      line: errLine,
      col: e.loc?.column,
      message: String(e.message).split('\n')[0],
      context: context.join('\n'),
    });
  }
}

walk(ROOT);

console.log(`Scanned ${total} files, ${errors.length} with syntax errors.\n`);
for (const e of errors) {
  console.log(`  ${e.file}:${e.line}:${e.col}  ${e.message}`);
  console.log(e.context);
  console.log('');
}
