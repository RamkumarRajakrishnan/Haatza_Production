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
  widgetType: 'top_categories',
  widgetId: crypto.randomUUID(), // Clean UUID, no prefix
  title: 'Top Categories',
  status: 'ACTIVE',
  sequence: 17,
  image: 'https://storage.googleapis.com/haatza-media-bucket/products/4244b4e9-cef1-492a-9193-00dd48ba18d1.webp',
  redirectLink: 'Category Page',
  categoryId: crypto.randomUUID(),
  productId: crypto.randomUUID(),
  mainCategoryId: crypto.randomUUID(),
  subCategoryId: crypto.randomUUID(),
  module: DashboardModule.HAATZA,
};
// =========================================================================

async function seedDashboardWidget() {
  console.log(`🌱 Seeding [${WIDGET_DATA.widgetType}] widget into Dashboard table...`);

  const existing = await prisma.dashboard.findFirst({
    where: { widgetId: WIDGET_DATA.widgetId, module: WIDGET_DATA.module },
  });

  let record;
  if (existing) {
    record = await prisma.dashboard.update({
      where: { id: existing.id },
      data: { 
        widgetType: WIDGET_DATA.widgetType, 
        title: WIDGET_DATA.title, 
        status: WIDGET_DATA.status, 
        sequence: WIDGET_DATA.sequence, 
        categoryId: WIDGET_DATA.categoryId 
      },
    });
  } else {
    record = await prisma.dashboard.create({
      data: { 
        widgetId: WIDGET_DATA.widgetId, 
        widgetType: WIDGET_DATA.widgetType, 
        title: WIDGET_DATA.title, 
        status: WIDGET_DATA.status, 
        sequence: WIDGET_DATA.sequence, 
        categoryId: WIDGET_DATA.categoryId, 
        module: WIDGET_DATA.module 
      },
    });
  }

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
