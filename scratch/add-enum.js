const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS \'SPONSOR\'');
    console.log('Successfully added SPONSOR to UserRole enum in DB!');
  } catch (err) {
    console.error('Error:', err.message);
  }
  await client.end();
}

run();
