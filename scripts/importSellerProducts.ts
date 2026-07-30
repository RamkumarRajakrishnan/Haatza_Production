import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SellerProductService } from '../src/modules/seller-product/seller-product.service';

async function bootstrap() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('❌ Error: Please provide a CSV file path.');
    console.log('Usage: npx ts-node scripts/importSellerProducts.ts <path-to-csv>');
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Error: File not found at path "${absolutePath}"`);
    process.exit(1);
  }

  console.log(`📂 Reading CSV file from: ${absolutePath}`);
  const csvData = fs.readFileSync(absolutePath, 'utf8');

  console.log('🚀 Initializing NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });

  const service = app.get(SellerProductService);

  console.log('⏳ Processing product import...');
  const startTime = Date.now();
  const result = await service.importCsvContent(csvData);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n================ IMPORT REPORT ================');
  console.log(`⏱️ Duration: ${duration} seconds`);
  console.log(`📊 Total Rows: ${result.stats.totalRows}`);
  console.log(`✅ Success Count: ${result.stats.successCount}`);
  console.log(`❌ Failed Count: ${result.stats.failedCount}`);

  if (result.errors.length > 0) {
    console.log('\n❌ Failures Summary (First 10 errors):');
    result.errors.slice(0, 10).forEach((err) => {
      console.log(`   - Row ${err.row}: ${err.error}`);
    });
  }
  console.log('===============================================\n');

  await app.close();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('💥 Fatal error during CSV import script:', err);
  process.exit(1);
});
