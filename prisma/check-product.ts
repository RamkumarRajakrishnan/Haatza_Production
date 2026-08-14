import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma: any = new PrismaClient({ adapter });

async function main() {
  try {
    const targetId = '76a4d6sc-7527-4946-b258-0d5358c0ac8f';
    const found = await prisma.sellerProduct.findFirst({
      where: {
        OR: [
          { id: targetId },
          { productId: targetId },
          { sku: targetId },
        ],
      },
    });
    console.log('--- FIND PRODUCT RESULT ---');
    console.log(found ? JSON.stringify(found, null, 2) : `Product ${targetId} NOT FOUND in seller_products table!`);

    const count = await prisma.sellerProduct.count();
    console.log('TOTAL PRODUCTS COUNT:', count);

    const firstProduct = await prisma.sellerProduct.findFirst();
    console.log('FIRST PRODUCT IN DB:', firstProduct ? JSON.stringify({ id: firstProduct.id, productId: firstProduct.productId, name: firstProduct.name, sku: firstProduct.sku }, null, 2) : 'NONE');
  } catch (err) {
    console.error('Database query error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
