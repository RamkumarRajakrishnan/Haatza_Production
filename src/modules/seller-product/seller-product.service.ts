import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateSellerProductDto, UpdateSellerProductDto, FilterSellerProductDto } from './dto/seller-product.dto';

@Injectable()
export class SellerProductService {
  private readonly logger = new Logger(SellerProductService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateSellerProductDto) {
    return this.db.sellerProduct.create({
      data: dto as any,
    });
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
      data: items,
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
    return product;
  }

  async update(id: string, dto: UpdateSellerProductDto) {
    await this.findOne(id);
    return this.db.sellerProduct.update({
      where: { id },
      data: dto as any,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.db.sellerProduct.delete({
      where: { id },
    });
  }

  /**
   * Reusable CSV Import Service for Wix Export Data
   */
  async importCsvContent(csvString: string) {
    this.logger.log('Starting CSV product import process...');
    const lines = this.parseCsvLines(csvString);
    if (lines.length < 2) {
      throw new BadRequestException('CSV file must contain a header row and at least one data row');
    }

    const headers = lines[0].map((h) => h.trim().toLowerCase());
    const dataRows = lines.slice(1);

    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 2;
      const row = dataRows[i];

      if (row.length === 0 || (row.length === 1 && !row[0].trim())) {
        continue; // skip empty lines
      }

      try {
        const record = this.mapRowToRecord(headers, row);
        if (!record.name) {
          throw new Error('Missing required column: "name"');
        }

        // Upsert based on Product ID or SKU if present, otherwise create new
        if (record.id) {
          await this.db.sellerProduct.upsert({
            where: { id: record.id },
            update: record,
            create: record,
          });
        } else {
          await this.db.sellerProduct.create({
            data: record,
          });
        }

        successCount++;
      } catch (err: any) {
        failedCount++;
        errors.push({ row: rowNum, error: err.message || String(err) });
        this.logger.warn(`Failed to import row ${rowNum}: ${err.message}`);
      }
    }

    this.logger.log(`Import completed. Success: ${successCount}, Failed: ${failedCount}`);

    return {
      success: true,
      message: 'CSV Import process completed',
      stats: {
        totalRows: dataRows.length,
        successCount,
        failedCount,
      },
      errors,
    };
  }

  private mapRowToRecord(headers: string[], row: string[]): any {
    const getVal = (colName: string): string | null => {
      const idx = headers.indexOf(colName.toLowerCase());
      if (idx === -1 || idx >= row.length) return null;
      const val = row[idx].trim();
      return val === '' ? null : val;
    };

    const parseJson = (colName: string): any => {
      const val = getVal(colName);
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch {
        return val; // fallback if string
      }
    };

    const parseBool = (colName: string): boolean | null => {
      const val = getVal(colName);
      if (val === null) return null;
      const lower = val.toLowerCase();
      return lower === 'true' || lower === '1' || lower === 'yes';
    };

    const parseNum = (colName: string): number | null => {
      const val = getVal(colName);
      if (val === null) return null;
      const num = parseFloat(val.replace(/,/g, ''));
      return isNaN(num) ? null : num;
    };

    const parseIntVal = (colName: string): number | null => {
      const val = getVal(colName);
      if (val === null) return null;
      const num = parseInt(val.replace(/,/g, ''), 10);
      return isNaN(num) ? null : num;
    };

    const parseDate = (colName: string): Date | null => {
      const val = getVal(colName);
      if (!val) return null;
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    };

    return {
      id: getVal('id') || undefined,
      mainMedia: getVal('main_media'),
      oneRsStore: parseBool('one_rs_store') ?? false,
      productImages: parseJson('product_images'),
      name: getVal('name') || getVal('title') || 'Untitled Product',
      searchKeywords: parseJson('search_keywords'),
      subCategory: getVal('sub_category'),
      subCategoryId: getVal('sub_category_id') || undefined,
      brand: getVal('brand'),
      inventory: parseIntVal('inventory'),
      variantPrice: parseJson('variant_price'),
      productId: getVal('product_id'),
      newVariantPrice: parseNum('new_variant_price'),
      mrp: parseNum('mrp'),
      onsalePrice: parseNum('onsale_price'),
      cod: parseBool('cod'),
      upi: parseBool('upi'),
      price: parseNum('price'),
      discount: parseJson('discount'),
      status: getVal('status') || 'ACTIVE',
      deliveryCharges: parseBool('delivery_charges'),
      mainCategory: getVal('main_category'),
      sellerId: getVal('seller_id') || undefined,
      shippingWeight: parseNum('shipping_weight'),
      collections: parseJson('collections'),
      sellerPincode: getVal('seller_pincode'),
      createdDate: parseDate('created_date'),
      updatedDate: parseDate('updated_date'),
      productOptions: parseJson('product_options'),
      additionalInfoSections: parseJson('additional_info_sections'),
      activeAd: parseBool('active_ad'),
      averageCpc: parseNum('average_cpc'),
      priorityScore: getVal('priority_score'),
      campaignId: getVal('campaign_id'),
      reach: parseIntVal('reach') ?? 0,
      impression: parseIntVal('impression') ?? 0,
      clicks: parseIntVal('clicks') ?? 0,
      sales: parseIntVal('sales') ?? 0,
      revenue: parseNum('revenue') ?? 0,
      categoryName: parseJson('category_name'),
      sku: getVal('sku'),
      productType: getVal('product_type'),
      manageVariants: parseBool('manage_variants'),
      ribbon: getVal('ribbon'),
      trackInventory: parseBool('track_inventory'),
      influencerBranding: parseBool('influencer_branding'),
      haatzaVerified: parseBool('haatza_verified'),
      promotionPhotos: parseJson('promotion_photos'),
      paymentType: getVal('payment_type'),
      productReturn: getVal('product_return'),
      sizeChart: getVal('size_chart'),
      description: getVal('description'),
      gstSeller: parseBool('gst_seller'),
      upiPaymentDiscount: parseNum('upi_payment_discount'),
      manageListingProducts: getVal('manage_listing_products'),
      sellAndEarnCommission: parseNum('sell_and_earn_commission'),
      sellAndEarn: parseBool('sell_and_earn'),
    };
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
