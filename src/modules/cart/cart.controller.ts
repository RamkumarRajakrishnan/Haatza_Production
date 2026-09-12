import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
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
@Controller(['api/cart', 'api/v1/cart', 'cart', 'api/v1/getCart', 'getCart', 'api/getCart'])
export class CartController {
  constructor(@Inject(CartService) private readonly cartService: CartService) {}

  @ApiOperation({
    summary: 'Get user cart items (GET /api/v1/getCart or GET /api/v1/cart)',
    description:
      'Retrieves all cart items (move_to_wishlist = false) for a user or cartId in Wix-style camelCase.',
  })
  @ApiQuery({
    name: 'module',
    required: true,
    type: String,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiQuery({
    name: 'userId',
    required: true,
    type: String,
    description: 'User ID',
  })
  @ApiQuery({
    name: 'cartId',
    required: false,
    type: String,
    description: 'Cart ID',
  })
  @ApiQuery({
    name: 'toPincode',
    required: true,
    type: String,
    description: 'Destination pincode for delivery calculation',
  })
  @ApiResponse({ status: 200, description: 'Cart retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid module or missing parameters' })
  @Get(['', 'getCart'])
  @Post(['getCart'])
  @HttpCode(HttpStatus.OK)
  async getCart(
    @Query('module') queryModule?: string,
    @Query('userId') queryUserId?: string,
    @Query('cartId') queryCartId?: string,
    @Query('toPincode') queryToPincode?: string,
    @Query('pincode') queryPincode?: string,
    @Body() body?: { module?: string; userId?: string; cartId?: string; toPincode?: string; pincode?: string },
    @Req() req?: any,
  ) {
    let module = queryModule !== undefined ? queryModule : body?.module;
    let userId = queryUserId !== undefined ? queryUserId : body?.userId;
    const cartId = queryCartId !== undefined ? queryCartId : body?.cartId;
    const toPincode =
      queryToPincode !== undefined
        ? queryToPincode
        : queryPincode !== undefined
          ? queryPincode
          : body?.toPincode || body?.pincode;

    if (!module && req?.query?.userIdmodule) {
      module = req.query.userIdmodule;
    }
    if (!userId && req?.query?.['']) {
      userId = req.query[''];
    }
    if (!userId && (req?.query?.user_id || req?.query?.userid)) {
      userId = req.query.user_id || req.query.userid;
    }

    return this.cartService.getCart({ module, userId, cartId, toPincode });
  }

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
    summary: 'Move item from cart to save for later (POST /api/cart/moveToSaveForLater)',
    description:
      'Updates move_to_saveForLater = true in the SAME database table without creating a new table.',
  })
  @ApiQuery({
    name: 'module',
    required: true,
    type: String,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiResponse({ status: 200, description: 'Product moved to save for later successfully' })
  @ApiResponse({ status: 400, description: 'Invalid module or missing parameters' })
  @Post('moveToSaveForLater')
  @HttpCode(HttpStatus.OK)
  async moveToSaveForLater(
    @Query('module') module: string,
    @Body() dto: CartItemActionDto,
  ) {
    return this.cartService.moveToSaveForLater(dto, module);
  }
}
