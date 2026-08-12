
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing from the .env file');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});
const TOTAL_USERS = 1000;
const TEST_PASSWORD = 'Password@123';

async function main() {
  console.log(`Creating ${TOTAL_USERS} test users...`);

  for (let i = 1; i <= TOTAL_USERS; i += 1) {
    const mobile = `8${String(i).padStart(9, '0')}`;

    await prisma.user.upsert({
      where: {
        mobile,
      },
      update: {
        password: TEST_PASSWORD,
      },
      create: {
        name: `Load Test User ${i}`,
        mobile,
        password: TEST_PASSWORD,
      },
    });

    if (i % 100 === 0) {
      console.log(`${i} users created`);
    }
  }

  console.log('All test users created successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });