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

    // Find all categories specific to LITE module
    const liteCats = await this.db.categoryList.findMany({
      where: { module: CategoryModule.LITE },
      select: { categoryId: true, categoryName: true, id: true },
    });
    const liteCatIds = liteCats.flatMap((c) => [c.categoryId, c.id].filter(Boolean));
    const liteCatNames = liteCats.map((c) => c.categoryName).filter(Boolean);

    if (moduleEnum === CategoryModule.LITE) {
      if (liteCatIds.length > 0 || liteCatNames.length > 0) {
        where.AND = [
          ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
          {
            OR: [
              { categoryId: { in: liteCatIds } },
              { subCategoryId: { in: liteCatIds } },
              { collections: { hasSome: liteCatIds } },
              { subCategory: { in: liteCatNames } },
            ],
          },
        ];
      }
    } else {
      // HAATZA module: general marketplace products; exclude strictly LITE-only categories if any exist
      if (liteCatIds.length > 0 || liteCatNames.length > 0) {
        where.AND = [
          ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
          {
            NOT: {
              OR: [
                { categoryId: { in: liteCatIds } },
                { subCategoryId: { in: liteCatIds } },
                { collections: { hasSome: liteCatIds } },
                { subCategory: { in: liteCatNames } },
              ],
            },
          },
        ];
      }
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
  private readonly productDetailsCache = new Map<string, { data: any; expiresAt: number }>();

  private getCache<T>(key: string): T | null {
    const entry = this.productDetailsCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.productDetailsCache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T, ttlMs = 300_000): void {
    if (this.productDetailsCache.size > 1000) {
      const firstKey = this.productDetailsCache.keys().next().value;
      if (firstKey) this.productDetailsCache.delete(firstKey);
    }
    this.productDetailsCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  /**
   * GET /api/v1/productDetails
   * Wix-compatible full product details by productId and toPincode in query params.
   * Replicates Wix flow: Cache check -> Product lookup -> Parallel resolution of
   * variants, inventory, seller details, delivery fees, and reviews in camelCase.
   */
  async getProductDetails(query: { productId?: string; toPincode?: string; userId?: string }) {
    const productId = query.productId?.trim();
    const toPincode = query.toPincode?.trim();
    const userId = query.userId?.trim();

    if (!productId) {
      throw new NotFoundException({ error: 'Product ID is required' });
    }
    if (!toPincode) {
      throw new BadRequestException({ error: 'toPincode is required' });
    }

    const responseCacheKey = `product_response_${productId}_${toPincode}`;
    const cachedResponse = this.getCache<any>(responseCacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    /* ---------------- PRODUCT CACHE & LOOKUP ---------------- */
    let product = this.getCache<any>(`product_${productId}`);
    if (!product) {
      product = await this.db.product.findFirst({
        where: {
          OR: [
            { id: productId },
            { productId: productId },
          ],
        },
      });

      if (!product) {
        throw new NotFoundException({ error: 'Product not found' });
      }

      this.setCache(`product_${productId}`, product, 300_000);
    }

    /* ---------------- SELLER DETAILS LOOKUP ---------------- */
    let sellerDetails: any = null;
    const sellerIdForQuery = product.sellerId || null;

    if (sellerIdForQuery) {
      try {
        const [sellerUser, sellerProductsCount] = await Promise.all([
          this.db.user.findFirst({
            where: {
              OR: [
                { sellerId: sellerIdForQuery },
                { id: sellerIdForQuery },
              ],
            },
            select: {
              name: true,
              companyName: true,
            },
          }),
          this.db.product.count({
            where: { sellerId: sellerIdForQuery },
          }),
        ]);

        if (sellerUser || sellerProductsCount > 0) {
          sellerDetails = {
            sellerName: sellerUser?.companyName || sellerUser?.name || sellerIdForQuery,
            totalRating: 0,
            sellerAverageRating: 0,
            followers: 0,
            products: sellerProductsCount || 0,
            badge: false,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Failed to fetch seller details for ${sellerIdForQuery}: ${err.message}`);
      }
    }

    /* ---------------- BASE MEDIA & MEDIA ITEMS ---------------- */
    const mainMediaSrc = convertWixMedia(product.mainMedia, 'Image')?.src || null;
    const rawMediaList = Array.isArray(product.productImages) ? (product.productImages as any[]) : [];
    let mediaItems = rawMediaList
      .map((item: any) => {
        if (typeof item === 'string') {
          const m = convertWixMedia(item, 'Image');
          return {
            src: m?.src || null,
            type: 'Image',
          };
        }
        const itemType = item?.type?.toString().toLowerCase() === 'video' ? 'Video' : 'Image';
        const m = convertWixMedia(item?.src || item?.url, itemType);
        return {
          src: m?.src || null,
          type: itemType,
          ...(itemType === 'Video' && m?.poster ? { poster: m.poster } : {}),
        };
      })
      .filter((item: any) => item.src !== null);

    if (mediaItems.length === 0 && mainMediaSrc) {
      mediaItems = [{ src: mainMediaSrc, type: 'Image' }];
    }

    /* ---------------- PRODUCT OPTIONS ---------------- */
    const formattedProductOptions: Record<string, any> = {};
    if (product.productOptions && typeof product.productOptions === 'object') {
      for (const key of Object.keys(product.productOptions as Record<string, any>)) {
        const option = (product.productOptions as Record<string, any>)[key];
        if (option && typeof option === 'object') {
          const choices = Array.isArray(option.choices) ? option.choices : [];
          formattedProductOptions[key] = {
            ...option,
            choices: choices.map((choice: any) => {
              if (typeof choice === 'string') {
                return {
                  value: choice,
                  description: choice,
                  inStock: true,
                  visible: true,
                  mainMedia: null,
                  orderImage: null,
                  mediaItems: [],
                };
              }
              const choiceMainMedia = convertWixMedia(choice?.mainMedia, 'Image');
              const choiceMediaItems = (Array.isArray(choice?.mediaItems) ? choice.mediaItems : []).map((item: any) => {
                const itemType = item?.type?.toString().toLowerCase() === 'video' ? 'Video' : 'Image';
                const m = convertWixMedia(item?.src || item, itemType);
                return {
                  src: m?.src || null,
                  type: itemType,
                  ...(itemType === 'Video' && m?.poster ? { poster: m.poster } : {}),
                };
              });

              return {
                ...choice,
                mainMedia: choiceMainMedia?.src || null,
                orderImage: choice?.mainMedia || null,
                mediaItems: choiceMediaItems,
              };
            }),
          };
        }
      }
    }

    /* ---------------- PRICING & DISCOUNTS ---------------- */
    const mrp = Number(product.mrp || 0);
    const onsalePrice = Number(product.onsalePrice || product.price || 0);
    const codFinal = Number(product.cod || product.onsalePrice || product.price || 0);
    const upiFinal = Number(product.upi || product.cod || product.onsalePrice || product.price || 0);
    const upiPaymentDiscount = Math.max(codFinal - upiFinal, 0);

    /* ---------------- DELIVERY CHARGES ---------------- */
    const deliveryCharges = product.deliveryCharges === true;
    const shippingWeight = Number(product.shippingWeight || 0);
    const sellerPinCode = product.sellerPincode || '';

    let deliveryFee = 0;
    let prepaid = 0;
    let cod = 0;

    if (deliveryCharges && sellerPinCode && shippingWeight > 0) {
      try {
        const deliveryObj = computeDeliveryCharges(
          sellerPinCode,
          toPincode,
          shippingWeight,
          onsalePrice,
        );
        prepaid = Number(deliveryObj?.prepaid || 0);
        cod = Number(deliveryObj?.cod || 0);
        deliveryFee = cod;
      } catch (err: any) {
        prepaid = 0;
        cod = 0;
        deliveryFee = 0;
      }
    }

    const finalPrice = codFinal + deliveryFee;

    /* ---------------- VARIANTS ---------------- */
    const rawVariants = Array.isArray(product.newVariantPrice)
      ? (product.newVariantPrice as any[])
      : (product.newVariantPrice && typeof product.newVariantPrice === 'object'
        ? Object.values(product.newVariantPrice as Record<string, any>)
        : []);

    const variants = rawVariants.map((v: any, idx: number) => {
      const variant = { ...(v.variant || v) };
      const vOnsalePrice = Number(variant.onsalePrice || variant.price || onsalePrice || 0);
      const vDeliveryFee = deliveryCharges ? Number(cod || 0) : 0;
      const vFinalPrice = vOnsalePrice + vDeliveryFee;

      const mrpPrice = formatCurrencyString(variant.mrpPrice, variant.MRP || mrp);
      const discountedPrice = formatCurrencyString(variant.discountedPrice, vOnsalePrice);

      const formattedVariant = {
        mrpPrice,
        discountedPrice,
        visible: variant.visible !== false,
        onsalePrice: vOnsalePrice,
        deliveryFee: vDeliveryFee,
        finalPrice: vFinalPrice,
      };

      return {
        variantId: v.variantId || v.id || `v${idx + 1}`,
        choices: v.choices || {},
        variant: formattedVariant,
      };
    });

    /* ---------------- INVENTORY ---------------- */
    let inventory: any[] = [];
    let trackQuantity = product.trackInventory ?? false;

    if (rawVariants.length > 0) {
      inventory = rawVariants.map((v: any, idx: number) => {
        const vInv = v.variant?.inventory !== undefined ? Number(v.variant.inventory) : (product.inventory || 0);
        return {
          variantId: v.variantId || v.id || `v${idx + 1}`,
          inStock: vInv > 0,
          quantity: vInv,
          availableForPreorder: false,
        };
      });
      trackQuantity = inventory.some((v: any) => v.quantity > 0);
    } else {
      const qty = Number(product.inventory || 0);
      inventory = [
        {
          variantId: product.id,
          inStock: qty > 0,
          quantity: qty,
          availableForPreorder: false,
        },
      ];
      trackQuantity = qty > 0;
    }

    /* ---------------- SPECIFICATIONS & ADDITIONAL INFO ---------------- */
    let specification: Array<{ title: string; description: string }> = [];
    let additionalInfoSections: Array<{ title: string; description: string }> = [];

    if (Array.isArray(product.additionalInfoSections)) {
      const parsedSections = product.additionalInfoSections
        .map((section: any) => {
          if (section && typeof section === 'object') {
            if (section.title !== undefined) {
              return {
                title: String(section.title || '').trim(),
                description: cleanHtmlText(section.description || ''),
              };
            }
            const key = Object.keys(section)[0] || '';
            return {
              title: key.trim(),
              description: cleanHtmlText(section[key]?.toString() || ''),
            };
          }
          return { title: '', description: '' };
        })
        .filter((s: any) => s.title !== '');

      specification = parsedSections;
      additionalInfoSections = parsedSections;
    }

    const sizeChart = product.sizeChart ? (convertWixMedia(product.sizeChart, 'Image')?.src || '') : '';
    const webUrl = product.sku || (product.name ? product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : product.id);

    if (!sellerDetails) {
      sellerDetails = {
        sellerName: sellerIdForQuery || '',
        totalRating: 0,
        sellerAverageRating: 0,
        followers: 0,
        products: 0,
        badge: false,
      };
    }

    /* ---------------- CONSTRUCT RESPONSE (STRICT SCHEMA) ---------------- */
    const response = {
      // Basic product info
      productId: product.id,
      name: product.name || '',
      description: product.description ? cleanHtmlText(product.description) : '',
      mainMedia: mainMediaSrc,
      orderImage: product.mainMedia || null,
      brand: product.brand === 'Generic' ? '' : (product.brand || ''),
      mediaItems,

      // Category / seller flags
      subCategory: product.subCategoryId || product.subCategory || '',
      sellerId: product.sellerId || '',
      haatzaVerified: product.haatzaVerified ?? false,
      activeAd: product.activeAd ?? false,

      // Product options (variants selector, e.g. size/color)
      productOptions: formattedProductOptions,

      webUrl,

      // Cart / wishlist status (only meaningful if userId passed)
      cartAdded: false,
      wishlistAdded: false,
      wishlistId: '',

      // Variants (from Import517.newVarientPrice)
      variants,

      // Inventory
      inventory,
      trackQuantity,

      // Shipping / seller pin
      shippingWeight,
      sellerPinCode,

      // Import517 fields (only present if importResult found)
      campaignId: product.campaignId || '',
      paymentType: product.paymentType || 'Any',
      productReturn: product.productReturn || '7 Days Easy Returns',
      collections: Array.isArray(product.collections) ? product.collections : [],
      deliveryCharges,
      sellAndEarn: product.sellAndEarn === 'TRUE' || product.sellAndEarn === 'true' || product.sellAndEarn === true,
      sellAndEarnCommission: product.sellAndEarnCommission ?? 0,
      sizeChart,
      specification,

      // Pricing (only present if importResult found)
      mrp,
      onsalePrice,
      codFinal,
      upiFinal,
      upiPaymentDiscount,

      // Delivery charge calc (only present if importResult found)
      prepaid,
      cod,
      deliveryFee,
      finalPrice,

      // Extra info sections (only if productDetails.additionalInfoSections exists)
      additionalInfoSections,

      // Seller details (only if sellerIdForQuery found a match)
      sellerDetails,

      // Reviews
      averageRating: 0,
      totalReviews: 0,
      reviews: [],
    };

    this.setCache(responseCacheKey, response, 300_000);
    return response;
  }

  /**
   * GET /api/v1/similarProducts
   * 
   * E-Commerce Multi-Tier Recommendation Engine (Amazon / Flipkart Model):
   * 1. Excludes current product (id != productId).
   * 2. Tier 1: Exact Subcategory Alternatives (subCategoryId / subCategory).
   * 3. Tier 2: Sibling Subcategories under the same parent / mainCategory.
   * 4. Tier 3: Same Brand Alternatives.
   * 5. Tier 4: Trending / Popular in catalog (priorityScore desc).
   * Formatted using standard card schema (mapProductToCard).
   */
  async getSimilarProducts(params: {
    productId?: string;
    limit?: string | number;
    page?: string | number;
    module?: string;
    userId?: string;
  }) {
    const rawProductId = params.productId?.trim();
    if (!rawProductId) {
      throw new BadRequestException('productId is required');
    }

    const rawModule = (params.module || 'haatza').toString().trim();
    const normalizedModule = rawModule.toLowerCase();
    if (normalizedModule !== 'haatza' && normalizedModule !== 'lite') {
      throw new BadRequestException("Invalid module. Allowed values are 'haatza', 'lite', 'HAATZA', and 'LITE'");
    }
    const moduleEnum = normalizedModule === 'lite' ? CategoryModule.LITE : CategoryModule.HAATZA;

    const page = Math.max(1, parseInt(String(params.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(params.limit || '10'), 10) || 10));

    // 1. Fetch source product
    const sourceProduct = await this.db.product.findFirst({
      where: {
        OR: [
          { id: rawProductId },
          { productId: rawProductId },
        ],
      },
      select: {
        id: true,
        productId: true,
        name: true,
        brand: true,
        price: true,
        onsalePrice: true,
        mrp: true,
        subCategory: true,
        subCategoryId: true,
        mainCategory: true,
        categoryId: true,
        collections: true,
        status: true,
      },
    });

    if (!sourceProduct) {
      throw new NotFoundException({ error: 'Product not found' });
    }

    // 2. Module category filtering
    const liteCats = await this.db.categoryList.findMany({
      where: { module: CategoryModule.LITE },
      select: { categoryId: true, categoryName: true, id: true },
    });
    const liteCatIds = liteCats.flatMap((c) => [c.categoryId, c.id].filter(Boolean));
    const liteCatNames = liteCats.map((c) => c.categoryName).filter(Boolean);

    const moduleFilter: Prisma.ProductWhereInput | undefined =
      moduleEnum === CategoryModule.LITE
        ? (liteCatIds.length > 0 || liteCatNames.length > 0
            ? {
                OR: [
                  { categoryId: { in: liteCatIds } },
                  { subCategoryId: { in: liteCatIds } },
                  { collections: { hasSome: liteCatIds } },
                  { subCategory: { in: liteCatNames } },
                ],
              }
            : undefined)
        : (liteCatIds.length > 0 || liteCatNames.length > 0
            ? {
                NOT: {
                  OR: [
                    { categoryId: { in: liteCatIds } },
                    { subCategoryId: { in: liteCatIds } },
                    { collections: { hasSome: liteCatIds } },
                    { subCategory: { in: liteCatNames } },
                  ],
                },
              }
            : undefined);

    // 3. Track excluded IDs (ensure source product is strictly omitted)
    const excludeIds = new Set<string>([sourceProduct.id]);
    if (sourceProduct.productId) {
      excludeIds.add(sourceProduct.productId);
    }
    const excludeIdsList = Array.from(excludeIds);
    const notExcludedFilter: Prisma.ProductWhereInput = {
      AND: [
        { id: { notIn: excludeIdsList } },
        {
          OR: [
            { productId: null },
            { productId: { notIn: excludeIdsList } },
          ],
        },
      ],
    };

    const targetSubCategoryId = sourceProduct.subCategoryId?.trim() || '';
    const targetSubCategoryName = sourceProduct.subCategory?.trim() || '';
    const parentCategoryId = (sourceProduct.mainCategory || sourceProduct.categoryId)?.trim() || '';
    const sourceBrand = sourceProduct.brand?.trim() || '';
    const sourcePrice = Number(sourceProduct.onsalePrice || sourceProduct.price || 0);

    const neededTotal = page * limit;
    const collectedProducts: any[] = [];

    // Ultra-lean column selection for similar product cards
    const SIMILAR_PRODUCT_SELECT: Prisma.ProductSelect = {
      id: true,
      productId: true,
      name: true,
      brand: true,
      mainMedia: true,
      productImages: true,
      price: true,
      onsalePrice: true,
      mrp: true,
      cod: true,
      upi: true,
      inventory: true,
      status: true,
      activeAd: true,
      priorityScore: true,
      createdDate: true,
    };

    // Helper to add products without duplicates
    const addUniqueProducts = (products: any[]) => {
      for (const p of products) {
        const pKey = p.id || p.productId;
        if (pKey && !excludeIds.has(pKey)) {
          excludeIds.add(pKey);
          if (p.id) excludeIds.add(p.id);
          if (p.productId) excludeIds.add(p.productId);
          collectedProducts.push(p);
        }
      }
    };

    // Tier 1: Exact Subcategory Alternatives
    if (targetSubCategoryId || targetSubCategoryName) {
      const subCatConditions: Prisma.ProductWhereInput[] = [];
      if (targetSubCategoryId) {
        subCatConditions.push({ subCategoryId: targetSubCategoryId });
        subCatConditions.push({ collections: { hasSome: [targetSubCategoryId] } });
      }
      if (targetSubCategoryName) {
        subCatConditions.push({ subCategory: { equals: targetSubCategoryName, mode: 'insensitive' } });
      }

      const tier1Products = await this.db.product.findMany({
        where: {
          AND: [
            notExcludedFilter,
            { OR: subCatConditions },
            ...(moduleFilter ? [moduleFilter] : []),
          ],
        },
        select: SIMILAR_PRODUCT_SELECT,
        orderBy: [{ priorityScore: 'desc' }, { createdDate: 'desc' }],
        take: neededTotal,
      });

      addUniqueProducts(tier1Products);
    }

    // Tier 2: Sibling Subcategories under same Parent / Main Category
    if (collectedProducts.length < neededTotal && parentCategoryId) {
      const remainingCount = neededTotal - collectedProducts.length;
      const tier2Products = await this.db.product.findMany({
        where: {
          AND: [
            notExcludedFilter,
            {
              OR: [
                { mainCategory: parentCategoryId },
                { categoryId: parentCategoryId },
                { collections: { hasSome: [parentCategoryId] } },
              ],
            },
            ...(moduleFilter ? [moduleFilter] : []),
          ],
        },
        select: SIMILAR_PRODUCT_SELECT,
        orderBy: [{ priorityScore: 'desc' }, { createdDate: 'desc' }],
        take: remainingCount,
      });

      addUniqueProducts(tier2Products);
    }

    // Tier 3: Same Brand Alternatives (if brand is meaningful and not Generic)
    if (collectedProducts.length < neededTotal && sourceBrand && sourceBrand.toLowerCase() !== 'generic') {
      const remainingCount = neededTotal - collectedProducts.length;
      const tier3Products = await this.db.product.findMany({
        where: {
          AND: [
            notExcludedFilter,
            { brand: { equals: sourceBrand, mode: 'insensitive' } },
            ...(moduleFilter ? [moduleFilter] : []),
          ],
        },
        select: SIMILAR_PRODUCT_SELECT,
        orderBy: [{ priorityScore: 'desc' }, { createdDate: 'desc' }],
        take: remainingCount,
      });

      addUniqueProducts(tier3Products);
    }

    // Tier 4: Global Trending / Popular items
    if (collectedProducts.length < neededTotal) {
      const remainingCount = neededTotal - collectedProducts.length;
      const tier4Products = await this.db.product.findMany({
        where: {
          AND: [
            notExcludedFilter,
            ...(moduleFilter ? [moduleFilter] : []),
          ],
        },
        select: SIMILAR_PRODUCT_SELECT,
        orderBy: [{ priorityScore: 'desc' }, { createdDate: 'desc' }],
        take: remainingCount,
      });

      addUniqueProducts(tier4Products);
    }

    // Separate sponsored (Ads) and organic items for e-commerce interleaving
    const ads: any[] = [];
    const organic: any[] = [];
    for (const p of collectedProducts) {
      if (p.activeAd === true) {
        ads.push(p);
      } else {
        organic.push(p);
      }
    }

    // Helper: Interleave sponsored and organic products
    let finalOrdered: any[] = [];
    if (ads.length > 0) {
      let adIdx = 0;
      let orgIdx = 0;
      while (adIdx < ads.length || orgIdx < organic.length) {
        for (let i = 0; i < 2 && adIdx < ads.length; i++) finalOrdered.push(ads[adIdx++]);
        for (let i = 0; i < 4 && orgIdx < organic.length; i++) finalOrdered.push(organic[orgIdx++]);
      }
    } else {
      finalOrdered = organic;
    }

    // Strict deduplication of finalOrdered list (guarantee zero duplicate products)
    const seenFinalIds = new Set<string>();
    const deduplicatedFinal: any[] = [];
    for (const p of finalOrdered) {
      const pKey = p.id || p.productId;
      if (pKey && !seenFinalIds.has(pKey)) {
        seenFinalIds.add(pKey);
        if (p.id) seenFinalIds.add(p.id);
        if (p.productId) seenFinalIds.add(p.productId);
        deduplicatedFinal.push(p);
      }
    }

    // Slice requested page window
    const startIndex = (page - 1) * limit;
    const pagedProducts = deduplicatedFinal.slice(startIndex, startIndex + limit);
    const mappedCards = pagedProducts.map(mapToSimilarProductCard);

    const totalItems = deduplicatedFinal.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    const resultData = {
      totalItems,
      totalPages,
      currentPage: page,
      limit,
      products: mappedCards,
    };

    return {
      status: 'success',
      data: resultData,
      message: resultData,
    };
  }

  /**
   * GET /api/v1/sellerProductDetails
   * Wix-compatible get product details by ID
   */
  async getSellerProductDetails(tableId: string, module?: string) {
    if (!tableId) {
      throw new BadRequestException('tableId is required');
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
    if (body.manageVariants !== undefined) updateData.manageVariants = body.manageVariants === true || body.manageVariants === 'true';
    if (body.ribbon !== undefined) updateData.ribbon = body.ribbon;
    if (body.additionalInfoSections !== undefined) updateData.additionalInfoSections = body.additionalInfoSections;
    if (body.paymentType !== undefined) updateData.paymentType = body.paymentType;
    if (body.productReturn !== undefined) updateData.productReturn = body.productReturn;
    if (body.deliveryCharges !== undefined) updateData.deliveryCharges = body.deliveryCharges === true || body.deliveryCharges === 'true';
    if (body.sizeChart !== undefined) updateData.sizeChart = body.sizeChart;
    if (body.cod !== undefined) updateData.cod = parseFloat(body.cod) || 0;
    if (body.upi !== undefined) updateData.upi = parseFloat(body.upi) || 0;
    if (body.gstSeller !== undefined) updateData.gstSeller = parseFloat(body.gstSeller) || 0;
    if (body.upiPaymentDiscount !== undefined) updateData.upiPaymentDiscount = parseFloat(body.upiPaymentDiscount) || 0;

    // Route price updates to pending review fields (newMrp, newDiscount, newOnsale, newVariantPrice)
    let isPriceUpdate = false;
    if (body.newMrp !== undefined || body.new_mrp !== undefined) {
      updateData.newMrp = parseFloat(body.newMrp ?? body.new_mrp) || 0;
      isPriceUpdate = true;
    } else if (body.mrp !== undefined) {
      updateData.newMrp = parseFloat(body.mrp) || 0;
      isPriceUpdate = true;
    }

    if (body.newDiscount !== undefined || body.new_discount !== undefined) {
      updateData.newDiscount = body.newDiscount ?? body.new_discount;
      isPriceUpdate = true;
    } else if (body.discount !== undefined) {
      updateData.newDiscount = body.discount;
      isPriceUpdate = true;
    }

    if (body.newOnsale !== undefined || body.new_onsale !== undefined || body.new_onsale_price !== undefined) {
      updateData.newOnsale = parseFloat(body.newOnsale ?? body.new_onsale ?? body.new_onsale_price) || 0;
      isPriceUpdate = true;
    } else if (body.onsalePrice !== undefined) {
      updateData.newOnsale = parseFloat(body.onsalePrice) || 0;
      isPriceUpdate = true;
    } else if (body.price !== undefined) {
      updateData.newOnsale = parseFloat(body.price) || 0;
      isPriceUpdate = true;
    }

    if (body.newVariantPrice !== undefined) {
      updateData.newVariantPrice = body.newVariantPrice;
      isPriceUpdate = true;
    } else if (body.variantPrice !== undefined || body.varientPrice !== undefined) {
      updateData.newVariantPrice = body.variantPrice ?? body.varientPrice;
      isPriceUpdate = true;
    }

    if (isPriceUpdate && !body.status) {
      updateData.status = 'Under Review';
    }

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

    // If status is being set to approved or active, promote pending review prices to live prices
    if (data.status && ['approved', 'active'].includes((data.status as string).trim().toLowerCase())) {
      const targetNewMrp = data.newMrp !== undefined ? data.newMrp : existing.newMrp;
      if (targetNewMrp !== null && targetNewMrp !== undefined) {
        data.mrp = targetNewMrp;
        data.newMrp = null;
      }
      const targetNewDiscount = data.newDiscount !== undefined ? data.newDiscount : existing.newDiscount;
      if (targetNewDiscount !== null && targetNewDiscount !== undefined) {
        data.discount = targetNewDiscount;
        data.newDiscount = Prisma.DbNull;
      }
      const targetNewOnsale = data.newOnsale !== undefined ? data.newOnsale : existing.newOnsale;
      if (targetNewOnsale !== null && targetNewOnsale !== undefined) {
        data.onsalePrice = targetNewOnsale;
        data.price = targetNewOnsale;
        data.newOnsale = null;
      }
      const targetNewVariantPrice = data.newVariantPrice !== undefined ? data.newVariantPrice : existing.newVariantPrice;
      if (targetNewVariantPrice !== null && targetNewVariantPrice !== undefined) {
        data.variantPrice = targetNewVariantPrice;
        data.newVariantPrice = Prisma.DbNull;
      }
    }

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

    const data: Prisma.ProductUpdateInput = {
      status,
      updatedDate: new Date(),
    };

    // When status is approved or active, activate pending price updates (newMrp, newDiscount, newOnsale, newVariantPrice)
    const isApproval = ['approved', 'active'].includes((status || '').trim().toLowerCase());
    if (isApproval) {
      if (existing.newMrp !== null && existing.newMrp !== undefined) {
        data.mrp = existing.newMrp;
        data.newMrp = null;
      }
      if (existing.newDiscount !== null && existing.newDiscount !== undefined) {
        data.discount = existing.newDiscount;
        data.newDiscount = Prisma.DbNull;
      }
      if (existing.newOnsale !== null && existing.newOnsale !== undefined) {
        data.onsalePrice = existing.newOnsale;
        data.price = existing.newOnsale;
        data.newOnsale = null;
      }
      if (existing.newVariantPrice !== null && existing.newVariantPrice !== undefined) {
        data.variantPrice = existing.newVariantPrice;
        data.newVariantPrice = Prisma.DbNull;
      }
    }

    const updated = await this.db.product.update({
      where: { id },
      data,
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
    if (dto.new_mrp !== undefined || dto.newMrp !== undefined) {
      data.newMrp = parseFloat(dto.new_mrp ?? dto.newMrp) || 0;
    } else if (dto.mrp !== undefined) {
      data.newMrp = parseFloat(dto.mrp) || 0;
    }

    if (dto.new_onsale !== undefined || dto.newOnsale !== undefined) {
      data.newOnsale = parseFloat(dto.new_onsale ?? dto.newOnsale) || 0;
    } else if (dto.onsale_price !== undefined || dto.onsalePrice !== undefined) {
      data.newOnsale = parseFloat(dto.onsale_price ?? dto.onsalePrice) || 0;
    } else if (dto.price !== undefined) {
      data.newOnsale = parseFloat(dto.price) || 0;
    }

    if (dto.new_discount !== undefined || dto.newDiscount !== undefined) {
      data.newDiscount = dto.new_discount ?? dto.newDiscount;
    } else if (dto.discount !== undefined) {
      data.newDiscount = dto.discount;
    }

    if (dto.new_variant_price !== undefined || dto.newVariantPrice !== undefined) {
      data.newVariantPrice = dto.new_variant_price ?? dto.newVariantPrice;
    } else if (dto.variant_price !== undefined || dto.variantPrice !== undefined) {
      data.newVariantPrice = dto.variant_price ?? dto.variantPrice;
    }

    data.status = 'Under Review';
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

    const dbCategoryFilter = categoryId
      ? await this.db.categoryFilters.findFirst({
        where: {
          OR: [
            { categoryId: categoryId },
            { id: categoryId },
          ],
        },
      })
      : null;

    let categoryFilters: any = null;

    if (dbCategoryFilter) {
      const dbOptions = dbCategoryFilter.productOptions && typeof dbCategoryFilter.productOptions === 'object'
        ? dbCategoryFilter.productOptions
        : {};
      const dbSpecs = Array.isArray(dbCategoryFilter.specification) ? dbCategoryFilter.specification : [];
      const hasOptions = Object.keys(dbOptions).length > 0;
      const hasSpecs = dbSpecs.length > 0;

      categoryFilters = {
        brands: dbCategoryFilter.brands || [],
        priceRange: dbCategoryFilter.priceRange || { min: 0, max: 0 },
        productOptions: dbOptions,
        ratingCounts: dbCategoryFilter.ratingCounts || { '1+': 0, '2+': 0, '3+': 10, '4+': 20 },
        specification: dbSpecs,
      };

      if (!hasOptions || !hasSpecs) {
        const allMatchingProducts = await this.db.product.findMany({
          where: categoryBaseWhere,
          select: {
            price: true,
            onsalePrice: true,
            mrp: true,
            brand: true,
            additionalInfoSections: true,
            productOptions: true,
          },
        });
        const dynamicFilters = buildDynamicCategoryFilters(allMatchingProducts);
        if (!hasOptions && Object.keys(dynamicFilters.productOptions).length > 0) {
          categoryFilters.productOptions = dynamicFilters.productOptions;
        }
        if (!hasSpecs && dynamicFilters.specification.length > 0) {
          categoryFilters.specification = dynamicFilters.specification;
        }
        if ((!categoryFilters.brands || categoryFilters.brands.length === 0) && dynamicFilters.brands.length > 0) {
          categoryFilters.brands = dynamicFilters.brands;
        }
      }
    } else {
      const allMatchingProducts = await this.db.product.findMany({
        where: categoryBaseWhere,
        select: {
          price: true,
          onsalePrice: true,
          mrp: true,
          brand: true,
          additionalInfoSections: true,
          productOptions: true,
        },
      });
      categoryFilters = buildDynamicCategoryFilters(allMatchingProducts);
    }

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

    // Collect all target category IDs and names (including child categories)
    const targetCategoryIds = new Set<string>([rawSubCategoryId, resolvedCategoryId]);
    const targetCategoryNames = new Set<string>();

    if (resolvedCategoryRecord?.categoryName) {
      const name = resolvedCategoryRecord.categoryName;
      targetCategoryNames.add(name);
      targetCategoryNames.add(name.replace(/'s/gi, '').trim());
      targetCategoryNames.add(name.replace(/&/g, 'and').trim());
    }

    // Resolve any children categories under this category from CategoryList & CategoryMaster
    const childRecords = await this.db.categoryList.findMany({
      where: {
        OR: [
          { parentCategoryId: rawSubCategoryId },
          { parentCategoryId: resolvedCategoryId },
        ],
        ...(moduleEnum ? { module: { in: [moduleEnum, CategoryModule.ALL] } } : {}),
      },
      select: { categoryId: true, categoryName: true },
    });

    for (const child of childRecords) {
      if (child.categoryId) targetCategoryIds.add(child.categoryId);
      if (child.categoryName) {
        targetCategoryNames.add(child.categoryName);
        targetCategoryNames.add(child.categoryName.replace(/'s/gi, '').trim());
      }
      // Also check grandchildren level
      const grandChildren = await this.db.categoryList.findMany({
        where: {
          parentCategoryId: child.categoryId,
          ...(moduleEnum ? { module: { in: [moduleEnum, CategoryModule.ALL] } } : {}),
        },
        select: { categoryId: true, categoryName: true },
      });
      for (const gc of grandChildren) {
        if (gc.categoryId) targetCategoryIds.add(gc.categoryId);
        if (gc.categoryName) {
          targetCategoryNames.add(gc.categoryName);
          targetCategoryNames.add(gc.categoryName.replace(/'s/gi, '').trim());
        }
      }
    }

    // Common fashion subcategory aliases
    if (targetCategoryIds.has('CAT_MENS_TSHIRTS')) {
      targetCategoryNames.add("Men's Tshirts");
      targetCategoryNames.add("Men's T-Shirts");
      targetCategoryNames.add("T-Shirts");
      targetCategoryNames.add("Tshirts");
    }
    if (targetCategoryIds.has('CAT_MENS_SHIRTS')) {
      targetCategoryNames.add("Men's Shirts");
      targetCategoryNames.add("Shirts");
    }
    if (targetCategoryIds.has('CAT_MENS_JEANS')) {
      targetCategoryNames.add("Jeans");
      targetCategoryNames.add("Men's Jeans");
    }
    if (targetCategoryIds.has('CAT_MENS_WEAR')) {
      targetCategoryNames.add("Men Fashion");
      targetCategoryNames.add("Men's Fashion");
      targetCategoryNames.add("Men's Tshirts");
      targetCategoryNames.add("Men's Formal Shoes");
      targetCategoryNames.add("Men's Casual Shoes");
      targetCategoryNames.add("Men's Shirts");
      targetCategoryNames.add("Men's Jackets");
    }
    if (targetCategoryIds.has('CAT_WOMENS_WEAR')) {
      targetCategoryNames.add("Women Fashion");
      targetCategoryNames.add("Women's Fashion");
      targetCategoryNames.add("Leggings");
      targetCategoryNames.add("Blouse Piece");
      targetCategoryNames.add("Sarees");
      targetCategoryNames.add("Kurtis");
      targetCategoryNames.add("Women's Shorts");
      targetCategoryNames.add("Active Topwear");
    }
    if (targetCategoryIds.has('CAT_FASH')) {
      targetCategoryNames.add("Fashion");
      targetCategoryNames.add("Men Fashion");
      targetCategoryNames.add("Men's Fashion");
      targetCategoryNames.add("Women Fashion");
      targetCategoryNames.add("Women's Fashion");
    }

    const allCatIdsList = Array.from(targetCategoryIds);
    const allCatNamesList = Array.from(targetCategoryNames);

    const subCategoryFilter: Prisma.ProductWhereInput = {
      OR: [
        { subCategoryId: { in: allCatIdsList } },
        { categoryId: { in: allCatIdsList } },
        { collections: { hasSome: allCatIdsList } },
        { mainCategory: { in: allCatIdsList } },
        ...(allCatNamesList.length > 0
          ? [
            { subCategory: { in: allCatNamesList, mode: 'insensitive' as const } },
            { categoryName: { hasSome: allCatNamesList } },
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

    const parsedProductOptions = parseProductOptionsInput(params.productOptions);
    const parsedSpecifications = parseSpecificationInput(params.specification);

    let activeAds = ads;
    let activeOrganic = organic;
    if (parsedProductOptions.length > 0 || parsedSpecifications.length > 0) {
      activeAds = ads.filter(
        (p) => matchProductOptions(p, parsedProductOptions) && matchSpecifications(p, parsedSpecifications),
      );
      activeOrganic = organic.filter(
        (p) => matchProductOptions(p, parsedProductOptions) && matchSpecifications(p, parsedSpecifications),
      );
    }

    // 1. Interleave primary products first
    const primaryInterleaved = interleaveAdAndOrganic(activeAds, activeOrganic);

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
    let categoryFilters: any = null;

    if (dbCategoryFilter) {
      const dbOptions = dbCategoryFilter.productOptions && typeof dbCategoryFilter.productOptions === 'object'
        ? dbCategoryFilter.productOptions
        : {};
      const dbSpecs = Array.isArray(dbCategoryFilter.specification) ? dbCategoryFilter.specification : [];
      const hasOptions = Object.keys(dbOptions).length > 0;
      const hasSpecs = dbSpecs.length > 0;

      categoryFilters = {
        brands: dbCategoryFilter.brands || [],
        priceRange: dbCategoryFilter.priceRange || { min: 0, max: 0 },
        productOptions: dbOptions,
        ratingCounts: dbCategoryFilter.ratingCounts || { '1+': 0, '2+': 0, '3+': 10, '4+': 20 },
        specification: dbSpecs,
      };

      if (!hasOptions || !hasSpecs) {
        const allMatchingProducts = await this.db.product.findMany({
          where: subCategoryFilter,
          select: {
            price: true,
            onsalePrice: true,
            mrp: true,
            brand: true,
            additionalInfoSections: true,
            productOptions: true,
          },
        });
        const dynamicFilters = buildDynamicCategoryFilters(allMatchingProducts);
        if (!hasOptions && Object.keys(dynamicFilters.productOptions).length > 0) {
          categoryFilters.productOptions = dynamicFilters.productOptions;
        }
        if (!hasSpecs && dynamicFilters.specification.length > 0) {
          categoryFilters.specification = dynamicFilters.specification;
        }
        if ((!categoryFilters.brands || categoryFilters.brands.length === 0) && dynamicFilters.brands.length > 0) {
          categoryFilters.brands = dynamicFilters.brands;
        }
      }
    } else {
      const allMatchingProducts = await this.db.product.findMany({
        where: subCategoryFilter,
        select: {
          price: true,
          onsalePrice: true,
          mrp: true,
          brand: true,
          additionalInfoSections: true,
          productOptions: true,
        },
      });

      categoryFilters = buildDynamicCategoryFilters(allMatchingProducts);
    }

    // 7. Strict deduplication of combinedList to eliminate duplicates
    const seenProductIds = new Set<string>();
    const deduplicatedCombinedList: any[] = [];
    for (const p of combinedList) {
      const pKey = p.id || p.productId;
      if (pKey && !seenProductIds.has(pKey)) {
        seenProductIds.add(pKey);
        deduplicatedCombinedList.push(p);
      }
    }

    // 8. Slice exact page window from combined stream (Primary then Fallback)
    const startIndex = (page - 1) * limit;
    const pagedProducts = deduplicatedCombinedList.slice(startIndex, startIndex + limit);

    // Determine if this current page slice contains fallback products
    const currentSliceHasFallback =
      isFallback &&
      (startIndex >= primaryInterleaved.length ||
        startIndex + pagedProducts.length > primaryInterleaved.length ||
        totalItems === 0);

    const grandTotalItems = isFallback
      ? Math.max(totalItems + fallbackTotalAvailable, deduplicatedCombinedList.length)
      : totalItems;

    const grandTotalPages = Math.ceil(grandTotalItems / limit) || 1;
    const hasMore = (startIndex + limit) < grandTotalItems || (startIndex + limit) < deduplicatedCombinedList.length;
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
        totalItems: grandTotalItems,
        totalPages: grandTotalPages,
        currentPage: page,
        lastFetched: mappedProducts.length,
        hasMore,
        isFallback: currentSliceHasFallback,
        fallbackTitle: currentSliceHasFallback ? (fallbackTitle || 'Trending Products') : null,
        products: mappedProducts,
        categoryFilters,
        sortFilter,
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

  if (dto.newMrp !== undefined) data.newMrp = parseFloat(dto.newMrp) || 0;
  else if (dto.new_mrp !== undefined) data.newMrp = parseFloat(dto.new_mrp) || 0;

  if (dto.newOnsale !== undefined) data.newOnsale = parseFloat(dto.newOnsale) || 0;
  else if (dto.new_onsale !== undefined) data.newOnsale = parseFloat(dto.new_onsale) || 0;
  else if (dto.new_onsale_price !== undefined) data.newOnsale = parseFloat(dto.new_onsale_price) || 0;

  if (dto.newDiscount !== undefined) data.newDiscount = dto.newDiscount;
  else if (dto.new_discount !== undefined) data.newDiscount = dto.new_discount;

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
  const pid = p.productId || p.id || '';
  const internalId = p.id || pid;

  let image = p.mainMedia || '';
  if (!image && Array.isArray(p.productImages) && p.productImages.length > 0) {
    const firstMedia: any = p.productImages[0];
    image = typeof firstMedia === 'string' ? firstMedia : (firstMedia?.url || firstMedia?.src || firstMedia?.image || '');
  }

  const codVal = p.cod !== undefined && p.cod !== null ? Number(p.cod) : Number(p.price || p.mrp || 0);
  const upiVal = p.upi !== undefined && p.upi !== null ? Number(p.upi) : Number(p.price || p.mrp || 0);

  const brand = (p.brand === 'Generic' || !p.brand) ? 'Generic' : String(p.brand).trim();
  const productOptions = p.productOptions && typeof p.productOptions === 'object' ? p.productOptions : {};

  const subCatVal = p.subCategoryId || p.subCategory || '';
  const mainCatVal = p.mainCategory || '';

  const mrpVal = p.mrp !== undefined && p.mrp !== null ? Number(p.mrp) : 0;
  const rawPrice = p.onsalePrice !== undefined && p.onsalePrice !== null
    ? Number(p.onsalePrice)
    : (p.price !== undefined && p.price !== null ? Number(p.price) : codVal);
  const priceVal = isNaN(rawPrice) ? 0 : rawPrice;

  let discountPercentage = 0;
  if (mrpVal > 0 && priceVal > 0 && mrpVal > priceVal) {
    discountPercentage = Math.round(((mrpVal - priceVal) / mrpVal) * 100);
  } else if (p.discount && typeof p.discount === 'object' && p.discount.percentage) {
    discountPercentage = Number(p.discount.percentage) || 0;
  }

  const inventoryVal = typeof p.inventory === 'number' ? p.inventory : (parseInt(String(p.inventory || '0'), 10) || 0);
  const statusStr = String(p.status || '').toUpperCase();
  const inStock = statusStr !== 'OUT_OF_STOCK' && (p.inventory === null || p.inventory === undefined || inventoryVal > 0);

  return {
    id: internalId,
    productId: pid,
    name: p.name || '',
    brand,
    image: image || '',
    mrp: isNaN(mrpVal) ? 0 : mrpVal,
    price: priceVal,
    discount: discountPercentage,
    finalPricing: {
      codFinal: isNaN(codVal) ? 0 : codVal,
      upiFinal: isNaN(upiVal) ? 0 : upiVal,
    },
    inStock,
    averageRating: typeof p.averageRating === 'number' ? p.averageRating : 0,
    totalReviews: typeof p.totalReviews === 'number' ? p.totalReviews : 0,
    isWishlist: false,
    wishlistTableId: '',
    sellerId: p.sellerId || '',
    campaignId: p.campaignId || '',
    deliveryCharges: p.deliveryCharges === true || p.deliveryCharges === 'true',
    mainCategoryId: mainCatVal,
    subCategoryId: subCatVal,
    productOptions,
    activeAd: p.activeAd === true || p.activeAd === 'true',
  };
}

export function mapToSimilarProductCard(p: any): any {
  if (!p) return null;
  const pid = p.productId || p.id || '';

  let image = p.mainMedia || '';
  if (!image && Array.isArray(p.productImages) && p.productImages.length > 0) {
    const firstMedia: any = p.productImages[0];
    image = typeof firstMedia === 'string' ? firstMedia : (firstMedia?.url || firstMedia?.src || firstMedia?.image || '');
  }

  const codVal = p.cod !== undefined && p.cod !== null ? Number(p.cod) : Number(p.price || p.mrp || 0);
  const upiVal = p.upi !== undefined && p.upi !== null ? Number(p.upi) : Number(p.price || p.mrp || 0);

  const brand = (p.brand === 'Generic' || !p.brand) ? 'Generic' : String(p.brand).trim();

  const mrpVal = p.mrp !== undefined && p.mrp !== null ? Number(p.mrp) : 0;
  const rawPrice = p.onsalePrice !== undefined && p.onsalePrice !== null
    ? Number(p.onsalePrice)
    : (p.price !== undefined && p.price !== null ? Number(p.price) : codVal);
  const priceVal = isNaN(rawPrice) ? 0 : rawPrice;

  let discountPercentage = 0;
  if (mrpVal > 0 && priceVal > 0 && mrpVal > priceVal) {
    discountPercentage = Math.round(((mrpVal - priceVal) / mrpVal) * 100);
  } else if (p.discount && typeof p.discount === 'object' && p.discount.percentage) {
    discountPercentage = Number(p.discount.percentage) || 0;
  }

  const inventoryVal = typeof p.inventory === 'number' ? p.inventory : (parseInt(String(p.inventory || '0'), 10) || 0);
  const statusStr = String(p.status || '').toUpperCase();
  const inStock = statusStr !== 'OUT_OF_STOCK' && (p.inventory === null || p.inventory === undefined || inventoryVal > 0);

  return {
    productId: pid,
    name: p.name || '',
    brand,
    image: image || '',
    price: priceVal,
    mrp: isNaN(mrpVal) ? 0 : mrpVal,
    discount: discountPercentage,
    finalPricing: {
      codFinal: isNaN(codVal) ? 0 : codVal,
      upiFinal: isNaN(upiVal) ? 0 : upiVal,
    },
    inStock,
    averageRating: typeof p.averageRating === 'number' ? p.averageRating : 0,
    totalReviews: typeof p.totalReviews === 'number' ? p.totalReviews : 0,
    isWishlist: false,
    activeAd: p.activeAd === true || p.activeAd === 'true',
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
    newMrp: p.newMrp,
    new_mrp: p.newMrp,
    onsalePrice: p.onsalePrice,
    newOnsale: p.newOnsale,
    new_onsale: p.newOnsale,
    cod: p.cod,
    upi: p.upi,
    price: p.price,
    discount: p.discount,
    newDiscount: p.newDiscount,
    new_discount: p.newDiscount,
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
    tableId: p.id,
    productId: p.productId || p.id || '',
    mainMedia: p.mainMedia || '',
    productImages: productImagesArray,
    name: p.name || '',
    description: p.description || '',
    brand: p.brand || '',
    shippingWeight: p.shippingWeight || 0,
    price: p.price || 0,
    mrp: p.mrp || 0,
    newMrp: p.newMrp !== undefined ? p.newMrp : null,
    new_mrp: p.newMrp !== undefined ? p.newMrp : null,
    onsalePrice: p.onsalePrice || 0,
    newOnsale: p.newOnsale !== undefined ? p.newOnsale : null,
    new_onsale: p.newOnsale !== undefined ? p.newOnsale : null,
    discount: p.discount && typeof p.discount === 'object' && Object.keys(p.discount).length > 0 ? p.discount : {},
    newDiscount: p.newDiscount !== undefined ? p.newDiscount : null,
    new_discount: p.newDiscount !== undefined ? p.newDiscount : null,
    ribbon: p.ribbon || '',
    productOptions: p.productOptions && typeof p.productOptions === 'object' && Object.keys(p.productOptions).length > 0 ? p.productOptions : {},
    additionalInfoSections: Array.isArray(p.additionalInfoSections) ? p.additionalInfoSections : [],
    sellerId: p.sellerId || '',
    variantPrice: p.variantPrice && typeof p.variantPrice === 'object' && Object.keys(p.variantPrice).length > 0 ? p.variantPrice : {},
    newVariantPrice: p.newVariantPrice !== undefined ? p.newVariantPrice : null,
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

function cleanHtmlText(text: any): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/<[^>]*>?/gm, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function convertWixMedia(urlOrObj: any, type: string = 'Image'): { src: string | null; poster?: string } | null {
  if (!urlOrObj) return null;
  let src = typeof urlOrObj === 'string' ? urlOrObj.trim() : (urlOrObj?.src ? String(urlOrObj.src).trim() : '');
  if (!src) return null;

  if (src.startsWith('wix:image://v1/')) {
    const parts = src.split('/');
    const rawFilename = parts[3] || '';
    const mediaId = rawFilename.split('#')[0] || '';
    if (mediaId) {
      src = `https://static.wixstatic.com/media/${mediaId}`;
    }
  } else if (src.startsWith('wix:video://v1/')) {
    const parts = src.split('/');
    const mediaId = parts[3] ? parts[3].split('#')[0] : '';
    if (mediaId) {
      src = `https://video.wixstatic.com/video/${mediaId}/mp4/file.mp4`;
    }
  }

  const result: { src: string | null; poster?: string } = { src };
  if (type === 'Video' && urlOrObj && typeof urlOrObj === 'object' && urlOrObj.poster) {
    result.poster = typeof urlOrObj.poster === 'string' ? urlOrObj.poster : undefined;
  }
  return result;
}

function computeDeliveryCharges(
  sellerPin: string | number,
  toPin: string | number,
  rawWeight: number,
  orderAmount: number,
): { prepaid: number; cod: number } {
  let weight = Number(rawWeight) || 0.5;
  if (weight > 20) {
    // If weight is passed in grams (e.g. 400g, 500g), convert to kg
    weight = weight / 1000;
  }
  const sellerP = String(sellerPin || '').trim();
  const toP = String(toPin || '').trim();

  if (!sellerP || !toP || weight <= 0) {
    return { prepaid: 0, cod: 0 };
  }

  const isLocal = sellerP.slice(0, 3) === toP.slice(0, 3);
  const isRegional = sellerP.slice(0, 2) === toP.slice(0, 2);

  let prepaid = 50;
  let cod = 60;
  if (isLocal) {
    prepaid = 30;
    cod = 40;
  } else if (isRegional) {
    prepaid = 40;
    cod = 50;
  }

  const additionalSlabs = Math.max(0, Math.ceil((weight - 0.5) / 0.5));
  if (additionalSlabs > 0) {
    const slabRate = isLocal ? 15 : isRegional ? 25 : 35;
    prepaid += additionalSlabs * slabRate;
    cod += additionalSlabs * slabRate;
  }

  return { prepaid, cod };
}

function formatCurrencyString(val: any, fallbackNum?: number): string {
  if (typeof val === 'string' && val.trim()) {
    const trimmed = val.trim();
    if (trimmed.startsWith('?')) {
      return '₹' + trimmed.slice(1);
    }
    if (trimmed.startsWith('₹') || trimmed.startsWith('Rs') || trimmed.startsWith('INR')) {
      return trimmed;
    }
    const num = Number(trimmed);
    if (!isNaN(num)) {
      return `₹${num}`;
    }
    return trimmed;
  }
  if (typeof val === 'number') {
    return `₹${val}`;
  }
  if (fallbackNum !== undefined && !isNaN(fallbackNum)) {
    return `₹${fallbackNum}`;
  }
  return '₹0';
}

function buildDynamicCategoryFilters(allMatchingProducts: any[]) {
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  const brandSet = new Set<string>();
  const specMap = new Map<string, Set<string>>();
  const productOptionMap: Record<string, { name: string; choices: Set<string> }> = {};

  allMatchingProducts.forEach((p) => {
    const pPrice = Number(p.price || p.onsalePrice || p.mrp || 0);
    if (pPrice > 0) {
      if (pPrice < minPrice) minPrice = pPrice;
      if (pPrice > maxPrice) maxPrice = pPrice;
    }
    if (p.brand && typeof p.brand === 'string') {
      const trimmed = p.brand.trim();
      if (trimmed) {
        brandSet.add(trimmed);
      }
    }

    // 1. Extract productOptions
    const options = p.productOptions || p.product_options;
    if (options && typeof options === 'object' && !Array.isArray(options)) {
      Object.keys(options).forEach((optKey) => {
        const optionData = options[optKey];
        if (optionData && typeof optionData === 'object') {
          const optName = optionData.name || optKey;
          const normalizedKey = optName.trim().toLowerCase();
          if (!productOptionMap[normalizedKey]) {
            productOptionMap[normalizedKey] = {
              name: optName,
              choices: new Set<string>(),
            };
          }
          if (Array.isArray(optionData.choices)) {
            optionData.choices.forEach((choice: any) => {
              const val = typeof choice === 'string'
                ? choice.trim()
                : (choice?.value ? String(choice.value).trim() : (choice?.description ? String(choice.description).trim() : ''));
              if (val) {
                productOptionMap[normalizedKey].choices.add(val);
              }
            });
          }
        }
      });
    }

    // 2. Extract additionalInfoSections (specifications)
    const sections = p.additionalInfoSections || p.additional_info_sections;
    if (Array.isArray(sections)) {
      sections.forEach((info: any) => {
        if (!info || typeof info !== 'object') return;
        if (info.title && info.description) {
          const title = String(info.title).trim();
          const desc = String(info.description).replace(/<[^>]*>?/gm, '').trim();
          if (title && desc) {
            if (!specMap.has(title)) specMap.set(title, new Set());
            specMap.get(title)!.add(desc);
          }
        } else {
          Object.keys(info).forEach((key) => {
            const title = key.trim();
            const rawVal = info[key];
            if (rawVal !== null && rawVal !== undefined) {
              const desc = String(rawVal).replace(/<[^>]*>?/gm, '').trim();
              if (title && desc) {
                if (!specMap.has(title)) specMap.set(title, new Set());
                specMap.get(title)!.add(desc);
              }
            }
          });
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

  const formattedProductOptions: Record<string, Array<{ name: string; choices: Array<{ value: string }> }>> = {};
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  Object.keys(productOptionMap).forEach((normKey) => {
    const opt = productOptionMap[normKey];
    const values = Array.from(opt.choices);
    if (opt.name.toLowerCase() === 'size') {
      values.sort((a, b) => {
        const idxA = sizeOrder.indexOf(a.toUpperCase());
        const idxB = sizeOrder.indexOf(b.toUpperCase());
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b, undefined, { numeric: true });
      });
    } else {
      values.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }

    formattedProductOptions[normKey] = [
      {
        name: opt.name,
        choices: values.map((v) => ({ value: v })),
      },
    ];
  });

  return {
    brands: Array.from(brandSet).sort(),
    priceRange: { min: minPrice, max: maxPrice },
    productOptions: formattedProductOptions,
    ratingCounts: { '1+': 0, '2+': 0, '3+': 10, '4+': 20 },
    specification: specList,
  };
}

function parseSpecificationInput(specInput: any): Record<string, string>[] {
  if (!specInput) return [];
  if (Array.isArray(specInput)) {
    return specInput.flatMap((item) => {
      if (typeof item === 'object' && item !== null) return [item];
      return parseSpecificationInput(item);
    });
  }
  if (typeof specInput === 'object') return [specInput];
  if (typeof specInput === 'string') {
    const trimmed = specInput.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseSpecificationInput(parsed);
      } catch (e) { }
    }
    return trimmed
      .split(',')
      .map((part) => {
        const idx = part.indexOf(':');
        if (idx !== -1) {
          return { [part.substring(0, idx).trim()]: part.substring(idx + 1).trim() };
        }
        const eqIdx = part.indexOf('=');
        if (eqIdx !== -1) {
          return { [part.substring(0, eqIdx).trim()]: part.substring(eqIdx + 1).trim() };
        }
        return { [part.trim()]: part.trim() };
      })
      .filter((obj) => Object.keys(obj).length > 0 && Object.keys(obj)[0] !== '');
  }
  return [];
}

function parseProductOptionsInput(optInput: any): string[] {
  if (!optInput) return [];
  if (Array.isArray(optInput)) {
    return optInput.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof optInput === 'string') {
    const trimmed = optInput.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
      } catch (e) { }
    }
    return trimmed
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function matchProductOptions(product: any, filterOptions: string[]): boolean {
  if (!filterOptions || filterOptions.length === 0) return true;
  const pOpts = product.productOptions || product.product_options;
  if (!pOpts || typeof pOpts !== 'object') return false;

  const groups: Record<string, string[]> = {};
  for (const f of filterOptions) {
    const idx = f.indexOf(':');
    let optName = '';
    let optVal = '';
    if (idx !== -1) {
      optName = f.substring(0, idx).trim().toLowerCase();
      optVal = f.substring(idx + 1).trim().toLowerCase();
    } else {
      optVal = f.trim().toLowerCase();
    }
    if (!groups[optName]) groups[optName] = [];
    groups[optName].push(optVal);
  }

  for (const optName of Object.keys(groups)) {
    const targetValues = groups[optName];
    let groupMatched = false;

    for (const key of Object.keys(pOpts)) {
      const opt = pOpts[key];
      if (!opt) continue;
      const actualName = (opt.name || key).trim().toLowerCase();
      if (optName && actualName !== optName) continue;

      const choices = Array.isArray(opt.choices) ? opt.choices : [];
      const hasMatch = choices.some((ch: any) => {
        const val = typeof ch === 'string'
          ? ch.trim().toLowerCase()
          : String(ch?.value || ch?.description || '').trim().toLowerCase();
        return targetValues.includes(val);
      });

      if (hasMatch) {
        groupMatched = true;
        break;
      }
    }

    if (!groupMatched) return false;
  }

  return true;
}

function matchSpecifications(product: any, filterSpecs: Record<string, string>[]): boolean {
  if (!filterSpecs || filterSpecs.length === 0) return true;
  const sections = product.additionalInfoSections || product.additional_info_sections;
  if (!Array.isArray(sections) || sections.length === 0) return false;

  const specGroups: Record<string, string[]> = {};
  for (const spec of filterSpecs) {
    for (const [k, v] of Object.entries(spec)) {
      const normKey = k.trim().toLowerCase();
      const normVal = String(v).trim().toLowerCase();
      if (!specGroups[normKey]) specGroups[normKey] = [];
      specGroups[normKey].push(normVal);
    }
  }

  for (const specKey of Object.keys(specGroups)) {
    const targetVals = specGroups[specKey];
    let keyMatched = false;

    for (const sec of sections) {
      if (!sec || typeof sec !== 'object') continue;
      if (sec.title && sec.description) {
        const title = String(sec.title).trim().toLowerCase();
        const desc = String(sec.description).replace(/<[^>]*>?/gm, '').trim().toLowerCase();
        if (title === specKey && targetVals.includes(desc)) {
          keyMatched = true;
          break;
        }
      } else {
        for (const [k, v] of Object.entries(sec)) {
          const actualKey = k.trim().toLowerCase();
          const actualVal = String(v).replace(/<[^>]*>?/gm, '').trim().toLowerCase();
          if (actualKey === specKey && targetVals.includes(actualVal)) {
            keyMatched = true;
            break;
          }
        }
        if (keyMatched) break;
      }
    }

    if (!keyMatched) return false;
  }

  return true;
}


