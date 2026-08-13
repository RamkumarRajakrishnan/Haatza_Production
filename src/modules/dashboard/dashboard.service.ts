import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { GetHaatzaDashboardDto } from './dto/get-haatza-dashboard.dto';
import { DashboardModule } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Widget type constants
// ─────────────────────────────────────────────────────────────────────────────
const BANNER_WIDGETS = new Set([
  'hero_banner', 'bank_offers', 'new_arrival', 'flash_sales', 'mega_offer',
]);
const CATEGORY_WIDGETS = new Set([
  'shop_by_category', 'trending_now', 'best_sellers', 'deals_zone',
  'best_rated', 'must_have', 'top_categories',
]);
const PRODUCT_ONLY_WIDGETS = new Set([
  'super_sales', 'featured_products', 'haatza_special',
]);
const SEASONAL_WIDGETS = new Set(['seasonal_picks']);
const SPECIAL_OFFER_WIDGETS = new Set(['special_offers']);

@Injectable()
export class DashboardService implements OnModuleInit {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    try {
      this.logger.log('🌱 Auto-seeding default Hero Banner if missing...');
      await this.db.dashboard.upsert({
        where: { widgetId: 'hero_banner_widget_01' },
        update: {
          image: 'https://storage.googleapis.com/haatza-media-bucket/products/ca2360b6-d63b-42d2-a7c9-0fd5c9a1d9b1.webp',
        },
        create: {
          widgetType: 'hero_banner',
          widgetId: 'hero_banner_widget_01',
          title: 'Coffee & Charcoal Banner',
          subtitle: 'Powered by Coffee + Charcoal',
          status: 'ACTIVE',
          sequence: 1,
          image: 'https://storage.googleapis.com/haatza-media-bucket/products/ca2360b6-d63b-42d2-a7c9-0fd5c9a1d9b1.webp',
          redirectLink: 'Category Page',
          categoryId: crypto.randomUUID(),
          productId: crypto.randomUUID(),
          mainCategoryId: crypto.randomUUID(),
          subCategoryId: crypto.randomUUID(),
          module: DashboardModule.HAATZA,
        },
      });
      this.logger.log('✅ Default Hero Banner verified/seeded successfully!');
    } catch (err: any) {
      this.logger.warn(`⚠️ Auto-seeding hero banner skipped: ${err?.message}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────────────────────

  /** Return a safe absolute image URL */
  private formatImageUrl(url: string | null | undefined): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('wix:image://v1/')) {
      const mediaId = trimmed.replace('wix:image://v1/', '').split('/')[0];
      return `https://static.wixstatic.com/media/${mediaId}`;
    }
    if (trimmed.startsWith('/') || trimmed.startsWith('uploads/')) {
      const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
      const base =
        process.env.APP_URL ||
        process.env.BASE_DOMAIN ||
        'https://haatza-production-807150947524.asia-south1.run.app';
      return `${base.replace(/\/$/, '')}${path}`;
    }
    return `https://static.wixstatic.com/media/${trimmed}`;
  }

  /** Build a banner item (hero_banner, bank_offers, new_arrival, flash_sales, mega_offer) */
  private buildBannerItem(item: any) {
    return {
      banner_image: this.formatImageUrl(item.image),
      redirect_link: item.redirectLink || '',
      category_id: item.categoryId || '',
      product_id: item.productId || '',
      maincategory_id: item.mainCategoryId || '',
      subcategory_id: item.subCategoryId || '',
    };
  }

  /** Build a category item (shop_by_category, trending_now, best_sellers, deals_zone, best_rated, must_have, top_categories) */
  private buildCategoryItem(item: any) {
    return {
      Image: this.formatImageUrl(item.image),
      categoryId: item.categoryId || '',
      productId: item.productId || '',
      categoryName: item.categoryName || '',
      redirect_link: item.redirectLink || '',
      maincategory_id: item.mainCategoryId || '',
      subcategory_id: item.subCategoryId || '',
    };
  }

