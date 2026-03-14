#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { check } from './index';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: zobr-check <file.zobr> [file2.zobr ...]');
  console.log('       zobr-check examples/*.zobr');
  process.exit(0);
}

let totalErrors = 0;
let totalWarnings = 0;
let totalFiles = 0;

for (const arg of args) {
  const filePath = path.resolve(arg);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${arg}`);
    totalErrors++;
    continue;
  }

  const source = fs.readFileSync(filePath, 'utf-8');
  const result = check(source);
  totalFiles++;

  const errors = result.diagnostics.filter(d => d.severity === 'error');
  const warnings = result.diagnostics.filter(d => d.severity === 'warning');
  totalErrors += errors.length;
  totalWarnings += warnings.length;

  if (result.diagnostics.length === 0) {
    console.log(`\x1b[32m✓\x1b[0m ${arg}`);
  } else {
    console.log(`\x1b[${errors.length > 0 ? '31' : '33'}m✗\x1b[0m ${arg}`);
    for (const d of result.diagnostics) {
      const loc = d.location ? `:${d.location.start.line}:${d.location.start.column}` : '';
      const color = d.severity === 'error' ? '31' : '33';
      const label = d.severity === 'error' ? 'ERROR' : 'WARN';
      console.log(`  \x1b[${color}m${label}\x1b[0m${loc} ${d.message}`);
    }
  }
}

console.log(`\n${totalFiles} file(s): ${totalErrors} error(s), ${totalWarnings} warning(s)`);
process.exit(totalErrors > 0 ? 1 : 0);
