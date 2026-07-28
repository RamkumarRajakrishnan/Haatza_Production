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

  constructor() {
    const connectionString = process.env.DATABASE_URL;
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

    const pool = new Pool({
      connectionString,
      max: poolMax,
      min: poolMin,
      idleTimeoutMillis,
      connectionTimeoutMillis,
    });

    pool.on('error', (err) => {
      new Logger('PgPool').error(
        'Unexpected error on idle PostgreSQL client',
        err.stack,
      );
    });

    const adapter = new PrismaPg(pool, {
      disposeExternalPool: true,
      onPoolError: (err) => {
        new Logger('PrismaPgAdapter').error(
          'Prisma PG Adapter pool error',
          err.stack,
        );
      },
    });

    super({
      adapter,
    });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Database connected successfully with explicit pg.Pool');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (this.pool) {
      await this.pool.end();
    }
    this.logger.log('🛑 Database disconnected successfully');
  }
}

