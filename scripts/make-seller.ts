import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing.');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'employee@haatza.com';

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('User not found!');
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { email },
    data: {
      isSeller: true,
      sellerId: user.sellerId || 'TEST_SELLER_123', // Assign a seller ID so they can own products
    }
  });

  console.log(`✅ User ${updatedUser.email} is now a Seller!`);
  console.log(`Their Seller ID is: ${updatedUser.sellerId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
