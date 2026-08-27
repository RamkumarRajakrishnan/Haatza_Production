import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { WixImageMigrationService } from '../src/modules/media-storage/wix-image-migration.service';
import { DatabaseService } from '../src/database/database.service';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function safeParseJson(val: string): any {
  if (!val || val.trim() === '' || val.trim() === '[]' || val.trim() === '{}') return null;
  try {
    return JSON.parse(val.trim());
  } catch {
    return null;
  }
}

function safeParseStringArray(val: string): string[] {
  if (!val || val.trim() === '') return [];
  try {
    const parsed = JSON.parse(val.trim());
    if (Array.isArray(parsed)) return parsed.map(String);
    return [String(parsed)];
  } catch {
    if (val.startsWith('[') && val.endsWith(']')) {
      const cleaned = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      return cleaned.filter(Boolean);
    }
    return [val.trim()];
  }
}

function safeParseBoolean(val: string): boolean | null {
  if (!val || val.trim() === '') return null;
  const upper = val.trim().toUpperCase();
  return upper === 'TRUE' || upper === '1' || upper === 'YES';
}

function safeParseFloat(val: string): number | null {
  if (!val || val.trim() === '') return null;
  // Clean currency symbols or commas if present
  const cleaned = val.replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function safeParseInt(val: string): number | null {
  if (!val || val.trim() === '') return null;
  const cleaned = val.replace(/[^\d.-]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function safeParseDate(val: string): Date | null {
  if (!val || val.trim() === '') return null;
  const date = new Date(val.trim());
  return isNaN(date.getTime()) ? null : date;
}

async function run() {
  console.log('🚀 Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const wixMigrator = app.get(WixImageMigrationService);
  const db = app.get(DatabaseService);

  const csvPath = path.join(process.cwd(), 'Products.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Products.csv not found at: ${csvPath}`);
    await app.close();
    process.exit(1);
  }

  console.log(`📖 Reading Products.csv...`);
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length <= 1) {
    console.error('❌ CSV file is empty or only contains headers.');
    await app.close();
    process.exit(1);
  }

  const headers = parseCsvLine(lines[0]);
  console.log(`✅ Loaded ${lines.length - 1} products from CSV. Parsing headers...`);

  let successCount = 0;
  let errorCount = 0;
  const batchSize = 10;

  for (let i = 1; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch: ${Math.floor(i / batchSize) + 1}/${Math.ceil((lines.length - 1) / batchSize)}`);

    const promises = batch.map(async (line, index) => {
      const lineNum = i + index;
      const fields = parseCsvLine(line);
      if (fields.length < headers.length) {
        // Padd fields if line was cut short
        while (fields.length < headers.length) fields.push('');
      }

      const row: any = {};
      headers.forEach((header, idx) => {
        row[header] = fields[idx] || '';
      });

      const productId = row['ID'];
      if (!productId) {
        console.warn(`⚠️ [Line ${lineNum}] Missing ID field, skipping.`);
        return;
      }

      try {
        console.log(`🔄 [Product ${productId}] Starting migration...`);

        const forceRebuild = process.env.FORCE_REBUILD === 'true';

        // 1. Migrate Mainmedia URL
        let mainMedia = row['Mainmedia'] || null;
        if (mainMedia && wixMigrator.isWixUrl(mainMedia)) {
          mainMedia = await wixMigrator.migrateWixUrl(productId, mainMedia, forceRebuild);
        }

        // 2. Migrate Product Images Json
        let productImages = safeParseJson(row['Product Images']);
        if (productImages) {
          productImages = await wixMigrator.migrateProductImagesJson(productId, productImages, forceRebuild);
        }

        // 3. Construct clean DB object
        const data = {
          mainMedia,
          oneRsStore: safeParseBoolean(row['1 Rs Store']),
          productImages: productImages ?? undefined,
          name: row['Name'] || '',
          searchKeywords: safeParseStringArray(row['search_keywords']),
          subCategory: row['Sub Category'] || null,
          subCategoryId: row['Sub Category ID'] || null,
          brand: row['Brand'] || null,
          inventory: safeParseInt(row['Inventory']) || 0,
          variantPrice: safeParseJson(row['varient Price']),
          wixProductId: row['Product ID'] || null,
          newVariantPrice: safeParseJson(row['New Varient Price']),
          mrp: safeParseFloat(row['MRP']),
          onsalePrice: safeParseFloat(row['onsalePrice']),
          cod: safeParseFloat(row['COD']),
          upi: safeParseFloat(row['UPI']),
          price: safeParseFloat(row['Price']),
          discount: safeParseJson(row['Discount']),
          status: row['status'] || null,
          deliveryCharges: safeParseBoolean(row['Delivery Charges']),
          mainCategory: row['MainCategory'] || null,
          sellerId: row['Seller ID'] || null,
          shippingWeight: safeParseFloat(row['Shipping Weight']),
          collections: safeParseStringArray(row['Collections']),
          sellerPincode: row['Seller PinCode'] || null,
          createdDate: safeParseDate(row['Created Date']),
          updatedDate: safeParseDate(row['Updated Date']),
          owner: row['Owner'] || null,
          productOptions: safeParseJson(row['Product Options']),
          additionalInfoSections: safeParseJson(row['additionalInfoSections']),
          activeAd: safeParseBoolean(row['Active Ad']),
          averageCpc: safeParseFloat(row['averageCPC']),
          priorityScore: safeParseInt(row['Priority Score']),
          campaignId: row['Campaign ID'] || null,
          reach: safeParseInt(row['Reach']),
          impression: safeParseInt(row['Impression']),
          clicks: safeParseInt(row['Clicks']),
          sales: safeParseInt(row['sales']),
          revenue: safeParseFloat(row['revenue']),
          categoryName: safeParseStringArray(row['Category Name']),
          sku: row['SKU'] || null,
          productType: row['Product Type'] || null,
          manageVariants: safeParseBoolean(row['Manage Variants']),
          ribbon: row['Ribbon'] || null,
          trackInventory: safeParseBoolean(row['trackInventory']),
          influencerBranding: safeParseBoolean(row['Influencer Branding']),
          haatzaVerified: safeParseBoolean(row['Haatzaverified']),
          promotionPhotos: safeParseStringArray(row['Promotion Photos']),
          paymentType: row['Payment type'] || null,
          productReturn: row['ProductReturn'] || null,
          sizeChart: row['Size chart'] || null,
          description: row['Description'] || null,
          gstSeller: safeParseFloat(row['gstSeller']),
          upiPaymentDiscount: safeParseFloat(row['upipaymentDiscount']),
          manageListingProducts: row['Manage listing Products'] || null,
          sellAndEarnCommission: safeParseFloat(row['Sell and Earn Commission']),
          sellAndEarn: row['sellAndEarn'] || null,
        };

        // 4. Upsert into database
        await db.product.upsert({
          where: { id: productId },
          update: data,
          create: { id: productId, ...data },
        });

        console.log(`✅ [Product ${productId}] Successfully imported and migrated.`);
        successCount++;
      } catch (err) {
        console.error(`❌ [Line ${lineNum}] Error importing product ${productId}:`, err);
        errorCount++;
      }
    });

    await Promise.all(promises);
  }

  console.log(`\n🎉 Import and Migration completed!`);
  console.log(`✨ Successes: ${successCount}`);
  console.log(`⚠️ Errors: ${errorCount}`);

  await app.close();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Script failed catastrophically:', err);
  process.exit(1);
});
