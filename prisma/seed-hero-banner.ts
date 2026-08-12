import { PrismaClient, DashboardModule } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function seedHeroBanner() {
  console.log('🌱 Seeding Hero Banner into Dashboard table...');

  const heroBannerData = {
    widgetType: 'hero_banner',
    widgetId: 'hero_banner_widget_01',
    title: 'Test Title',
    subtitle: 'Powered by Coffee + Charcoal',
    status: 'ACTIVE',
    sequence: 1,
    image: 'https://haatza-production-807150947524.asia-south1.run.app/uploads/dashboard/img_coffee_charcoal_banner.png',
    redirectLink: 'Category Page',
    categoryId: 'c6d480e9-52c4-7b1c-c14c-de187bb61f3c',
    productId: 'c6d480e9-52c4-7b1c-c14c-de187bb61f3c',
    mainCategoryId: 'c6d480e9-52c4-7b1c-c14c-de187bb61f3c',
    subCategoryId: 'c6d480e9-52c4-7b1c-c14c-de187bb61f3c',
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
