import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ProductService } from './product.service';

@Controller()
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('products')
  @Get('seller_products')
  @Get('sellerlisting')
  getProducts(@Query('sellerId') sellerId: string) {
    return this.productService.getSellerProducts(sellerId);
  }

  @Get('products/:id')
  @Get('sellerProductDetails')
  @Get('productDetails')
  getProductDetails(@Param('id') id: string, @Query('id') queryId: string) {
    return this.productService.getProductDetails(id || queryId);
  }

  @Post('products')
  createProduct(@Body() body: any) {
    return this.productService.createProduct(body);
  }

  @Put('products/:id')
  @Post('updateSellerProduct')
  updateProduct(@Param('id') id: string, @Body() body: any) {
    return this.productService.updateProduct(id || body.id, body);
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

  @Post('uploadMedia')
  @Post('uploadVideo')
  uploadMedia(@Body() body: any) {
    return this.productService.uploadMedia(body);
  }

  @Get('searchcategorylist')
  searchCategories(@Query('query') query: string) {
    return this.productService.searchCategories(query);
  }

  @Get('CategoryFields')
  getCategoryFields(@Query('categoryId') categoryId: string) {
    return this.productService.getCategoryFields(categoryId);
  }

  @Get('sellerproductInventory')
  getInventory(@Query('sellerId') sellerId: string) {
    return this.productService.getSellerProducts(sellerId);
  }

  @Post('incrementInventory')
  incrementInventory(@Body() body: any) {
    return this.productService.updateInventory(body.productId, Number(body.amount) || 1);
  }

  @Post('decrementInventory')
  decrementInventory(@Body() body: any) {
    return this.productService.updateInventory(body.productId, -(Number(body.amount) || 1));
  }

  @Get('sellerIBProducts')
  getInfluencerBrandingProducts(@Query('sellerId') sellerId: string) {
    return this.productService.getInfluencerBrandingProducts(sellerId);
  }

  @Post('updateInfluencerBranding')
  updateInfluencerBranding(@Body() body: any) {
    return this.productService.updateInfluencerBranding(body.productId, body.enabled);
  }
}