  /** Build a product-only item (super_sales, featured_products, haatza_special) */
  private buildProductItem(item: any) {
    return {
      Image: this.formatImageUrl(item.image),
      productId: item.productId || '',
      redirect_link: item.redirectLink || '',
      maincategory_id: item.mainCategoryId || '',
      subcategory_id: item.subCategoryId || '',
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Dashboard Widgets grouped by Widget Type for both HAATZA and LITE modules.
   * Only the 17 defined widget types are included in the response.
   */
  async getHaatzaDashboard(dto: GetHaatzaDashboardDto) {
    const { categoryId, warehouseId } = dto;
    const targetModule = dto.module
      ? (String(dto.module).toUpperCase() as DashboardModule)
      : DashboardModule.HAATZA;

    const whereCondition: any = { module: targetModule };
    if (categoryId?.trim()) whereCondition.categoryId = categoryId.trim();
    if (warehouseId?.trim()) whereCondition.warehouseId = warehouseId.trim();

    const items = await this.db.dashboard.findMany({
      where: whereCondition,
      orderBy: { sequence: 'asc' },
    });

    const groupedData: Record<string, any> = {};

    items.forEach((item) => {
      const widgetType = item.widgetType;
      if (!widgetType) return;

      // Only process the 17 known widget types
      const isKnown =
        BANNER_WIDGETS.has(widgetType) ||
        CATEGORY_WIDGETS.has(widgetType) ||
        PRODUCT_ONLY_WIDGETS.has(widgetType) ||
        SEASONAL_WIDGETS.has(widgetType) ||
        SPECIAL_OFFER_WIDGETS.has(widgetType);

      if (!isKnown) return;

      // ── Initialize group header ──
      if (!groupedData[widgetType]) {
        const header: any = {
          widgetsequence: item.sequence || 0,
          title: item.title || '',
          items: [],
        };

        // Extra header fields for product-only widgets
        if (PRODUCT_ONLY_WIDGETS.has(widgetType)) {
          header.titleimage = this.formatImageUrl(item.titleImage);
          header.theme = item.subtitle || '';
          header.see_more = item.status === 'ACTIVE';
        }

        groupedData[widgetType] = header;
      }

      // ── Build item row ──
      let row: any;

      if (BANNER_WIDGETS.has(widgetType)) {
        row = this.buildBannerItem(item);
      } else if (CATEGORY_WIDGETS.has(widgetType)) {
        row = this.buildCategoryItem(item);
      } else if (PRODUCT_ONLY_WIDGETS.has(widgetType)) {
        row = this.buildProductItem(item);
      } else if (SEASONAL_WIDGETS.has(widgetType)) {
        // seasonal_picks — nested subcategory format
        row = {
          categoryId: item.categoryId || '',
          categoryName: item.categoryName || '',
          subcategory: [
            {
              Image: this.formatImageUrl(item.image),
              productId: item.productId || '',
              redirect_link: item.redirectLink || '',
              maincategory_id: item.mainCategoryId || '',
              subcategory_id: item.subCategoryId || '',
            },
          ],
        };
      } else if (SPECIAL_OFFER_WIDGETS.has(widgetType)) {
        // special_offers — image/video media + title + external link format
        const mediaUrl = this.formatImageUrl(item.image);
        const isVideo = /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(mediaUrl) || mediaUrl.includes('/video/');
        row = {
          image: isVideo ? '' : mediaUrl,
          video: isVideo ? mediaUrl : '',
          Title: item.title || '',
          'Sub title': item.subtitle || '',
          product_id: item.productId || '',
          'External Link': item.redirectLink || '',
        };
      }

      groupedData[widgetType].items.push(row);
    });

    return {
      status: 'success',
      message: {
        warehouseId: warehouseId || '',
        module: targetModule,
        data: groupedData,
      },
    };
  }

  /**
   * Bulk or single upsert of dashboard widgets
   */
  async upsertWidgets(widgetsPayload: any) {
    const list = Array.isArray(widgetsPayload) ? widgetsPayload : [widgetsPayload];
    const results: any[] = [];

    for (const w of list) {
      const widgetId = w.widgetId || crypto.randomUUID();
      const data: any = {
        widgetType: w.widgetType || 'hero_banner',
        title: w.title ?? null,
        subtitle: w.subtitle ?? null,
        status: w.status || 'ACTIVE',
        sequence: Number(w.sequence) || 1,
        image: w.image ?? null,
        redirectLink: w.redirectLink ?? null,
        categoryId: w.categoryId || crypto.randomUUID(),
        categoryName: w.categoryName ?? null,
        priority: w.priority ? Number(w.priority) : null,
        productId: w.productId || crypto.randomUUID(),
        product: w.product ?? null,
        price: w.price ? Number(w.price) : null,
        discount: w.discount ? Number(w.discount) : null,
        mainCategoryId: w.mainCategoryId || crypto.randomUUID(),
        subCategoryId: w.subCategoryId || crypto.randomUUID(),
        warehouseId: w.warehouseId ?? null,
        module: w.module || 'HAATZA',
        titleImage: w.titleImage ?? null,
      };

      const record = await this.db.dashboard.upsert({
        where: { widgetId },
        update: data,
        create: { ...data, widgetId },
      });
      results.push(record);
    }

    return {
      success: true,
      message: `Successfully upserted ${results.length} dashboard widget(s)`,
      data: results,
    };
  }
}
