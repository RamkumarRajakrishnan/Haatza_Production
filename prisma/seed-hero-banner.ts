import { PrismaClient, DashboardModule } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import 'dotenv/config';

// Initialize Database Connection
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// =========================================================================
// ✏️ EDIT YOUR WIDGET VALUES HERE BEFORE RUNNING SCRIPT
// =========================================================================
const WIDGET_DATA = {
  widgetType: 'deals_zone',
  widgetId: crypto.randomUUID(), // Clean UUID, no prefix
  title: 'Deals Zone',
  subtitle: 'Best Deals of the Day',
  status: 'ACTIVE',
  sequence: 9,
  image: 'https://storage.googleapis.com/haatza-media-bucket/products/c59fbdfd-8b66-4dc9-ad0a-08f9d00a91b2.webp',
  redirectLink: 'Deals Page',
  categoryId: crypto.randomUUID(),
  productId: crypto.randomUUID(),
  mainCategoryId: crypto.randomUUID(),
  subCategoryId: crypto.randomUUID(),
  module: DashboardModule.HAATZA,
};
// =========================================================================

async function seedDashboardWidget() {
  console.log(`🌱 Seeding [${WIDGET_DATA.widgetType}] widget into Dashboard table...`);

  const record = await prisma.dashboard.upsert({
    where: { widgetId: WIDGET_DATA.widgetId },
    update: WIDGET_DATA,
    create: WIDGET_DATA,
  });

  console.log('✅ Dashboard Widget successfully saved to database!');
  console.log(record);
}

seedDashboardWidget()
  .catch((e) => {
    console.error('❌ Error seeding dashboard widget:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
