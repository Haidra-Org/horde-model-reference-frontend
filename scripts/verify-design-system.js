#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const requiredPaths = [
  'src/shared/design-system/components/button/index.ts',
  'src/shared/design-system/components/badge/index.ts',
  'src/shared/design-system/primitives/index.css',
];

const missingPaths = requiredPaths.filter((relativePath) => {
  const absolutePath = path.join(repoRoot, relativePath);
  return !fs.existsSync(absolutePath);
});

if (missingPaths.length === 0) {
  process.exit(0);
}

console.error('');
console.error('Design system files are missing.');
console.error(
  'This repository expects the Git submodule at src/shared/design-system to be initialized.',
);
console.error('');
console.error('Missing paths:');
for (const missingPath of missingPaths) {
  console.error(`  - ${missingPath}`);
}
console.error('');
console.error('Run these commands, then retry:');
console.error('  git submodule sync --recursive');
console.error('  git submodule update --init --recursive');
console.error('');

process.exit(1);
