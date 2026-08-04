import { Controller, Get, Post, Put, Body, Param, Query, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductService } from './product.service';
import { StorageService } from '../seller-product/storage.service';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Products')
@Controller(['products', 'api/products'])
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly storageService: StorageService,
  ) { }

  /**
   * 1. Get seller products list (GET /api/products, GET /seller_products, GET /products)
   */
  @Get(['', 'products', 'seller_products'])
  getSellerProducts(
    @Query('email') email?: string,
    @Query('sellerId') sellerId?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('type') type?: string,
  ) {
    return this.productService.getSellerProducts(
      email,
      sellerId,
      limit ? parseInt(limit, 10) : 30,
      page ? parseInt(page, 10) : 1,
      type,
    );
  }

  /**
   * 2 & 5. Get one seller product by Table_ID / ProductID (GET /sellerProductDetails, GET /productDetails)
   */
  @Get('products/:id')
  @Get('sellerProductDetails')
  @Get('productDetails')
  getProductDetails(
    @Param('id') paramId?: string,
    @Query('Table_ID') tableId?: string,
    @Query('productId') productId?: string,
    @Query('id') queryId?: string,
  ) {
    const targetId = paramId || tableId || productId || queryId;
    return this.productService.getProductDetails(targetId!);
  }

  /**
   * 3. Submit or create seller listing (POST /sellerlisting, POST /products)
   */
  @Post('products')
  @Post('sellerlisting')
  createProduct(@Body() body: any) {
    return this.productService.createProduct(body);
  }

  /**
   * 4. Update seller product (POST /updateSellerProduct, PUT /products/:id)
   */
  @Put('products/:id')
  @Post('updateSellerProduct')
  updateProduct(@Param('id') paramId: string, @Body() body: any) {
    return this.productService.updateProduct(paramId || body.tableId || body.Id || body.id, body);
  }

  /**
   * 6. Get seller inventory list (GET /sellerproductInventory)
   */
  @Get('sellerproductInventory')
  getInventory(
    @Query('sellerId') sellerId?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.productService.getSellerProducts(
      undefined,
      sellerId,
      limit ? parseInt(limit, 10) : 50,
      page ? parseInt(page, 10) : 1,
    );
  }

  /**
   * 7. Increment inventory (POST /incrementInventory)
   */
  @Post('incrementInventory')
  incrementInventory(@Body() body: any) {
    if (Array.isArray(body.updateInfo)) {
      return this.productService.updateInventoryBatch(body.updateInfo, true);
    }
    return this.productService.updateInventorySingle(body.productId || body.tableId, Number(body.amount || body.quantity) || 1);
  }

  /**
   * 8. Decrement inventory (POST /decrementInventory)
   */
  @Post('decrementInventory')
  decrementInventory(@Body() body: any) {
    if (Array.isArray(body.updateInfo)) {
      return this.productService.updateInventoryBatch(body.updateInfo, false);
    }
    return this.productService.updateInventorySingle(body.productId || body.tableId, -(Number(body.amount || body.quantity) || 1));
  }

  /**
   * 9. Get influencer branding products (GET /sellerIBProducts)
   */
  @Get('sellerIBProducts')
  getInfluencerBrandingProducts(@Query('sellerId') sellerId: string) {
    return this.productService.getInfluencerBrandingProducts(sellerId);
  }

  /**
   * 10. Update influencer branding (POST /updateInfluencerBranding)
   */
  @Post('updateInfluencerBranding')
  updateInfluencerBranding(@Body() body: any) {
    const targetIds = body.tableId || body.tableIds || body.productId;
    const enabled = body.influencerBranding !== undefined ? Boolean(body.influencerBranding) : Boolean(body.enabled);
    return this.productService.updateInfluencerBranding(targetIds, enabled);
  }

  /**
   * 11 & 12. Media Upload APIs (POST /uploadMedia, POST /uploadVideo)
   */
  @Post('uploadMedia')
  @Post('uploadVideo')
  @UseInterceptors(FilesInterceptor('files'))
  uploadMedia(@UploadedFiles() files: any[]) {
    return this.storageService.uploadFiles(files);
  }

  @Get('category')
  getCategories() {
    return this.productService.getCategories();
  }

  @Get('subCategories')
  @Get('subcategorylist')
  getSubCategories(@Query('categoryId') categoryId: string) {
    return this.productService.getSubcategories(categoryId);
  }

  @Get('searchcategorylist')
  searchCategories(@Query('query') query: string) {
    return this.productService.searchCategories(query);
  }

  @Get('CategoryFields')
  getCategoryFields(@Query('categoryId') categoryId: string) {
    return this.productService.getCategoryFields(categoryId);
  }
}

