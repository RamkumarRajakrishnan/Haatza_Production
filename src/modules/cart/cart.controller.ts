import {
  Controller,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartQuantityDto } from './dto/update-cart-quantity.dto';
import { CartItemActionDto } from './dto/cart-item-action.dto';

@ApiTags('Cart')
@Controller(['api/cart', 'api/v1/cart', 'cart'])
export class CartController {
  constructor(@Inject(CartService) private readonly cartService: CartService) {}

  @ApiOperation({
    summary: 'Add product to cart (POST /api/cart/addToCart)',
    description:
      'Adds a product to the user cart. Case-sensitive module required (haatza or lite). Stores in single table with move_to_wishlist = false.',
  })
  @ApiQuery({
    name: 'module',
    required: true,
    type: String,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiResponse({ status: 200, description: 'Product added to cart successfully' })
  @ApiResponse({ status: 400, description: 'Invalid module or missing parameters' })
  @Post('addToCart')
  @HttpCode(HttpStatus.OK)
  async addToCart(
    @Query('module') module: string,
    @Body() dto: AddToCartDto,
  ) {
    return this.cartService.addToCart(dto, module);
  }

  @ApiOperation({
    summary: 'Update cart item quantity (POST /api/cart/updateQuantity)',
    description:
      'Updates quantity for a cart item (move_to_wishlist = false). Deletes row if quantity <= 0.',
  })
  @ApiQuery({
    name: 'module',
    required: true,
    type: String,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiResponse({ status: 200, description: 'Cart quantity updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid module or missing parameters' })
  @Post('updateQuantity')
  @HttpCode(HttpStatus.OK)
  async updateQuantity(
    @Query('module') module: string,
    @Body() dto: UpdateCartQuantityDto,
  ) {
    return this.cartService.updateQuantity(dto, module);
  }

  @ApiOperation({
    summary: 'Remove item from cart (POST /api/cart/removeFromCart)',
    description:
      'Deletes the item from cart (move_to_wishlist = false). Does not delete wishlist rows.',
  })
  @ApiQuery({
    name: 'module',
    required: true,
    type: String,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiResponse({ status: 200, description: 'Product removed from cart successfully' })
  @ApiResponse({ status: 400, description: 'Invalid module or missing parameters' })
  @Post('removeFromCart')
  @HttpCode(HttpStatus.OK)
  async removeFromCart(
    @Query('module') module: string,
    @Body() dto: CartItemActionDto,
  ) {
    return this.cartService.removeFromCart(dto, module);
  }

  @ApiOperation({
    summary: 'Move item from cart to wishlist (POST /api/cart/moveToWishlist)',
    description:
      'Updates move_to_wishlist = true in the SAME database table without creating a new table.',
  })
  @ApiQuery({
    name: 'module',
    required: true,
    type: String,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiResponse({ status: 200, description: 'Product moved to wishlist successfully' })
  @ApiResponse({ status: 400, description: 'Invalid module or missing parameters' })
  @Post('moveToWishlist')
  @HttpCode(HttpStatus.OK)
  async moveToWishlist(
    @Query('module') module: string,
    @Body() dto: CartItemActionDto,
  ) {
    return this.cartService.moveToWishlist(dto, module);
  }
}
