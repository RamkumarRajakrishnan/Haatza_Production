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
import { CartItemActionDto } from './dto/cart-item-action.dto';

@ApiTags('SaveForLater')
@Controller([
  'api/saveForLater',
  'api/v1/saveForLater',
  'saveForLater',
  'api/v1/getSaveForLater',
  'getSaveForLater',
  'api/getSaveForLater',
])
export class SaveForLaterController {
  constructor(@Inject(CartService) private readonly cartService: CartService) {}

  @ApiOperation({
    summary: 'Get user save for later items (GET /api/v1/saveForLater or GET /api/v1/getSaveForLater)',
    description:
      'Retrieves all save for later items (move_to_saveForLater = true) for a user or cartId in Wix-style camelCase.',
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
  @ApiResponse({ status: 200, description: 'Save for later items retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid module or missing parameters' })
  @Get(['', 'saveForLater', 'getSaveForLater'])
  @Post(['', 'saveForLater', 'getSaveForLater'])
  @HttpCode(HttpStatus.OK)
  async getSaveForLater(
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

    return this.cartService.getSaveForLater({ module, userId, cartId, toPincode });
  }

  @ApiOperation({
    summary: 'Add product to save for later (POST /api/saveForLater/addToSaveForLater)',
    description:
      'Adds a product to save for later. Stores in the SAME database table as cart with move_to_saveForLater = true.',
  })
  @ApiQuery({
    name: 'module',
    required: true,
    type: String,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiResponse({ status: 200, description: 'Product added to save for later successfully' })
  @ApiResponse({ status: 400, description: 'Invalid module or missing parameters' })
  @Post('addToSaveForLater')
  @HttpCode(HttpStatus.OK)
  async addToSaveForLater(
    @Query('module') module: string,
    @Body() dto: AddToCartDto,
  ) {
    return this.cartService.addToSaveForLater(dto, module);
  }

  @ApiOperation({
    summary: 'Move item from save for later to cart (POST /api/saveForLater/moveToCart)',
    description:
      'Updates move_to_saveForLater = false in the SAME database table. Increments quantity if cart item already exists.',
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
    summary: 'Remove item from save for later (POST /api/saveForLater/removeFromSaveForLater)',
    description:
      'Deletes item from save for later (move_to_saveForLater = true). Does not delete cart rows.',
  })
  @ApiQuery({
    name: 'module',
    required: true,
    type: String,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiResponse({ status: 200, description: 'Product removed from save for later successfully' })
  @ApiResponse({ status: 400, description: 'Invalid module or missing parameters' })
  @Post('removeFromSaveForLater')
  @HttpCode(HttpStatus.OK)
  async removeFromSaveForLater(
    @Query('module') module: string,
    @Body() dto: CartItemActionDto,
  ) {
    return this.cartService.removeFromSaveForLater(dto, module);
  }
}
