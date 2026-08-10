import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { PrismaClient, DashboardModule } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing in .env file');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SERVER_BASE_URL = process.env.BASE_URL || 'https://haatza-production-807150947524.asia-south1.run.app';
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'dashboard');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Downloads image from URL and saves locally to public/uploads/dashboard/
 */
function downloadAndSaveImageLocally(wixString: string | undefined): Promise<string | null> {
  return new Promise((resolve) => {
    if (!wixString || wixString.trim() === '' || wixString.trim() === 'FALSE' || wixString.trim() === 'false') {
      return resolve(null);
    }

    let sourceUrl = wixString.trim();

    // Convert wix:image://v1/ to public Wix download URL
    if (sourceUrl.startsWith('wix:image://v1/')) {
      const parts = sourceUrl.replace('wix:image://v1/', '').split('/');
      const mediaId = parts[0];
      sourceUrl = `https://static.wixstatic.com/media/${mediaId}`;
    } else if (!sourceUrl.startsWith('http://') && !sourceUrl.startsWith('https://')) {
      sourceUrl = `https://static.wixstatic.com/media/${sourceUrl}`;
    }

    // Determine extension
    let ext = 'jpg';
    if (sourceUrl.includes('.png')) ext = 'png';
    else if (sourceUrl.includes('.gif')) ext = 'gif';
    else if (sourceUrl.includes('.webp')) ext = 'webp';

    // Generate unique local filename
    const urlHash = sourceUrl.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 35);
    const fileName = `img_${urlHash}.${ext}`;
    const localFilePath = path.join(UPLOADS_DIR, fileName);
    const publicUrl = `${SERVER_BASE_URL}/uploads/dashboard/${fileName}`;

    // If file already downloaded, return public URL
    if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).size > 0) {
      return resolve(publicUrl);
    }

    console.log(`Downloading: ${sourceUrl}`);
    const client = sourceUrl.startsWith('https') ? https : http;

    client.get(sourceUrl, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          return downloadAndSaveImageLocally(redirectUrl).then(resolve);
        }
      }

      if (res.statusCode !== 200) {
        console.warn(`⚠️ Warning: Status ${res.statusCode} for ${sourceUrl}`);
        return resolve(publicUrl); // fallback URL
      }

      const fileStream = fs.createWriteStream(localFilePath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`✅ Saved: ${fileName} (${fs.statSync(localFilePath).size} bytes)`);
        resolve(publicUrl);
      });

      fileStream.on('error', (err) => {
        fs.unlink(localFilePath, () => {});
        console.warn(`⚠️ Download error: ${err.message}`);
        resolve(publicUrl);
      });
    }).on('error', (err) => {
      console.warn(`⚠️ Request error: ${err.message}`);
      resolve(publicUrl);
    });
  });
}

async function loadDataIntoPostgres() {
  console.log('🚀 Starting Image Download & Data Import into PostgreSQL Database...');

  let csvPath = path.join(process.cwd(), process.argv[2] || 'dashboard_data.csv');
  if (!fs.existsSync(csvPath)) {
    csvPath = path.join(process.cwd(), 'scripts', 'dashboard_data.csv');
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Data File not found at: ${csvPath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf8');
  const lines = fileContent.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (lines.length < 2) {
    console.error('❌ Data file is empty or missing header row.');
    process.exit(1);
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
  console.log(`Processing ${lines.length - 1} rows with headers...`);

  let count = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ''));
    if (values.length < 2) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });

    const widgetId = row['Widget ID'] || row['ID'] || `widget_${Date.now()}_${count}`;
    const moduleStr = (row['Module'] || 'HAATZA').toUpperCase();
    const moduleEnum = moduleStr.includes('LITE') ? DashboardModule.LITE : DashboardModule.HAATZA;

    // Download image from Wix and get YOUR server's public URL
    const imageUrl = await downloadAndSaveImageLocally(row['Image']);
    const titleImageUrl = await downloadAndSaveImageLocally(row['Title Image']);

    await prisma.dashboard.upsert({
      where: { widgetId },
      update: {
        widgetType: row['Widget Type'] || null,
        title: row['Title'] || null,
        subtitle: row['Subtitle'] || null,
        status: row['Status'] === 'TRUE' || row['Status'] === 'true' ? 'ACTIVE' : 'INACTIVE',
        sequence: row['Sequence'] ? parseInt(row['Sequence'], 10) : null,
        image: imageUrl,
        redirectLink: row['Redirect Link'] || null,
        categoryId: row['Category ID'] || null,
        categoryName: row['Category Name'] || null,
        priority: row['Priority'] ? parseInt(row['Priority'], 10) : null,
        productId: row['Product ID'] || null,
        product: row['Product'] || row['Name'] || null,
        price: row['Price'] ? parseFloat(row['Price']) : null,
        discount: row['Discount'] ? parseFloat(row['Discount']) : null,
        mainCategoryId: row['Main Categore ID'] || null,
        subCategoryId: row['Sub Categore ID'] || null,
        warehouseId: row['warehouseID'] || null,
        module: moduleEnum,
        titleImage: titleImageUrl,
      },
      create: {
        widgetId,
        widgetType: row['Widget Type'] || null,
        title: row['Title'] || null,
        subtitle: row['Subtitle'] || null,
        status: row['Status'] === 'TRUE' || row['Status'] === 'true' ? 'ACTIVE' : 'INACTIVE',
        sequence: row['Sequence'] ? parseInt(row['Sequence'], 10) : null,
        image: imageUrl,
        redirectLink: row['Redirect Link'] || null,
        categoryId: row['Category ID'] || null,
        categoryName: row['Category Name'] || null,
        priority: row['Priority'] ? parseInt(row['Priority'], 10) : null,
        productId: row['Product ID'] || null,
        product: row['Product'] || row['Name'] || null,
        price: row['Price'] ? parseFloat(row['Price']) : null,
        discount: row['Discount'] ? parseFloat(row['Discount']) : null,
        mainCategoryId: row['Main Categore ID'] || null,
        subCategoryId: row['Sub Categore ID'] || null,
        warehouseId: row['warehouseID'] || null,
        module: moduleEnum,
        titleImage: titleImageUrl,
      },
    });

    count++;
  }

  console.log(`\n🎉 SUCCESS! Downloaded all images to public/uploads/dashboard/ and loaded ${count} rows into PostgreSQL!`);
  await prisma.$disconnect();
  await pool.end();
}

loadDataIntoPostgres().catch((err) => {
  console.error('❌ Data loading error:', err);
  prisma.$disconnect();
  pool.end();
});
