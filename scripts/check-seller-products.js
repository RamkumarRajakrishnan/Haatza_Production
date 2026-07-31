const { Client } = require('pg');
require('dotenv').config();

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:Haatza%402025@127.0.0.1:5433/haatza?schema=public';

async function check() {
  const client = new Client({ connectionString });
  await client.connect();

  const countRes = await client.query('SELECT COUNT(*) FROM public.seller_products');
  console.log('\n================ DB VERIFICATION REPORT ================');
  console.log('✅ TOTAL PRODUCTS IN seller_products TABLE:', countRes.rows[0].count);

  const sampleRes = await client.query(
    'SELECT id, product_id, name, brand, price, mrp, status, created_at FROM public.seller_products ORDER BY created_at DESC LIMIT 3',
  );

  console.log('\n--- Top 3 Latest Imported Products in Database ---');
  console.log(JSON.stringify(sampleRes.rows, null, 2));
  console.log('========================================================\n');

  await client.end();
}

check().catch((err) => {
  console.error('Error connecting to DB:', err);
});
