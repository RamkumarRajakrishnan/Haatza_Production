import { Controller, Get, Post, Body, Query, Req, HttpCode, HttpStatus, Param, Patch, Delete, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { ProductListQueryDto } from './dto/product-list.dto';
import { CreateProductDto, UpdateProductDto, InventoryUpdateDto, CollectionsUpdateDto, MediaUpdateDto, StatusUpdateDto, PricingUpdateDto, AdStatsUpdateDto } from './dto/product-rest.dto';
import { ProductDetailsQueryDto } from './dto/product-details.dto';

@ApiTags('Products')
@Controller(['_functions', 'api/v1', 'api', ''])
export class ProductController {
  constructor(private readonly productService: ProductService) { }

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
    @Query('currentPage') currentPage?: string,
    @Query('pageNo') pageNo?: string,
    @Query('limit') limit?: string,
    @Query('count') count?: string,
    @Query('pageSize') pageSize?: string,
    @Query('brands') brands?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('productOptions') productOptions?: string,
    @Query('specfication') specfication?: string,
    @Query('specification') specification?: string,
    @Query('rating') rating?: string,
    @Query('sort') sort?: string,
    @Query('module') module?: string,
    @Query('Module') pascalModule?: string,
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

    const targetModule = (
      module ||
      pascalModule ||
      body?.module ||
      body?.Module ||
      ''
    ).trim();

    if (!targetModule) {
      throw new BadRequestException('module is required (haatza or lite)');
    }
    const rawModule = targetModule.toLowerCase();
    if (rawModule !== 'haatza' && rawModule !== 'lite') {
      throw new BadRequestException("Invalid module. Allowed values are 'haatza' and 'lite'");
    }

    return this.productService.getProductsBySubCategoryIdInterleaved({
      subCategoryId: targetSubCategoryId || '',
      page: page || currentPage || pageNo || body?.page || body?.currentPage || body?.pageNo,
      limit: limit || count || pageSize || body?.limit || body?.count || body?.pageSize,
      brands: brands || body?.brands,
      minPrice: minPrice || body?.minPrice,
      maxPrice: maxPrice || body?.maxPrice,
      productOptions: productOptions || body?.productOptions,
      specification: specification || specfication || body?.specification || body?.specfication,
      rating: rating || body?.rating,
      sort: sort || body?.sort,
      module: rawModule,
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



  @ApiOperation({
    summary: 'Wix-compatible get product details by productId & toPincode (GET/POST /productDetails)',
    description: 'Retrieves complete product details, dynamic delivery fees, variants, seller info, and reviews in camelCase format.',
  })
  @Get([
    'productDetails',
    'get_productDetails',
    'product-details',
  ])
  @Post([
    'productDetails',
    'get_productDetails',
    'product-details',
  ])
  @HttpCode(HttpStatus.OK)
  async getProductDetails(
    @Query('productId') productId?: string,
    @Query('product_id') querySnakeProductId?: string,
    @Query('id') queryId?: string,
    @Query('toPincode') toPincode?: string,
    @Query('to_pincode') querySnakeToPincode?: string,
    @Query('pincode') queryPincode?: string,
    @Query('toPin') queryToPin?: string,
    @Query('to_pin') querySnakeToPin?: string,
    @Query('userId') userId?: string,
    @Query('user_id') querySnakeUserId?: string,
    @Body() body?: any,
  ) {
    const targetProductId =
      productId ||
      querySnakeProductId ||
      queryId ||
      body?.productId ||
      body?.product_id ||
      body?.id;

    const targetToPincode =
      toPincode ||
      querySnakeToPincode ||
      queryPincode ||
      queryToPin ||
      querySnakeToPin ||
      body?.toPincode ||
      body?.to_pincode ||
      body?.pincode ||
      body?.toPin ||
      body?.to_pin;

    const targetUserId =
      userId ||
      querySnakeUserId ||
      body?.userId ||
      body?.user_id;

    return this.productService.getProductDetails({
      productId: targetProductId,
      toPincode: targetToPincode,
      userId: targetUserId,
    });
  }

  @ApiOperation({
    summary: 'Get similar/recommended products for a product (GET/POST /similarProducts)',
    description: 'E-commerce multi-tier recommendation engine (Amazon/Flipkart model): returns alternative and sibling products in the same subcategory/category, excluding the current product.',
  })
  @ApiQuery({ name: 'module', required: true, type: String, description: 'Module name (haatza, lite, HAATZA, or LITE)' })
  @ApiQuery({ name: 'productId', required: true, type: String, description: 'Source product ID (aliases: product_id, id)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items to return (default: 10, max: 100)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @Get([
    'similarProducts',
    'similar-products',
    'products/similar',
    'similarProducts/:productId',
    'similar-products/:productId',
  ])
  @Post([
    'similarProducts',
    'similar-products',
    'products/similar',
  ])
  @HttpCode(HttpStatus.OK)
  async getSimilarProducts(
    @Param('productId') paramProductId?: string,
    @Query('productId') queryProductId?: string,
    @Query('product_id') querySnakeProductId?: string,
    @Query('id') queryId?: string,
    @Query('limit') limit?: string,
    @Query('count') count?: string,
    @Query('pageSize') pageSize?: string,
    @Query('page') page?: string,
    @Query('currentPage') currentPage?: string,
    @Query('module') module?: string,
    @Query('Module') pascalModule?: string,
    @Query('userId') userId?: string,
    @Body() body?: any,
    @Query() allQueries?: any,
  ) {
    // 1. Validate module - required, allows haatza, lite, HAATZA, and LITE
    let rawModule = (
      module !== undefined
        ? module
        : pascalModule !== undefined
        ? pascalModule
        : body?.module || body?.Module
    );

    // Also inspect allQueries in case key had whitespace (e.g. 'module ' as in '?module =Haatza')
    if (!rawModule && allQueries) {
      for (const [k, v] of Object.entries(allQueries)) {
        if (k.trim().toLowerCase() === 'module') {
          rawModule = v as string;
          break;
        }
      }
    }

    const trimmedModule = rawModule?.toString().trim();
    if (!trimmedModule) {
      throw new BadRequestException('module is required (haatza, lite, HAATZA, or LITE)');
    }
    const normalizedModule = trimmedModule.toLowerCase();
    if (normalizedModule !== 'haatza' && normalizedModule !== 'lite') {
      throw new BadRequestException("Invalid module. Allowed values are 'haatza', 'lite', 'HAATZA', and 'LITE'");
    }

    // 2. Validate productId
    const targetProductId =
      paramProductId ||
      queryProductId ||
      querySnakeProductId ||
      queryId ||
      body?.productId ||
      body?.product_id ||
      body?.id;

    if (!targetProductId || !targetProductId.trim()) {
      throw new BadRequestException('productId is required');
    }

    const targetLimit = limit || count || pageSize || body?.limit || body?.count || body?.pageSize;
    const targetPage = page || currentPage || body?.page || body?.currentPage;
    const targetUserId = userId || body?.userId;

    return this.productService.getSimilarProducts({
      productId: targetProductId.trim(),
      limit: targetLimit,
      page: targetPage,
      module: normalizedModule,
      userId: targetUserId,
    });
  }

  @ApiOperation({
    summary: 'Get seller product details by tableId (GET /sellerProductDetails)',
    description: 'Retrieves complete seller product details in camelCase by tableId and case-sensitive module (haatza or lite).',
  })
  @ApiQuery({ name: 'module', required: true, type: String, description: 'Module name (strictly case-sensitive: haatza or lite)' })
  @ApiQuery({ name: 'tableId', required: true, type: String, description: 'Table/Product Database ID (camelCase)' })
  @ApiQuery({ name: 'Table_ID', required: false, type: String, description: 'Legacy alias for tableId' })
  @Get('sellerProductDetails')
  @HttpCode(HttpStatus.OK)
  async getSellerProductDetails(
    @Query('module') queryModule?: string,
    @Query('tableId') queryTableId?: string,
    @Query('Table_ID') queryLegacyTableId?: string,
    @Query('table_id') querySnakeTableId?: string,
    @Query('Product_ID') queryProductId?: string,
    @Query('productId') queryCamelProductId?: string,
    @Query('id') queryId?: string,
    @Query() allQueries?: any,
  ) {
    // 1. Validate module - allows haatza, lite, HAATZA, and LITE
    const rawModule = (queryModule !== undefined ? queryModule : (allQueries?.module || allQueries?.Module))?.toString().trim();
    if (!rawModule) {
      throw new BadRequestException('module is required (haatza, lite, HAATZA, or LITE)');
    }
    const normalizedModule = rawModule.toLowerCase();
    if (normalizedModule !== 'haatza' && normalizedModule !== 'lite') {
      throw new BadRequestException("Invalid module. Allowed values are 'haatza', 'lite', 'HAATZA', and 'LITE'");
    }

    // 2. Validate tableId (camelCase preferred, fallback to legacy Table_ID)
    const targetId =
      queryTableId ||
      queryLegacyTableId ||
      querySnakeTableId ||
      queryCamelProductId ||
      queryProductId ||
      queryId ||
      allQueries?.tableId ||
      allQueries?.Table_ID ||
      allQueries?.table_id;

    if (!targetId || !targetId.trim()) {
      throw new BadRequestException('tableId is required');
    }

    return this.productService.getSellerProductDetails(targetId.trim(), normalizedModule);
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
  async getCategoryLegacy(
    @Query('module') module?: string,
    @Query('Module') pascalModule?: string,
    @Body('module') bodyModule?: string,
    @Body('Module') bodyPascalModule?: string,
  ) {
    const targetModule = module || pascalModule || bodyModule || bodyPascalModule;
    return this.productService.getCategoryLegacy(targetModule);
  }

  @ApiOperation({ summary: 'Wix-compatible get subcategory list (GET/POST)' })
  @Get('subcategorylist')
  @Post('subcategorylist')
  @HttpCode(HttpStatus.OK)
  async getSubcategoryListLegacy(
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('count') count: string,
    @Query('module') module?: string,
    @Query('Module') pascalModule?: string,
    @Body() body?: any,
  ) {
    const s = search || body?.search;
    const p = page || body?.page;
    const c = count || body?.count;
    const targetModule = module || pascalModule || body?.module || body?.Module;
    return this.productService.getSubcategoryListLegacy({ search: s, page: p, count: c, module: targetModule });
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
    @Query('specification') specification?: string,
    @Query('rating') rating?: string,
    @Query('sort') sort?: string,
    @Query('module') module?: string,
    @Query('Module') pascalModule?: string,
    @Body() body?: any,
  ) {
    const targetModule = (
      module ||
      pascalModule ||
      body?.module ||
      body?.Module ||
      ''
    ).trim();

    if (!targetModule) {
      throw new BadRequestException('module is required (haatza or lite)');
    }
    const rawModule = targetModule.toLowerCase();
    if (rawModule !== 'haatza' && rawModule !== 'lite') {
      throw new BadRequestException("Invalid module. Allowed values are 'haatza' and 'lite'");
    }

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
      specfication: specfication || specification || body?.specfication || body?.specification,
      rating: rating || body?.rating,
      sort: sort || body?.sort,
      module: rawModule,
    });
  }
}
