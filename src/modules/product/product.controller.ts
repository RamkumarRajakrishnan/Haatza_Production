import { Controller, Get, Post, Body, Query, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { ProductListQueryDto } from './dto/product-list.dto';

@ApiTags('Products')
@Controller(['products-list', 'Products-list', 'api/v1/products-list', 'api/v1/Products-list'])
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @ApiOperation({ summary: 'Get list of products with pagination and filters (GET)' })
  @Get()
  @HttpCode(HttpStatus.OK)
  async getProductsListGet(@Query() query: ProductListQueryDto, @Req() req: any) {
    const authenticatedSellerId = req.user?.sellerId || req.user?.id;
    return this.productService.getProductsList(query, authenticatedSellerId);
  }

  @ApiOperation({ summary: 'Get list of products with pagination and filters via body payload (POST)' })
  @Post()
  @HttpCode(HttpStatus.OK)
  async getProductsListPost(@Body() query: ProductListQueryDto, @Req() req: any) {
    const authenticatedSellerId = req.user?.sellerId || req.user?.id;
    return this.productService.getProductsList(query, authenticatedSellerId);
  }
}
