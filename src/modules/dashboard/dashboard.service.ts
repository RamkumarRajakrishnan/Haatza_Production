import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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

    let parsed = rawItem;
    if (typeof rawItem === 'string') {
      const trimmed = rawItem.trim();
      if (!trimmed) return [];
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return [trimmed];
      }
    }

    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      for (const k of Object.keys(parsed)) {
        if (Array.isArray(parsed[k])) {
          return this.formatProductArray(parsed[k]);
        }
      }
    }

    if (Array.isArray(parsed)) {
      const unwrapped: any[] = [];
      for (const el of parsed) {
        if (typeof el === 'object' && el !== null) {
          if (Array.isArray(el.items)) {
            unwrapped.push(...this.formatProductArray(el.items));
          } else if (el.Lite_Shopbycategory || el.shopbycategory) {
            unwrapped.push(...this.formatProductArray(el.Lite_Shopbycategory || el.shopbycategory));
          } else {
            unwrapped.push(el);
          }
        } else {
          unwrapped.push(el);
        }
      }
      return unwrapped;
    }

    return [parsed];
  }

  /**
   * Get Dashboard Widgets dynamically for ANY widget type in the database.
   * - HAATZA module: categoryId is COMPULSORY, warehouseId is OPTIONAL.
   * - LITE module: categoryId is COMPULSORY, warehouseId is COMPULSORY.
   */
  async getHaatzaDashboard(dto: GetHaatzaDashboardDto) {
    const { categoryId, warehouseId } = dto;

    if (!dto.module) {
      throw new BadRequestException('module is mandatory (HAATZA or LITE).');
    }

    const targetModule = String(dto.module).toUpperCase() as DashboardModule;

    // VALIDATION: categoryId is COMPULSORY for both HAATZA and LITE modules
    if (!categoryId?.trim()) {
      throw new BadRequestException(`categoryId is mandatory for ${targetModule} module.`);
    }

    // VALIDATION: warehouseId is COMPULSORY for LITE module
    if (targetModule === DashboardModule.LITE && !warehouseId?.trim()) {
      throw new BadRequestException('warehouseId is mandatory for LITE module.');
    }

    const whereCondition: any = { module: targetModule };
    if (categoryId?.trim()) whereCondition.categoryId = categoryId.trim();
    if (warehouseId?.trim()) whereCondition.warehouseId = warehouseId.trim();

    const items = await this.db.dashboard.findMany({
      where: whereCondition,
      orderBy: { sequence: 'asc' },
      select: {
        id: true,
        widgetType: true,
        widgetId: true,
        title: true,
        status: true,
        sequence: true,
        categoryId: true,
        categoryName: true,
        item: true,
        warehouseId: true,
        module: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const resultWidgets: Array<{
      widgetType: string;
      widget_Id: string;
      sequence: number;
      title: string;
      item: any[];
    }> = [];

    items.forEach((item) => {
      const widgetType = item.widgetType;
      if (!widgetType) return;

      const widget_Id = item.widgetId || (item as any).widget_id || item.id;
      const sequence = item.sequence ?? 0;
      const rawProductArray = this.formatProductArray(item.item);
      const itemFieldAny = item.item as any;
      const title =
        item.title ||
        (Array.isArray(itemFieldAny) && itemFieldAny[0]?.title) ||
        (Array.isArray(itemFieldAny) && itemFieldAny[0]?.Title) ||
        '';

      const itemAny = item as any;
      const mediaUrl = this.formatImageUrl(itemAny.Image);
      const isVideo =
        /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(mediaUrl) || mediaUrl.includes('/video/');

      const lowerKey = widgetType.toLowerCase();

      let formattedItems: any[] = [];

      if (lowerKey === 'seasonal_picks') {
        const catEntry: any = {
          categoryId: item.categoryId || '',
          categoryName: item.categoryName || '',
          subcategory: [],
        };

        if (rawProductArray.length > 0) {
          for (const storedItem of rawProductArray) {
            if (typeof storedItem === 'object' && storedItem !== null) {
              catEntry.subcategory.push(storedItem);
            } else {
              catEntry.subcategory.push({
                Image: mediaUrl,
              });
            }
          }
        } else {
          catEntry.subcategory.push({
            Image: mediaUrl,
          });
        }
        formattedItems = [catEntry];
      } else if (rawProductArray.length > 0) {
        for (const storedItem of rawProductArray) {
          if (typeof storedItem === 'object' && storedItem !== null) {
            formattedItems.push(storedItem);
          } else {
            formattedItems.push({
              Image: mediaUrl,
              categoryId: item.categoryId || '',
              categoryName: item.categoryName || '',
              Item: rawProductArray,
            });
            break;
          }
        }
      } else {
        if (lowerKey === 'special_offers') {
          formattedItems.push({
            image: isVideo ? '' : mediaUrl,
            Title: item.title || '',
          });
        } else if (
          ['hero_banner', 'bank_offers', 'new_arrival', 'flash_sales', 'mega_offer'].includes(
            lowerKey,
          )
        ) {
          formattedItems.push({
            banner_image: mediaUrl,
            category_id: item.categoryId || '',
          });
        } else {
          formattedItems.push({
            Image: mediaUrl,
            categoryId: item.categoryId || '',
            categoryName: item.categoryName || '',
          });
        }
      }

      resultWidgets.push({
        widgetType:
          lowerKey === 'shopbycategory' || lowerKey === 'shop_by_category'
            ? 'Lite_Shopbycategory'
            : widgetType,
        widget_Id,
        sequence,
        title,
        item: formattedItems,
      });
    });

    // Ensure strict sequence ordering (1, 2, 3...)
    resultWidgets.sort((a, b) => a.sequence - b.sequence);

    return {
      status: 'success',
      message: {
        warehouseId: warehouseId || '',
        module: targetModule,
        data: resultWidgets,
      },
    };
  }

  /**
   * Bulk or single upsert of dashboard widgets.
   * Automatically generates sequential unique widget IDs (WID001, WID002, WID003...) if not provided.
   */
  async upsertWidgets(widgetsPayload: any) {
    const list = Array.isArray(widgetsPayload) ? widgetsPayload : [widgetsPayload];
    const results: any[] = [];

    // Query max numerical suffix from existing 'WIDxxx' widget IDs
    const existingWidRecords = await this.db.dashboard.findMany({
      where: { widgetId: { startsWith: 'WID' } },
      select: { widgetId: true },
    });
    let maxWidNum = 0;
    existingWidRecords.forEach((rec) => {
      const match = rec.widgetId.match(/^WID(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxWidNum) {
          maxWidNum = num;
        }
      }
    });

    for (const w of list) {
      let widgetId = w.widgetId || w.widget_id || w.widget_Id;
      if (!widgetId?.trim()) {
        maxWidNum++;
        widgetId = `WID${String(maxWidNum).padStart(3, '0')}`;
      }
      const rawItem = w.items ?? w.Items ?? w.item ?? w.Item ?? w.product ?? w.widgetProducts ?? null;
      const parsedItemArray = this.formatProductArray(rawItem);

      const data: any = {
        widgetType: w.widgetType || w.widget_type || 'hero_banner',
        title: w.title ?? w.Title ?? null,
        status: w.status || 'ACTIVE',
        sequence: Number(w.sequence) || 1,
        categoryId: w.categoryId ?? w.category_id ?? crypto.randomUUID(),
        categoryName: w.categoryName ?? null,
        item: parsedItemArray,
        warehouseId: w.warehouseId ?? null,
        module: w.module || 'HAATZA',
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

  /**
   * Delete widget by widgetId or database ID cleanly from current DB.
   */
  async deleteWidget(idOrWidgetId: string) {
    if (!idOrWidgetId?.trim()) {
      throw new BadRequestException('Widget identifier (id or widgetId) is required.');
    }

    const trimmedId = idOrWidgetId.trim();

    // Check if record exists by widgetId or id
    const existing = await this.db.dashboard.findFirst({
      where: {
        OR: [{ widgetId: trimmedId }, { id: trimmedId }],
      },
      select: {
        id: true,
        widgetId: true,
      },
    });

    if (!existing) {
      throw new BadRequestException(`Widget with id/widgetId '${trimmedId}' not found.`);
    }

    await this.db.dashboard.delete({
      where: { id: existing.id },
    });

    return {
      status: 'success',
      message: `Widget '${trimmedId}' successfully deleted from database.`,
      data: { id: existing.id, widgetId: existing.widgetId },
    };
  }
}
