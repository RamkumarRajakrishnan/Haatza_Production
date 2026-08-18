import { DatabaseService } from '../src/database/database.service';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testLiveDashboardQuery() {
  console.log('Testing live query against production DB target...');
  const db = new DatabaseService();
  await db.onModuleInit();

  const service = new DashboardService(db);
  try {
    const res = await service.getHaatzaDashboard({
      module: 'HAATZA' as any,
      categoryId: 'cate002',
    });
    console.log('SUCCESS_LIVE_TEST_RESULT:', JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error('ERROR_LIVE_TEST:', err);
  } finally {
    await db.onModuleDestroy();
  }
}

testLiveDashboardQuery();
