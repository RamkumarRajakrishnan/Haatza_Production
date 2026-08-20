-- CreateTable: pricing_plans
CREATE TABLE "pricing_plans" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "period_unit" VARCHAR(20) NOT NULL DEFAULT 'MONTH',
    "ribbon" VARCHAR(50),
    "benefits" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable: seller_subscriptions
CREATE TABLE "seller_subscriptions" (
    "id" VARCHAR(36) NOT NULL,
    "seller_id" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "plan_id" VARCHAR(36) NOT NULL,
    "plan_name" VARCHAR(50) NOT NULL,
    "started_date" TIMESTAMP(3) NOT NULL,
    "ended_date" TIMESTAMP(3) NOT NULL,
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "grace_period_end_date" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "payment_id" VARCHAR(100),
    "razorpay_order_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: seller_subscription_invoices
CREATE TABLE "seller_subscription_invoices" (
    "id" VARCHAR(36) NOT NULL,
    "subscription_id" VARCHAR(36) NOT NULL,
    "seller_id" VARCHAR(50) NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "seller_name" VARCHAR(100) NOT NULL,
    "gstin" VARCHAR(20),
    "address" TEXT,
    "item_name" VARCHAR(100) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "coupon_code" VARCHAR(50),
    "coupon_type" VARCHAR(20),
    "coupon_value" DECIMAL(12,2) DEFAULT 0.00,
    "discount_amount" DECIMAL(12,2) DEFAULT 0.00,
    "taxable_amount" DECIMAL(12,2) NOT NULL,
    "cgst" DECIMAL(12,2) DEFAULT 0.00,
    "sgst" DECIMAL(12,2) DEFAULT 0.00,
    "wallet_amount_used" DECIMAL(12,2) DEFAULT 0.00,
    "upi_amount_paid" DECIMAL(12,2) DEFAULT 0.00,
    "total_payable" DECIMAL(12,2) NOT NULL,
    "transaction_method" VARCHAR(30) NOT NULL,
    "payment_id" VARCHAR(100),
    "razorpay_order_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- Create Indexes
CREATE INDEX "pricing_plans_status_idx" ON "pricing_plans"("status");

CREATE INDEX "seller_subscriptions_seller_id_idx" ON "seller_subscriptions"("seller_id");
CREATE INDEX "seller_subscriptions_plan_id_idx" ON "seller_subscriptions"("plan_id");
CREATE INDEX "seller_subscriptions_status_idx" ON "seller_subscriptions"("status");

CREATE INDEX "seller_subscription_invoices_subscription_id_idx" ON "seller_subscription_invoices"("subscription_id");
CREATE INDEX "seller_subscription_invoices_seller_id_idx" ON "seller_subscription_invoices"("seller_id");

-- Add Foreign Keys
ALTER TABLE "seller_subscriptions" ADD CONSTRAINT "seller_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "pricing_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "seller_subscription_invoices" ADD CONSTRAINT "seller_subscription_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "seller_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
