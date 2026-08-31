import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
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
  const plainPassword = 'password123';
  
  // Hash the password with bcrypt (standard 10 rounds)
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    console.log('User already exists! Updating their password and role...');
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        role: UserRole.EMPLOYEE,
        isEmployee: true,
        isSeller: false,
        isBuyer: false
      }
    });
    console.log(`Updated employee user: ${updatedUser.email}`);
    return;
  }

  // Create new user
  const newUser = await prisma.user.create({
    data: {
      email: email,
      password: hashedPassword,
      name: 'Frontend Employee',
      mobile: '0000000000', // Required field by your schema
      role: UserRole.EMPLOYEE,
      isEmployee: true,
      isSeller: false,
      isBuyer: false
    },
  });

  console.log(`Created new employee user: ${newUser.email}`);
}

main()
  .catch((e) => {
    console.error('Error creating user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
