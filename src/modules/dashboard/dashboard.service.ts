import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { GetHaatzaDashboardDto } from './dto/get-haatza-dashboard.dto';
import { DashboardModule } from '@prisma/client';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly db: DatabaseService) { }

  /** Safe image/media URL formatter */
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

  /** Helper to safely parse and normalize product / item field to guaranteed array format */
  private formatProductArray(rawItem: any): any[] {
    if (!rawItem) return [];
    if (Array.isArray(rawItem)) return rawItem;
    if (typeof rawItem === 'string') {
      const trimmed = rawItem.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [trimmed];
      }
    }
    return [rawItem];
  }

  /**
   * Get Dashboard Widgets dynamically for ANY widget type in the database.
   * Works for both HAATZA and LITE modules without static restrictions.
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

      const mediaUrl = this.formatImageUrl(item.image);
      const isVideo =
        /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(mediaUrl) || mediaUrl.includes('/video/');

      const rawKey = widgetType;
      const lowerKey = widgetType.toLowerCase();

      // Determine output widget group key name
      let widgetKey = rawKey;
      if (lowerKey === 'shopbycategory' || lowerKey === 'shop_by_category') {
        widgetKey = targetModule === DashboardModule.LITE ? 'Lite_Shopbycategory' : 'Shopbycategory';
      }

      // Initialize group header with full metadata (widgetsequence, title, titleimage, theme, see_more)
      if (!groupedData[widgetKey]) {
        groupedData[widgetKey] = {
          widgetsequence: item.sequence || 0,
          title: item.title || '',
          titleimage: this.formatImageUrl(item.titleImage) || '',
          theme: item.subtitle || '',
          see_more: true,
          items: [],
        };
      }

      let row: any;

      if (lowerKey === 'seasonal_picks') {
        let catEntry = groupedData[widgetKey].items.find(
          (c: any) => c.categoryId === (item.categoryId || ''),
        );
        if (!catEntry) {
          catEntry = {
            categoryId: item.categoryId || '',
            categoryName: item.categoryName || '',
            subcategory: [],
          };
          groupedData[widgetKey].items.push(catEntry);
        }

        catEntry.subcategory.push({
          Image: mediaUrl,
          productId: '',
          redirect_link: item.redirectLink || '',
          maincategory_id: item.mainCategoryId || '',
          subcategory_id: item.subCategoryId || '',
        });
        return;
      }

      if (lowerKey === 'special_offers') {
        row = {
          image: isVideo ? '' : mediaUrl,
          video: isVideo ? mediaUrl : '',
          Title: item.title || '',
          'Sub title': item.subtitle || '',
          product_id: '',
          'External Link': item.redirectLink || '',
        };
      } else if (
        ['hero_banner', 'bank_offers', 'new_arrival', 'flash_sales', 'mega_offer'].includes(lowerKey)
      ) {
        row = {
          banner_image: mediaUrl,
          redirect_link: item.redirectLink || '',
          category_id: item.categoryId || '',
          product_id: '',
          maincategory_id: item.mainCategoryId || '',
          subcategory_id: item.subCategoryId || '',
        };
      } else {
        // shopbycategory, trending_now, best_sellers, deals_zone, featured_products, super_sales, haatza_special, best_rated, must_have, top_categories
        row = {
          Image: mediaUrl,
          categoryId: item.categoryId || '',
          productId: '',
          categoryName: item.categoryName || '',
          redirect_link: item.redirectLink || '',
          maincategory_id: item.mainCategoryId || '',
          subcategory_id: item.subCategoryId || '',
        };
      }

      groupedData[widgetKey].items.push(row);
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
      const rawItem = w.items ?? w.Items ?? w.item ?? w.Item ?? w.product ?? w.widgetProducts ?? null;
      const parsedItemArray = this.formatProductArray(rawItem);

      const data: any = {
        widgetType: w.widgetType || 'hero_banner',
        title: w.title ?? w.Title ?? null,
        subtitle: w.subtitle ?? w.theme ?? w['Sub title'] ?? null,
        status: w.status || 'ACTIVE',
        sequence: Number(w.sequence) || 1,
        image: w.image ?? w.Image ?? w.banner_image ?? w.backgroundImage ?? null,
        redirectLink:
          w.redirectLink ??
          w.redirect_link ??
          w.Redrict_link ??
          w.redrict_link ??
          w.page ??
          w['External Link'] ??
          null,
        categoryId: w.categoryId ?? w.category_id ?? crypto.randomUUID(),
        categoryName: w.categoryName ?? null,
        item: parsedItemArray,
        price: w.price ? Number(w.price) : null,
        discount: w.discount ? Number(w.discount) : null,
        mainCategoryId:
          w.mainCategoryId ??
          w.maincategory_id ??
          w.mailcategory_id ??
          crypto.randomUUID(),
        subCategoryId: w.subCategoryId ?? w.subcategory_id ?? crypto.randomUUID(),
        warehouseId: w.warehouseId ?? null,
        module: w.module || 'HAATZA',
        titleImage: w.titleImage ?? w.titleimage ?? null,
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
