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
import { CartItemActionDto } from './dto/cart-item-action.dto';

@ApiTags('Wishlist')
@Controller(['api/wishlist', 'api/v1/wishlist', 'wishlist'])
export class WishlistController {
  constructor(@Inject(CartService) private readonly cartService: CartService) {}

  @ApiOperation({
    summary: 'Add product to wishlist (POST /api/wishlist/addToWishlist)',
    description:
      'Adds a product to wishlist. Stores in the SAME database table as cart with move_to_wishlist = true.',
  })
  @ApiQuery({
    name: 'module',
    required: true,
    type: String,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiResponse({ status: 200, description: 'Product added to wishlist successfully' })
  @ApiResponse({ status: 400, description: 'Invalid module or missing parameters' })
  @Post('addToWishlist')
  @HttpCode(HttpStatus.OK)
  async addToWishlist(
    @Query('module') module: string,
    @Body() dto: AddToCartDto,
  ) {
    return this.cartService.addToWishlist(dto, module);
  }

  @ApiOperation({
    summary: 'Move item from wishlist to cart (POST /api/wishlist/moveToCart)',
    description:
      'Updates move_to_wishlist = false in the SAME database table. Increments quantity if cart item already exists.',
  })
  @ApiQuery({
    name: 'module',
    required: true,
    type: String,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiResponse({ status: 200, description: 'Product moved to cart successfully' })
  @ApiResponse({ status: 400, description: 'Invalid module or missing parameters' })
  @Post('moveToCart')
  @HttpCode(HttpStatus.OK)
  async moveToCart(
    @Query('module') module: string,
    @Body() dto: CartItemActionDto,
  ) {
    return this.cartService.moveToCart(dto, module);
  }

  @ApiOperation({
    summary: 'Remove item from wishlist (POST /api/wishlist/removeFromWishlist)',
    description:
      'Deletes item from wishlist (move_to_wishlist = true). Does not delete cart rows.',
  })
  @ApiQuery({
    name: 'module',
    required: true,
    type: String,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiResponse({ status: 200, description: 'Product removed from wishlist successfully' })
  @ApiResponse({ status: 400, description: 'Invalid module or missing parameters' })
  @Post('removeFromWishlist')
  @HttpCode(HttpStatus.OK)
  async removeFromWishlist(
    @Query('module') module: string,
    @Body() dto: CartItemActionDto,
  ) {
    return this.cartService.removeFromWishlist(dto, module);
  }
}
