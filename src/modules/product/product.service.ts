import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ProductService {
  constructor(private db: DatabaseService) {}

  async getSellerProducts(sellerId: string) {
    return this.db.product.findMany({ where: { sellerId }, include: { category: true } });
  }

  async getProductDetails(id: string) {
    const product = await this.db.product.findUnique({ where: { id }, include: { category: true } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async createProduct(data: any) {
    return this.db.product.create({
      data: {
        sellerId: data.sellerId || 'seller-1',
        title: data.title || 'Sample Product',
        description: data.description,
        price: Number(data.price) || 100,
        sku: data.sku || `SKU-${Date.now()}`,
        categoryId: data.categoryId,
        mediaUrls: data.mediaUrls || [],
      },
    });
  }

  async updateProduct(id: string, data: any) {
    return this.db.product.update({
      where: { id },
      data,
    });
  }

  async getCategories() {
    return this.db.category.findMany({ where: { parentId: null } });
  }

  async getSubcategories(parentId: string) {
    return this.db.category.findMany({ where: { parentId } });
  }

  uploadMedia(files: any) {
    return { urls: ['https://cdn.haatza.com/uploads/sample-media.jpg'] };
  }

  async searchCategories(query: string) {
    return this.db.category.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
    });
  }

  async getCategoryFields(categoryId: string) {
    const cat = await this.db.category.findUnique({ where: { id: categoryId } });
    return cat?.fields || [];
  }

  async updateInventory(productId: string, delta: number) {
    return this.db.product.update({
      where: { id: productId },
      data: { inventory: { increment: delta } },
    });
  }

  async getInfluencerBrandingProducts(sellerId: string) {
    return this.db.product.findMany({
      where: { sellerId, influencerBranding: true },
    });
  }

  async updateInfluencerBranding(productId: string, enabled: boolean) {
    return this.db.product.update({
      where: { id: productId },
      data: { influencerBranding: enabled },
    });
  }
}
