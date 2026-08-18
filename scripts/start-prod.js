const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

// Auto-sync database tables (public.users, etc.) on container startup if DATABASE_URL is set
if (process.env.DATABASE_URL) {
  try {
    console.log('Generating Prisma Client in start-prod.js...');
    execSync('npx prisma generate', { stdio: 'inherit', cwd: rootDir });
    console.log('Synchronizing PostgreSQL schema with Database...');
    execSync('npx prisma db push', { stdio: 'inherit', cwd: rootDir });
    console.log('✅ Database schema synchronized successfully!');
  } catch (err) {
    console.warn('⚠️ Warning: Prisma sync encountered an issue:', err.message || err);
  }
}

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
