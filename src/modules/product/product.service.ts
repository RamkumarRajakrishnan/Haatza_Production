import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProductListQueryDto, SortOrder } from './dto/product-list.dto';
import { Prisma, CategoryStatus, CategoryModule } from '@prisma/client';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private readonly db: DatabaseService) { }

  async getProductsList(query: ProductListQueryDto, authenticatedSellerId?: string) {
    const {
      email,
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

    let targetSellerId = authenticatedSellerId || sellerId;

    // If an email is provided instead of a sellerId, validate it belongs to a seller
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

    // STRICT SELLER CHECK: If we still don't have a valid seller, return empty
    // This prevents buyers or non-seller employees from fetching the full product list
    if (!targetSellerId) {
      return {
        status: 'success',
        message: 'Products list retrieved successfully (No valid seller provided)',
        data: {
          products: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      };
    }

    // Build the query filter object
    const where: Prisma.ProductWhereInput = {};

    where.sellerId = targetSellerId;

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

    const rawModule = (query.module || (query as any).Module || '').trim().toUpperCase();
    if (!rawModule) {
      throw new BadRequestException('module is required (haatza or lite)');
    }
    if (rawModule !== 'LITE' && rawModule !== 'HAATZA') {
      throw new BadRequestException("Invalid module. Allowed values are 'haatza' and 'lite'");
    }
    const moduleEnum = rawModule === 'LITE' ? CategoryModule.LITE : CategoryModule.HAATZA;
      const modCats = await this.db.categoryList.findMany({
        where: { module: { in: [moduleEnum, CategoryModule.ALL] } },
        select: { categoryId: true, categoryName: true },
      });
      const modCatIds = modCats.map((c) => c.categoryId);
      const modCatNames = modCats.map((c) => c.categoryName);
      if (modCatIds.length > 0) {
        where.AND = [
          ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
          {
            OR: [
              { categoryId: { in: modCatIds } },
              { subCategoryId: { in: modCatIds } },
              { collections: { hasSome: modCatIds } },
              { subCategory: { in: modCatNames } },
              { mainCategory: { in: modCatIds } },
            ],
          },
        ];
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
    const [total, rawProducts] = await Promise.all([
      this.db.product.count({ where }),
      this.db.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          brand: true,
          productOptions: true,
          mainMedia: true,
          activeAd: true,
          sellerId: true,
          campaignId: true,
          deliveryCharges: true,
          mainCategory: true,
          subCategoryId: true,
          cod: true,
          upi: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const mappedProducts = rawProducts.map((p) => ({
      brand: p.brand || '',
      name: p.name || '',
      productId: p.id,
      productOption: p.productOptions || {},
      productOptions: p.productOptions || {},
      image: p.mainMedia || '',
      mainMedia: p.mainMedia || '',
      activeAd: p.activeAd || false,
      averageRating: 0,
      isWishlist: false,
      wishlistTableId: '',
      sellerId: p.sellerId || '',
      campaignId: p.campaignId || '',
      deliveryCharges: p.deliveryCharges ?? true,
      mainCategoryId: p.mainCategory || '',
      subCategoryId: p.subCategoryId || '',
      finalPricing: {
        codFinal: p.cod || 0,
        upiFinal: p.upi || 0,
      },
    }));

    return {
      status: 'success',
      message: 'Products list retrieved successfully',
      data: {
        products: mappedProducts,
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

    return mapPrismaToWixSellerListing(p);
  }

  /**
   * POST /api/v1/updateSellerProduct
   * Wix-compatible update product
   */
  async updateSellerProduct(body: any) {
    const id = body.Id || body.id || body._id;
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
    if (body.sellAndEarnCommission !== undefined) updateData.sellAndEarnCommission = parseFloat(body.sellAndEarnCommission) || 0;
    if (body.inventory !== undefined) updateData.inventory = parseInt(body.inventory, 10) || 0;
    if (body.sellAndEarn !== undefined) {
      updateData.sellAndEarn = body.sellAndEarn === true || body.sellAndEarn === 'true' || body.sellAndEarn === 'TRUE' ? 'TRUE' : 'FALSE';
    }
    if (body.search_keywords !== undefined) {
      updateData.searchKeywords = typeof body.search_keywords === 'string'
        ? body.search_keywords.split(',').map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(body.search_keywords) ? body.search_keywords : []);
    }
    if (body.searchKeywords !== undefined) {
      updateData.searchKeywords = Array.isArray(body.searchKeywords) ? body.searchKeywords : [body.searchKeywords];
    }
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.category_id !== undefined) updateData.categoryId = body.category_id;
    if (body.promotionPhotos !== undefined) updateData.promotionPhotos = Array.isArray(body.promotionPhotos) ? body.promotionPhotos : [];
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
        updatedData: mapPrismaToWixSellerListing(updated),
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
    const mediaList = body.mediaItems || body.productImages || [];
    const firstMedia = Array.isArray(mediaList) && mediaList.length > 0
      ? (mediaList[0]?.src || (typeof mediaList[0] === 'string' ? mediaList[0] : ''))
      : '';

    const searchKeywordsList = typeof body.search_keywords === 'string'
      ? body.search_keywords.split(',').map((s: string) => s.trim()).filter(Boolean)
      : (Array.isArray(body.search_keywords) ? body.search_keywords : (body.searchKeywords || []));

    const isSellAndEarn = body.sellAndEarn === true || body.sellAndEarn === 'true' || body.sellAndEarn === 'TRUE' ? 'TRUE' : 'FALSE';

    const insertData: Prisma.ProductCreateInput = {
      name: body.name,
      price: parseFloat(body.price) || 0,
      sellerId: sellerId || '',
      status: body.status || 'Under Review',
      inventory: body.totalQuantity !== undefined
        ? parseInt(body.totalQuantity, 10)
        : (body.inventory !== undefined ? parseInt(body.inventory, 10) : 0),
      mainMedia: body.mainmedia || body.mainMedia || firstMedia,
      productImages: mediaList,
      shippingWeight: body.shippingWeight !== undefined ? parseFloat(body.shippingWeight) : 0,
      brand: body.brand || '',
      productOptions: body.productOptions || {},
      collections: body.categoryId ? (Array.isArray(body.categoryId) ? body.categoryId : [body.categoryId]) : (body.collections || []),
      categoryName: body.categoryName ? (Array.isArray(body.categoryName) ? body.categoryName : [body.categoryName]) : [],
      productType: body.productType || 'physical',
      discount: body.discount || null,
      manageVariants: body.manageVariants === true || body.manageVariants === 'true',
      variantPrice: body.varientPrice || body.variantPrice || {},
      additionalInfoSections: body.additionalInfoSections || [],
      mainCategory: body.mainCategory || '',
      subCategory: body.subCategory || '',
      subCategoryId: body.subCategoryId || '',
      promotionPhotos: Array.isArray(body.promotionPhotos) ? body.promotionPhotos : [],
      paymentType: body.paymentType || '',
      productReturn: body.productReturn || '',
      deliveryCharges: body.deliveryCharges === true || body.deliveryCharges === 'true',
      sizeChart: body.sizeChart || '',
      sellerPincode: body.sellerPinCode || body.sellerPincode || '',
      searchKeywords: searchKeywordsList,
      categoryId: body.categoryId || body.category_id || (Array.isArray(body.collections) && body.collections.length > 0 ? body.collections[0] : (typeof body.collections === 'string' ? body.collections : null)),
      sellAndEarnCommission: body.sellAndEarnCommission !== undefined ? parseFloat(body.sellAndEarnCommission) : 0,
      sellAndEarn: isSellAndEarn,
      createdDate: new Date(),
      updatedDate: new Date(),
    };

    const created = await this.db.product.create({
      data: insertData,
    });

    return {
      status: 'success',
      message: {
        headers: {},
        message: 'Product submitted successfully',
        data: mapPrismaToWixSellerListing(created),
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

    return { productId: id, attached: valid, skipped };
  }

  async updateMediaRest(id: string, dto: { main_media?: string; mainMedia?: string; product_images?: any[]; productImages?: any[] }) {
    const existing = await this.db.product.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const data: any = {};
    const mediaImages = dto.productImages ?? dto.product_images;
    const mainMedia = dto.mainMedia ?? dto.main_media;
    if (mediaImages !== undefined) {
      data.productImages = mediaImages;
      data.mainMedia = mainMedia ?? (Array.isArray(mediaImages) ? (mediaImages[0]?.src || mediaImages[0]) : null);
    } else if (mainMedia !== undefined) {
      data.mainMedia = mainMedia;
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

  async getProductsByCategory(query: {
    categoryId?: string;
    page?: string;
    count?: string;
    userId?: string;
    toPincode?: string;
    brands?: string;
    minPrice?: string;
    maxPrice?: string;
    productOptions?: string;
    specfication?: string;
    specification?: string;
    rating?: string;
    sort?: string;
    module?: string;
  }) {
    const categoryId = query.categoryId;
    const page = parseInt(String(query.page || '1'), 10) || 1;
    const limit = parseInt(String(query.count || '10'), 10) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (categoryId) {
      where.OR = [
        { categoryId: categoryId },
        { subCategory: categoryId },
        { subCategoryId: categoryId },
        { collections: { hasSome: [categoryId] } },
        { mainCategory: categoryId },
      ];
    }

    if (query.brands) {
      const brandList = typeof query.brands === 'string'
        ? query.brands.split(',').map((b) => b.trim()).filter(Boolean)
        : (Array.isArray(query.brands) ? query.brands : [query.brands]);
      if (brandList.length > 0) {
        where.brand = { in: brandList, mode: 'insensitive' };
      }
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceFilter: Prisma.FloatNullableFilter = {};
      if (query.minPrice !== undefined && query.minPrice !== '') {
        priceFilter.gte = parseFloat(String(query.minPrice));
      }
      if (query.maxPrice !== undefined && query.maxPrice !== '') {
        priceFilter.lte = parseFloat(String(query.maxPrice));
      }
      where.price = priceFilter;
    }

    let orderBy: any = [{ priorityScore: 'desc' }, { createdDate: 'desc' }];
    if (query.sort === 'price_low_high') {
      orderBy = { price: 'asc' };
    } else if (query.sort === 'price_high_low') {
      orderBy = { price: 'desc' };
    } else if (query.sort === 'newest') {
      orderBy = { createdDate: 'desc' };
    } else {
      // default popularity
      orderBy = [{ priorityScore: 'desc' }, { createdDate: 'desc' }];
    }

    const [total, products] = await Promise.all([
      this.db.product.count({ where }),
      this.db.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
    ]);

    // calculate category filters (all matching products for category)
    const categoryBaseWhere: Prisma.ProductWhereInput = {};
    if (categoryId) {
      categoryBaseWhere.OR = [
        { subCategory: categoryId },
        { subCategoryId: categoryId },
        { collections: { hasSome: [categoryId] } },
        { mainCategory: categoryId },
      ];
    }

    const allMatchingProducts = await this.db.product.findMany({
      where: categoryBaseWhere,
      select: {
        price: true,
        mrp: true,
        brand: true,
        additionalInfoSections: true,
      },
    });

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    const brandSet = new Set<string>();
    const specMap = new Map<string, Set<string>>();

    allMatchingProducts.forEach((p) => {
      const pPrice = Number(p.price || p.mrp || 0);
      if (pPrice < minPrice) minPrice = pPrice;
      if (pPrice > maxPrice) maxPrice = pPrice;
      if (p.brand && typeof p.brand === 'string') {
        const trimmedBrand = p.brand.trim();
        if (trimmedBrand) {
          brandSet.add(trimmedBrand);
        }
      }
      if (Array.isArray(p.additionalInfoSections)) {
        p.additionalInfoSections.forEach((info: any) => {
          if (info && typeof info === 'object' && info.title && info.description) {
            const title = String(info.title).trim();
            const desc = String(info.description).replace(/<[^>]*>?/gm, '').trim();
            if (title && desc) {
              if (!specMap.has(title)) {
                specMap.set(title, new Set());
              }
              specMap.get(title)!.add(desc);
            }
          }
        });
      }
    });

    if (minPrice === Infinity) minPrice = 0;
    if (maxPrice === -Infinity) maxPrice = 0;

    const specficationList: Record<string, string>[] = [];
    specMap.forEach((values, title) => {
      Array.from(values).sort().forEach((val) => {
        specficationList.push({ [title]: val });
      });
    });

    const categoryFilters = {
      brands: Array.from(brandSet).sort(),
      priceRange: { min: minPrice, max: maxPrice },
      productOptions: {},
      ratingCounts: { '1+': 0, '2+': 0, '3+': 0, '4+': 0 },
      specification: specficationList,
    };

    const totalPages = Math.ceil(total / limit);

    const mappedProducts = products.map(mapProductToCard);

    const sortFilter = [
      { label: 'Popularity', value: 'popularity' },
      { label: 'Price: Low to High', value: 'price_low_high' },
      { label: 'Price: High to Low', value: 'price_high_low' },
      { label: 'Newest First', value: 'newest' },
    ];

    return {
      status: 'success',
      message: {
        categoryId: categoryId || '',
        module: (query.module || '').trim() || 'haatza',
        totalItems: total,
        totalPages,
        currentPage: page,
        lastFetched: mappedProducts.length,
        products: mappedProducts,
        categoryFilters,
        sortFilter,
      },
    };
  }

  /**
   * GET /api/v1/ProductsBySubCategoryId
   * 
   * Parallel execution of Bucket A (Ads) and Bucket B (Organic) by sub_category_id
   * Interleaved 2-Ad / 2-Organic / 2-Ad / 2-Organic repeating cycle with default limit=20 per page.
   * Includes category_filters data by categoryId (with fallback dynamic filter generation).
   */
  async getProductsBySubCategoryIdInterleaved(params: {
    subCategoryId: string;
    page?: string | number;
    limit?: string | number;
    brands?: string | string[];
    minPrice?: string | number;
    maxPrice?: string | number;
    productOptions?: any;
    specification?: any;
    rating?: string | number;
    sort?: string;
    module?: string;
  }) {
    const rawSubCategoryId = params.subCategoryId?.trim();
    if (!rawSubCategoryId) {
      throw new BadRequestException('sub_category_id is required');
    }

    const rawModule = (params.module || '').trim();
    let moduleEnum: CategoryModule | undefined;
    if (rawModule) {
      const upper = rawModule.toUpperCase();
      if (upper === 'LITE') {
        moduleEnum = CategoryModule.LITE;
      } else if (upper === 'HAATZA') {
        moduleEnum = CategoryModule.HAATZA;
      }
    }

    // 1. Input validation & normalization: default page 1, default limit 20
    let page = parseInt(String(params.page || '1'), 10);
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    let limit = parseInt(String(params.limit || '20'), 10);
    if (isNaN(limit) || limit < 1) {
      limit = 20;
    }

    // 2. Validate subcategory existence in CategoryMaster
    const categoryExists = await this.db.categoryMaster.findFirst({
      where: {
        OR: [
          { categoryId: rawSubCategoryId },
          { id: rawSubCategoryId },
          { categoryName: { equals: rawSubCategoryId, mode: 'insensitive' } },
        ],
        ...(moduleEnum ? { module: { in: [moduleEnum, CategoryModule.ALL] } } : {}),
      },
    });

    let resolvedCategoryRecord = categoryExists;
    if (!resolvedCategoryRecord) {
      resolvedCategoryRecord = await this.db.categoryList.findFirst({
        where: {
          OR: [
            { categoryId: rawSubCategoryId },
            { id: rawSubCategoryId },
            { categoryName: { equals: rawSubCategoryId, mode: 'insensitive' } },
          ],
          ...(moduleEnum ? { module: { in: [moduleEnum, CategoryModule.ALL] } } : {}),
        },
      });
    }

    const resolvedCategoryId = categoryExists?.categoryId || resolvedCategoryRecord?.categoryId || rawSubCategoryId;

    const subCategoryFilter: Prisma.ProductWhereInput = {
      OR: [
        { subCategoryId: rawSubCategoryId },
        { subCategory: rawSubCategoryId },
        { categoryId: rawSubCategoryId },
        { collections: { hasSome: [rawSubCategoryId] } },
        { mainCategory: rawSubCategoryId },
        { categoryName: { hasSome: [rawSubCategoryId] } },
        ...(resolvedCategoryRecord
          ? [
            { subCategoryId: resolvedCategoryRecord.categoryId },
            { subCategory: resolvedCategoryRecord.categoryName },
            { categoryId: resolvedCategoryRecord.categoryId },
            { mainCategory: resolvedCategoryRecord.categoryId },
          ]
          : []),
      ],
    };

    // 3. User Filter parameters (brands, priceRange, etc.)
    const extraFilterConditions: Prisma.ProductWhereInput[] = [];

    if (params.brands) {
      const brandList = typeof params.brands === 'string'
        ? params.brands.split(',').map((b) => b.trim()).filter(Boolean)
        : (Array.isArray(params.brands) ? params.brands : [params.brands]);
      if (brandList.length > 0) {
        extraFilterConditions.push({ brand: { in: brandList, mode: 'insensitive' } });
      }
    }

    if (params.minPrice !== undefined && params.minPrice !== '') {
      const min = parseFloat(String(params.minPrice));
      if (!isNaN(min)) {
        extraFilterConditions.push({
          OR: [
            { price: { gte: min } },
            { onsalePrice: { gte: min } },
            { mrp: { gte: min } },
          ],
        });
      }
    }

    if (params.maxPrice !== undefined && params.maxPrice !== '') {
      const max = parseFloat(String(params.maxPrice));
      if (!isNaN(max)) {
        extraFilterConditions.push({
          OR: [
            { price: { lte: max } },
            { onsalePrice: { lte: max } },
            { mrp: { lte: max } },
          ],
        });
      }
    }

    // 4. Sort ordering configuration
    let adsOrderBy: any = [{ priorityScore: 'desc' }, { id: 'asc' }];
    let organicOrderBy: any = [{ priorityScore: 'desc' }, { id: 'asc' }];

    if (params.sort === 'price_low_high') {
      adsOrderBy = [{ priorityScore: 'desc' }, { price: 'asc' }, { id: 'asc' }];
      organicOrderBy = [{ price: 'asc' }, { id: 'asc' }];
    } else if (params.sort === 'price_high_low') {
      adsOrderBy = [{ priorityScore: 'desc' }, { price: 'desc' }, { id: 'asc' }];
      organicOrderBy = [{ price: 'desc' }, { id: 'asc' }];
    } else if (params.sort === 'newest') {
      adsOrderBy = [{ priorityScore: 'desc' }, { createdDate: 'desc' }, { id: 'asc' }];
      organicOrderBy = [{ createdDate: 'desc' }, { id: 'asc' }];
    }

    const whereAds: Prisma.ProductWhereInput = {
      AND: [
        subCategoryFilter,
        { activeAd: true },
        ...extraFilterConditions,
      ],
    };

    const whereOrganic: Prisma.ProductWhereInput = {
      AND: [
        subCategoryFilter,
        {
          OR: [
            { activeAd: false },
            { activeAd: null },
          ],
        },
        ...extraFilterConditions,
      ],
    };

    const takeCount = page * limit;

    // 5. Parallel database query execution (Counts, Ads, Organic, CategoryFilters)
    const [totalAds, totalOrganic, ads, organic, dbCategoryFilter] = await Promise.all([
      this.db.product.count({ where: whereAds }),
      this.db.product.count({ where: whereOrganic }),
      this.db.product.findMany({
        where: whereAds,
        orderBy: adsOrderBy,
        take: takeCount,
      }),
      this.db.product.findMany({
        where: whereOrganic,
        orderBy: organicOrderBy,
        take: takeCount,
      }),
      this.db.categoryFilters.findFirst({
        where: {
          OR: [
            { categoryId: rawSubCategoryId },
            { categoryId: resolvedCategoryId },
            ...(categoryExists?.id ? [{ categoryId: categoryExists.id }] : []),
          ],
        },
      }),
    ]);

    const totalItems = totalAds + totalOrganic;
    let totalPages = Math.ceil(totalItems / limit) || 1;

    // Helper: Interleave 2 Ads / 2 Organic in repeating 8-item cycle
    const interleaveAdAndOrganic = (adsArr: any[], orgArr: any[]): any[] => {
      const list: any[] = [];
      let adIdx = 0;
      let orgIdx = 0;
      while (adIdx < adsArr.length || orgIdx < orgArr.length) {
        for (let i = 0; i < 2; i++) {
          if (adIdx < adsArr.length) list.push(adsArr[adIdx++]);
          else if (orgIdx < orgArr.length) list.push(orgArr[orgIdx++]);
        }
        for (let i = 0; i < 2; i++) {
          if (orgIdx < orgArr.length) list.push(orgArr[orgIdx++]);
          else if (adIdx < adsArr.length) list.push(adsArr[adIdx++]);
        }
        for (let i = 0; i < 2; i++) {
          if (adIdx < adsArr.length) list.push(adsArr[adIdx++]);
          else if (orgIdx < orgArr.length) list.push(orgArr[orgIdx++]);
        }
        for (let i = 0; i < 2; i++) {
          if (orgIdx < orgArr.length) list.push(orgArr[orgIdx++]);
          else if (adIdx < adsArr.length) list.push(adsArr[adIdx++]);
        }
      }
      return list;
    };

    // 1. Interleave primary products first
    const primaryInterleaved = interleaveAdAndOrganic(ads, organic);

    // Flipkart / Amazon 3-Tier Fallback Engine:
    // If exact subcategory products are exhausted or low, fill remaining slots from sibling categories / trending items
    let isFallback = false;
    let fallbackTitle: string | null = null;
    let fallbackTotalAvailable = 0;
    const fallbackAds: any[] = [];
    const fallbackOrganic: any[] = [];

    const neededTotal = (page * limit) + (limit * 2);

    if (primaryInterleaved.length < neededTotal) {
      const existingProductIds = new Set<string>([
        ...ads.map((p) => p.id),
        ...organic.map((p) => p.id),
      ]);

      const neededCount = neededTotal - primaryInterleaved.length + (limit * 2);

      // Tier 1. Sibling Subcategories under Parent Category
      let parentCategoryId = resolvedCategoryRecord?.parentCategoryId;
      let parentCategoryName = '';

      if (parentCategoryId && parentCategoryId !== '0') {
        const parentCat = await this.db.categoryList.findFirst({
          where: {
            OR: [
              { categoryId: parentCategoryId },
              { id: parentCategoryId },
            ],
          },
        });
        parentCategoryName = parentCat?.categoryName || '';

        // Find all active sibling subcategory IDs under this parent
        const siblingCats = await this.db.categoryList.findMany({
          where: {
            parentCategoryId: parentCategoryId,
            categoryId: { notIn: [rawSubCategoryId, resolvedCategoryId] },
            status: CategoryStatus.ACTIVE,
            ...(moduleEnum ? { module: { in: [moduleEnum, CategoryModule.ALL] } } : {}),
          },
          select: { categoryId: true, categoryName: true },
        });

        const siblingCatIds = siblingCats.map((c) => c.categoryId);
        const siblingCatNames = siblingCats.map((c) => c.categoryName);

        if (siblingCatIds.length > 0) {
          const siblingFilter: Prisma.ProductWhereInput = {
            AND: [
              {
                id: { notIn: Array.from(existingProductIds) },
                OR: [
                  { subCategoryId: { in: siblingCatIds } },
                  { categoryId: { in: siblingCatIds } },
                  { collections: { hasSome: siblingCatIds } },
                  { subCategory: { in: siblingCatNames } },
                ],
              },
              ...extraFilterConditions,
            ],
          };

          const [siblingCount, sAds, sOrganic] = await Promise.all([
            this.db.product.count({ where: siblingFilter }),
            this.db.product.findMany({
              where: { AND: [siblingFilter, { activeAd: true }] },
              orderBy: adsOrderBy,
              take: neededCount,
            }),
            this.db.product.findMany({
              where: {
                AND: [
                  siblingFilter,
                  { OR: [{ activeAd: false }, { activeAd: null }] },
                ],
              },
              orderBy: organicOrderBy,
              take: neededCount,
            }),
          ]);

          fallbackTotalAvailable += siblingCount;

          sAds.forEach((p) => {
            if (!existingProductIds.has(p.id)) {
              existingProductIds.add(p.id);
              fallbackAds.push(p);
            }
          });

          sOrganic.forEach((p) => {
            if (!existingProductIds.has(p.id)) {
              existingProductIds.add(p.id);
              fallbackOrganic.push(p);
            }
          });

          if (sAds.length > 0 || sOrganic.length > 0) {
            isFallback = true;
            fallbackTitle = parentCategoryName
              ? `Explore More in ${parentCategoryName}`
              : 'Popular in Related Categories';
          }
        }
      }

      // Tier 2. Global Popular/Trending Fallback (if still under neededTotal)
      if (primaryInterleaved.length + fallbackAds.length + fallbackOrganic.length < neededTotal) {
        const globalFilter: Prisma.ProductWhereInput = {
          AND: [
            { id: { notIn: Array.from(existingProductIds) } },
            ...extraFilterConditions,
          ],
        };

        const [globalCount, gAds, gOrganic] = await Promise.all([
          this.db.product.count({ where: globalFilter }),
          this.db.product.findMany({
            where: { AND: [globalFilter, { activeAd: true }] },
            orderBy: [{ priorityScore: 'desc' }, { id: 'asc' }],
            take: neededCount,
          }),
          this.db.product.findMany({
            where: {
              AND: [
                globalFilter,
                { OR: [{ activeAd: false }, { activeAd: null }] },
              ],
            },
            orderBy: [{ priorityScore: 'desc' }, { id: 'asc' }],
            take: neededCount,
          }),
        ]);

        fallbackTotalAvailable += globalCount;

        gAds.forEach((p) => {
          if (!existingProductIds.has(p.id)) {
            existingProductIds.add(p.id);
            fallbackAds.push(p);
          }
        });

        gOrganic.forEach((p) => {
          if (!existingProductIds.has(p.id)) {
            existingProductIds.add(p.id);
            fallbackOrganic.push(p);
          }
        });

        if (gAds.length > 0 || gOrganic.length > 0) {
          isFallback = true;
          if (!fallbackTitle) {
            fallbackTitle = 'Trending Products';
          }
        }
      }
    }

    // 2. Interleave fallback products separately and append after primary products
    const fallbackInterleaved = interleaveAdAndOrganic(fallbackAds, fallbackOrganic);
    const combinedList = [...primaryInterleaved, ...fallbackInterleaved];

    // 6. Resolve CategoryFilters (use database record if exists, or compute dynamic fallback)
    let categoryFilters: any;

    if (dbCategoryFilter) {
      categoryFilters = {
        categoryId: dbCategoryFilter.categoryId || resolvedCategoryId,
        brands: dbCategoryFilter.brands || [],
        priceRange: dbCategoryFilter.priceRange || { min: 0, max: 0 },
        productOptions: dbCategoryFilter.productOptions || {},
        ratingCounts: dbCategoryFilter.ratingCounts || { '1+': 0, '2+': 0, '3+': 0, '4+': 0 },
        specification: dbCategoryFilter.specification || [],
        discountAvailable: dbCategoryFilter.discountAvailable ?? false,
        lastUpdated: dbCategoryFilter.lastUpdated || new Date(),
      };
    } else {
      const allMatchingProducts = await this.db.product.findMany({
        where: subCategoryFilter,
        select: {
          price: true,
          onsalePrice: true,
          mrp: true,
          brand: true,
          additionalInfoSections: true,
        },
      });

      let minPrice = Infinity;
      let maxPrice = -Infinity;
      const brandSet = new Set<string>();
      const specMap = new Map<string, Set<string>>();

      allMatchingProducts.forEach((p) => {
        const pPrice = Number(p.price || p.onsalePrice || p.mrp || 0);
        if (pPrice > 0) {
          if (pPrice < minPrice) minPrice = pPrice;
          if (pPrice > maxPrice) maxPrice = pPrice;
        }
        if (p.brand && typeof p.brand === 'string') {
          const trimmed = p.brand.trim();
          if (trimmed) brandSet.add(trimmed);
        }
        if (Array.isArray(p.additionalInfoSections)) {
          p.additionalInfoSections.forEach((info: any) => {
            if (info && typeof info === 'object' && info.title && info.description) {
              const title = String(info.title).trim();
              const desc = String(info.description).replace(/<[^>]*>?/gm, '').trim();
              if (title && desc) {
                if (!specMap.has(title)) specMap.set(title, new Set());
                specMap.get(title)!.add(desc);
              }
            }
          });
        }
      });

      if (minPrice === Infinity) minPrice = 0;
      if (maxPrice === -Infinity) maxPrice = 0;

      const specList: Record<string, string>[] = [];
      specMap.forEach((values, title) => {
        Array.from(values).sort().forEach((val) => {
          specList.push({ [title]: val });
        });
      });

      categoryFilters = {
        categoryId: resolvedCategoryId,
        brands: Array.from(brandSet).sort(),
        priceRange: { min: minPrice, max: maxPrice },
        productOptions: {},
        ratingCounts: { '1+': 0, '2+': 0, '3+': 0, '4+': 0 },
        specification: specList,
        discountAvailable: false,
        lastUpdated: new Date(),
      };
    }

    // 8. Slice exact page window from combined stream (Primary then Fallback)
    const startIndex = (page - 1) * limit;
    const pagedProducts = combinedList.slice(startIndex, startIndex + limit);

    // Determine if this current page slice contains fallback products
    const currentSliceHasFallback =
      isFallback &&
      (startIndex >= primaryInterleaved.length ||
        startIndex + pagedProducts.length > primaryInterleaved.length ||
        totalItems === 0);

    const grandTotalItems = isFallback
      ? Math.max(totalItems + fallbackTotalAvailable, combinedList.length)
      : totalItems;

    const grandTotalPages = Math.ceil(grandTotalItems / limit) || 1;
    const hasMore = (startIndex + limit) < grandTotalItems || (startIndex + limit) < combinedList.length;

    const mappedProducts = pagedProducts.map(mapProductToCard);

    const sortFilter = [
      { label: 'Popularity', value: 'popularity' },
      { label: 'Price: Low to High', value: 'price_low_high' },
      { label: 'Price: High to Low', value: 'price_high_low' },
      { label: 'Newest First', value: 'newest' },
    ];

    return {
      status: 'success',
      message: {
        categoryId: resolvedCategoryId || rawSubCategoryId,
        module: rawModule || 'haatza',
        totalItems: grandTotalItems,
        totalPages: grandTotalPages,
        currentPage: page,
        lastFetched: mappedProducts.length,
        products: mappedProducts,
        categoryFilters,
        sortFilter,
        hasMore,
        isFallback: currentSliceHasFallback,
        fallbackTitle: currentSliceHasFallback ? (fallbackTitle || 'Trending Products') : null,
        totalAds,
        totalOrganic,
      },
    };
  }

  // Alias for backward compatibility
  async getCategoryProductsInterleaved(params: {
    categoryId: string;
    page?: string | number;
    limit?: string | number;
  }) {
    return this.getProductsBySubCategoryIdInterleaved({
      subCategoryId: params.categoryId,
      page: params.page,
      limit: params.limit,
    });
  }

  async getCategoryLegacy(module?: string) {
    const rawModule = (module || '').trim().toUpperCase();
    const moduleEnum =
      rawModule === 'LITE'
        ? CategoryModule.LITE
        : rawModule === 'HAATZA'
          ? CategoryModule.HAATZA
          : undefined;

    const desiredOrder = [
      'Men Fashion',
      'Women Fashion',
      'Kids & Toys',
      'Beauty & Personal Care',
      'Home & Kitchen',
      'Books',
      'Musical Instruments'
    ];

    const records = await this.db.categoryMaster.findMany({
      where: {
        categoryName: { in: desiredOrder },
        ...(moduleEnum ? { module: { in: [moduleEnum, CategoryModule.ALL] } } : {}),
      }
    });

    const filteredItems = records.map(item => ({
      mainMedia: (item as any).imageUrl || (item as any).image || '',
      name: item.categoryName,
      categoryId: item.categoryId || item.id
    }));

    const sortedItems = filteredItems.sort((a, b) => {
      return desiredOrder.indexOf(a.name) - desiredOrder.indexOf(b.name);
    });

    return sortedItems;
  }

  async getSubcategoryListLegacy(query: { search?: string; page?: string; count?: string; module?: string }) {
    const search = query.search || null;
    const page = parseInt(query.page || '1', 10);
    const count = parseInt(query.count || '10', 10);
    const skip = (page - 1) * count;

    const rawModule = (query.module || '').trim().toUpperCase();
    const moduleEnum =
      rawModule === 'LITE'
        ? CategoryModule.LITE
        : rawModule === 'HAATZA'
          ? CategoryModule.HAATZA
          : undefined;

    const where: Prisma.CategoryMasterWhereInput = {
      categoryType: 'SUBCATEGORY',
      status: 'ACTIVE',
      ...(moduleEnum ? { module: { in: [moduleEnum, CategoryModule.ALL] } } : {}),
    };

    if (search) {
      where.categoryName = { contains: search, mode: 'insensitive' };
    }

    const [total, records] = await Promise.all([
      this.db.categoryMaster.count({ where }),
      this.db.categoryMaster.findMany({
        where,
        skip,
        take: count
      })
    ]);

    const items = records.map(item => ({
      categoryId: item.parentCategoryId || '',
      categoryName: (item as any).parentCategoryName || '',
      subCategoryId: item.categoryId || item.id,
      subCategory: item.categoryName
    }));

    return {
      status: "success",
      currentPage: page,
      totalPages: Math.ceil(total / count),
      totalItems: total,
      data: items
    };
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
  if (dto.sellerId !== undefined) data.sellerId = dto.sellerId;
  else if (dto.seller_id !== undefined) data.sellerId = dto.seller_id;

  if (dto.mainMedia !== undefined) data.mainMedia = dto.mainMedia;
  else if (dto.main_media !== undefined) data.mainMedia = dto.main_media;

  if (dto.productImages !== undefined) data.productImages = dto.productImages;
  else if (dto.product_images !== undefined) data.productImages = dto.product_images;

  if (dto.searchKeywords !== undefined) {
    data.searchKeywords = Array.isArray(dto.searchKeywords) ? dto.searchKeywords : [dto.searchKeywords];
  } else if (dto.search_keywords !== undefined) {
    data.searchKeywords = Array.isArray(dto.search_keywords)
      ? dto.search_keywords
      : (typeof dto.search_keywords === 'string' ? dto.search_keywords.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
  }

  if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
  else if (dto.category_id !== undefined) data.categoryId = dto.category_id;

  if (dto.subCategory !== undefined) data.subCategory = dto.subCategory;
  else if (dto.sub_category !== undefined) data.subCategory = dto.sub_category;

  if (dto.subCategoryId !== undefined) data.subCategoryId = dto.subCategoryId;
  else if (dto.sub_category_id !== undefined) data.subCategoryId = dto.sub_category_id;

  if (dto.brand !== undefined) data.brand = dto.brand;
  if (dto.inventory !== undefined) data.inventory = parseInt(dto.inventory, 10) || 0;

  if (dto.variantPrice !== undefined) data.variantPrice = dto.variantPrice;
  else if (dto.variant_price !== undefined) data.variantPrice = dto.variant_price;

  if (dto.productId !== undefined) data.productId = dto.productId;
  else if (dto.product_id !== undefined) data.productId = dto.product_id;
  else if (dto.wixProductId !== undefined) data.productId = dto.wixProductId;
  else if (dto.wix_product_id !== undefined) data.productId = dto.wix_product_id;

  if (dto.newVariantPrice !== undefined) data.newVariantPrice = dto.newVariantPrice;
  else if (dto.new_variant_price !== undefined) data.newVariantPrice = dto.new_variant_price;

  if (dto.mrp !== undefined) data.mrp = parseFloat(dto.mrp) || 0;

  if (dto.onsalePrice !== undefined) data.onsalePrice = parseFloat(dto.onsalePrice) || 0;
  else if (dto.onsale_price !== undefined) data.onsalePrice = parseFloat(dto.onsale_price) || 0;

  if (dto.cod !== undefined) data.cod = parseFloat(dto.cod) || 0;
  if (dto.upi !== undefined) data.upi = parseFloat(dto.upi) || 0;
  if (dto.price !== undefined) data.price = parseFloat(dto.price) || 0;
  if (dto.discount !== undefined) data.discount = dto.discount;
  if (dto.status !== undefined) data.status = dto.status;

  if (dto.deliveryCharges !== undefined) data.deliveryCharges = dto.deliveryCharges === true || dto.deliveryCharges === 'true';
  else if (dto.delivery_charges !== undefined) data.deliveryCharges = dto.delivery_charges === true || dto.delivery_charges === 'true';

  if (dto.mainCategory !== undefined) data.mainCategory = dto.mainCategory;
  else if (dto.main_category !== undefined) data.mainCategory = dto.main_category;

  if (dto.shippingWeight !== undefined) data.shippingWeight = parseFloat(dto.shippingWeight) || 0;
  else if (dto.shipping_weight !== undefined) data.shippingWeight = parseFloat(dto.shipping_weight) || 0;

  if (dto.collections !== undefined) data.collections = dto.collections;

  if (dto.sellerPincode !== undefined) data.sellerPincode = dto.sellerPincode;
  else if (dto.seller_pincode !== undefined) data.sellerPincode = dto.seller_pincode;

  if (dto.owner !== undefined) data.owner = dto.owner;

  if (dto.productOptions !== undefined) data.productOptions = sanitizeProductOptions(dto.productOptions);
  else if (dto.product_options !== undefined) data.productOptions = sanitizeProductOptions(dto.product_options);

  if (dto.additionalInfoSections !== undefined) data.additionalInfoSections = dto.additionalInfoSections;
  else if (dto.additional_info_sections !== undefined) data.additionalInfoSections = dto.additional_info_sections;

  if (dto.activeAd !== undefined) data.activeAd = dto.activeAd === true || dto.activeAd === 'true';
  else if (dto.active_ad !== undefined) data.activeAd = dto.active_ad === true || dto.active_ad === 'true';

  if (dto.averageCpc !== undefined) data.averageCpc = parseFloat(dto.averageCpc) || 0;
  else if (dto.average_cpc !== undefined) data.averageCpc = parseFloat(dto.average_cpc) || 0;

  if (dto.priorityScore !== undefined) data.priorityScore = parseInt(dto.priorityScore, 10) || 0;
  else if (dto.priority_score !== undefined) data.priorityScore = parseInt(dto.priority_score, 10) || 0;

  if (dto.campaignId !== undefined) data.campaignId = dto.campaignId;
  else if (dto.campaign_id !== undefined) data.campaignId = dto.campaign_id;

  if (dto.reach !== undefined) data.reach = parseInt(dto.reach, 10) || 0;
  if (dto.impression !== undefined) data.impression = parseInt(dto.impression, 10) || 0;
  if (dto.clicks !== undefined) data.clicks = parseInt(dto.clicks, 10) || 0;
  if (dto.sales !== undefined) data.sales = parseInt(dto.sales, 10) || 0;
  if (dto.revenue !== undefined) data.revenue = parseFloat(dto.revenue) || 0;

  if (dto.categoryName !== undefined) data.categoryName = Array.isArray(dto.categoryName) ? dto.categoryName : [dto.categoryName];
  else if (dto.category_name !== undefined) data.categoryName = Array.isArray(dto.category_name) ? dto.category_name : [dto.category_name];

  if (dto.sku !== undefined) data.sku = dto.sku;

  if (dto.productType !== undefined) data.productType = dto.productType;
  else if (dto.product_type !== undefined) data.productType = dto.product_type;

  if (dto.manageVariants !== undefined) data.manageVariants = dto.manageVariants === true || dto.manageVariants === 'true';
  else if (dto.manage_variants !== undefined) data.manageVariants = dto.manage_variants === true || dto.manage_variants === 'true';

  if (dto.ribbon !== undefined) data.ribbon = dto.ribbon;

  if (dto.trackInventory !== undefined) data.trackInventory = dto.trackInventory === true || dto.trackInventory === 'true';
  else if (dto.track_inventory !== undefined) data.trackInventory = dto.track_inventory === true || dto.track_inventory === 'true';

  if (dto.influencerBranding !== undefined) data.influencerBranding = dto.influencerBranding === true || dto.influencerBranding === 'true';
  else if (dto.influencer_branding !== undefined) data.influencerBranding = dto.influencer_branding === true || dto.influencer_branding === 'true';

  if (dto.haatzaVerified !== undefined) data.haatzaVerified = dto.haatzaVerified === true || dto.haatzaVerified === 'true';
  else if (dto.haatza_verified !== undefined) data.haatzaVerified = dto.haatza_verified === true || dto.haatza_verified === 'true';

  if (dto.promotionPhotos !== undefined) data.promotionPhotos = dto.promotionPhotos;
  else if (dto.promotion_photos !== undefined) data.promotionPhotos = dto.promotion_photos;

  if (dto.paymentType !== undefined) data.paymentType = dto.paymentType;
  else if (dto.payment_type !== undefined) data.paymentType = dto.payment_type;

  if (dto.productReturn !== undefined) data.productReturn = dto.productReturn;
  else if (dto.product_return !== undefined) data.productReturn = dto.product_return;

  if (dto.sizeChart !== undefined) data.sizeChart = dto.sizeChart;
  else if (dto.size_chart !== undefined) data.sizeChart = dto.size_chart;

  if (dto.description !== undefined) data.description = dto.description;

  if (dto.gstSeller !== undefined) data.gstSeller = parseFloat(dto.gstSeller) || 0;
  else if (dto.gst_seller !== undefined) data.gstSeller = parseFloat(dto.gst_seller) || 0;

  if (dto.upiPaymentDiscount !== undefined) data.upiPaymentDiscount = parseFloat(dto.upiPaymentDiscount) || 0;
  else if (dto.upi_payment_discount !== undefined) data.upiPaymentDiscount = parseFloat(dto.upi_payment_discount) || 0;

  if (dto.manageListingProducts !== undefined) data.manageListingProducts = dto.manageListingProducts;
  else if (dto.manage_listing_products !== undefined) data.manageListingProducts = dto.manage_listing_products;

  if (dto.sellAndEarnCommission !== undefined) data.sellAndEarnCommission = parseFloat(dto.sellAndEarnCommission) || 0;
  else if (dto.sell_and_earn_commission !== undefined) data.sellAndEarnCommission = parseFloat(dto.sell_and_earn_commission) || 0;

  if (dto.sellAndEarn !== undefined) data.sellAndEarn = dto.sellAndEarn;
  else if (dto.sell_and_earn !== undefined) data.sellAndEarn = dto.sell_and_earn;

  return data;
}

export function mapProductToCard(p: any): any {
  if (!p) return null;
  const pid = p.id || p.productId || '';

  let image = p.mainMedia || '';
  if (!image && Array.isArray(p.productImages) && p.productImages.length > 0) {
    const firstMedia: any = p.productImages[0];
    image = typeof firstMedia === 'string' ? firstMedia : firstMedia?.src || '';
  }

  const codVal = p.cod !== undefined && p.cod !== null ? Number(p.cod) : Number(p.price || p.mrp || 0);
  const upiVal = p.upi !== undefined && p.upi !== null ? Number(p.upi) : Number(p.price || p.mrp || 0);

  const brand = (p.brand === 'Generic' || !p.brand) ? '' : String(p.brand).trim();
  const productOptions = p.productOptions && typeof p.productOptions === 'object' ? p.productOptions : {};

  return {
    brand,
    name: p.name || '',
    productId: pid,
    productOptions,
    image: image || '',
    activeAd: p.activeAd === true || p.activeAd === 'true',
    averageRating: typeof p.averageRating === 'number' ? p.averageRating : 0,
    isWishlist: false,
    wishlistTableId: '',
    sellerId: p.sellerId || '',
    campaignId: p.campaignId || '',
    deliveryCharges: p.deliveryCharges === true || p.deliveryCharges === 'true',
    mainCategoryId: p.mainCategory || '',
    subCategoryId: p.subCategoryId || p.subCategory || '',
    finalPricing: {
      codFinal: isNaN(codVal) ? 0 : codVal,
      upiFinal: isNaN(upiVal) ? 0 : upiVal,
    },
  };
}

function mapPrismaToRestOutput(p: any): any {
  if (!p) return p;
  return {
    id: p.id,
    productId: p.productId || p.id,
    mainMedia: p.mainMedia,
    productImages: p.productImages,
    name: p.name,
    searchKeywords: p.searchKeywords,
    categoryId: p.categoryId || (Array.isArray(p.collections) && p.collections.length > 0 ? p.collections[0] : (typeof p.collections === 'string' ? p.collections : null)),
    subCategory: p.subCategory,
    subCategoryId: p.subCategoryId,
    brand: p.brand,
    inventory: p.inventory,
    variantPrice: p.variantPrice,
    newVariantPrice: p.newVariantPrice,
    mrp: p.mrp,
    onsalePrice: p.onsalePrice,
    cod: p.cod,
    upi: p.upi,
    price: p.price,
    discount: p.discount,
    status: p.status,
    deliveryCharges: p.deliveryCharges,
    mainCategory: p.mainCategory,
    sellerId: p.sellerId,
    shippingWeight: p.shippingWeight,
    collections: p.collections,
    sellerPincode: p.sellerPincode,
    createdDate: p.createdDate,
    updatedDate: p.updatedDate,
    createdAt: p.createdDate,
    updatedAt: p.updatedDate,
    owner: p.owner,
    productOptions: p.productOptions,
    additionalInfoSections: p.additionalInfoSections,
    activeAd: p.activeAd,
    averageCpc: p.averageCpc,
    priorityScore: p.priorityScore,
    campaignId: p.campaignId,
    reach: p.reach,
    impression: p.impression,
    clicks: p.clicks,
    sales: p.sales,
    revenue: p.revenue,
    categoryName: p.categoryName,
    sku: p.sku,
    productType: p.productType,
    manageVariants: p.manageVariants,
    ribbon: p.ribbon,
    trackInventory: p.trackInventory,
    influencerBranding: p.influencerBranding,
    haatzaVerified: p.haatzaVerified,
    promotionPhotos: p.promotionPhotos,
    paymentType: p.paymentType,
    productReturn: p.productReturn,
    sizeChart: p.sizeChart,
    description: p.description,
    gstSeller: p.gstSeller,
    upiPaymentDiscount: p.upiPaymentDiscount,
    manageListingProducts: p.manageListingProducts,
    sellAndEarnCommission: p.sellAndEarnCommission,
    sellAndEarn: p.sellAndEarn,
  };
}

function mapPrismaToWixSellerListing(p: any) {
  const productImagesArray = Array.isArray(p.productImages)
    ? (p.productImages as any[]).map((img) => {
      if (typeof img === 'string') {
        return { description: '', id: '', src: img, type: 'image' };
      }
      return {
        description: img?.description || '',
        id: img?.slug || img?.id || '',
        src: img?.src || '',
        type: img?.type || 'image',
      };
    })
    : [];

  const categoryId = p.categoryId || (Array.isArray(p.collections) && p.collections.length > 0
    ? p.collections[0]
    : (typeof p.collections === 'string' ? p.collections : ''));

  const categoryName = Array.isArray(p.categoryName) && p.categoryName.length > 0
    ? p.categoryName[0]
    : (typeof p.categoryName === 'string' ? p.categoryName : '');

  const searchKeywordsStr = Array.isArray(p.searchKeywords)
    ? p.searchKeywords.join(', ')
    : (typeof p.searchKeywords === 'string' ? p.searchKeywords : '');

  const isSellAndEarn = p.sellAndEarn === true || p.sellAndEarn === 'true' || p.sellAndEarn === 'TRUE';

  return {
    id: p.id,
    productId: p.productId || p.id || '',
    mainMedia: p.mainMedia || '',
    productImages: productImagesArray,
    name: p.name || '',
    description: p.description || '',
    brand: p.brand || '',
    shippingWeight: p.shippingWeight || 0,
    price: p.price || 0,
    discount: p.discount && typeof p.discount === 'object' && Object.keys(p.discount).length > 0 ? p.discount : {},
    ribbon: p.ribbon || '',
    productOptions: p.productOptions && typeof p.productOptions === 'object' && Object.keys(p.productOptions).length > 0 ? p.productOptions : {},
    additionalInfoSections: Array.isArray(p.additionalInfoSections) ? p.additionalInfoSections : [],
    sellerId: p.sellerId || '',
    variantPrice: p.variantPrice && typeof p.variantPrice === 'object' && Object.keys(p.variantPrice).length > 0 ? p.variantPrice : {},
    status: p.status || '',
    manageVariants: p.manageVariants || false,
    trackInventory: p.trackInventory || false,
    categoryName,
    categoryId,
    inventory: p.inventory || 0,
    sku: p.sku || '',
    mainCategory: p.mainCategory || '',
    subCategory: p.subCategory || '',
    subCategoryId: p.subCategoryId || '',
    promotionPhotos: Array.isArray(p.promotionPhotos) ? p.promotionPhotos : [],
    haatzaVerified: p.haatzaVerified || false,
    paymentType: p.paymentType || '',
    productReturn: p.productReturn || '',
    deliveryCharges: p.deliveryCharges || false,
    sizeChart: p.sizeChart || '',
    searchKeywords: searchKeywordsStr,
    sellAndEarnCommission: p.sellAndEarnCommission || 0,
    sellAndEarn: isSellAndEarn,
    collections: p.collections || [],
    productType: p.productType || 'physical',
    sellerPincode: p.sellerPincode || '',
    createdDate: p.createdDate,
    updatedDate: p.updatedDate,
    createdAt: p.createdDate,
    updatedAt: p.updatedDate,
  };
}
