import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { SellerOrderController } from './seller-order.controller';
import { SellerOrderService } from './seller-order.service';
import { SellerOrderRepository } from './repositories/seller-order.repository';
import { DatabaseModule } from '../../database/database.module';
import { MediaStorageModule } from '../media-storage/media-storage.module';

@Module({
  imports: [DatabaseModule, MediaStorageModule],
  controllers: [OrderController, SellerOrderController],
  providers: [OrderService, SellerOrderService, SellerOrderRepository],
  exports: [OrderService, SellerOrderService, SellerOrderRepository],
})
export class OrderModule {}
