import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;
  private connectionString: string;
  private isConnected = false;

  private createPool(connectionString: string, useSsl: boolean): Pool {
    const poolOptions: any = {
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX) || 15,
      min: Number(process.env.DATABASE_POOL_MIN) || 2,
      idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS) || 10000,
      connectionTimeoutMillis: Number(process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS) || 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    };

    if (useSsl) {
      poolOptions.ssl = { rejectUnauthorized: false };
    } else {
      poolOptions.ssl = false;
    }

    const pool = new Pool(poolOptions);
    pool.on('error', (err: any) => {
      this.logger.warn(`⚠️ PostgreSQL pool background client error: ${err.message}`);
    });

    return pool;
  }

  constructor() {
    let connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is missing.');
    }

    // Clean up invalid or legacy sslmode parameter if present
    if (connectionString.includes('sslmode=no-verify')) {
      connectionString = connectionString.replace(/sslmode=no-verify/g, 'sslmode=disable');
      process.env.DATABASE_URL = connectionString;
    }

    const explicitDisable =
      process.env.DATABASE_SSL === 'false' ||
      connectionString.includes('sslmode=disable') ||
      process.env.PGSSLMODE === 'disable';

    const explicitEnable =
      process.env.DATABASE_SSL === 'true' ||
      connectionString.includes('sslmode=require') ||
      connectionString.includes('sslmode=verify-ca') ||
      connectionString.includes('sslmode=verify-full');

    // Default SSL to false unless explicitly enabled, because servers without SSL reject TLS handshakes
    const useSsl = explicitDisable ? false : explicitEnable ? true : false;

    if (!useSsl) {
      if (connectionString.includes('sslmode=')) {
        connectionString = connectionString.replace(/sslmode=[^&]+/g, 'sslmode=disable');
      } else {
        const sep = connectionString.includes('?') ? '&' : '?';
        connectionString = `${connectionString}${sep}sslmode=disable`;
      }
      process.env.DATABASE_URL = connectionString;
    }

    const pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX) || 15,
      min: Number(process.env.DATABASE_POOL_MIN) || 2,
      idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS) || 10000,
      connectionTimeoutMillis: Number(process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS) || 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err: any) => {
      this.logger.warn(`⚠️ PostgreSQL pool background client error: ${err.message}`);
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
    this.connectionString = connectionString;
    this.logger.log(
      `Initializing DatabaseService with target: ${connectionString.replace(/:[^:@]+@/, ':****@')} (SSL: ${useSsl})`,
    );
  }

  private fallbackToNonSslPool(): void {
    if (this.connectionString) {
      if (this.connectionString.includes('sslmode=')) {
        this.connectionString = this.connectionString.replace(/sslmode=[^&]+/g, 'sslmode=disable');
      } else {
        const sep = this.connectionString.includes('?') ? '&' : '?';
        this.connectionString = `${this.connectionString}${sep}sslmode=disable`;
      }
      process.env.DATABASE_URL = this.connectionString;
    }
    this.logger.warn('Switching PostgreSQL pool to non-SSL mode (sslmode=disable)...');
    try {
      if (this.pool) {
        this.pool.end().catch(() => { });
      }
    } catch { }

    this.pool = new Pool({
      connectionString: this.connectionString,
      max: Number(process.env.DATABASE_POOL_MAX) || 15,
      min: Number(process.env.DATABASE_POOL_MIN) || 2,
      idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS) || 10000,
      connectionTimeoutMillis: Number(process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS) || 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ssl: false,
    });

    this.pool.on('error', (err: any) => {
      this.logger.warn(`⚠️ PostgreSQL non-SSL pool error: ${err.message}`);
    });
  }

  async queryRawDashboard(text: string, params: any[] = []): Promise<any[]> {
    try {
      if (this.pool) {
        const result = await this.pool.query(text, params);
        if (result && Array.isArray(result.rows)) {
          return result.rows;
        }
      }
    } catch (err: any) {
      this.logger.warn(`queryRawDashboard pool query warning: ${err.message}`);
      if (err.message && (err.message.includes('does not support SSL') || err.message.includes('TLS'))) {
        this.fallbackToNonSslPool();
        try {
          const retryRes = await this.pool.query(text, params);
          if (retryRes && Array.isArray(retryRes.rows)) {
            return retryRes.rows;
          }
        } catch (retryErr: any) {
          this.logger.warn(`queryRawDashboard non-SSL retry warning: ${retryErr.message}`);
        }
      }
    }

    try {
      const prismaRes: any = await this.$queryRawUnsafe(text, ...params);
      return Array.isArray(prismaRes) ? prismaRes : [];
    } catch (prismaErr: any) {
      this.logger.error(`queryRawDashboard fallback failed: ${prismaErr.message}`);
      throw prismaErr;
    }
  }

  async executePoolQuery(text: string, params: any[] = []): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }
    try {
      const result = await this.pool.query(text, params);
      return result.rowCount || 0;
    } catch (err: any) {
      this.logger.warn(`Pool query initial attempt failed (${err.message}). Retrying query...`);
      try {
        const retryResult = await this.pool.query(text, params);
        return retryResult.rowCount || 0;
      } catch (retryErr: any) {
        this.logger.error(`Pool query retry failed: ${retryErr.message}`);
        return 0;
      }
    }
  }

  async onModuleInit() {
    // Non-blocking background database connection so Cloud Run boots instantly
    this.connectWithRetry()
      .then(async () => {
        await this.ensureCoreTablesExist();
        await this.dropUnusedDashboardColumns();
      })
      .catch((err) => {
        this.logger.error('Background DB connection failed:', err);
      });
  }

  private async dropUnusedDashboardColumns(): Promise<void> {
    try {
      this.logger.log('Cleaning up deleted columns on dashboard table if present...');
      await this.pool.query(`
        ALTER TABLE public.dashboard DROP COLUMN IF EXISTS subtitle;
        ALTER TABLE public.dashboard DROP COLUMN IF EXISTS priority;
        ALTER TABLE public.dashboard DROP COLUMN IF EXISTS main_category_id;
        ALTER TABLE public.dashboard DROP COLUMN IF EXISTS sub_category_id;
        ALTER TABLE public.dashboard DROP COLUMN IF EXISTS title_image;
        ALTER TABLE public.dashboard DROP COLUMN IF EXISTS image;
        ALTER TABLE public.dashboard DROP COLUMN IF EXISTS redirect_link;
        ALTER TABLE public.dashboard DROP COLUMN IF EXISTS price;
        ALTER TABLE public.dashboard DROP COLUMN IF EXISTS discount;
        ALTER TABLE public.dashboard DROP COLUMN IF EXISTS product;
      `);
      this.logger.log('✅ Dashboard table column cleanup completed.');
    } catch (err: any) {
      this.logger.warn(`Dashboard column cleanup warning: ${err.message}`);
    }
  }

  private async connectWithRetry(retries = 3, delayMs = 2000): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.$connect();
        await this.pool.query('SELECT 1');
        this.isConnected = true;
        this.logger.log('✅ Database connected successfully with explicit pg.Pool');
        return;
      } catch (err: any) {
        this.isConnected = false;
        if (err.message && (err.message.includes('does not support SSL') || err.message.includes('TLS'))) {
          this.logger.warn(`SSL connection rejected by server: ${err.message}. Retrying with non-SSL pool...`);
          this.fallbackToNonSslPool();
        }
        this.logger.warn(
          `⚠️ Database connection attempt ${attempt}/${retries} failed: ${err.message}. Retrying in ${delayMs}ms...`,
        );
        if (attempt === retries) {
          this.logger.warn(
            '⚠️ Database server unreachable (Cloud SQL public IP port 5432 restricted on this local network). App will continue running.',
          );
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
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserOnboardStatus') THEN
            CREATE TYPE public."UserOnboardStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED', 'SUSPENDED');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserStatus') THEN
            CREATE TYPE public."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
            CREATE TYPE public."UserRole" AS ENUM ('ADMIN', 'SELLER', 'BUYER', 'NEST_WORKER', 'DELIVERY_PARTNER', 'SUPPORT', 'SELLER_OWNER', 'SELLER_STAFF', 'ACCOUNT_MANAGER', 'EMPLOYEE');
          END IF;
          DO $inner$ BEGIN
            ALTER TYPE public."UserRole" ADD VALUE IF NOT EXISTS 'EMPLOYEE';
          EXCEPTION WHEN OTHERS THEN NULL; END $inner$;
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
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DashboardModule') THEN
            CREATE TYPE public."DashboardModule" AS ENUM ('LITE', 'HAATZA');
          END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS public.users (
          user_id text PRIMARY KEY,
          seller_id text UNIQUE,
          first_name text NOT NULL,
          email text UNIQUE,
          phone text UNIQUE NOT NULL,
          password text NOT NULL,
          company_name text,
          gstin text,
          pan_number text,
          address text,
          pincode text,
          city text,
          state text,
          country text,
          "sellerOnboard_status" public."UserOnboardStatus" DEFAULT 'PENDING'::public."UserOnboardStatus",
          role public."UserRole" DEFAULT 'BUYER'::public."UserRole",
          role_id text,
          status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus",
          email_verified_at timestamp,
          phone_verified_at timestamp,
          last_login_at timestamp,
          password_changed_at timestamp,
          failed_login_attempts integer DEFAULT 0,
          locked_until timestamp,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now(),
          refresh_token text,
          is_buyer boolean DEFAULT true,
          is_seller boolean DEFAULT false,
          is_employee boolean DEFAULT false
        );

        -- Safe column additions and rename for existing tables
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') AND
             EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password') THEN
            ALTER TABLE public.users DROP COLUMN password;
            ALTER TABLE public.users RENAME COLUMN password_hash TO password;
          ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN
            ALTER TABLE public.users RENAME COLUMN password_hash TO password;
          END IF;
        EXCEPTION WHEN OTHERS THEN NULL; END $$;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password text;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS refresh_token text;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS seller_id text;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_name text;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gstin text;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pan_number text;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address text;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pincode text;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city text;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS state text;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country text;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "sellerOnboard_status" public."UserOnboardStatus" DEFAULT 'PENDING'::public."UserOnboardStatus";
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role public."UserRole" DEFAULT 'BUYER'::public."UserRole";
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role_id text;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus";
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_buyer boolean DEFAULT true;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_seller boolean DEFAULT false;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_employee boolean DEFAULT false;

        DO $$ BEGIN
          ALTER TABLE public.users ALTER COLUMN role TYPE public."UserRole" USING role::public."UserRole";
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

        CREATE TABLE IF NOT EXISTS public.user_sessions (
          session_id text PRIMARY KEY,
          user_id text NOT NULL,
          refresh_token_hash text UNIQUE NOT NULL,
          ip_address text,
          user_agent text,
          device_name text,
          device_type text,
          is_active boolean DEFAULT true,
          last_activity_at timestamp DEFAULT now(),
          expires_at timestamp NOT NULL,
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

        CREATE TABLE IF NOT EXISTS public.dashboard (
          id text PRIMARY KEY,
          widget_type text,
          widget_id text UNIQUE NOT NULL,
          title text,
          status text DEFAULT 'ACTIVE',
          sequence integer,
          category_id text,
          category_name text,
          "Item" jsonb,
          warehouse_id text,
          module public."DashboardModule" DEFAULT 'HAATZA'::public."DashboardModule",
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now(),
          expires_at timestamp
        );

        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_otp_verifications_identifier ON public.otp_verifications(identifier);
        CREATE INDEX IF NOT EXISTS idx_user_login_histories_user_id ON public.user_login_histories(user_id);

        -- Automatic ID Generation (DASH_001, DASH_002...) for dashboard.id
        CREATE SEQUENCE IF NOT EXISTS public.seq_dashboard_id START WITH 1 INCREMENT BY 1 NO MAXVALUE NO MINVALUE CACHE 1;

        CREATE OR REPLACE FUNCTION public.fn_next_dashboard_id()
        RETURNS text AS $fn$
        BEGIN
          RETURN 'DASH_' || lpad(nextval('public.seq_dashboard_id')::text, 3, '0');
        END;
        $fn$ LANGUAGE plpgsql;

        -- Ensure column default is set to fn_next_dashboard_id()
        ALTER TABLE public.dashboard ALTER COLUMN id SET DEFAULT public.fn_next_dashboard_id();

        -- BEFORE INSERT Trigger to guarantee DASH_xxx assignment if ID is NULL or empty
        CREATE OR REPLACE FUNCTION public.fn_trg_dashboard_auto_id()
        RETURNS TRIGGER AS $trg$
        BEGIN
          IF NEW.id IS NULL OR trim(NEW.id) = '' THEN
            NEW.id := public.fn_next_dashboard_id();
          END IF;
          RETURN NEW;
        END;
        $trg$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_dashboard_auto_id ON public.dashboard;
        CREATE TRIGGER trg_dashboard_auto_id
        BEFORE INSERT ON public.dashboard
        FOR EACH ROW
        EXECUTE FUNCTION public.fn_trg_dashboard_auto_id();

        -- Synchronize Sequence with existing max numeric DASH_xxx IDs
        DO $$
        DECLARE
          v_max_id int;
        BEGIN
          SELECT COALESCE(MAX(
            CASE 
              WHEN id ~ '^DASH_[0-9]+$' THEN NULLIF(regexp_replace(id, '^DASH_', ''), '')::int
              ELSE 0
            END
          ), 0) INTO v_max_id FROM public.dashboard;

          IF v_max_id > 0 THEN
            PERFORM setval('public.seq_dashboard_id', v_max_id);
          END IF;
        END $$;

        -- Safe column additions for dashboard table
        ALTER TABLE public.dashboard ADD COLUMN IF NOT EXISTS widget_type text;
        ALTER TABLE public.dashboard ADD COLUMN IF NOT EXISTS widget_id text;
        ALTER TABLE public.dashboard ADD COLUMN IF NOT EXISTS title text;
        ALTER TABLE public.dashboard ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE';
        ALTER TABLE public.dashboard ADD COLUMN IF NOT EXISTS sequence integer;
        ALTER TABLE public.dashboard ADD COLUMN IF NOT EXISTS category_id text;
        ALTER TABLE public.dashboard ADD COLUMN IF NOT EXISTS category_name text;
        ALTER TABLE public.dashboard ADD COLUMN IF NOT EXISTS "Item" jsonb;
        ALTER TABLE public.dashboard ADD COLUMN IF NOT EXISTS warehouse_id text;
        ALTER TABLE public.dashboard ADD COLUMN IF NOT EXISTS module public."DashboardModule" DEFAULT 'HAATZA'::public."DashboardModule";
        ALTER TABLE public.dashboard ADD COLUMN IF NOT EXISTS expires_at timestamp;

        -- Grow Plan Subscription Tables DDL
        CREATE TABLE IF NOT EXISTS public.grow_plan (
          id varchar(36) PRIMARY KEY,
          member_id text,
          order_id text,
          plan_name text,
          nickname text,
          plan_id text,
          status text,
          email text,
          ended_date timestamp,
          started_date timestamp,
          payment_id text,
          razorpay_order_id text,
          manage_grow_plan_page_link text,
          phone text,
          seller_id text,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.seller_subscriptions (
          id varchar(36) PRIMARY KEY,
          seller_id varchar(50) NOT NULL,
          email varchar(100) NOT NULL,
          phone varchar(20),
          plan_id varchar(36) NOT NULL,
          plan_name varchar(50) NOT NULL,
          started_date timestamp NOT NULL,
          ended_date timestamp NOT NULL,
          grace_period_days integer DEFAULT 0,
          grace_period_end_date timestamp,
          status varchar(20) DEFAULT 'ACTIVE',
          payment_id varchar(100),
          razorpay_order_id varchar(100),
          created_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.seller_subscription_invoices (
          id varchar(36) PRIMARY KEY,
          subscription_id varchar(36) NOT NULL,
          seller_id varchar(50) NOT NULL,
          invoice_date timestamp NOT NULL,
          seller_name varchar(100) NOT NULL,
          gstin varchar(20),
          address text,
          item_name varchar(100) NOT NULL,
          rate numeric(12, 2) NOT NULL,
          subtotal numeric(12, 2) NOT NULL,
          coupon_code varchar(50),
          coupon_type varchar(20),
          coupon_value numeric(12, 2) DEFAULT 0.00,
          discount_amount numeric(12, 2) DEFAULT 0.00,
          taxable_amount numeric(12, 2) NOT NULL,
          cgst numeric(12, 2) DEFAULT 0.00,
          sgst numeric(12, 2) DEFAULT 0.00,
          wallet_amount_used numeric(12, 2) DEFAULT 0.00,
          upi_amount_paid numeric(12, 2) DEFAULT 0.00,
          total_payable numeric(12, 2) NOT NULL,
          transaction_method varchar(30) NOT NULL,
          payment_id varchar(100),
          razorpay_order_id varchar(100),
          created_at timestamp DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_seller_subscriptions_seller_id ON public.seller_subscriptions(seller_id);
        CREATE INDEX IF NOT EXISTS idx_seller_subscriptions_plan_id ON public.seller_subscriptions(plan_id);
        CREATE INDEX IF NOT EXISTS idx_seller_subscriptions_status ON public.seller_subscriptions(status);
        CREATE INDEX IF NOT EXISTS idx_seller_subscription_invoices_subscription_id ON public.seller_subscription_invoices(subscription_id);
        ALTER TABLE public.seller_subscriptions ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT true;
        ALTER TABLE public.seller_subscriptions ADD COLUMN IF NOT EXISTS cancelled_at timestamp;

        CREATE TABLE IF NOT EXISTS public.subscription_coupons (
          id varchar(36) PRIMARY KEY,
          code varchar(50) NOT NULL UNIQUE,
          discount_type varchar(20) NOT NULL,
          discount_value numeric(12, 2) NOT NULL,
          min_order_amount numeric(12, 2) DEFAULT 0.00,
          max_discount_amount numeric(12, 2),
          start_date timestamp NOT NULL,
          end_date timestamp NOT NULL,
          usage_limit integer,
          usage_count integer DEFAULT 0,
          status varchar(20) DEFAULT 'ACTIVE',
          applicable_plan_id varchar(36),
          description text,
          created_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.seller_wallet (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          seller_id varchar(50) NOT NULL UNIQUE,
          total_added_amount numeric(12, 2) DEFAULT 0.00,
          gst_amount numeric(12, 2) DEFAULT 0.00,
          usable_balance numeric(12, 2) DEFAULT 0.00,
          remaining_balance numeric(12, 2) DEFAULT 0.00,
          owner uuid,
          created_date timestamptz DEFAULT now(),
          updated_date timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.wallet_transactions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          seller_id varchar(50) NOT NULL,
          transaction_type varchar(20),
          transaction_amount numeric(12, 2) DEFAULT 0.00,
          gst_deducted numeric(12, 2) DEFAULT 0.00,
          remaining_balance numeric(12, 2) DEFAULT 0.00,
          campaign_id varchar(100),
          created_date timestamptz DEFAULT now(),
          campaign_spends boolean DEFAULT false,
          total numeric(12, 2) DEFAULT 0.00,
          payment_id varchar(100),
          FOREIGN KEY (seller_id) REFERENCES public.seller_wallet(seller_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS public.seller_referrals (
          id varchar(36) PRIMARY KEY,
          seller_id varchar(50) NOT NULL UNIQUE,
          referral_code varchar(50) NOT NULL UNIQUE,
          referral_link varchar(255),
          points_balance numeric(12, 2) DEFAULT 0.00,
          total_earned numeric(12, 2) DEFAULT 0.00,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.referral_transactions (
          id varchar(36) PRIMARY KEY,
          referral_id varchar(36) NOT NULL,
          seller_id varchar(50) NOT NULL,
          referred_seller_id varchar(50),
          points numeric(12, 2) NOT NULL,
          type varchar(20) NOT NULL,
          description varchar(255),
          created_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.referral_program (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          seller_id VARCHAR(50) NOT NULL,
          referral_code VARCHAR(100),
          referred_seller_id VARCHAR(50),
          referred_email VARCHAR(255),
          referred_phone VARCHAR(50),
          status VARCHAR(50),
          reward_earned NUMERIC(14,2) DEFAULT 0.00,
          reward_type VARCHAR(50),
          date_referred TIMESTAMPTZ,
          notes TEXT,
          owner UUID,
          reward_amount NUMERIC(14,2) DEFAULT 0.00,
          reward_used BOOLEAN DEFAULT false,
          image TEXT,
          created_date TIMESTAMPTZ DEFAULT now(),
          updated_date TIMESTAMPTZ DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.subscription_coupons(code);
        CREATE INDEX IF NOT EXISTS idx_seller_wallet_seller_id ON public.seller_wallet(seller_id);
        CREATE INDEX IF NOT EXISTS idx_seller_referrals_seller_id ON public.seller_referrals(seller_id);

        -- Seed sample coupons
        INSERT INTO public.subscription_coupons (id, code, discount_type, discount_value, min_order_amount, start_date, end_date, description, status)
        SELECT 'coupon_001', 'GROW50', 'PERCENTAGE', 50.00, 100.00, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 year', '50% off on Growth Plan', 'ACTIVE'
        WHERE NOT EXISTS (SELECT 1 FROM public.subscription_coupons WHERE code = 'GROW50');

        -- Employee RBAC Master Tables DDL
        ALTER TABLE public.role_master ADD COLUMN IF NOT EXISTS description text;
        ALTER TABLE public.role_page_master ADD COLUMN IF NOT EXISTS page_id text;

        -- Automatic sync of boolean capability flags and cleanup of legacy roles
        DO $$ BEGIN
          DELETE FROM public.role_page_master WHERE role_id IN ('role_seller', 'role_buyer', 'SELLER', 'BUYER');
          DELETE FROM public.user_role WHERE role_id IN ('role_seller', 'role_buyer', 'SELLER', 'BUYER');
          DELETE FROM public.role_master WHERE id IN ('role_seller', 'role_buyer') OR role_code IN ('SELLER', 'BUYER');

          UPDATE public.users 
          SET is_seller = true
          WHERE email LIKE 'seller%' OR role::text IN ('SELLER', 'SELLER_OWNER', 'SELLER_STAFF');

          UPDATE public.users 
          SET is_employee = true
          WHERE is_employee = true OR role::text IN ('EMPLOYEE', 'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPPORT', 'NEST_WORKER');
        EXCEPTION WHEN OTHERS THEN NULL; END $$;

        CREATE TABLE IF NOT EXISTS public.page_master (
          id text PRIMARY KEY,
          page_code text UNIQUE NOT NULL,
          page_name text NOT NULL,
          route text NOT NULL,
          description text,
          is_active boolean DEFAULT true,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.user_role (
          id text PRIMARY KEY,
          user_id text NOT NULL,
          role_id text NOT NULL,
          is_active boolean DEFAULT true,
          assigned_at timestamp DEFAULT now(),
          assigned_by text,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now(),
          CONSTRAINT uq_user_role_pair UNIQUE (user_id, role_id)
        );

        CREATE INDEX IF NOT EXISTS idx_user_role_user_id ON public.user_role(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_role_role_id ON public.user_role(role_id);
        CREATE INDEX IF NOT EXISTS idx_role_page_master_role_id ON public.role_page_master(role_id);
        CREATE INDEX IF NOT EXISTS idx_role_page_master_page_id ON public.role_page_master(page_id);

        -- Warehouse Master Table for Appbar & Location Services
        CREATE TABLE IF NOT EXISTS public.warehouse_master (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          warehouse_id text UNIQUE NOT NULL,
          warehouse_name text NOT NULL,
          warehouse_type text,
          franchise_code text,
          owner_name text,
          contact_phone text,
          contact_email text,
          address_line_1 text,
          address_line_2 text,
          city text,
          state text,
          pincode text,
          latitude decimal(10, 7) NOT NULL,
          longitude decimal(10, 7) NOT NULL,
          service_radius_km decimal(10, 2) NOT NULL DEFAULT 10.0,
          status text NOT NULL DEFAULT 'ACTIVE',
          operating_start_time time DEFAULT '07:00:00',
          operating_end_time time DEFAULT '22:00:00',
          estimated_delivery_time_minutes integer DEFAULT 10,
          created_date timestamp DEFAULT now(),
          updated_date timestamp DEFAULT now(),
          owner text,
          account_manager text,
          manager_phone text
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouse_master_id ON public.warehouse_master(warehouse_id);
        CREATE INDEX IF NOT EXISTS idx_warehouse_master_status ON public.warehouse_master(status);
        CREATE INDEX IF NOT EXISTS idx_warehouse_master_location ON public.warehouse_master(latitude, longitude);

        -- Appbar Categories Table
        CREATE TABLE IF NOT EXISTS public.appbar_categories (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          category_id text NOT NULL,
          category_name text NOT NULL,
          warehouse_id text,
          image text,
          status text NOT NULL DEFAULT 'ACTIVE',
          expire_date timestamp,
          primary_appbar_color text,
          secondary_appbar_color text,
          appbar_image text,
          category_text_color text,
          appbarbackground boolean DEFAULT false,
          module text NOT NULL DEFAULT 'lite',
          created_date timestamp DEFAULT now(),
          updated_date timestamp DEFAULT now(),
          owner text
        );

        -- Safe rename column & add new column if table already exists
        DO $$ 
        BEGIN
          IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'appbar_categories' 
              AND column_name = 'appbar_color'
          ) THEN
            ALTER TABLE public.appbar_categories RENAME COLUMN appbar_color TO primary_appbar_color;
          END IF;
        END $$;

        ALTER TABLE public.appbar_categories ADD COLUMN IF NOT EXISTS secondary_appbar_color text;

        CREATE INDEX IF NOT EXISTS idx_appbar_categories_module_status ON public.appbar_categories(module, status);
        CREATE INDEX IF NOT EXISTS idx_appbar_categories_wh_mod_stat ON public.appbar_categories(warehouse_id, module, status);
        CREATE INDEX IF NOT EXISTS idx_appbar_categories_expire_date ON public.appbar_categories(expire_date);

        -- PostgreSQL Employee-Only Role Validation Trigger (is_employee = true)
        DO $$ BEGIN
          CREATE OR REPLACE FUNCTION public.fn_validate_employee_role_assignment()
          RETURNS TRIGGER AS $trg$
          DECLARE
            v_is_employee boolean;
          BEGIN
            SELECT is_employee INTO v_is_employee
            FROM public.users
            WHERE user_id = NEW.user_id;

            IF v_is_employee = true THEN
              RETURN NEW;
            ELSE
              RAISE EXCEPTION 'Security Policy Violation: Cannot assign employee role (Role ID: %) to non-employee user (User ID: %). RBAC roles apply ONLY to users with is_employee = true.', 
                NEW.role_id, NEW.user_id;
            END IF;
          END;
          $trg$ LANGUAGE plpgsql;

          DROP TRIGGER IF EXISTS trg_check_employee_role_assignment ON public.user_role;
          CREATE TRIGGER trg_check_employee_role_assignment
          BEFORE INSERT OR UPDATE ON public.user_role
          FOR EACH ROW
          EXECUTE FUNCTION public.fn_validate_employee_role_assignment();
        EXCEPTION WHEN OTHERS THEN NULL; END $$;
      `);
      this.logger.log('✅ All PostgreSQL tables & enum types verified and active!');
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


