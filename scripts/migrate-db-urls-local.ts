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
  'http://haatza.com/media'
];
const NEW_PREFIX = 'http://haatza.com/uploads';

async function main() {
  console.log('🔄 Initializing database client...');
  const db = new DatabaseService();
  await db.onModuleInit();

  try {
    for (const prefix of OLD_PREFIXES) {
      console.log(`Replacing '${prefix}' -> '${NEW_PREFIX}'...`);
      const likePattern = `%${prefix}%`;
      const count = await db.$executeRaw`
        UPDATE products 
        SET main_media = REPLACE(main_media, ${prefix}, ${NEW_PREFIX}),
            product_images = REPLACE(product_images::text, ${prefix}, ${NEW_PREFIX})::json
        WHERE main_media LIKE ${likePattern} 
           OR product_images::text LIKE ${likePattern}
      `;
      console.log(`✅ Updated rows: ${count}`);
    }

    console.log('🧹 Cleaning up "haatza/" sub-prefix from new URLs...');
    const searchPattern = 'http://haatza.com/uploads/haatza/';
    const replacementPattern = 'http://haatza.com/uploads/';
    const cleanLikePattern = `%${searchPattern}%`;
    const cleanCount = await db.$executeRaw`
      UPDATE products 
      SET main_media = REPLACE(main_media, ${searchPattern}, ${replacementPattern}),
          product_images = REPLACE(product_images::text, ${searchPattern}, ${replacementPattern})::json
      WHERE main_media LIKE ${cleanLikePattern} 
         OR product_images::text LIKE ${cleanLikePattern}
    `;
    console.log(`✅ Cleaned up rows: ${cleanCount}`);

    console.log('🎉 Migration completed successfully!');
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message, err.stack);
  } finally {
    await db.onModuleDestroy();
    console.log('🔌 Database connection closed.');
  }
}

main();
