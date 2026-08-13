import { Client } from 'pg';
import * as crypto from 'crypto';
import 'dotenv/config';

async function run() {
  console.log('🌱 Connecting directly to PostgreSQL via pg driver...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('✅ Successfully connected to database server!');

    const query = `
      INSERT INTO "dashboard" (
        "id", "widget_type", "widget_id", "title", "subtitle", "status", "sequence",
        "image", "redirect_link", "category_id", "product_id", "main_category_id",
        "sub_category_id", "module", "created_at", "updated_at"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::public."DashboardModule", NOW(), NOW()
      )
      ON CONFLICT ("widget_id") DO UPDATE SET
        "title" = EXCLUDED."title",
        "subtitle" = EXCLUDED."subtitle",
        "status" = EXCLUDED."status",
        "sequence" = EXCLUDED."sequence",
        "image" = EXCLUDED."image",
        "redirect_link" = EXCLUDED."redirect_link",
        "updated_at" = NOW()
      RETURNING *;
    `;

    const values = [
      crypto.randomUUID(),
      'hero_banner',
      'hero_banner_widget_01',
      'Coffee & Charcoal Banner',
      'Powered by Coffee + Charcoal',
      'ACTIVE',
      1,
      'https://storage.googleapis.com/haatza-media-bucket/products/ca2360b6-d63b-42d2-a7c9-0fd5c9a1d9b1.webp',
      'Category Page',
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      'HAATZA',
    ];

    const res = await client.query(query, values);
    console.log('🎉 Successfully seeded hero banner into Dashboard table!');
    console.log(res.rows[0]);
  } catch (err: any) {
    console.error('❌ Error seeding database:', err.message || err);
  } finally {
    await client.end();
  }
}

run();
