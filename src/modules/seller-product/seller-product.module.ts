import { Module } from '@nestjs/common';
import { SellerProductController } from './seller-product.controller';
import { SellerProductService } from './seller-product.service';
import { DatabaseModule } from '../../database/database.module';

import { StorageService } from './storage.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SellerProductController],
  providers: [SellerProductService, StorageService],
  exports: [SellerProductService, StorageService],
})
export class SellerProductModule {}
