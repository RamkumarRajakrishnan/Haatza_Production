-- CreateTable: category_sponsored
CREATE TABLE IF NOT EXISTS "category_sponsored" (
    "id" TEXT NOT NULL DEFAULT fn_next_category_sponsored_id(),
    "widget_type" TEXT,
    "widget_id" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT DEFAULT 'ACTIVE',
    "sequence" INTEGER,
    "category_id" TEXT,
    "category_name" TEXT,
    "warehouse_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "module" "DashboardModule" DEFAULT 'HAATZA',
    "Item" JSONB,

    CONSTRAINT "category_sponsored_pkey" PRIMARY KEY ("id")
);

-- Create Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "category_sponsored_widget_id_key" ON "category_sponsored"("widget_id");
CREATE INDEX IF NOT EXISTS "category_sponsored_widget_id_idx" ON "category_sponsored"("widget_id");
CREATE INDEX IF NOT EXISTS "category_sponsored_widget_type_idx" ON "category_sponsored"("widget_type");
CREATE INDEX IF NOT EXISTS "category_sponsored_module_idx" ON "category_sponsored"("module");
CREATE INDEX IF NOT EXISTS "category_sponsored_category_id_idx" ON "category_sponsored"("category_id");
