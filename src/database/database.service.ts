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

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is missing.');
    }
    const pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX) || 15,
      min: Number(process.env.DATABASE_POOL_MIN) || 3,
      idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS) || 30000,
      connectionTimeoutMillis: Number(process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS) || 10000,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
    this.connectionString = connectionString;
    this.logger.log(
      `Initializing DatabaseService with target: ${connectionString.replace(/:[^:@]+@/, ':****@')}`,
    );
  }

  async executePoolQuery(text: string, params: any[] = []): Promise<number> {
    try {
      const result = await this.pool.query(text, params);
      return result.rowCount || 0;
    } catch (err: any) {
      this.logger.error(`Pool query failed: ${err.message}`);
      return 0;
    }
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
          email text UNIQUE,
          phone text UNIQUE NOT NULL,
          password_hash text NOT NULL,
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
          deleted_at timestamp,
          refresh_token text,
          is_buyer boolean DEFAULT true,
          is_seller boolean DEFAULT false,
          is_employee boolean DEFAULT false
        );

        -- Safe column additions for existing tables
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
          refresh_token_hash text UNIQUE NOT NULL,
          ip_address text,
          user_agent text,
          device_name text,
          device_type text,
          is_active boolean DEFAULT true,
          last_activity_at timestamp DEFAULT now(),
          expires_at timestamp NOT NULL,
          revoked_at timestamp,
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

        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContactEnquiryStatus') THEN
            CREATE TYPE public."ContactEnquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
          END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS public.contact_enquiries (
          id text PRIMARY KEY,
          first_name varchar(100) NOT NULL,
          phone varchar(20) NOT NULL,
          email varchar(255),
          city varchar(100) NOT NULL,
          message text,
          status public."ContactEnquiryStatus" DEFAULT 'NEW'::public."ContactEnquiryStatus",
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.categories (
          category_id text PRIMARY KEY,
          name text NOT NULL,
          slug text UNIQUE NOT NULL,
          parent_id text,
          fields jsonb,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.products (
          product_id text PRIMARY KEY,
          seller_id text NOT NULL,
          category_id text,
          title text NOT NULL,
          description text,
          price double precision NOT NULL,
          sku text UNIQUE NOT NULL,
          inventory integer DEFAULT 0,
          media_urls text[],
          video_urls text[],
          influencer_branding boolean DEFAULT false,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.orders (
          order_id text PRIMARY KEY,
          seller_id text NOT NULL,
          buyer_id text,
          status text DEFAULT 'PENDING',
          total_amount double precision NOT NULL,
          shipping_amount double precision DEFAULT 0.0,
          delivery_address jsonb,
          awb_number text,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.order_returns (
          return_id text PRIMARY KEY,
          order_id text NOT NULL,
          seller_id text NOT NULL,
          reason text NOT NULL,
          status text DEFAULT 'REQUESTED',
          is_exchange boolean DEFAULT false,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.claims (
          claim_id text PRIMARY KEY,
          seller_id text NOT NULL,
          order_id text,
          subject text NOT NULL,
          description text NOT NULL,
          status text DEFAULT 'OPEN',
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.wallets (
          wallet_id text PRIMARY KEY,
          seller_id text UNIQUE NOT NULL,
          balance double precision DEFAULT 0.0,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.wallet_transactions (
          transaction_id text PRIMARY KEY,
          wallet_id text NOT NULL,
          amount double precision NOT NULL,
          type text NOT NULL,
          description text,
          created_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.invoices (
          invoice_id text PRIMARY KEY,
          seller_id text NOT NULL,
          invoice_no text UNIQUE NOT NULL,
          amount double precision NOT NULL,
          tax_amount double precision DEFAULT 0.0,
          pdf_url text,
          created_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.campaigns (
          campaign_id text PRIMARY KEY,
          seller_id text NOT NULL,
          name text NOT NULL,
          budget double precision NOT NULL,
          status text DEFAULT 'ACTIVE',
          product_ids text[],
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.notifications (
          notification_id text PRIMARY KEY,
          seller_id text NOT NULL,
          title text NOT NULL,
          message text NOT NULL,
          is_read boolean DEFAULT false,
          created_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.support_tickets (
          ticket_id text PRIMARY KEY,
          seller_id text NOT NULL,
          subject text NOT NULL,
          description text NOT NULL,
          status text DEFAULT 'OPEN',
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.subscription_plans (
          plan_id text PRIMARY KEY,
          name text NOT NULL,
          price double precision NOT NULL,
          duration text NOT NULL,
          features jsonb,
          created_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.seller_subscriptions (
          subscription_id text PRIMARY KEY,
          seller_id text UNIQUE NOT NULL,
          plan_id text NOT NULL,
          status text DEFAULT 'ACTIVE',
          expires_at timestamp NOT NULL,
          created_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.referrals (
          referral_id text PRIMARY KEY,
          referrer_id text NOT NULL,
          referred_email text NOT NULL,
          referral_code text NOT NULL,
          status text DEFAULT 'PENDING',
          reward_amount double precision DEFAULT 0.0,
          created_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.haatzup_videos (
          video_id text PRIMARY KEY,
          seller_id text NOT NULL,
          video_url text NOT NULL,
          hashtags text[],
          product_ids text[],
          views_count integer DEFAULT 0,
          created_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.warehouses (
          warehouse_id text PRIMARY KEY,
          seller_id text NOT NULL,
          name text NOT NULL,
          address text NOT NULL,
          pincode text NOT NULL,
          city text NOT NULL,
          state text NOT NULL,
          created_at timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.seller_products (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          main_media text,
          media jsonb,
          one_rs_store boolean DEFAULT false,
          product_images jsonb,
          name text NOT NULL,
          search_keywords jsonb,
          sub_category text,
          sub_category_id uuid,
          brand text,
          inventory integer,
          variant_price jsonb,
          product_id text,
          new_variant_price numeric(12,2),
          mrp numeric(12,2),
          onsale_price numeric(12,2),
          cod boolean,
          upi boolean,
          price numeric(12,2),
          discount jsonb,
          status varchar(50),
          delivery_charges boolean,
          main_category text,
          seller_id uuid,
          shipping_weight numeric(10,2),
          collections jsonb,
          seller_pincode varchar(10),
          created_date timestamptz,
          updated_date timestamptz,
          product_options jsonb,
          additional_info_sections jsonb,
          active_ad boolean,
          average_cpc numeric(10,2),
          priority_score varchar(100),
          campaign_id text,
          reach integer DEFAULT 0,
          impression integer DEFAULT 0,
          clicks integer DEFAULT 0,
          sales integer DEFAULT 0,
          revenue numeric(12,2) DEFAULT 0,
          category_name jsonb,
          sku text,
          product_type varchar(50),
          manage_variants boolean,
          ribbon text,
          track_inventory boolean,
          influencer_branding boolean,
          haatza_verified boolean,
          promotion_photos jsonb,
          payment_type text,
          product_return text,
          size_chart text,
          description text,
          gst_seller boolean,
          upi_payment_discount numeric(10,2),
          manage_listing_products text,
          sell_and_earn_commission numeric(10,2),
          sell_and_earn boolean,
          imported_at timestamptz DEFAULT now(),
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_seller_products_seller_id ON public.seller_products(seller_id);
        CREATE INDEX IF NOT EXISTS idx_seller_products_sku ON public.seller_products(sku);
        CREATE INDEX IF NOT EXISTS idx_seller_products_status ON public.seller_products(status);
        CREATE INDEX IF NOT EXISTS idx_seller_products_brand ON public.seller_products(brand);
        CREATE INDEX IF NOT EXISTS idx_seller_products_sub_category ON public.seller_products(sub_category);
        CREATE INDEX IF NOT EXISTS idx_seller_products_created_date ON public.seller_products(created_date);
        CREATE INDEX IF NOT EXISTS idx_seller_products_updated_date ON public.seller_products(updated_date);
        CREATE INDEX IF NOT EXISTS idx_seller_products_search_keywords ON public.seller_products USING gin(search_keywords);
        CREATE INDEX IF NOT EXISTS idx_seller_products_product_images ON public.seller_products USING gin(product_images);
        CREATE INDEX IF NOT EXISTS idx_seller_products_variant_price ON public.seller_products USING gin(variant_price);
        CREATE INDEX IF NOT EXISTS idx_seller_products_product_options ON public.seller_products USING gin(product_options);
        ALTER TABLE public.seller_products ADD COLUMN IF NOT EXISTS media jsonb;
        CREATE INDEX IF NOT EXISTS idx_seller_products_collections ON public.seller_products USING gin(collections);
        CREATE INDEX IF NOT EXISTS idx_seller_products_media ON public.seller_products USING gin(media);
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


