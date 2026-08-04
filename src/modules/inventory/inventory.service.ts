import { Injectable } from '@nestjs/common';
import { ProductService } from '../product/product.service';

@Injectable()
export class InventoryService {
  constructor(private readonly productService: ProductService) {}

  async getInventory(sellerId?: string, limit = 50, page = 1) {
    return this.productService.getSellerProducts(undefined, sellerId, limit, page);
  }

  async incrementInventory(body: any) {
    if (Array.isArray(body.updateInfo)) {
      return this.productService.updateInventoryBatch(body.updateInfo, true);
    }
    return this.productService.updateInventorySingle(
      body.productId || body.tableId,
      Number(body.amount || body.quantity) || 1,
    );
  }

  async decrementInventory(body: any) {
    if (Array.isArray(body.updateInfo)) {
      return this.productService.updateInventoryBatch(body.updateInfo, false);
    }
    return this.productService.updateInventorySingle(
      body.productId || body.tableId,
      -(Number(body.amount || body.quantity) || 1),
    );
  }
}
