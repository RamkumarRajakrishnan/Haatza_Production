import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting Category Master migration from public.dashboard...');

  try {
    // 1. Fetch distinct categories from public.dashboard
    const rawCategories: any[] = await prisma.$queryRaw`
      SELECT DISTINCT 
        TRIM(category_id) AS "rawCategoryId",
        TRIM(category_name) AS "categoryName",
        module::text AS module
      FROM public.dashboard
      WHERE category_id IS NOT NULL 
        AND TRIM(category_id) != ''
        AND category_id != 'null'
    `;

    console.log(`Found ${rawCategories.length} category entries in public.dashboard.`);

    // 2. Fetch existing max CATxxx suffix
    const existingMaster = await prisma.categoryMaster.findMany({
      where: { categoryId: { startsWith: 'CAT' } },
      select: { categoryId: true, categoryName: true, module: true },
    });

    let maxNum = 0;
    existingMaster.forEach((r) => {
      const match = r.categoryId.match(/^CAT(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    let migratedCount = 0;

    for (const entry of rawCategories) {
      const catName = entry.categoryName || entry.rawCategoryId || 'General Category';
      const mod = entry.module === 'LITE' ? 'LITE' : 'HAATZA';

      // Check if category already exists in category_master by name & module
      let existing = await prisma.categoryMaster.findFirst({
        where: {
          categoryName: { equals: catName, mode: 'insensitive' },
          module: { in: [mod as any, 'ALL'] },
        },
      });

      if (!existing) {
        maxNum++;
        const newCatId = `CAT${String(maxNum).padStart(3, '0')}`;

        existing = await prisma.categoryMaster.create({
          data: {
            categoryId: newCatId,
            categoryName: catName,
            categoryType: 'MAIN_CATEGORY',
            module: mod as any,
            status: 'ACTIVE',
            sequence: maxNum,
            description: `Auto-migrated from dashboard category ${entry.rawCategoryId}`,
          },
        });

        console.log(`✅ Created CategoryMaster record: ${newCatId} -> ${catName} (${mod})`);
        migratedCount++;
      }

      // Update public.dashboard category_id reference to match CategoryMaster category_id
      if (entry.rawCategoryId !== existing.categoryId) {
        await prisma.$executeRaw`
          UPDATE public.dashboard 
          SET category_id = ${existing.categoryId},
              category_name = ${existing.categoryName}
          WHERE category_id = ${entry.rawCategoryId}
        `;
        console.log(`🔄 Updated dashboard category_id reference: ${entry.rawCategoryId} -> ${existing.categoryId}`);
      }
    }

    console.log(`\n🎉 Migration finished! Migrated ${migratedCount} new categories to CategoryMaster.`);
    
    // Print all CategoryMaster records
    const finalMaster = await prisma.categoryMaster.findMany({
      orderBy: { sequence: 'asc' },
    });
    console.log('\n--- CURRENT CATEGORY MASTER TABLE ---');
    console.table(
      finalMaster.map((c) => ({
        ID: c.id,
        CategoryID: c.categoryId,
        Name: c.categoryName,
        Type: c.categoryType,
        Module: c.module,
        Status: c.status,
      })),
    );
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
