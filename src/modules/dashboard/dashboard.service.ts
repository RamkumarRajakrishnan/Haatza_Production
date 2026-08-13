import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { GetHaatzaDashboardDto } from './dto/get-haatza-dashboard.dto';
import { DashboardModule } from '@prisma/client';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly db: DatabaseService) {}

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

      // Initialize group header dynamically for any widgetType
      if (!groupedData[widgetType]) {
        groupedData[widgetType] = {
          widgetsequence: item.sequence || 0,
          title: item.title || '',
          titleimage: this.formatImageUrl(item.titleImage),
          theme: item.subtitle || '',
          see_more: item.status === 'ACTIVE' || item.status === 'TRUE',
          items: [],
        };
      }

      const mediaUrl = this.formatImageUrl(item.image);
      const isVideo =
        /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(mediaUrl) || mediaUrl.includes('/video/');

      let row: any;

      // Handle seasonal_picks nested subcategory structure
      if (widgetType.toLowerCase().includes('seasonal')) {
        row = {
          categoryId: item.categoryId || '',
          categoryName: item.categoryName || '',
          subcategory: [
            {
              Image: mediaUrl,
              backgroundImage: mediaUrl,
              productId: item.productId || '',
              redirect_link: item.redirectLink || '',
              page: item.redirectLink || '',
              maincategory_id: item.mainCategoryId || '',
              subcategory_id: item.subCategoryId || '',
            },
          ],
        };
      } else {
        // Universal dynamic mapping for ALL widgets from Dashboard table
        row = {
          // Media fields
          Image: mediaUrl,
          banner_image: mediaUrl,
          backgroundImage: mediaUrl,
          image: isVideo ? '' : mediaUrl,
          video: isVideo ? mediaUrl : '',

          // Titles & Headers
          title: item.title || '',
          Title: item.title || '',
          subtitle: item.subtitle || '',
          'Sub title': item.subtitle || '',

          // Categories & Products
          categoryId: item.categoryId || '',
          category_id: item.categoryId || '',
          categoryName: item.categoryName || '',
          productId: item.productId || '',
          product_id: item.productId || '',
          maincategory_id: item.mainCategoryId || '',
          mainCategoryId: item.mainCategoryId || '',
          subcategory_id: item.subCategoryId || '',
          subCategoryId: item.subCategoryId || '',

          // Links
          redirect_link: item.redirectLink || '',
          'External Link': item.redirectLink || '',
          page: item.redirectLink || '',

          // Price & Priority (if available in DB)
          price: item.price ?? null,
          discount: item.discount ?? null,
          priority: item.priority ?? null,
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
        priority: w.priority ? Number(w.priority) : null,
        productId: w.productId ?? w.product_id ?? crypto.randomUUID(),
        product: w.product ?? (w.widgetProducts ? JSON.stringify(w.widgetProducts) : null),
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
