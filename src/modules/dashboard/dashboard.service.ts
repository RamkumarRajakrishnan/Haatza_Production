import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { GetHaatzaDashboardDto } from './dto/get-haatza-dashboard.dto';
import { DashboardModule } from '@prisma/client';

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

  /**
   * Helper to ensure image URLs are valid direct public URLs
   */
  private formatImageUrl(url: string | null | undefined): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('wix:image://v1/')) {
      const parts = trimmed.replace('wix:image://v1/', '').split('/');
      const mediaId = parts[0];
      return `https://static.wixstatic.com/media/${mediaId}`;
    }
    if (trimmed.startsWith('/') || trimmed.startsWith('uploads/')) {
      const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
      const baseUrl =
        process.env.APP_URL ||
        process.env.BASE_DOMAIN ||
        'https://haatza-production-807150947524.asia-south1.run.app';
      return `${baseUrl.replace(/\/$/, '')}${path}`;
    }
    return `https://static.wixstatic.com/media/${trimmed}`;
  }

  /**
   * Helper to safely parse JSON widgetProducts
   */
  private parseWidgetProducts(productData: any): any[] {
    if (!productData) return [];
    if (Array.isArray(productData)) return productData;
    if (typeof productData === 'string') {
      try {
        return JSON.parse(productData);
      } catch (err) {
        this.logger.warn(`Failed to parse widgetProducts JSON: ${err?.message}`);
        return [];
      }
    }
    return [];
  }

  /**
   * Get HAATZA Dashboard Widgets grouped by Widget Type matching reference format
   */
  async getHaatzaDashboard(dto: GetHaatzaDashboardDto) {
    const { categoryId, warehouseId } = dto;
    const targetModule = dto.module
      ? (String(dto.module).toUpperCase() as DashboardModule)
      : DashboardModule.HAATZA;

    const whereCondition: any = {
      module: targetModule,
    };

    if (categoryId && categoryId.trim() !== '') {
      whereCondition.categoryId = categoryId.trim();
    }

    if (warehouseId && warehouseId.trim() !== '') {
      whereCondition.warehouseId = warehouseId.trim();
    }

    const items = await this.db.dashboard.findMany({
      where: whereCondition,
      orderBy: {
        sequence: 'asc',
      },
    });

    const groupedData: Record<
      string,
      {
        widgetsequence: number;
        title?: string;
        titleimage?: string;
        theme?: string;
        see_more?: boolean;
        items: any[];
      }
    > = {};

    items.forEach((item) => {
      const widgetType = item.widgetType || 'Others';

      if (!groupedData[widgetType]) {
        const header: any = {
          widgetsequence: item.sequence || 0,
        };

        if (['super_sales', 'featured_products', 'haatza_special'].includes(widgetType)) {
          if (item.titleImage) header.titleimage = this.formatImageUrl(item.titleImage);
          if (item.subtitle) header.theme = item.subtitle;
          header.see_more = item.status === 'TRUE' || item.status === 'ACTIVE';
        }

        header.items = [];
        groupedData[widgetType] = header;
      }

      let row: any = {};

      switch (widgetType) {
        case 'Lite_hero_banner':
        case 'hero_banner':
        case 'Haatza_hero_banner':
        case 'Lite_heroBanner':
        case 'heroBanner':
        case 'Haatza_heroBanner':
          row = {
            banner_image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            Redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            category_id: item.categoryId || '',
            categoryId: item.categoryId || '',
            product_id: item.productId || '',
            productId: item.productId || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'Lite_Promobanner':
        case 'Promobanner':
        case 'Haatza_Promobanner':
          row = {
            backgroundImage: this.formatImageUrl(item.image),
            banner_image: this.formatImageUrl(item.image),
            page: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            categoryId: item.categoryId || '',
            category_id: item.categoryId || '',
          };
          break;

        case 'Lite_Shopbycategory':
        case 'Shopbycategory':
        case 'Haatza_Shopbycategory':
        case 'shop_by_category':
          row = {
            title: item.title || '',
            Image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            categoryId: item.categoryId || '',
            productId: item.productId || '',
            categoryName: item.categoryName || '',
            redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'trending_now':
        case 'trendingNow':
        case 'Lite_trending_now':
        case 'Haatza_trending_now':
          row = {
            title: item.title || '',
            Image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            categoryId: item.categoryId || '',
            productId: item.productId || '',
            categoryName: item.categoryName || '',
            redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'bank_offers':
        case 'bankOffers':
        case 'Lite_bank_offers':
        case 'Haatza_bank_offers':
          row = {
            banner_image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            Redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            category_id: item.categoryId || '',
            categoryId: item.categoryId || '',
            product_id: item.productId || '',
            productId: item.productId || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'best_sellers':
        case 'bestSellers':
        case 'Lite_best_sellers':
        case 'Haatza_best_sellers':
          row = {
            title: item.title || '',
            Image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            categoryId: item.categoryId || '',
            productId: item.productId || '',
            categoryName: item.categoryName || '',
            redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'new_arrival':
        case 'newArrival':
        case 'new_arrivals':
        case 'Lite_new_arrival':
        case 'Haatza_new_arrival':
          row = {
            banner_image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            Redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            category_id: item.categoryId || '',
            categoryId: item.categoryId || '',
            product_id: item.productId || '',
            productId: item.productId || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'super_sales':
        case 'superSales':
        case 'Lite_super_sales':
        case 'Haatza_super_sales':
          row = {
            title: item.title || '',
            Image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            productId: item.productId || '',
            categoryName: item.categoryName || '',
            redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'flash_sales':
        case 'flashSales':
        case 'Lite_flash_sales':
        case 'Haatza_flash_sales':
          row = {
            banner_image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            Redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            category_id: item.categoryId || '',
            categoryId: item.categoryId || '',
            product_id: item.productId || '',
            productId: item.productId || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'deals_zone':
        case 'dealsZone':
        case 'Lite_deals_zone':
        case 'Haatza_deals_zone':
          row = {
            title: item.title || '',
            Image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            categoryId: item.categoryId || '',
            productId: item.productId || '',
            categoryName: item.categoryName || '',
            redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'featured_products':
        case 'featuredProducts':
        case 'Lite_featured_products':
        case 'Haatza_featured_products':
          row = {
            title: item.title || '',
            Image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            productId: item.productId || '',
            categoryName: item.categoryName || '',
            redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'mega_offer':
        case 'megaOffer':
        case 'Lite_mega_offer':
        case 'Haatza_mega_offer':
          row = {
            banner_image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            Redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            category_id: item.categoryId || '',
            categoryId: item.categoryId || '',
            product_id: item.productId || '',
            productId: item.productId || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'haatza_special':
        case 'haatzaSpecial':
        case 'Lite_haatza_special':
        case 'Haatza_haatza_special':
          row = {
            title: item.title || '',
            Image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            productId: item.productId || '',
            categoryName: item.categoryName || '',
            redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'best_rated':
        case 'bestRated':
        case 'Lite_best_rated':
        case 'Haatza_best_rated':
          row = {
            title: item.title || '',
            Image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            categoryId: item.categoryId || '',
            productId: item.productId || '',
            categoryName: item.categoryName || '',
            redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'special_offers':
        case 'specialOffers':
        case 'Lite_special_offers':
        case 'Haatza_special_offers':
          row = {
            image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            Title: item.title || '',
            'Sub title': item.subtitle || '',
            product_id: item.productId || '',
            productId: item.productId || '',
            'External Link': item.redirectLink || '',
            external_link: item.redirectLink || '',
            page: item.redirectLink || '',
          };
          break;

        case 'must_have':
        case 'mustHave':
        case 'Lite_must_have':
        case 'Haatza_must_have':
          row = {
            title: item.title || '',
            Image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            categoryId: item.categoryId || '',
            productId: item.productId || '',
            categoryName: item.categoryName || '',
            redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'seasonal_picks':
        case 'seasonalPicks':
        case 'Lite_seasonal_picks':
        case 'Haatza_seasonal_picks':
          row = {
            categoryId: item.categoryId || '',
            categoryName: item.categoryName || '',
            subcategory: [
              {
                Image: this.formatImageUrl(item.image),
                backgroundImage: this.formatImageUrl(item.image),
                productId: item.productId || '',
                redirect_link: item.redirectLink || '',
                page: item.redirectLink || '',
                maincategory_id: item.mainCategoryId || '',
                subcategory_id: item.subCategoryId || '',
              },
            ],
          };
          break;

        case 'top_categories':
        case 'topCategories':
        case 'Lite_top_categories':
        case 'Haatza_top_categories':
          row = {
            title: item.title || '',
            Image: this.formatImageUrl(item.image),
            backgroundImage: this.formatImageUrl(item.image),
            categoryId: item.categoryId || '',
            productId: item.productId || '',
            categoryName: item.categoryName || '',
            redrict_link: item.redirectLink || '',
            redirect_link: item.redirectLink || '',
            page: item.redirectLink || '',
            mailcategory_id: item.mainCategoryId || '',
            subcategory_id: item.subCategoryId || '',
          };
          break;

        case 'Lite_freshmarketSection':
        case 'freshmarketSection':
        case 'Haatza_freshmarketSection':
          row = {
            titleimage: this.formatImageUrl(item.titleImage),
            categoryId: item.categoryId || '',
            widgetProducts: this.parseWidgetProducts(item.product),
            page: item.redirectLink || '',
            widgetbackgroundColor: item.subtitle || '#000080',
            showMore: item.status === 'TRUE' || item.status === 'ACTIVE',
            showMorePage: item.redirectLink || '',
            showMoreButtonColor: '#FFA500',
            textColor: '#FFFFFF',
          };
          break;

        case 'Lite_hurryDeals':
        case 'hurryDeals':
        case 'Haatza_hurryDeals':
          row = {
            title: item.title || '',
            backgroundImage: this.formatImageUrl(item.image),
            categoryId: item.categoryId || '',
            productId: item.productId || '',
            page: item.redirectLink || '',
            placement: item.categoryName || '',
          };
          break;

        default:
          row = {
            widgettitle: item.title || '',
            backgroundImage: this.formatImageUrl(item.image),
            widgetsequence: item.sequence || 0,
          };
      }

      groupedData[widgetType].items.push(row);
    });

    return {
      status: 'success',
      message: {
        categoryId,
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
        create: {
          ...data,
          widgetId,
        },
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
