const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

// Auto-sync database tables (public.users, etc.) on container startup if DATABASE_URL is set
if (process.env.DATABASE_URL) {
  let dbUrl = process.env.DATABASE_URL;

  // Replace invalid/legacy sslmode=no-verify with sslmode=disable
  if (dbUrl.includes('sslmode=no-verify')) {
    dbUrl = dbUrl.replace(/sslmode=no-verify/g, 'sslmode=disable');
  }

  // If SSL is disabled or not explicitly enabled, ensure sslmode=disable parameter is set
  if (process.env.DATABASE_SSL === 'false' || process.env.DATABASE_SSL !== 'true') {
    if (dbUrl.includes('sslmode=')) {
      if (!dbUrl.includes('sslmode=disable')) {
        dbUrl = dbUrl.replace(/sslmode=[^&]+/g, 'sslmode=disable');
      }
    } else {
      const sep = dbUrl.includes('?') ? '&' : '?';
      dbUrl = `${dbUrl}${sep}sslmode=disable`;
    }
  }

  process.env.DATABASE_URL = dbUrl;

  try {
    console.log('Generating Prisma Client & Synchronizing PostgreSQL schema...');
    execSync('npx prisma generate', { stdio: 'inherit', cwd: rootDir });
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', cwd: rootDir });
    console.log('✅ Database schema & Prisma Client synchronized successfully!');
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
