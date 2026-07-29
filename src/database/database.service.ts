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
      'postgresql://postgres:postgres@127.0.0.1:5432/haatza';

    const poolMax = parseInt(process.env.DATABASE_POOL_MAX || '25', 10);
    const poolMin = parseInt(process.env.DATABASE_POOL_MIN || '5', 10);
    const idleTimeoutMillis = parseInt(
      process.env.DATABASE_POOL_IDLE_TIMEOUT_MS || '30000',
      10,
    );
    const connectionTimeoutMillis = parseInt(
      process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS || '5000',
      10,
    );

    let pool: Pool;
    let adapter: PrismaPg;

    try {
      // Parse host parameter if using Cloud SQL Unix socket (e.g. ?host=/cloudsql/...)
      const poolConfig: any = {
        connectionString,
        max: poolMax,
        min: poolMin,
        idleTimeoutMillis,
        connectionTimeoutMillis,
      };

      if (connectionString.includes('host=/cloudsql/')) {
        const match = connectionString.match(/host=([^&]+)/);
        if (match && match[1]) {
          poolConfig.host = decodeURIComponent(match[1]);
        }
      }

      pool = new Pool(poolConfig);

      pool.on('error', (err) => {
        this.logger.error('Unexpected error on idle PostgreSQL client', err.stack);
      });

      adapter = new PrismaPg(pool, {
        disposeExternalPool: true,
        onPoolError: (err) => {
          this.logger.error('Prisma PG Adapter pool error', err.stack);
        },
      });

      super({ adapter });
      this.pool = pool;
    } catch (err: any) {
      this.logger.error('Failed to initialize PrismaPg adapter', err.stack || err.message);
      super();
      this.pool = null as any;
    }
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


