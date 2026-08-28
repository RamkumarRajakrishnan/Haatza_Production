import { DatabaseService } from '../src/database/database.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const OLD_PREFIXES = [
  'https://storage.googleapis.com/haatza-media-bucket',
  'https://seller.haatza.com/api/v1/media',
  'https://www.haatza.com/api/v1/media',
  'https://seller.haatza.com/media',
  'https://www.haatza.com/media',
  'https://haatza.com/media',
  'https://haatza.com/api/v1/media',
  'https://media.haatza.com',
  'http://haatza.com/uploads',
  'http://haatza.com/media',
  'https://haatza.com/media',
  'https://haatza.com/uploads'
];
const NEW_PREFIX = 'https://storage.googleapis.com/haatza-media-bucket';

async function main() {
  console.log('🔄 Initializing database client...');
  const db = new DatabaseService();
  await db.onModuleInit();

  try {
    console.log('📖 Fetching all products from database...');
    const products = await db.product.findMany({
      select: {
        id: true,
        mainMedia: true,
        productImages: true
      }
    });
    console.log(`✅ Fetched ${products.length} products. Processing replacements...`);

    let updatedCount = 0;

    for (const p of products) {
      let isChanged = false;
      let mainMedia = p.mainMedia;
      let productImages = p.productImages;

      // 1. Replace mainMedia
      if (mainMedia) {
        for (const prefix of OLD_PREFIXES) {
          if (prefix === NEW_PREFIX) continue;
          if (mainMedia.includes(prefix)) {
            mainMedia = mainMedia.replace(prefix, NEW_PREFIX);
            isChanged = true;
          }
        }
        // Cleanup haatza/ sub-prefix
        const badSub = 'https://storage.googleapis.com/haatza-media-bucket/haatza/';
        const goodSub = 'https://storage.googleapis.com/haatza-media-bucket/';
        if (mainMedia.includes(badSub)) {
          mainMedia = mainMedia.replace(badSub, goodSub);
          isChanged = true;
        }
      }

      // 2. Replace productImages JSON
      if (productImages && typeof productImages === 'object') {
        let stringified = JSON.stringify(productImages);
        let imgChanged = false;
        for (const prefix of OLD_PREFIXES) {
          if (prefix === NEW_PREFIX) continue;
          if (stringified.includes(prefix)) {
            stringified = stringified.replace(new RegExp(prefix, 'g'), NEW_PREFIX);
            imgChanged = true;
          }
        }
        const badSub = 'https://storage.googleapis.com/haatza-media-bucket/haatza/';
        const goodSub = 'https://storage.googleapis.com/haatza-media-bucket/';
        if (stringified.includes(badSub)) {
          stringified = stringified.replace(new RegExp(badSub, 'g'), goodSub);
          imgChanged = true;
        }

        if (imgChanged) {
          productImages = JSON.parse(stringified);
          isChanged = true;
        }
      }

      if (isChanged) {
        await db.product.update({
          where: { id: p.id },
          data: {
            mainMedia,
            productImages: productImages ?? undefined
          }
        });
        updatedCount++;
      }
    }

    console.log(`🎉 Migration completed! Updated ${updatedCount} products.`);
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message, err.stack);
  } finally {
    await db.onModuleDestroy();
    console.log('🔌 Database connection closed.');
  }
}

main();
