import { Module } from '@nestjs/common';
import { SellerProductController } from './seller-product.controller';
import { SellerProductService } from './seller-product.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SellerProductController],
  providers: [SellerProductService],
  exports: [SellerProductService],
})
export class SellerProductModule {}
