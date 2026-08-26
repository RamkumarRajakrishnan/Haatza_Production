import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:Haatza%402025@8.231.84.94:5432/haatza?schema=public&sslmode=disable';

async function main() {
  console.log('Connecting to PostgreSQL database at 8.231.84.94...');
  const pool = new Pool({
    connectionString,
    ssl: false,
  });

  try {
    const client = await pool.connect();
    console.log('Connected successfully to database!');

    const ddl = `
      CREATE TABLE IF NOT EXISTS public.pricing_plans (
        id varchar(36) PRIMARY KEY,
        name varchar(50) NOT NULL,
        price numeric(12, 2) NOT NULL,
        period_unit varchar(20) DEFAULT 'MONTH',
        ribbon varchar(50),
        benefits jsonb,
        status varchar(20) DEFAULT 'ACTIVE',
        created_at timestamp DEFAULT now()
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
        auto_renew boolean DEFAULT true,
        cancelled_at timestamp,
        created_at timestamp DEFAULT now()
      );

      ALTER TABLE public.seller_subscriptions ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT true;
      ALTER TABLE public.seller_subscriptions ADD COLUMN IF NOT EXISTS cancelled_at timestamp;

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

      CREATE INDEX IF NOT EXISTS idx_pricing_plans_status ON public.pricing_plans(status);
      CREATE INDEX IF NOT EXISTS idx_seller_subscriptions_seller_id ON public.seller_subscriptions(seller_id);
      CREATE INDEX IF NOT EXISTS idx_seller_subscriptions_plan_id ON public.seller_subscriptions(plan_id);
      CREATE INDEX IF NOT EXISTS idx_seller_subscriptions_status ON public.seller_subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_seller_subscription_invoices_subscription_id ON public.seller_subscription_invoices(subscription_id);
      CREATE INDEX IF NOT EXISTS idx_seller_subscription_invoices_seller_id ON public.seller_subscription_invoices(seller_id);
      CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.subscription_coupons(code);
      CREATE INDEX IF NOT EXISTS idx_seller_wallet_seller_id ON public.seller_wallet(seller_id);
      CREATE INDEX IF NOT EXISTS idx_seller_referrals_seller_id ON public.seller_referrals(seller_id);

      INSERT INTO public.pricing_plans (id, name, price, period_unit, ribbon, benefits, status)
      SELECT 'plan_pro_123', 'Pro', 499.00, 'MONTH', 'Recommended', '["0% Commission", "Priority Support", "Unlimited Listings"]'::jsonb, 'ACTIVE'
      WHERE NOT EXISTS (SELECT 1 FROM public.pricing_plans WHERE id = 'plan_pro_123');

      INSERT INTO public.pricing_plans (id, name, price, period_unit, ribbon, benefits, status)
      SELECT 'plan_growth_123', 'Growth', 299.00, 'MONTH', 'Popular', '["5% Commission", "Standard Support", "Up to 50 Listings"]'::jsonb, 'ACTIVE'
      WHERE NOT EXISTS (SELECT 1 FROM public.pricing_plans WHERE id = 'plan_growth_123');

      INSERT INTO public.subscription_coupons (id, code, discount_type, discount_value, min_order_amount, start_date, end_date, description, status)
      SELECT 'coupon_001', 'GROW50', 'PERCENTAGE', 50.00, 100.00, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 year', '50% off on Growth Plan', 'ACTIVE'
      WHERE NOT EXISTS (SELECT 1 FROM public.subscription_coupons WHERE code = 'GROW50');
    `;

    await client.query(ddl);
    console.log('✅ Columns auto_renew, cancelled_at and tables public.subscription_coupons, seller_wallets, seller_referrals created/updated on DB 8.231.84.94!');
    client.release();
  } catch (err: any) {
    console.error('❌ Error executing DDL on database:', err.message);
  } finally {
    await pool.end();
  }
}

main();
