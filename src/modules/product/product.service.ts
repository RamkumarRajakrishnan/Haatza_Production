import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { MediaStorageService } from '../media-storage/media-storage.service';

@Injectable()
export class ProductService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mediaStorage: MediaStorageService,
  ) {}

  /**
   * 1. Get seller products list (Flutter endpoint GET /seller_products)
   */
  async getSellerProducts(email?: string, sellerId?: string, limit = 30, page = 1, type?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (sellerId) where.sellerId = sellerId;
    if (email) {
      where.OR = [
        { sellerId: email },
        { sellerId: { contains: email, mode: 'insensitive' } },
      ];
    }
    if (type) where.status = { equals: type, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      this.db.sellerProduct.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdDate: 'desc' },
      }),
      this.db.sellerProduct.count({ where }),
    ]);

    const transformedItems = this.mediaStorage.transformMediaToUrls(items);

    return {
      message: {
        body: {
          sellerProducts: transformedItems,
          pagination: {
            totalItems: total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
          },
        },
      },
      sellerProducts: transformedItems,
      totalItems: total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 2. Get one seller product by ID / Table_ID (GET /sellerProductDetails, GET /productDetails)
   */
  async getProductDetails(idOrTableId: string) {
    if (!idOrTableId) {
      throw new BadRequestException('Product ID or Table ID must be provided.');
    }

    const product = await this.db.sellerProduct.findFirst({
      where: {
        OR: [
          { id: idOrTableId },
          { productId: idOrTableId },
          { sku: idOrTableId },
        ],
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${idOrTableId}" not found`);
    }

    return this.mediaStorage.transformMediaToUrls(product);
  }

  /**
   * 3. Submit or Create Seller Listing (POST /sellerlisting)
   */
  async createProduct(data: any) {
    const recordId = data.Id || data.id || data.tableId;
    const cleanMainMedia = data.mainmedia
      ? this.mediaStorage.extractKey(data.mainmedia)
      : data.mainMedia
        ? this.mediaStorage.extractKey(data.mainMedia)
        : null;

    const payload: any = {
      name: data.name || data.productName || 'Untitled Product',
      description: data.description,
      brand: data.brand,
      status: data.status || 'Approved',
      price: Number(data.price || data.onSalePrice) || 0,
      mrp: Number(data.mrp) || Number(data.price) || 0,
      discount: data.discount,
      shippingWeight: Number(data.shippingWeight) || 0,
      inventory: Number(data.inventory) || 0,
      sku: data.sku,
      mainMedia: cleanMainMedia,
      productImages: data.productImages || data.mediaItems,
      productOptions: data.productOptions,
      manageVariants: Boolean(data.manageVariants),
      ribbon: data.ribbon,
      variantPrice: data.varientPrice || data.variantPrice,
      additionalInfoSections: data.additionalInfoSections || data.additionalInfo,
      subCategory: data.subCategory,
      sellerId: data.sellerId,
      influencerBranding: Boolean(data.influencerBranding),
    };

    let result: any;
    if (recordId) {
      result = await this.db.sellerProduct.upsert({
        where: { id: recordId },
        update: payload,
        create: { id: recordId, ...payload },
      });
    } else {
      result = await this.db.sellerProduct.create({ data: payload });
    }

    return this.mediaStorage.transformMediaToUrls(result);
  }

  /**
   * 4. Update an existing seller product (POST/PUT /updateSellerProduct)
   */
  async updateProduct(id: string, data: any) {
    const targetId = id || data.tableId || data.Id || data.id;
    if (!targetId) {
      throw new BadRequestException('Missing target product ID for update.');
    }

    const updateFields = data.updateFields || data;
    const payload: any = {};

    if (updateFields.productName || updateFields.name) payload.name = updateFields.productName || updateFields.name;
    if (updateFields.description !== undefined) payload.description = updateFields.description;
    if (updateFields.onSalePrice !== undefined || updateFields.price !== undefined) {
      payload.price = Number(updateFields.onSalePrice ?? updateFields.price);
    }
    if (updateFields.mrp !== undefined) payload.mrp = Number(updateFields.mrp);
    if (updateFields.brand !== undefined) payload.brand = updateFields.brand;
    if (updateFields.additionalInfo !== undefined || updateFields.additionalInfoSections !== undefined) {
      payload.additionalInfoSections = updateFields.additionalInfo || updateFields.additionalInfoSections;
    }
    if (updateFields.inventory !== undefined) payload.inventory = Number(updateFields.inventory);
    if (updateFields.sku !== undefined) payload.sku = updateFields.sku;
    if (updateFields.status !== undefined) payload.status = updateFields.status;
    if (updateFields.shippingWeight !== undefined) payload.shippingWeight = Number(updateFields.shippingWeight);
    if (updateFields.mainmedia || updateFields.mainMedia) {
      payload.mainMedia = this.mediaStorage.extractKey(updateFields.mainmedia || updateFields.mainMedia);
    }

    const updated = await this.db.sellerProduct.update({
      where: { id: targetId },
      data: payload,
    });

    return this.mediaStorage.transformMediaToUrls(updated);
  }

  /**
   * 7 & 8. Inventory APIs (incrementInventory & decrementInventory)
   */
  async updateInventoryBatch(updateInfo: Array<{ productId?: string; tableId?: string; quantity: number }>, isIncrement = true) {
    if (!Array.isArray(updateInfo) || updateInfo.length === 0) {
      throw new BadRequestException('updateInfo array is required');
    }

    const tasks = updateInfo.map((item) => {
      const targetId = item.productId || item.tableId;
      const amount = (item.quantity || 1) * (isIncrement ? 1 : -1);

      return this.db.sellerProduct.update({
        where: { id: targetId },
        data: { inventory: { increment: amount } },
      });
    });

    const results = await this.db.$transaction(tasks);
    return {
      success: true,
      updatedCount: results.length,
      inventoryItems: this.mediaStorage.transformMediaToUrls(results),
    };
  }

  async updateInventorySingle(productId: string, delta: number) {
    const updated = await this.db.sellerProduct.update({
      where: { id: productId },
      data: { inventory: { increment: delta } },
    });
    return this.mediaStorage.transformMediaToUrls(updated);
  }

  /**
   * 9 & 10. Influencer Branding APIs (sellerIBProducts & updateInfluencerBranding)
   */
  async getInfluencerBrandingProducts(sellerId: string) {
    const items = await this.db.sellerProduct.findMany({
      where: {
        ...(sellerId ? { sellerId } : {}),
        influencerBranding: true,
      },
    });
    return this.mediaStorage.transformMediaToUrls(items);
  }

  async updateInfluencerBranding(tableIds: string | string[], enabled: boolean) {
    const ids = Array.isArray(tableIds) ? tableIds : [tableIds];

    await this.db.sellerProduct.updateMany({
      where: { id: { in: ids } },
      data: { influencerBranding: enabled },
    });

    return {
      success: true,
      message: `Updated influencer branding status to ${enabled} for ${ids.length} products.`,
    };
  }

  async getCategories() {
    return this.db.category.findMany({ where: { parentId: null } });
  }

  async getSubcategories(parentId: string) {
    return this.db.category.findMany({ where: { parentId } });
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

  async uploadMedia(files: any[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided for upload.');
    }

    const mediaItems: Array<{ type: string; key?: string; url: string }> = [];
    for (const file of files) {
      const uploaded = await this.mediaStorage.upload({ file });
      mediaItems.push({
        type: uploaded.type === 'video' ? 'video' : 'image',
        key: uploaded.key,
        url: uploaded.url || this.mediaStorage.getPublicUrl(uploaded.key),
      });
    }
    return mediaItems;
  }
}

