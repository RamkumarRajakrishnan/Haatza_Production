-- CreateTable
CREATE TABLE "seller_orders" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "order_id" INTEGER NOT NULL,
    "tracking_id" TEXT,
    "status" TEXT,
    "items" TEXT,
    "total_amount" DOUBLE PRECISION,
    "customer_name" TEXT,
    "customer_address" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_status" TEXT,
    "product_id" TEXT,
    "storage_type" TEXT,
    "seller_payment_status" TEXT,
    "item_price" DOUBLE PRECISION,
    "buyer_email" TEXT,
    "customer_phone" TEXT,
    "estimated_delivery" TIMESTAMP(3),
    "product_option" JSONB,
    "delivered_date" TIMESTAMP(3),
    "invoice_number" TEXT,
    "return_and_exchange_date" TIMESTAMP(3),
    "invoice_file" TEXT,
    "refund_status" BOOLEAN DEFAULT false,
    "reason" TEXT,
    "message" TEXT,
    "delivery_partner" TEXT,
    "delivery_pincode" TEXT,
    "address_line1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "razorpay_order_id" TEXT,
    "shipping" BOOLEAN DEFAULT false,
    "product_return" TEXT,
    "return_order_id" TEXT,
    "exchange_order_id" TEXT,
    "return_date" TIMESTAMP(3),
    "exchange_date" TIMESTAMP(3),
    "return_exchange_images" JSONB,
    "mrp" DOUBLE PRECISION,
    "payment_mode" TEXT,
    "haatza_free_delivery" BOOLEAN DEFAULT false,
    "product_image" TEXT,
    "upi_delivery_fee" DOUBLE PRECISION,
    "coupon_code" TEXT,
    "coupon_discount" DOUBLE PRECISION,
    "delivery_charge" BOOLEAN DEFAULT false,
    "payment_method" TEXT,
    "quantity" INTEGER,
    "cod_delivery_fee" DOUBLE PRECISION,
    "return_exchange_tracking_id" TEXT,
    "return_order_tracking_id" TEXT,
    "pickup_address" TEXT,
    "used_wallet_amount" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "seller_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seller_orders_seller_id_idx" ON "seller_orders"("seller_id");
CREATE INDEX "seller_orders_order_id_idx" ON "seller_orders"("order_id");
CREATE INDEX "seller_orders_customer_name_idx" ON "seller_orders"("customer_name");
CREATE INDEX "seller_orders_buyer_email_idx" ON "seller_orders"("buyer_email");
CREATE INDEX "seller_orders_tracking_id_idx" ON "seller_orders"("tracking_id");
CREATE INDEX "seller_orders_status_idx" ON "seller_orders"("status");
CREATE INDEX "seller_orders_payment_status_idx" ON "seller_orders"("payment_status");
CREATE INDEX "seller_orders_seller_payment_status_idx" ON "seller_orders"("seller_payment_status");
CREATE INDEX "seller_orders_refund_status_idx" ON "seller_orders"("refund_status");
CREATE INDEX "seller_orders_created_date_idx" ON "seller_orders"("created_date");
CREATE INDEX "seller_orders_deleted_at_idx" ON "seller_orders"("deleted_at");
