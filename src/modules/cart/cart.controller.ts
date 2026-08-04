import { Controller, Get, Post, Put, Delete, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CartService } from './cart.service';

@ApiTags('Cart')
@Controller(['cart', 'api/cart'])
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({ summary: 'Get active shopping cart' })
  @Get()
  getCart(@Query('userId') userId: string) {
    return this.cartService.getCart(userId || 'guest');
  }

  @ApiOperation({ summary: 'Add item to shopping cart' })
  @Post(['', 'add'])
  addItem(@Body() body: any) {
    return this.cartService.addItem(body.userId || 'guest', {
      productId: body.productId || body.id,
      quantity: Number(body.quantity) || 1,
      price: Number(body.price) || 0,
    });
  }

  @ApiOperation({ summary: 'Update item quantity in cart' })
  @Put(['update', ':productId'])
  updateItemQuantity(
    @Param('productId') paramProductId: string,
    @Body() body: any,
  ) {
    const productId = paramProductId || body.productId;
    return this.cartService.updateItemQuantity(
      body.userId || 'guest',
      productId,
      Number(body.quantity) || 0,
    );
  }

  @ApiOperation({ summary: 'Remove item from cart' })
  @Delete(['remove', ':productId'])
  removeItem(
    @Param('productId') paramProductId: string,
    @Body() body: any,
    @Query('productId') queryProductId: string,
  ) {
    const productId = paramProductId || queryProductId || body?.productId;
    return this.cartService.removeItem(body?.userId || 'guest', productId);
  }

  @ApiOperation({ summary: 'Clear all items from cart' })
  @Delete('clear')
  clearCart(@Body() body: any, @Query('userId') userId: string) {
    return this.cartService.clearCart(userId || body?.userId || 'guest');
  }
}
