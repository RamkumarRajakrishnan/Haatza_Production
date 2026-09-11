-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SponsorAdvertiserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "sponsor_advertisers" (
    "id" TEXT NOT NULL,
    "advertiser_name" TEXT NOT NULL,
    "advertiser_logo" TEXT,
    "gst_number" TEXT NOT NULL,
    "gst_certificate" TEXT,
    "pan" TEXT NOT NULL,
    "pan_card" TEXT,
    "status" "SponsorAdvertiserStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sponsor_advertisers_pkey" PRIMARY KEY ("id")
);
