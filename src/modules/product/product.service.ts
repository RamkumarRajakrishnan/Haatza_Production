import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProductListQueryDto, SortOrder } from './dto/product-list.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private readonly db: DatabaseService) {}

  async getProductsList(query: ProductListQueryDto, authenticatedSellerId?: string) {
    const {
      sellerId,
      search,
      category,
      subCategory,
      status,
      page = 1,
      limit = 10,
      sortBy = 'createdDate',
      sortOrder = SortOrder.DESC,
    } = query;

    const skip = (page - 1) * limit;

    // Build the query filter object
    const where: Prisma.ProductWhereInput = {};

    // Prioritize active JWT session sellerId if present
    const targetSellerId = authenticatedSellerId || sellerId;
    if (targetSellerId) {
      where.sellerId = targetSellerId;
    }

    if (status) {
      where.status = {
        equals: status,
        mode: 'insensitive',
      };
    }

    if (category) {
      where.mainCategory = {
        equals: category,
        mode: 'insensitive',
      };
    }

    if (subCategory) {
      where.OR = [
        { subCategory: { equals: subCategory, mode: 'insensitive' } },
        { subCategoryId: { equals: subCategory } },
      ];
    }

    if (search?.trim()) {
      const searchTrimmed = search.trim();
      where.OR = [
        ...(where.OR || []),
        { name: { contains: searchTrimmed, mode: 'insensitive' } },
        { brand: { contains: searchTrimmed, mode: 'insensitive' } },
        { sku: { contains: searchTrimmed, mode: 'insensitive' } },
        { description: { contains: searchTrimmed, mode: 'insensitive' } },
        { searchKeywords: { has: searchTrimmed } },
      ];
    }

    // Determine sorting field
    const orderBy: any = {};
    const validSortFields = ['createdDate', 'updatedDate', 'price', 'mrp', 'name', 'inventory', 'sales', 'revenue'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdDate';
    orderBy[sortField] = sortOrder.toLowerCase();

    // Execute queries in parallel
    const [total, products] = await Promise.all([
      this.db.product.count({ where }),
      this.db.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          price: true,
          discount: true,
          status: true,
          mainMedia: true,
          sku: true,
          inventory: true,
          brand: true,
          mrp: true,
          onsalePrice: true,
          createdDate: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      status: 'success',
      message: 'Products list retrieved successfully',
      data: {
        products,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    };
  }

  /**
   * GET /api/v1/seller_products
   * Wix-compatible get seller products list
   */
  async getSellerProducts(query: any, authenticatedSellerId?: string) {
    const email = query.email;
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const type = query.type; // 'mylisting' or 'inprogress'
    const searchText = query.searchText;

    let targetSellerId = authenticatedSellerId;

    if (!targetSellerId && email) {
      const user = await this.db.user.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
          isSeller: true,
        },
      });
      if (user) {
        targetSellerId = user.sellerId || user.id;
      }
    }

    if (!targetSellerId) {
      return {
        status: 'success',
        message: {
          body: {
            sellerProducts: [],
            pagination: {
              total: 0,
              page,
              limit,
              totalPages: 0,
            },
          },
        },
      };
    }

    const where: Prisma.ProductWhereInput = {
      sellerId: targetSellerId,
    };

    if (type === 'mylisting') {
      where.status = { in: ['Approved', 'Out of Stock'] };
    } else if (type === 'inprogress') {
      where.status = { equals: 'Under Review' };
    }

    if (searchText?.trim()) {
      where.name = {
        contains: searchText.trim(),
        mode: 'insensitive',
      };
    }

    const skip = (page - 1) * limit;

    const [total, products] = await Promise.all([
      this.db.product.count({ where }),
      this.db.product.findMany({
        where,
        orderBy: { createdDate: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const formattedProducts = products.map((p) => ({
      mainmedia: p.mainMedia || '',
      name: p.name,
      price: p.price || 0,
      discount: p.discount ? (typeof p.discount === 'string' ? p.discount : JSON.stringify(p.discount)) : '',
      status: p.status || '',
      Table_ID: p.id,
    }));

    return {
      status: 'success',
      message: {
        body: {
          sellerProducts: formattedProducts,
          pagination: {
            total,
            page,
            limit,
            totalPages,
          },
        },
      },
    };
  }

  /**
   * GET /api/v1/sellerProductDetails
   * Wix-compatible get product details by ID
   */
  async getSellerProductDetails(tableId: string) {
    if (!tableId) {
      throw new BadRequestException('Table_ID is required');
    }

    const p = await this.db.product.findUnique({
      where: { id: tableId },
    });

    if (!p) {
      throw new NotFoundException(`Product with ID ${tableId} not found`);
    }

    const productImagesArray = Array.isArray(p.productImages)
      ? (p.productImages as any[]).map((img) => ({
          description: img.description || '',
          id: img.slug || img.id || '',
          src: img.src,
          type: img.type || 'image',
        }))
      : [];

    return {
      mainmedia: p.mainMedia || '',
      productImages: productImagesArray,
      name: p.name,
      description: p.description || '',
      brand: p.brand || '',
      shippingWeight: p.shippingWeight || 0,
      price: p.price || 0,
      discount: p.discount || null,
      ribbon: p.ribbon || '',
      productOptions: p.productOptions || null,
      additionalInfoSections: p.additionalInfoSections || [],
      sellerId: p.sellerId || '',
      varientPrice: p.variantPrice || null,
      status: p.status || '',
      manageVariants: p.manageVariants || false,
      trackInventory: p.trackInventory || false,
      categoryName: p.categoryName || [],
      categoryId: p.collections || [],
      inventory: p.inventory || 0,
      sku: p.sku || '',
      productId: p.wixProductId || '',
      mainCategory: p.mainCategory || '',
      subCategory: p.subCategory || '',
      promotionPhotos: p.promotionPhotos || [],
      haatzaverified: p.haatzaVerified || false,
      paymentType: p.paymentType || '',
      productReturn: p.productReturn || '',
      subCategoryId: p.subCategoryId || '',
      deliveryCharges: p.deliveryCharges || false,
      sizeChart: p.sizeChart || '',
      search_keywords: p.searchKeywords || [],
      sellAndEarnCommission: p.sellAndEarnCommission || null,
      sellAndEarn: p.sellAndEarn || 'FALSE',
    };
  }

  /**
   * POST /api/v1/updateSellerProduct
   * Wix-compatible update product
   */
  async updateSellerProduct(body: any) {
    const id = body.Id || body.id;
    if (!id) {
      throw new BadRequestException('Product Id is required');
    }

    const existing = await this.db.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const updateData: Prisma.ProductUpdateInput = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.sku !== undefined) updateData.sku = body.sku;
    if (body.sellAndEarnCommission !== undefined) updateData.sellAndEarnCommission = body.sellAndEarnCommission;
    if (body.inventory !== undefined) updateData.inventory = parseInt(body.inventory, 10) || 0;
    if (body.sellAndEarn !== undefined) updateData.sellAndEarn = body.sellAndEarn;
    if (body.search_keywords !== undefined) updateData.searchKeywords = body.search_keywords;
    if (body.searchKeywords !== undefined) updateData.searchKeywords = body.searchKeywords;
    if (body.promotionPhotos !== undefined) updateData.promotionPhotos = body.promotionPhotos;
    if (body.productImages !== undefined) updateData.productImages = body.productImages;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.shippingWeight !== undefined) updateData.shippingWeight = parseFloat(body.shippingWeight) || 0;
    if (body.brand !== undefined) updateData.brand = body.brand;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.mainmedia !== undefined) updateData.mainMedia = body.mainmedia;
    if (body.mainMedia !== undefined) updateData.mainMedia = body.mainMedia;
    if (body.productOptions !== undefined) updateData.productOptions = body.productOptions;
    if (body.price !== undefined) updateData.price = parseFloat(body.price) || 0;
    if (body.discount !== undefined) updateData.discount = body.discount;
    if (body.manageVariants !== undefined) updateData.manageVariants = body.manageVariants === true || body.manageVariants === 'true';
    if (body.ribbon !== undefined) updateData.ribbon = body.ribbon;
    if (body.varientPrice !== undefined) updateData.variantPrice = body.varientPrice;
    if (body.variantPrice !== undefined) updateData.variantPrice = body.variantPrice;
    if (body.additionalInfoSections !== undefined) updateData.additionalInfoSections = body.additionalInfoSections;
    if (body.paymentType !== undefined) updateData.paymentType = body.paymentType;
    if (body.productReturn !== undefined) updateData.productReturn = body.productReturn;
    if (body.deliveryCharges !== undefined) updateData.deliveryCharges = body.deliveryCharges === true || body.deliveryCharges === 'true';
    if (body.sizeChart !== undefined) updateData.sizeChart = body.sizeChart;
    if (body.newVariantPrice !== undefined) updateData.newVariantPrice = body.newVariantPrice;
    if (body.mrp !== undefined) updateData.mrp = parseFloat(body.mrp) || 0;
    if (body.onsalePrice !== undefined) updateData.onsalePrice = parseFloat(body.onsalePrice) || 0;
    if (body.cod !== undefined) updateData.cod = parseFloat(body.cod) || 0;
    if (body.upi !== undefined) updateData.upi = parseFloat(body.upi) || 0;
    if (body.gstSeller !== undefined) updateData.gstSeller = parseFloat(body.gstSeller) || 0;
    if (body.upiPaymentDiscount !== undefined) updateData.upiPaymentDiscount = parseFloat(body.upiPaymentDiscount) || 0;

    updateData.updatedDate = new Date();

    const updated = await this.db.product.update({
      where: { id },
      data: updateData,
    });

    return {
      status: 'success',
      message: {
        message: 'Product has been updated sucessfully and sent for review',
        updatedData: updated,
      },
    };
  }

  /**
   * POST /api/v1/sellerlisting
   * Wix-compatible submit new product listing
   */
  async createSellerListing(body: any, authenticatedSellerId?: string) {
    if (!body.name || body.price === undefined) {
      throw new BadRequestException('Product name and price are required');
    }

    const sellerId = authenticatedSellerId || body.sellerId;

    const insertData: Prisma.ProductCreateInput = {
      name: body.name,
      price: parseFloat(body.price) || 0,
      sellerId: sellerId || '',
      status: body.status || 'Under Review',
      inventory: body.totalQuantity !== undefined ? parseInt(body.totalQuantity, 10) : (body.inventory !== undefined ? parseInt(body.inventory, 10) : 0),
      mainMedia: body.mainmedia || body.mainMedia || '',
      productImages: body.mediaItems || body.productImages || [],
      shippingWeight: body.shippingWeight !== undefined ? parseFloat(body.shippingWeight) : 0,
      brand: body.brand || '',
      productOptions: body.productOptions || {},
      collections: body.categoryId ? [body.categoryId] : (body.collections || []),
      productType: body.productType || 'physical',
      discount: body.discount || null,
      manageVariants: body.manageVariants === true || body.manageVariants === 'true',
      variantPrice: body.varientPrice || body.variantPrice || {},
      additionalInfoSections: body.additionalInfoSections || [],
      mainCategory: body.mainCategory || '',
      subCategory: body.subCategory || '',
      subCategoryId: body.subCategoryId || '',
      promotionPhotos: body.promotionPhotos || [],
      paymentType: body.paymentType || '',
      productReturn: body.productReturn || '',
      deliveryCharges: body.deliveryCharges === true || body.deliveryCharges === 'true',
      sizeChart: body.sizeChart || '',
      sellerPincode: body.sellerPinCode || body.sellerPincode || '',
      searchKeywords: body.search_keywords || body.searchKeywords || [],
      sellAndEarnCommission: body.sellAndEarnCommission !== undefined ? parseFloat(body.sellAndEarnCommission) : null,
      sellAndEarn: body.sellAndEarn || 'FALSE',
      createdDate: new Date(),
      updatedDate: new Date(),
    };

    const created = await this.db.product.create({
      data: insertData,
    });

    return {
      status: 'success',
      message: {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        message: 'Product submitted successfully',
        data: created,
      },
    };
  }

  // ==========================================
  // NEW RESTFUL API METHODS (SNAKE_CASE CLIENT MAPPING)
  // ==========================================

  async createProductRest(dto: any) {
    const data = mapRestToPrismaInput(dto);
    data.createdDate = new Date();
    data.updatedDate = new Date();

    const created = await this.db.product.create({
      data: data as Prisma.ProductCreateInput,
    });
    return mapPrismaToRestOutput(created);
  }

  async listProductsRest(query: any) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (query.seller_id) {
      where.sellerId = query.seller_id;
    }
    if (query.main_category) {
      where.mainCategory = { equals: query.main_category, mode: 'insensitive' };
    }
    if (query.sub_category) {
      where.subCategory = { equals: query.sub_category, mode: 'insensitive' };
    }
    if (query.status) {
      where.status = { equals: query.status, mode: 'insensitive' };
    }
    if (query.active_ad !== undefined) {
      where.activeAd = query.active_ad === 'true' || query.active_ad === true;
    }
    if (query.collections) {
      const colArray = Array.isArray(query.collections)
        ? query.collections
        : typeof query.collections === 'string'
        ? query.collections.split(',')
        : [query.collections];
      where.collections = { hasSome: colArray };
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { brand: { contains: s, mode: 'insensitive' } },
        { sku: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { searchKeywords: { has: s } },
      ];
    }

    const [total, products] = await Promise.all([
      this.db.product.count({ where }),
      this.db.product.findMany({
        where,
        orderBy: { createdDate: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: products.map(mapPrismaToRestOutput),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProductByIdRest(id: string) {
    const p = await this.db.product.findUnique({
      where: { id },
    });
    if (!p) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return mapPrismaToRestOutput(p);
  }

  async updateProductRest(id: string, dto: any) {
    const existing = await this.db.product.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const data = mapRestToPrismaInput(dto);
    data.updatedDate = new Date();

    const updated = await this.db.product.update({
      where: { id },
      data: data as Prisma.ProductUpdateInput,
    });
    return mapPrismaToRestOutput(updated);
  }

  async deleteProductRest(id: string) {
    const existing = await this.db.product.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    await this.db.product.delete({
      where: { id },
    });
    return { success: true, message: 'Product deleted successfully' };
  }

  async incrementInventory(id: string, quantity: number) {
    const existing = await this.db.product.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const updated = await this.db.product.update({
      where: { id },
      data: {
        inventory: { increment: quantity },
        updatedDate: new Date(),
      },
    });
    return mapPrismaToRestOutput(updated);
  }

  async decrementInventory(id: string, quantity: number) {
    const existing = await this.db.product.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const newInventory = Math.max(0, (existing.inventory || 0) - quantity);

    const updated = await this.db.product.update({
      where: { id },
      data: {
        inventory: newInventory,
        updatedDate: new Date(),
      },
    });
    return mapPrismaToRestOutput(updated);
  }

  async updateCollectionsRest(id: string, collectionIds: string[]) {
    const existing = await this.db.product.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const valid = collectionIds.filter(isValidGuid);
    const skipped = collectionIds.filter((cid) => !isValidGuid(cid));
    if (skipped.length) {
      this.logger.warn(`Skipping invalid collectionIds: ${skipped.join(', ')}`);
    }

    await this.db.product.update({
      where: { id },
      data: {
        collections: valid,
        updatedDate: new Date(),
      },
    });

    return { product_id: id, attached: valid, skipped };
  }

  async updateMediaRest(id: string, dto: { main_media?: string; product_images?: any[] }) {
    const existing = await this.db.product.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const data: any = {};
    if (dto.product_images !== undefined) {
      data.productImages = dto.product_images;
      data.mainMedia = dto.main_media ?? dto.product_images?.[0] ?? null;
    } else if (dto.main_media !== undefined) {
      data.mainMedia = dto.main_media;
    }

    data.updatedDate = new Date();

    const updated = await this.db.product.update({
      where: { id },
      data,
    });
    return mapPrismaToRestOutput(updated);
  }

  async updateStatusRest(id: string, status: string) {
    const existing = await this.db.product.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const updated = await this.db.product.update({
      where: { id },
      data: {
        status,
        updatedDate: new Date(),
      },
    });
    return mapPrismaToRestOutput(updated);
  }

  async updateAdStats(id: string, dto: any) {
    const existing = await this.db.product.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const data: any = {};
    if (dto.reach !== undefined) data.reach = parseInt(dto.reach, 10) || 0;
    if (dto.impression !== undefined) data.impression = parseInt(dto.impression, 10) || 0;
    if (dto.clicks !== undefined) data.clicks = parseInt(dto.clicks, 10) || 0;
    if (dto.sales !== undefined) data.sales = parseInt(dto.sales, 10) || 0;
    if (dto.revenue !== undefined) data.revenue = parseFloat(dto.revenue) || 0;

    data.updatedDate = new Date();

    const updated = await this.db.product.update({
      where: { id },
      data,
    });
    return mapPrismaToRestOutput(updated);
  }

  async updatePricing(id: string, dto: any) {
    const existing = await this.db.product.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const data: any = {};
    if (dto.price !== undefined) data.price = parseFloat(dto.price) || 0;
    if (dto.mrp !== undefined) data.mrp = parseFloat(dto.mrp) || 0;
    if (dto.onsale_price !== undefined) data.onsalePrice = parseFloat(dto.onsale_price) || 0;
    if (dto.discount !== undefined) data.discount = dto.discount;
    if (dto.variant_price !== undefined) data.variantPrice = dto.variant_price;
    if (dto.new_variant_price !== undefined) data.newVariantPrice = dto.new_variant_price;

    data.updatedDate = new Date();

    const updated = await this.db.product.update({
      where: { id },
      data,
    });
    return mapPrismaToRestOutput(updated);
  }
}

// ==========================================
// OUT-OF-CLASS HELPER MAPPERS & UTILITIES
// ==========================================

function sanitizeProductOptions(options: any) {
  if (!options || typeof options !== 'object') return options;
  for (const key of Object.keys(options)) {
    const option = options[key];
    if (option && typeof option === 'object') {
      if (Array.isArray(option.optionType)) {
        option.optionType = option.optionType[0];
      }
      if (!option.optionType) {
        option.optionType = 'dropdown';
      }
    }
  }
  return options;
}

function isValidGuid(id: string): boolean {
  return typeof id === 'string' &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
}

function mapRestToPrismaInput(dto: any): Prisma.ProductCreateInput & Prisma.ProductUpdateInput {
  const data: any = {};
  if (dto.name !== undefined) data.name = dto.name;
  if (dto.seller_id !== undefined) data.sellerId = dto.seller_id;
  if (dto.main_media !== undefined) data.mainMedia = dto.main_media;
  if (dto.one_rs_store !== undefined) data.oneRsStore = dto.one_rs_store;
  if (dto.product_images !== undefined) data.productImages = dto.product_images;
  if (dto.search_keywords !== undefined) data.searchKeywords = dto.search_keywords;
  if (dto.sub_category !== undefined) data.subCategory = dto.sub_category;
  if (dto.sub_category_id !== undefined) data.subCategoryId = dto.sub_category_id;
  if (dto.brand !== undefined) data.brand = dto.brand;
  if (dto.inventory !== undefined) data.inventory = parseInt(dto.inventory, 10) || 0;
  if (dto.variant_price !== undefined) data.variantPrice = dto.variant_price;
  if (dto.wix_product_id !== undefined) data.wixProductId = dto.wix_product_id;
  if (dto.new_variant_price !== undefined) data.newVariantPrice = dto.new_variant_price;
  if (dto.mrp !== undefined) data.mrp = parseFloat(dto.mrp) || 0;
  if (dto.onsale_price !== undefined) data.onsalePrice = parseFloat(dto.onsale_price) || 0;
  if (dto.cod !== undefined) data.cod = parseFloat(dto.cod) || 0;
  if (dto.upi !== undefined) data.upi = parseFloat(dto.upi) || 0;
  if (dto.price !== undefined) data.price = parseFloat(dto.price) || 0;
  if (dto.discount !== undefined) data.discount = dto.discount;
  if (dto.status !== undefined) data.status = dto.status;
  if (dto.delivery_charges !== undefined) data.deliveryCharges = dto.delivery_charges === true || dto.delivery_charges === 'true';
  if (dto.main_category !== undefined) data.mainCategory = dto.main_category;
  if (dto.shipping_weight !== undefined) data.shippingWeight = parseFloat(dto.shipping_weight) || 0;
  if (dto.collections !== undefined) data.collections = dto.collections;
  if (dto.seller_pincode !== undefined) data.sellerPincode = dto.seller_pincode;
  if (dto.owner !== undefined) data.owner = dto.owner;
  if (dto.product_options !== undefined) data.productOptions = sanitizeProductOptions(dto.product_options);
  if (dto.additional_info_sections !== undefined) data.additionalInfoSections = dto.additional_info_sections;
  if (dto.active_ad !== undefined) data.activeAd = dto.active_ad === true || dto.active_ad === 'true';
  if (dto.average_cpc !== undefined) data.averageCpc = parseFloat(dto.average_cpc) || 0;
  if (dto.priority_score !== undefined) data.priorityScore = parseInt(dto.priority_score, 10) || 0;
  if (dto.campaign_id !== undefined) data.campaignId = dto.campaign_id;
  if (dto.reach !== undefined) data.reach = parseInt(dto.reach, 10) || 0;
  if (dto.impression !== undefined) data.impression = parseInt(dto.impression, 10) || 0;
  if (dto.clicks !== undefined) data.clicks = parseInt(dto.clicks, 10) || 0;
  if (dto.sales !== undefined) data.sales = parseInt(dto.sales, 10) || 0;
  if (dto.revenue !== undefined) data.revenue = parseFloat(dto.revenue) || 0;
  if (dto.category_name !== undefined) data.categoryName = dto.category_name;
  if (dto.sku !== undefined) data.sku = dto.sku;
  if (dto.product_type !== undefined) data.productType = dto.product_type;
  if (dto.manage_variants !== undefined) data.manageVariants = dto.manage_variants === true || dto.manage_variants === 'true';
  if (dto.ribbon !== undefined) data.ribbon = dto.ribbon;
  if (dto.track_inventory !== undefined) data.trackInventory = dto.track_inventory === true || dto.track_inventory === 'true';
  if (dto.influencer_branding !== undefined) data.influencerBranding = dto.influencer_branding === true || dto.influencer_branding === 'true';
  if (dto.haatza_verified !== undefined) data.haatzaVerified = dto.haatza_verified === true || dto.haatza_verified === 'true';
  if (dto.promotion_photos !== undefined) data.promotionPhotos = dto.promotion_photos;
  if (dto.payment_type !== undefined) data.paymentType = dto.payment_type;
  if (dto.product_return !== undefined) data.productReturn = dto.product_return;
  if (dto.size_chart !== undefined) data.sizeChart = dto.size_chart;
  if (dto.description !== undefined) data.description = dto.description;
  if (dto.gst_seller !== undefined) data.gstSeller = parseFloat(dto.gst_seller) || 0;
  if (dto.upi_payment_discount !== undefined) data.upiPaymentDiscount = parseFloat(dto.upi_payment_discount) || 0;
  if (dto.manage_listing_products !== undefined) data.manageListingProducts = dto.manage_listing_products;
  if (dto.sell_and_earn_commission !== undefined) data.sellAndEarnCommission = parseFloat(dto.sell_and_earn_commission) || 0;
  if (dto.sell_and_earn !== undefined) data.sellAndEarn = dto.sell_and_earn;
  return data;
}

function mapPrismaToRestOutput(p: any): any {
  if (!p) return p;
  return {
    product_id: p.id,
    main_media: p.mainMedia,
    one_rs_store: p.oneRsStore,
    product_images: p.productImages,
    name: p.name,
    search_keywords: p.searchKeywords,
    sub_category: p.subCategory,
    sub_category_id: p.subCategoryId,
    brand: p.brand,
    inventory: p.inventory,
    variant_price: p.variantPrice,
    wix_product_id: p.wixProductId,
    new_variant_price: p.newVariantPrice,
    mrp: p.mrp,
    onsale_price: p.onsalePrice,
    cod: p.cod,
    upi: p.upi,
    price: p.price,
    discount: p.discount,
    status: p.status,
    delivery_charges: p.deliveryCharges,
    main_category: p.mainCategory,
    seller_id: p.sellerId,
    shipping_weight: p.shippingWeight,
    collections: p.collections,
    seller_pincode: p.sellerPincode,
    created_date: p.createdDate,
    updated_date: p.updatedDate,
    owner: p.owner,
    product_options: p.productOptions,
    additional_info_sections: p.additionalInfoSections,
    active_ad: p.activeAd,
    average_cpc: p.averageCpc,
    priority_score: p.priorityScore,
    campaign_id: p.campaignId,
    reach: p.reach,
    impression: p.impression,
    clicks: p.clicks,
    sales: p.sales,
    revenue: p.revenue,
    category_name: p.categoryName,
    sku: p.sku,
    product_type: p.productType,
    manage_variants: p.manageVariants,
    ribbon: p.ribbon,
    track_inventory: p.trackInventory,
    influencer_branding: p.influencerBranding,
    haatza_verified: p.haatzaVerified,
    promotion_photos: p.promotionPhotos,
    payment_type: p.paymentType,
    product_return: p.productReturn,
    size_chart: p.sizeChart,
    description: p.description,
    gst_seller: p.gstSeller,
    upi_payment_discount: p.upiPaymentDiscount,
    manage_listing_products: p.manageListingProducts,
    sell_and_earn_commission: p.sellAndEarnCommission,
    sell_and_earn: p.sellAndEarn,
  };
}
