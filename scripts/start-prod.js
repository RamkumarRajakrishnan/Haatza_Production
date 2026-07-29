const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const candidates = [
  path.join(rootDir, 'dist', 'src', 'main.js'),
  path.join(rootDir, 'dist', 'main.js'),
  path.join(rootDir, 'dist', 'src', 'main'),
  path.join(rootDir, 'dist', 'main'),
];

let entryPoint = null;
for (const cand of candidates) {
  if (fs.existsSync(cand)) {
    entryPoint = cand;
    break;
  }
}

if (!entryPoint) {
  console.error('CRITICAL: Could not locate compiled entrypoint in dist folder!');
  console.error('Checked candidates:', candidates);
  process.exit(1);
}

console.log('Starting application from:', entryPoint);
require(entryPoint);
