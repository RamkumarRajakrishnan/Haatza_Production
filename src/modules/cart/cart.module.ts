import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { WishlistController } from './wishlist.controller';
import { CartService } from './cart.service';

@Module({
  controllers: [CartController, WishlistController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
