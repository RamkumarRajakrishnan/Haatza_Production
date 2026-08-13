import { PrismaClient, DashboardModule } from '@prisma/client';
import * as crypto from 'crypto';
import 'dotenv/config';

const prisma = new PrismaClient();

async function seedHeroBanner() {
  console.log('🌱 Seeding Hero Banner into Dashboard table...');

  const heroBannerData = {
    widgetType: 'hero_banner',
    widgetId: 'hero_banner_widget_01',
    title: 'Hero Banner',
    subtitle: 'Powered by Coffee + Charcoal',
    status: 'ACTIVE',
    sequence: 1,
    image: 'https://storage.googleapis.com/haatza-media-bucket/products/ca2360b6-d63b-42d2-a7c9-0fd5c9a1d9b1.webp',
    redirectLink: 'Category Page',
    categoryId: crypto.randomUUID(),
    productId: crypto.randomUUID(),
    mainCategoryId: crypto.randomUUID(),
    subCategoryId: crypto.randomUUID(),
    module: DashboardModule.HAATZA,
  };

  const record = await prisma.dashboard.upsert({
    where: { widgetId: heroBannerData.widgetId },
    update: heroBannerData,
    create: heroBannerData,
  });

  console.log('✅ Hero Banner successfully saved to database!');
  console.log(record);
}

seedHeroBanner()
  .catch((e) => {
    console.error('❌ Error seeding hero banner:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
