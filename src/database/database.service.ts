import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;
  private isConnected = false;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    // Connect asynchronously with retries without blocking HTTP server startup
    this.connectWithRetry().catch((err) => {
      this.logger.error('Initial background DB connection failed:', err);
    });
  }

  private async connectWithRetry(retries = 10, delayMs = 3000): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.$connect();
        this.isConnected = true;
        this.logger.log('✅ Database connected successfully with explicit pg.Pool');
        return;
      } catch (err: any) {
        this.logger.warn(
          `⚠️ Database connection attempt ${attempt}/${retries} failed: ${err.message}. Retrying in ${delayMs}ms...`,
        );
        if (attempt === retries) {
          this.logger.error('❌ Database connection failed after maximum retries.');
        } else {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      if (this.pool) {
        await this.pool.end();
      }
      this.logger.log('🛑 Database disconnected successfully');
    } catch (err: any) {
      this.logger.error('Error during database disconnect:', err.message);
    }
  }
}


