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
  private connectionString: string;
  private isConnected = false;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 30000,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
    this.connectionString = connectionString;
  }

  async onModuleInit() {
    // Non-blocking background database connection so Cloud Run boots instantly
    this.connectWithRetry().catch((err) => {
      this.logger.error('Background DB connection failed:', err);
    });
  }

  private async connectWithRetry(retries = 3, delayMs = 2000): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.$connect();
        this.isConnected = true;
        this.logger.log('✅ Database connected successfully with explicit pg.Pool');

        await this.ensureCoreTablesExist();
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

  private async ensureCoreTablesExist(): Promise<void> {
    try {
      this.logger.log('Verifying core database tables and enum types directly via PostgreSQL pool...');
      await this.pool.query(`
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";

        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StorageType') THEN
            CREATE TYPE public."StorageType" AS ENUM ('SELLER', 'HAATZA');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserOnboardStatus') THEN
            CREATE TYPE public."UserOnboardStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED', 'SUSPENDED');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserStatus') THEN
            CREATE TYPE public."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
            CREATE TYPE public."UserRole" AS ENUM ('ADMIN', 'SELLER', 'BUYER', 'NEST_WORKER', 'DELIVERY_PARTNER', 'SUPPORT', 'SELLER_OWNER', 'SELLER_STAFF', 'ACCOUNT_MANAGER');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OtpIdentifierType') THEN
            CREATE TYPE public."OtpIdentifierType" AS ENUM ('EMAIL', 'PHONE');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OtpPurpose') THEN
            CREATE TYPE public."OtpPurpose" AS ENUM ('REGISTRATION', 'LOGIN', 'FORGOT_PASSWORD', 'EMAIL_VERIFICATION', 'MOBILE_VERIFICATION');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OtpChannel') THEN
            CREATE TYPE public."OtpChannel" AS ENUM ('SMS', 'EMAIL', 'WHATSAPP');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoginMethod') THEN
            CREATE TYPE public."LoginMethod" AS ENUM ('EMAIL_PASSWORD', 'PHONE_PASSWORD', 'OTP_EMAIL', 'OTP_PHONE', 'REFRESH_TOKEN');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoginStatus') THEN
            CREATE TYPE public."LoginStatus" AS ENUM ('SUCCESS', 'FAILED', 'BLOCKED', 'LOCKED', 'TOKEN_REJECTED');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeviceOS') THEN
            CREATE TYPE public."DeviceOS" AS ENUM ('ANDROID', 'IOS', 'WEB', 'UNKNOWN');
          END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS public.users (
          user_id text PRIMARY KEY,
          seller_id text UNIQUE,
          first_name text NOT NULL,
          last_name text,
          nickname text,
          email text UNIQUE,
          phone text UNIQUE NOT NULL,
          password_hash text NOT NULL,
          company_name text,
          gstin text,
          pan_number text,
          storage_type public."StorageType" DEFAULT 'SELLER'::public."StorageType",
          address text,
          pincode text,
          city text,
          state text,
          country text DEFAULT 'India',
          onboard_status public."UserOnboardStatus" DEFAULT 'PENDING'::public."UserOnboardStatus",
          legacy_role public."UserRole" DEFAULT 'BUYER'::public."UserRole",
          role_id text,
          status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus",
          legacy_refresh_token text,
          email_verified_at timestamp,
          phone_verified_at timestamp,
          last_login_at timestamp,
          password_changed_at timestamp,
          failed_login_attempts integer DEFAULT 0,
          locked_until timestamp,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now(),
          deleted_at timestamp
        );

        DO $$ BEGIN
          ALTER TABLE public.users ALTER COLUMN storage_type TYPE public."StorageType" USING storage_type::public."StorageType";
        EXCEPTION WHEN OTHERS THEN NULL; END $$;
        DO $$ BEGIN
          ALTER TABLE public.users ALTER COLUMN onboard_status TYPE public."UserOnboardStatus" USING onboard_status::public."UserOnboardStatus";
        EXCEPTION WHEN OTHERS THEN NULL; END $$;
        DO $$ BEGIN
          ALTER TABLE public.users ALTER COLUMN legacy_role TYPE public."UserRole" USING legacy_role::public."UserRole";
        EXCEPTION WHEN OTHERS THEN NULL; END $$;
        DO $$ BEGIN
          ALTER TABLE public.users ALTER COLUMN status TYPE public."UserStatus" USING status::public."UserStatus";
        EXCEPTION WHEN OTHERS THEN NULL; END $$;

        CREATE TABLE IF NOT EXISTS public.roles (
          role_id text PRIMARY KEY,
          role_name text UNIQUE NOT NULL,
          role_code text UNIQUE NOT NULL,
          description text,
          is_default boolean DEFAULT false,
          is_system_role boolean DEFAULT false,
          is_active boolean DEFAULT true,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now(),
          deleted_at timestamp
        );

        CREATE TABLE IF NOT EXISTS public.permissions (
          permission_id text PRIMARY KEY,
          permission_name text UNIQUE NOT NULL,
          permission_code text UNIQUE NOT NULL,
          module text NOT NULL,
          action text,
          description text,
          is_active boolean DEFAULT true,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.role_permissions (
          id text PRIMARY KEY,
          role_id text NOT NULL,
          permission_id text NOT NULL,
          granted_at timestamp DEFAULT now(),
          granted_by text,
          created_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.sellers (
          seller_pk text PRIMARY KEY,
          user_id text UNIQUE NOT NULL,
          business_name text NOT NULL,
          gst_number text,
          address text,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.buyers (
          buyer_pk text PRIMARY KEY,
          user_id text UNIQUE NOT NULL,
          address text,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.user_sessions (
          session_id text PRIMARY KEY,
          user_id text NOT NULL,
          device_id text,
          access_token_jti text UNIQUE,
          session_token_hash text UNIQUE NOT NULL,
          ip_address text,
          user_agent text,
          is_active boolean DEFAULT true,
          last_activity_at timestamp DEFAULT now(),
          expires_at timestamp NOT NULL,
          revoked_at timestamp,
          revocation_reason text,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.refresh_tokens (
          token_id text PRIMARY KEY,
          user_id text NOT NULL,
          session_id text NOT NULL,
          device_id text,
          token_hash text UNIQUE NOT NULL,
          token_family text,
          parent_token_id text,
          is_revoked boolean DEFAULT false,
          expires_at timestamp NOT NULL,
          revoked_at timestamp,
          replaced_by_token_id text,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.otp_verifications (
          otp_id text PRIMARY KEY,
          user_id text,
          identifier text NOT NULL,
          identifier_type public."OtpIdentifierType" DEFAULT 'PHONE'::public."OtpIdentifierType",
          otp_hash text NOT NULL,
          purpose public."OtpPurpose" DEFAULT 'LOGIN'::public."OtpPurpose",
          channel public."OtpChannel" DEFAULT 'SMS'::public."OtpChannel",
          attempt_count integer DEFAULT 0,
          max_attempts integer DEFAULT 3,
          resend_count integer DEFAULT 0,
          max_resend_count integer DEFAULT 3,
          is_verified boolean DEFAULT false,
          expires_at timestamp NOT NULL,
          verified_at timestamp,
          used_at timestamp,
          last_sent_at timestamp DEFAULT now(),
          blocked_until timestamp,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.user_login_histories (
          login_id text PRIMARY KEY,
          user_id text,
          identifier text NOT NULL,
          login_method public."LoginMethod" DEFAULT 'PHONE_PASSWORD'::public."LoginMethod",
          status public."LoginStatus" DEFAULT 'SUCCESS'::public."LoginStatus",
          failure_reason text,
          session_id text,
          device_id text,
          ip_address text,
          user_agent text,
          device_name text,
          location text,
          attempted_at timestamp DEFAULT now(),
          created_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.user_devices (
          device_id text PRIMARY KEY,
          user_id text NOT NULL,
          fcm_token text,
          apns_token text,
          device_uuid text,
          device_identifier text,
          device_os public."DeviceOS" DEFAULT 'UNKNOWN'::public."DeviceOS",
          device_name text,
          device_model text,
          app_version text,
          app_build_number text,
          platform text,
          is_active boolean DEFAULT true,
          notifications_enabled boolean DEFAULT true,
          last_seen_at timestamp DEFAULT now(),
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );
      `);
      this.logger.log('✅ Core PostgreSQL tables & enum types verified and active!');
    } catch (err: any) {
      this.logger.error('Error rendering core tables:', err.message || err);
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


