import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { MediaStorageService } from '../media-storage/media-storage.service';
import { CreateSellerProductDto, UpdateSellerProductDto, FilterSellerProductDto } from './dto/seller-product.dto';

@Injectable()
export class SellerProductService {
  private readonly logger = new Logger(SellerProductService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mediaStorage: MediaStorageService,
  ) {}

  async create(dto: CreateSellerProductDto) {
    const dataToSave = this.extractMediaKeysFromDto(dto);
    let created: any;
    try {
      created = await this.db.sellerProduct.create({
        data: dataToSave as any,
      });
    } catch (err) {
      // Rollback uploaded media files if DB transaction fails
      await this.rollbackMediaKeys(dataToSave);
      throw err;
    }
    return this.mediaStorage.transformMediaToUrls(created);
  }

  async findAll(query: FilterSellerProductDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sellerId,
      brand,
      status,
      subCategory,
      mainCategory,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (sellerId) where.sellerId = sellerId;
    if (brand) where.brand = { contains: brand, mode: 'insensitive' };
    if (status) where.status = { equals: status, mode: 'insensitive' };
    if (subCategory) where.subCategory = { contains: subCategory, mode: 'insensitive' };
    if (mainCategory) where.mainCategory = { contains: mainCategory, mode: 'insensitive' };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const validSortFields = ['createdAt', 'updatedAt', 'name', 'price', 'inventory', 'createdDate'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [items, total] = await Promise.all([
      this.db.sellerProduct.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: sortOrder },
      }),
      this.db.sellerProduct.count({ where }),
    ]);

    return {
      data: this.mediaStorage.transformMediaToUrls(items),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.db.sellerProduct.findUnique({
      where: { id },
    });
    if (!product) {
      throw new NotFoundException(`Seller Product with ID "${id}" not found`);
    }
    return this.mediaStorage.transformMediaToUrls(product);
  }

  async update(id: string, dto: UpdateSellerProductDto) {
    const existing = await this.db.sellerProduct.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Seller Product with ID "${id}" not found`);
    }

    const dataToSave = this.extractMediaKeysFromDto(dto);
    const updated = await this.db.sellerProduct.update({
      where: { id },
      data: dataToSave as any,
    });

    // Cleanup orphaned media object keys after successful DB update
    this.cleanupRemovedMediaKeys(existing, dataToSave);

    return this.mediaStorage.transformMediaToUrls(updated);
  }

  async remove(id: string) {
    const existing = await this.db.sellerProduct.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Seller Product with ID "${id}" not found`);
    }

    const deleted = await this.db.sellerProduct.delete({
      where: { id },
    });

    // Delete all associated media object keys from storage safely
    this.deleteAllAssociatedMediaKeys(existing);

    return this.mediaStorage.transformMediaToUrls(deleted);
  }

  private extractMediaKeysFromDto(dto: any) {
    const copy = { ...dto };
    if (typeof copy.mainMedia === 'string') {
      copy.mainMedia = this.mediaStorage.extractKey(copy.mainMedia);
    }
    if (Array.isArray(copy.media)) {
      copy.media = copy.media.map((m: any) => {
        if (typeof m === 'string') return { key: this.mediaStorage.extractKey(m), type: 'image' };
        if (m && typeof m === 'object') {
          const rawKey = m.key || m.url;
          return { key: this.mediaStorage.extractKey(rawKey), type: m.type || 'image' };
        }
        return m;
      });
    }
    if (Array.isArray(copy.productImages)) {
      copy.productImages = copy.productImages.map((m: any) => {
        if (typeof m === 'string') return { key: this.mediaStorage.extractKey(m), type: 'image' };
        if (m && typeof m === 'object') {
          const rawKey = m.key || m.url;
          return { key: this.mediaStorage.extractKey(rawKey), type: m.type || 'image' };
        }
        return m;
      });
    }
    return copy;
  }

  private async rollbackMediaKeys(savedData: any) {
    const keysToDelete: string[] = [];
    if (savedData.mainMedia) keysToDelete.push(savedData.mainMedia);
    if (Array.isArray(savedData.media)) {
      savedData.media.forEach((item: any) => {
        if (item?.key) keysToDelete.push(item.key);
      });
    }
    await Promise.all(keysToDelete.map((k) => this.mediaStorage.delete(k)));
  }

  private async cleanupRemovedMediaKeys(oldProduct: any, newData: any) {
    const oldKeys = new Set<string>();
    if (oldProduct.mainMedia) oldKeys.add(this.mediaStorage.extractKey(oldProduct.mainMedia));
    if (Array.isArray(oldProduct.media)) {
      oldProduct.media.forEach((m: any) => m?.key && oldKeys.add(this.mediaStorage.extractKey(m.key)));
    }

    const newKeys = new Set<string>();
    if (newData.mainMedia) newKeys.add(this.mediaStorage.extractKey(newData.mainMedia));
    if (Array.isArray(newData.media)) {
      newData.media.forEach((m: any) => m?.key && newKeys.add(this.mediaStorage.extractKey(m.key)));
    }

    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        await this.mediaStorage.delete(key);
      }
    }
  }

  private async deleteAllAssociatedMediaKeys(product: any) {
    const keys = new Set<string>();
    if (product.mainMedia) keys.add(this.mediaStorage.extractKey(product.mainMedia));
    if (Array.isArray(product.media)) {
      product.media.forEach((m: any) => m?.key && keys.add(this.mediaStorage.extractKey(m.key)));
    }
    if (Array.isArray(product.productImages)) {
      product.productImages.forEach((m: any) => m?.key && keys.add(this.mediaStorage.extractKey(m.key)));
    }
    await Promise.all(Array.from(keys).map((k) => this.mediaStorage.delete(k)));
  }

  async bulkUpdate(updates: Array<{ id: string; data: UpdateSellerProductDto }>) {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new BadRequestException('Updates array cannot be empty');
    }

    const transactionTasks = updates.map((item) =>
      this.db.sellerProduct.update({
        where: { id: item.id },
        data: item.data as any,
      }),
    );

    const results = await this.db.$transaction(transactionTasks);
    return {
      success: true,
      updatedCount: results.length,
    };
  }

  /**
   * Reusable Wix CSV Import Engine
   */
  async importCsvContent(csvString: string) {
    this.logger.log('Starting Wix CSV product import process...');
    const lines = this.parseCsvLines(csvString);
    if (lines.length < 2) {
      throw new BadRequestException('CSV file must contain a header row and at least one data row');
    }

    const rawHeaders = lines[0].map((h) => h.trim());
    const dataRows = lines.slice(1);

    const validRecords: any[] = [];
    const errors: Array<{ row: number; column: string; message: string }> = [];

    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 2;
      const row = dataRows[i];

      if (row.length === 0 || (row.length === 1 && !row[0].trim())) {
        continue; // skip empty line
      }

      const { record, error } = this.mapWixRowToRecord(rawHeaders, row, rowNum);
      if (error) {
        errors.push(error);
      } else if (record) {
        validRecords.push(record);
      }
    }

    let importedCount = 0;
    // Execute Batch Insert / Upsert in chunks inside Prisma Transactions
    const batchSize = 100;
    for (let i = 0; i < validRecords.length; i += batchSize) {
      const batch = validRecords.slice(i, i + batchSize);
      try {
        await this.db.$transaction(
          batch.map((rec) => {
            const { _rowNum, ...record } = rec;
            return record.id
              ? this.db.sellerProduct.upsert({
                  where: { id: record.id },
                  update: record,
                  create: record,
                })
              : this.db.sellerProduct.create({ data: record });
          }),
        );
        importedCount += batch.length;
      } catch (err: any) {
        this.logger.error(`Batch transaction failed for rows ${i + 2} to ${i + batch.length + 1}: ${err.message}`);
        // Fallback row-by-row insertion to log exact failing row
        for (const rec of batch) {
          const { _rowNum, ...record } = rec;
          try {
            if (record.id) {
              await this.db.sellerProduct.upsert({
                where: { id: record.id },
                update: record,
                create: record,
              });
            } else {
              await this.db.sellerProduct.create({ data: record });
            }
            importedCount++;
          } catch (singleErr: any) {
            errors.push({
              row: _rowNum || 0,
              column: 'Database Transaction',
              message: singleErr.message || 'Database insert failed',
            });
          }
        }
      }
    }

    const failedCount = dataRows.length - importedCount;

    return {
      success: importedCount > 0,
      message:
        importedCount > 0
          ? `Successfully imported ${importedCount} products into database.`
          : 'No products were imported into the database. Please review the errors array.',
      totalRows: dataRows.length,
      imported: importedCount,
      failed: failedCount < 0 ? 0 : failedCount,
      errors,
    };
  }

  private mapWixRowToRecord(
    headers: string[],
    row: string[],
    rowNum: number,
  ): { record: any | null; error: { row: number; column: string; message: string } | null } {
    const findHeaderIndex = (possibleNames: string[]): number => {
      const lowerPossible = possibleNames.map((p) => p.toLowerCase().replace(/[\s_]/g, ''));
      return headers.findIndex((h) => lowerPossible.includes(h.toLowerCase().replace(/[\s_]/g, '')));
    };

    const getVal = (possibleNames: string[]): string | null => {
      const idx = findHeaderIndex(possibleNames);
      if (idx === -1 || idx >= row.length) return null;
      const val = row[idx].trim();
      return val === '' ? null : val;
    };

    const parseJson = (possibleNames: string[], colDisplayName: string): { data: any; err: string | null } => {
      const val = getVal(possibleNames);
      if (!val) return { data: null, err: null };
      try {
        return { data: JSON.parse(val), err: null };
      } catch {
        return { data: null, err: `Invalid JSON in column "${colDisplayName}"` };
      }
    };

    const parseBool = (possibleNames: string[]): boolean | null => {
      const val = getVal(possibleNames);
      if (val === null) return null;
      const lower = val.toLowerCase();
      return lower === 'true' || lower === '1' || lower === 'yes';
    };

    const parseNum = (possibleNames: string[]): number | null => {
      const val = getVal(possibleNames);
      if (val === null) return null;
      const num = parseFloat(val.replace(/,/g, ''));
      return isNaN(num) ? null : num;
    };

    const parseIntVal = (possibleNames: string[]): number | null => {
      const val = getVal(possibleNames);
      if (val === null) return null;
      const num = parseInt(val.replace(/,/g, ''), 10);
      return isNaN(num) ? null : num;
    };

    const parseDate = (possibleNames: string[]): Date | null => {
      const val = getVal(possibleNames);
      if (!val) return null;
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    };

    // Check required field
    const nameVal = getVal(['Name', 'name', 'Title', 'title']);
    if (!nameVal) {
      return {
        record: null,
        error: { row: rowNum, column: 'Name', message: 'Missing required product Name' },
      };
    }

    // Check JSON fields for errors
    const jsonFieldsMap = [
      { names: ['Product Images', 'product_images'], label: 'Product Images' },
      { names: ['search_keywords', 'searchKeywords'], label: 'search_keywords' },
      { names: ['varient Price', 'variant_price', 'variantPrice'], label: 'varient Price' },
      { names: ['Discount', 'discount'], label: 'Discount' },
      { names: ['Collections', 'collections'], label: 'Collections' },
      { names: ['Product Options', 'product_options'], label: 'Product Options' },
      { names: ['additionalInfoSections', 'additional_info_sections'], label: 'additionalInfoSections' },
      { names: ['Category Name', 'category_name'], label: 'Category Name' },
      { names: ['Promotion Photos', 'promotion_photos'], label: 'Promotion Photos' },
      { names: ['Media', 'media'], label: 'Media' },
    ];

    const jsonParsed: Record<string, any> = {};
    for (const jf of jsonFieldsMap) {
      const { data, err } = parseJson(jf.names, jf.label);
      if (err) {
        return {
          record: null,
          error: { row: rowNum, column: jf.label, message: err },
        };
      }
      jsonParsed[jf.label] = data;
    }

    const isUuid = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

    const rawId = getVal(['ID', 'id']);
    const recordId = rawId && isUuid(rawId) ? rawId : undefined;
    const productIdVal = getVal(['Product ID', 'product_id']) || (rawId && !isUuid(rawId) ? rawId : null);

    const rawSubCatId = getVal(['Sub Category ID', 'sub_category_id']);
    const subCategoryIdVal = rawSubCatId && isUuid(rawSubCatId) ? rawSubCatId : null;

    const rawSellerId = getVal(['Seller ID', 'seller_id']);
    const sellerIdVal = rawSellerId && isUuid(rawSellerId) ? rawSellerId : null;

    const record = {
      _rowNum: rowNum,
      id: recordId,
      mainMedia: getVal(['Mainmedia', 'main_media', 'Main Media']),
      media: jsonParsed['Media'],
      oneRsStore: parseBool(['1 Rs Store', 'one_rs_store', '1RsStore']) ?? false,
      productImages: jsonParsed['Product Images'],
      name: nameVal,
      searchKeywords: jsonParsed['search_keywords'],
      subCategory: getVal(['Sub Category', 'sub_category']),
      subCategoryId: subCategoryIdVal,
      brand: getVal(['Brand', 'brand']),
      inventory: parseIntVal(['Inventory', 'inventory']),
      variantPrice: jsonParsed['varient Price'],
      productId: productIdVal,
      mrp: parseNum(['MRP', 'mrp']),
      onsalePrice: parseNum(['onsalePrice', 'onsale_price', 'On Sale Price']),
      cod: parseBool(['COD', 'cod']),
      upi: parseBool(['UPI', 'upi']),
      price: parseNum(['Price', 'price']),
      discount: jsonParsed['Discount'],
      status: getVal(['status', 'Status']) || 'ACTIVE',
      deliveryCharges: parseBool(['Delivery Charges', 'delivery_charges']),
      mainCategory: getVal(['Main Category', 'main_category']),
      sellerId: sellerIdVal,
      shippingWeight: parseNum(['Shipping Weight', 'shipping_weight']),
      collections: jsonParsed['Collections'],
      sellerPincode: getVal(['Seller Pincode', 'seller_pincode']),
      createdDate: parseDate(['Created Date', 'created_date']),
      updatedDate: parseDate(['Updated Date', 'updated_date']),
      productOptions: jsonParsed['Product Options'],
      additionalInfoSections: jsonParsed['additionalInfoSections'],
      activeAd: parseBool(['Active Ad', 'active_ad']),
      averageCpc: parseNum(['Average CPC', 'average_cpc']),
      priorityScore: getVal(['Priority Score', 'priority_score']),
      campaignId: getVal(['Campaign ID', 'campaign_id']),
      reach: parseIntVal(['Reach', 'reach']) ?? 0,
      impression: parseIntVal(['Impression', 'impression']) ?? 0,
      clicks: parseIntVal(['Clicks', 'clicks']) ?? 0,
      sales: parseIntVal(['Sales', 'sales']) ?? 0,
      revenue: parseNum(['Revenue', 'revenue']) ?? 0,
      categoryName: jsonParsed['Category Name'],
      sku: getVal(['SKU', 'sku']),
      productType: getVal(['Product Type', 'product_type']),
      manageVariants: parseBool(['Manage Variants', 'manage_variants']),
      ribbon: getVal(['Ribbon', 'ribbon']),
      trackInventory: parseBool(['Track Inventory', 'track_inventory']),
      influencerBranding: parseBool(['Influencer Branding', 'influencer_branding']),
      haatzaVerified: parseBool(['Haatza Verified', 'haatza_verified']),
      promotionPhotos: jsonParsed['Promotion Photos'],
      paymentType: getVal(['Payment Type', 'payment_type']),
      productReturn: getVal(['Product Return', 'product_return']),
      sizeChart: getVal(['Size Chart', 'size_chart']),
      description: getVal(['Description', 'description']),
      gstSeller: parseBool(['GST Seller', 'gst_seller']),
      upiPaymentDiscount: parseNum(['UPI Payment Discount', 'upi_payment_discount']),
      manageListingProducts: getVal(['Manage Listing Products', 'manage_listing_products']),
      sellAndEarnCommission: parseNum(['Sell and Earn Commission', 'sell_and_earn_commission']),
      sellAndEarn: parseBool(['Sell and Earn', 'sell_and_earn']),
    };

    return { record, error: null };
  }

  private parseCsvLines(csvText: string): string[][] {
    const result: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          field += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(field);
        field = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n
        }
        row.push(field);
        result.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }

    if (field || row.length > 0) {
      row.push(field);
      result.push(row);
    }

    return result;
  }
}
