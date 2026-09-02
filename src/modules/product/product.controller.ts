import { Controller, Get, Post, Body, Query, Req, HttpCode, HttpStatus, Param, Patch, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { ProductListQueryDto } from './dto/product-list.dto';
import { CreateProductDto, UpdateProductDto, InventoryUpdateDto, CollectionsUpdateDto, MediaUpdateDto, StatusUpdateDto, PricingUpdateDto, AdStatsUpdateDto } from './dto/product-rest.dto';

@ApiTags('Products')
@Controller(['_functions', 'api/v1', 'api', ''])
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @ApiOperation({
    summary: 'Get interleaved 2-Ad / 2-Organic products by Sub Category ID (GET/POST /api/v1/ProductsBySubCategoryId)',
    description: 'Queries Bucket A (Ads) and Bucket B (Organic) by sub_category_id in parallel and returns interleaved products with limit=20 per page, along with categoryFilters.',
  })
  @Get([
    'ProductsBySubCategoryId',
    'productsBySubCategoryId',
    'ProductsBySubCategoryId/:subCategoryId',
    'productsBySubCategoryId/:subCategoryId',
    'products/category/:categoryId',
    'api/products/category/:categoryId',
    'category/:categoryId/products',
  ])
  @Post([
    'ProductsBySubCategoryId',
    'productsBySubCategoryId',
    'ProductsBySubCategoryId/:subCategoryId',
    'productsBySubCategoryId/:subCategoryId',
    'products/category/:categoryId',
    'api/products/category/:categoryId',
    'category/:categoryId/products',
  ])
  @HttpCode(HttpStatus.OK)
  async getProductsBySubCategoryId(
    @Param('subCategoryId') paramSubCategoryId?: string,
    @Param('categoryId') paramCategoryId?: string,
    @Query('sub_category_id') querySnakeSubCategoryId?: string,
    @Query('subCategoryId') queryCamelSubCategoryId?: string,
    @Query('Sub_Category_ID') queryPascalSubCategoryId?: string,
    @Query('categoryId') queryCategoryId?: string,
    @Query('category_id') querySnakeCategoryId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('count') count?: string,
    @Query('brands') brands?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('productOptions') productOptions?: string,
    @Query('specfication') specfication?: string,
    @Query('specification') specification?: string,
    @Query('rating') rating?: string,
    @Query('sort') sort?: string,
    @Body() body?: any,
  ) {
    const targetSubCategoryId =
      paramSubCategoryId ||
      paramCategoryId ||
      querySnakeSubCategoryId ||
      queryCamelSubCategoryId ||
      queryPascalSubCategoryId ||
      queryCategoryId ||
      querySnakeCategoryId ||
      body?.sub_category_id ||
      body?.subCategoryId ||
      body?.Sub_Category_ID ||
      body?.categoryId ||
      body?.category_id;

    return this.productService.getProductsBySubCategoryIdInterleaved({
      subCategoryId: targetSubCategoryId || '',
      page: page || body?.page,
      limit: limit || count || body?.limit || body?.count,
      brands: brands || body?.brands,
      minPrice: minPrice || body?.minPrice,
      maxPrice: maxPrice || body?.maxPrice,
      productOptions: productOptions || body?.productOptions,
      specification: specification || specfication || body?.specification || body?.specfication,
      rating: rating || body?.rating,
      sort: sort || body?.sort,
    });
  }

  @ApiOperation({ summary: 'Get list of products with pagination and filters (GET)' })
  @Get(['products-list', 'Products-list'])
  @HttpCode(HttpStatus.OK)
  async getProductsListGet(@Query() query: ProductListQueryDto, @Req() req: any) {
    const authenticatedSellerId = req.user?.sellerId || req.user?.id;
    return this.productService.getProductsList(query, authenticatedSellerId);
  }

  @ApiOperation({ summary: 'Get list of products with pagination and filters via body payload (POST)' })
  @Post(['products-list', 'Products-list'])
  @HttpCode(HttpStatus.OK)
  async getProductsListPost(@Body() query: ProductListQueryDto, @Req() req: any) {
    const authenticatedSellerId = req.user?.sellerId || req.user?.id;
    return this.productService.getProductsList(query, authenticatedSellerId);
  }



  @ApiOperation({ summary: 'Wix-compatible get product details by Table_ID (GET)' })
  @Get('sellerProductDetails')
  @HttpCode(HttpStatus.OK)
  async getSellerProductDetails(
    @Query('Table_ID') queryTableId?: string,
    @Query('Product_ID') queryProductId?: string,
    @Query('productId') queryCamelProductId?: string,
    @Query('id') queryId?: string,
  ) {
    const targetId = queryTableId || queryProductId || queryCamelProductId || queryId;
    return this.productService.getSellerProductDetails(targetId || '');
  }

  @ApiOperation({ summary: 'Wix-compatible update product (POST)' })
  @Post('updateSellerProduct')
  @HttpCode(HttpStatus.OK)
  async updateSellerProduct(@Body() body: any) {
    return this.productService.updateSellerProduct(body);
  }

  @ApiOperation({ summary: 'Wix-compatible submit new product listing (POST)' })
  @Post('sellerlisting')
  @HttpCode(HttpStatus.CREATED)
  async createSellerListing(@Body() body: any, @Req() req: any) {
    const authenticatedSellerId = req.user?.sellerId || req.user?.id;
    return this.productService.createSellerListing(body, authenticatedSellerId);
  }

  @ApiOperation({ summary: 'Wix-compatible get categories (GET/POST)' })
  @Get('category')
  @Post('category')
  @HttpCode(HttpStatus.OK)
  async getCategoryLegacy() {
    return this.productService.getCategoryLegacy();
  }

  @ApiOperation({ summary: 'Wix-compatible get subcategory list (GET/POST)' })
  @Get('subcategorylist')
  @Post('subcategorylist')
  @HttpCode(HttpStatus.OK)
  async getSubcategoryListLegacy(
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('count') count: string,
    @Body() body: any,
  ) {
    const s = search || body?.search;
    const p = page || body?.page;
    const c = count || body?.count;
    return this.productService.getSubcategoryListLegacy({ search: s, page: p, count: c });
  }

  // ==========================================
  // RESTFUL API ENDPOINTS (SNAKE_CASE CLIENT MAPPING)
  // ==========================================

  @ApiOperation({ summary: 'Create product (POST /products)' })
  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  async createProductRest(@Body() dto: CreateProductDto) {
    return this.productService.createProductRest(dto);
  }

  @ApiOperation({ summary: 'List products (GET /products)' })
  @Get('products')
  @HttpCode(HttpStatus.OK)
  async listProductsRest(@Query() query: any) {
    return this.productService.listProductsRest(query);
  }

  @ApiOperation({ summary: 'Get single product details (GET /products/:product_id)' })
  @Get('products/:product_id')
  @HttpCode(HttpStatus.OK)
  async getProductByIdRest(@Param('product_id') productId: string) {
    return this.productService.getProductByIdRest(productId);
  }

  @ApiOperation({ summary: 'Update general product fields (PATCH /products/:product_id)' })
  @Patch('products/:product_id')
  @HttpCode(HttpStatus.OK)
  async updateProductRest(@Param('product_id') productId: string, @Body() dto: UpdateProductDto) {
    return this.productService.updateProductRest(productId, dto);
  }

  @ApiOperation({ summary: 'Delete product (DELETE /products/:product_id)' })
  @Delete('products/:product_id')
  @HttpCode(HttpStatus.OK)
  async deleteProductRest(@Param('product_id') productId: string) {
    return this.productService.deleteProductRest(productId);
  }

  @ApiOperation({ summary: 'Increment product inventory (PATCH /products/:product_id/inventory/increment)' })
  @Patch('products/:product_id/inventory/increment')
  @HttpCode(HttpStatus.OK)
  async incrementInventory(@Param('product_id') productId: string, @Body() dto: InventoryUpdateDto) {
    return this.productService.incrementInventory(productId, dto.quantity);
  }

  @ApiOperation({ summary: 'Decrement product inventory (PATCH /products/:product_id/inventory/decrement)' })
  @Patch('products/:product_id/inventory/decrement')
  @HttpCode(HttpStatus.OK)
  async decrementInventory(@Param('product_id') productId: string, @Body() dto: InventoryUpdateDto) {
    return this.productService.decrementInventory(productId, dto.quantity);
  }

  @ApiOperation({ summary: 'Update product collections array (PATCH /products/:product_id/collections)' })
  @Patch('products/:product_id/collections')
  @HttpCode(HttpStatus.OK)
  async updateCollections(@Param('product_id') productId: string, @Body() dto: CollectionsUpdateDto) {
    return this.productService.updateCollectionsRest(productId, dto.collections);
  }

  @ApiOperation({ summary: 'Update product media files (PATCH /products/:product_id/media)' })
  @Patch('products/:product_id/media')
  @HttpCode(HttpStatus.OK)
  async updateMedia(@Param('product_id') productId: string, @Body() dto: MediaUpdateDto) {
    return this.productService.updateMediaRest(productId, dto);
  }

  @ApiOperation({ summary: 'Update product status (PATCH /products/:product_id/status)' })
  @Patch('products/:product_id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(@Param('product_id') productId: string, @Body() dto: StatusUpdateDto) {
    return this.productService.updateStatusRest(productId, dto.status);
  }

  @ApiOperation({ summary: 'List products filtered by seller_id (GET /products/seller/:seller_id)' })
  @Get('products/seller/:seller_id')
  @HttpCode(HttpStatus.OK)
  async listProductsBySellerRest(@Param('seller_id') sellerId: string, @Query() query: any) {
    const forcedQuery = { ...query, seller_id: sellerId };
    return this.productService.listProductsRest(forcedQuery);
  }

  @ApiOperation({ summary: 'Update ad statistics (PATCH /products/:product_id/ad-stats)' })
  @Patch('products/:product_id/ad-stats')
  @HttpCode(HttpStatus.OK)
  async updateAdStats(@Param('product_id') productId: string, @Body() dto: AdStatsUpdateDto) {
    return this.productService.updateAdStats(productId, dto);
  }

  @ApiOperation({ summary: 'Update pricing fields (PATCH /products/:product_id/pricing)' })
  @Patch('products/:product_id/pricing')
  @HttpCode(HttpStatus.OK)
  async updatePricing(@Param('product_id') productId: string, @Body() dto: PricingUpdateDto) {
    return this.productService.updatePricing(productId, dto);
  }

  @ApiOperation({ summary: 'Wix-compatible get products by category with filters (GET/POST)' })
  @Get('productsByCategory')
  @Post('productsByCategory')
  @HttpCode(HttpStatus.OK)
  async getProductsByCategory(
    @Query('categoryId') categoryId?: string,
    @Query('page') page?: string,
    @Query('count') count?: string,
    @Query('userId') userId?: string,
    @Query('toPincode') toPincode?: string,
    @Query('brands') brands?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('productOptions') productOptions?: string,
    @Query('specfication') specfication?: string,
    @Query('rating') rating?: string,
    @Query('sort') sort?: string,
    @Body() body?: any,
  ) {
    return this.productService.getProductsByCategory({ 
      categoryId: categoryId || body?.categoryId, 
      page: page || body?.page, 
      count: count || body?.count, 
      userId: userId || body?.userId, 
      toPincode: toPincode || body?.toPincode,
      brands: brands || body?.brands,
      minPrice: minPrice || body?.minPrice,
      maxPrice: maxPrice || body?.maxPrice,
      productOptions: productOptions || body?.productOptions,
      specfication: specfication || body?.specfication,
      rating: rating || body?.rating,
      sort: sort || body?.sort,
    });
  }
}
