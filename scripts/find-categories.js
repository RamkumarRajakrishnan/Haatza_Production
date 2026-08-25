const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

async function check() {
  const client = new Client({ connectionString });
  await client.connect();

  const categories = await client.query('SELECT category_id, category_name FROM public.category_master LIMIT 5');
  console.log('Valid Categories in database:', categories.rows);

  await client.end();
}

check().catch((err) => {
  console.error('Error:', err);
});
