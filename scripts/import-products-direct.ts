import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma: any = new PrismaClient({ adapter });

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
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

function parseString(val: string): string | null {
  if (!val || val.trim() === '') return null;
  return val.trim();
}

function parseIntVal(val: string, defaultVal: number | null = null): number | null {
  if (!val || val.trim() === '') return defaultVal;
  const num = parseInt(val.trim(), 10);
  return isNaN(num) ? defaultVal : num;
}

function parseFloatVal(val: string, defaultVal: number | null = null): number | null {
  if (!val || val.trim() === '') return defaultVal;
  const num = parseFloat(val.trim());
  return isNaN(num) ? defaultVal : num;
}

function parseBoolean(val: string, defaultVal: boolean | null = null): boolean | null {
  if (!val || val.trim() === '') return defaultVal;
  const lower = val.trim().toLowerCase();
  return lower === 'true' || lower === '1' || lower === 'yes';
}

function parseJson(val: string): any {
  if (!val || val.trim() === '') return null;
  try {
    return JSON.parse(val.trim());
  } catch {
    return val.trim();
  }
}

function parseStringArray(val: string): string[] {
  if (!val || val.trim() === '') return [];
  try {
    const parsed = JSON.parse(val.trim());
    if (Array.isArray(parsed)) {
      return parsed.map(v => String(v));
    }
  } catch {}
  return val.split(',').map(v => v.trim()).filter(Boolean);
}

function parseDate(val: string): Date | null {
  if (!val || val.trim() === '') return null;
  const d = new Date(val.trim());
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('❌ Error: Please provide a CSV file path.');
    console.log('Usage: npx ts-node scripts/import-products-direct.ts <path-to-csv>');
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Error: File not found at path "${absolutePath}"`);
    process.exit(1);
  }

  console.log(`📂 Reading CSV file from: ${absolutePath}`);
  const csvContent = fs.readFileSync(absolutePath, 'utf8');
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length < 2) {
    console.error('❌ Error: CSV file is empty or missing data.');
    process.exit(1);
  }

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
  console.log(`📊 Found ${lines.length - 1} rows to process.`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 2) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });

    // Map fields to Product model schema
    const productData = {
      id: row['ID'] || undefined,
      mainMedia: parseString(row['Mainmedia']),
      oneRsStore: parseBoolean(row['1 Rs Store'], false),
      productImages: parseJson(row['Product Images']),
      name: row['Name'] || 'Unnamed Product',
      searchKeywords: parseStringArray(row['search_keywords']),
      subCategory: parseString(row['Sub Category']),
      subCategoryId: parseString(row['Sub Category ID']),
      brand: parseString(row['Brand']),
      inventory: parseIntVal(row['Inventory'], 0) || 0,
      variantPrice: parseJson(row['varient Price']),
      wixProductId: parseString(row['Product ID']),
      newVariantPrice: parseJson(row['New Varient Price']),
      mrp: parseFloatVal(row['MRP']),
      onsalePrice: parseFloatVal(row['onsalePrice']),
      cod: parseFloatVal(row['COD']),
      upi: parseFloatVal(row['UPI']),
      price: parseFloatVal(row['Price']),
      discount: parseJson(row['Discount']),
      status: parseString(row['status']),
      deliveryCharges: parseBoolean(row['Delivery Charges']),
      mainCategory: parseString(row['MainCategory']),
      sellerId: parseString(row['Seller ID']),
      shippingWeight: parseFloatVal(row['Shipping Weight']),
      collections: parseStringArray(row['Collections']),
      sellerPincode: parseString(row['Seller PinCode']),
      createdDate: parseDate(row['Created Date']),
      updatedDate: parseDate(row['Updated Date']),
      owner: parseString(row['Owner']),
      productOptions: parseJson(row['Product Options']),
      additionalInfoSections: parseJson(row['additionalInfoSections']),
      activeAd: parseBoolean(row['Active Ad'], false),
      averageCpc: parseFloatVal(row['averageCPC']),
      priorityScore: parseIntVal(row['Priority Score']),
      campaignId: parseString(row['Campaign ID']),
      reach: parseIntVal(row['Reach']),
      impression: parseIntVal(row['Impression']),
      clicks: parseIntVal(row['Clicks']),
      sales: parseIntVal(row['sales']),
      revenue: parseFloatVal(row['revenue']),
      categoryName: parseStringArray(row['Category Name']),
      sku: parseString(row['SKU']),
      productType: parseString(row['Product Type']),
      manageVariants: parseBoolean(row['Manage Variants']),
      ribbon: parseString(row['Ribbon']),
      trackInventory: parseBoolean(row['trackInventory']),
      influencerBranding: parseBoolean(row['Influencer Branding']),
      haatzaVerified: parseBoolean(row['Haatzaverified']),
      promotionPhotos: parseStringArray(row['Promotion Photos']),
      paymentType: parseString(row['Payment type']),
      productReturn: parseString(row['ProductReturn']),
      sizeChart: parseString(row['Size chart']),
      description: parseString(row['Description']),
      gstSeller: parseFloatVal(row['gstSeller']),
      upiPaymentDiscount: parseFloatVal(row['upipaymentDiscount']),
      manageListingProducts: parseString(row['Manage listing Products']),
      sellAndEarnCommission: parseFloatVal(row['Sell and Earn Commission']),
      sellAndEarn: parseString(row['sellAndEarn']),
    };

    try {
      if (productData.id) {
        await prisma.product.upsert({
          where: { id: productData.id },
          update: productData,
          create: productData,
        });
      } else {
        await prisma.product.create({
          data: productData,
        });
      }
      successCount++;
    } catch (err: any) {
      errorCount++;
      console.error(`❌ Error on row ${i} (${productData.name}):`, err.message);
    }

    if (i % 100 === 0) {
      console.log(`⏳ Processed ${i} rows...`);
    }
  }

  console.log('\n================ IMPORT REPORT ================');
  console.log(`✅ Success: ${successCount} products loaded/updated.`);
  console.log(`❌ Failures: ${errorCount} errors.`);
  console.log('===============================================\n');
}

main()
  .catch(err => {
    console.error('💥 Fatal error:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
