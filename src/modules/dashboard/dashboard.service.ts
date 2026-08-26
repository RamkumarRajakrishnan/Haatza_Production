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
          } else if (el.Lite_Shopbycategory || el.shopbycategory || el.shop_by_category) {
            unwrapped.push(...this.formatProductArray(el.Lite_Shopbycategory || el.shopbycategory || el.shop_by_category));
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
    const categoryId = dto.category?.trim() || dto.categoryId?.trim();
    const warehouseId = dto.warehouseId?.trim();

    if (!dto.module) {
      throw new BadRequestException('module is mandatory (HAATZA or LITE).');
    }

    const targetModule = String(dto.module).toUpperCase() as DashboardModule;

    // VALIDATION: category/categoryId is COMPULSORY for both HAATZA and LITE modules
    if (!categoryId) {
      throw new BadRequestException(`category (or categoryId) is mandatory for ${targetModule} module.`);
    }

    // VALIDATION: warehouseId is COMPULSORY for LITE module
    if (targetModule === DashboardModule.LITE && !warehouseId) {
      throw new BadRequestException('warehouseId is mandatory for LITE module.');
    }

    const queryParams: any[] = [targetModule];
    let sql = `SELECT id, widget_type AS "widgetType", widget_id AS "widgetId", title, status, sequence, category_id AS "categoryId", category_name AS "categoryName", "Item" AS item, warehouse_id AS "warehouseId", module, created_at AS "createdAt", updated_at AS "updatedAt", expires_at AS "expiresAt" 
               FROM public.dashboard 
               WHERE module::text = $1
                 AND (LOWER(TRIM(status)) = 'active' OR status IS NULL OR status = 'TRUE' OR status = 'true')
                 /* AND (expires_at IS NULL OR expires_at > NOW()) */`;

    if (categoryId) {
      queryParams.push(categoryId);
      sql += ` AND (LOWER(TRIM(category_id)) = LOWER(TRIM($${queryParams.length})) OR LOWER(TRIM(category_id)) = 'all')`;
    }
    if (warehouseId) {
      queryParams.push(warehouseId);
      sql += ` AND (LOWER(TRIM(warehouse_id)) = LOWER(TRIM($${queryParams.length})) OR warehouse_id IS NULL OR TRIM(warehouse_id) = '' OR LOWER(TRIM(warehouse_id)) = 'all')`;
    }
    sql += ` ORDER BY sequence ASC`;

    const items = await this.db.queryRawDashboard(sql, queryParams);

    const resultWidgets: Array<{
      widgetType: string;
      widget_Id: string;
      sequence: number;
      title: string;
      expiresAt?: Date | string | null;
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
      const mediaUrl = this.formatImageUrl(itemAny.Image || (Array.isArray(rawProductArray) && rawProductArray[0]?.banner_image) || (Array.isArray(rawProductArray) && rawProductArray[0]?.Image));
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
        widgetType: widgetType,
        widget_Id,
        sequence,
        title,
        expiresAt: item.expiresAt || null,
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
    const existingWidRecords = await this.db.queryRawDashboard(
      `SELECT widget_id AS "widgetId" FROM public.dashboard WHERE widget_id LIKE 'WID%'`
    );
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

      let expiresAtDate: Date | null = null;
      const rawExpires = w.expiresAt ?? w.expires_at ?? w.ExpireAt ?? w.expire_at;
      if (rawExpires) {
        expiresAtDate = new Date(rawExpires);
      } else {
        // Default to 10 days after creation if not provided
        expiresAtDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      }

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
        expiresAt: expiresAtDate,
      };

      const existingRec = await this.db.queryRawDashboard(
        `SELECT id FROM public.dashboard WHERE widget_id = $1 AND module = $2 LIMIT 1`,
        [widgetId, data.module]
      );

      let record: any;
      if (existingRec && existingRec.length > 0) {
        const updateRes = await this.db.queryRawDashboard(
          `UPDATE public.dashboard SET widget_type = $1, title = $2, status = $3, sequence = $4, category_id = $5, category_name = $6, "Item" = $7, warehouse_id = $8, module = $9, expires_at = $10, updated_at = NOW() WHERE id = $11 RETURNING id, widget_type AS "widgetType", widget_id AS "widgetId", title, status, sequence, category_id AS "categoryId", category_name AS "categoryName", "Item" AS item, warehouse_id AS "warehouseId", module, created_at AS "createdAt", updated_at AS "updatedAt", expires_at AS "expiresAt"`,
          [
            data.widgetType,
            data.title,
            data.status,
            data.sequence,
            data.categoryId,
            data.categoryName,
            JSON.stringify(data.item),
            data.warehouseId,
            data.module,
            data.expiresAt,
            existingRec[0].id,
          ]
        );
        record = updateRes[0];
      } else {
        const insertRes = await this.db.queryRawDashboard(
          `INSERT INTO public.dashboard (widget_type, title, status, sequence, category_id, category_name, "Item", warehouse_id, module, expires_at, widget_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, widget_type AS "widgetType", widget_id AS "widgetId", title, status, sequence, category_id AS "categoryId", category_name AS "categoryName", "Item" AS item, warehouse_id AS "warehouseId", module, created_at AS "createdAt", updated_at AS "updatedAt", expires_at AS "expiresAt"`,
          [
            data.widgetType,
            data.title,
            data.status,
            data.sequence,
            data.categoryId,
            data.categoryName,
            JSON.stringify(data.item),
            data.warehouseId,
            data.module,
            data.expiresAt,
            widgetId,
          ]
        );
        record = insertRes[0];
      }
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

    // Check if record exists by widgetId or id via raw SQL
    const records = await this.db.queryRawDashboard(
      `SELECT id, widget_id AS "widgetId" FROM public.dashboard WHERE widget_id = $1 OR id = $1 LIMIT 1`,
      [trimmedId]
    );

    const existing = records[0];

    if (!existing) {
      throw new BadRequestException(`Widget with id/widgetId '${trimmedId}' not found.`);
    }

    await this.db.executePoolQuery(
      `DELETE FROM public.dashboard WHERE id = $1`,
      [existing.id]
    );

    return {
      status: 'success',
      message: `Widget '${trimmedId}' successfully deleted from database.`,
      data: { id: existing.id, widgetId: existing.widgetId },
    };
  }
}
