import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { SaveForLaterController } from './save-for-later.controller';
import { CartService } from './cart.service';

@Module({
  controllers: [CartController, SaveForLaterController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
