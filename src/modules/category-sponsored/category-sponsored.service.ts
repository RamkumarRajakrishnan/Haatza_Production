import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { GetCategorySponsoredDto } from './dto/get-category-sponsored.dto';
import { DashboardModule } from '@prisma/client';

@Injectable()
export class CategorySponsoredService {
  private readonly logger = new Logger(CategorySponsoredService.name);

  constructor(private readonly db: DatabaseService) {}

  // In-memory cache for upserted widgets fallback when database is offline/unreachable
  private localWidgetsStore: any[] = [];

  /** Filter local in-memory store when database is offline or query returns no records */
  private getFromLocalStore(filter: {
    module: DashboardModule;
    categoryId?: string;
    warehouseId?: string;
    status?: string;
  }): any[] {
    const targetModule = filter.module;
    const catId = (filter.categoryId || '').trim().toLowerCase();
    const whId = (filter.warehouseId || '').trim().toLowerCase();
    const reqStatus = (filter.status || '').trim().toLowerCase();

    return this.localWidgetsStore
      .filter((w) => {
        // Module check
        const mod = String(w.module || '').toUpperCase();
        if (mod !== targetModule) return false;

        // Category check
        const itemCat = String(w.categoryId || '').trim().toLowerCase();
        if (catId && itemCat !== catId && itemCat !== 'all') {
          return false;
        }

        // Warehouse check
        if (whId) {
          const itemWh = String(w.warehouseId || '').trim().toLowerCase();
          if (itemWh && itemWh !== 'all' && itemWh !== whId) {
            return false;
          }
        }

        // Expiration & Status check: strictly determine status based on expiresAt if provided
        let resolvedStatus: string;
        if (w.expiresAt) {
          const expTime = new Date(w.expiresAt).getTime();
          if (!isNaN(expTime)) {
            resolvedStatus = expTime <= Date.now() ? 'INACTIVE' : 'ACTIVE';
          } else {
            resolvedStatus = w.status ? String(w.status).toUpperCase() : 'ACTIVE';
          }
        } else {
          resolvedStatus = w.status ? String(w.status).toUpperCase() : 'ACTIVE';
        }
        const isExpired = resolvedStatus === 'INACTIVE';

        if (reqStatus === 'all') {
          return true;
        }
        if (reqStatus === 'inactive') {
          return resolvedStatus === 'INACTIVE';
        }
        // Default: active only
        return resolvedStatus === 'ACTIVE';
      })
      .map((w) => {
        const isExpired = w.expiresAt && new Date(w.expiresAt).getTime() <= Date.now();
        return {
          ...w,
          status: isExpired
            ? 'INACTIVE'
            : w.status
            ? String(w.status).toUpperCase()
            : 'ACTIVE',
        };
      })
      .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0));
  }

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
            unwrapped.push(
              ...this.formatProductArray(
                el.Lite_Shopbycategory || el.shopbycategory || el.shop_by_category,
              ),
            );
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
   * Get Active and Date-Valid Widgets from category_sponsored table.
   * - HAATZA module: categoryId is compulsory, warehouseId is optional.
   * - LITE module: categoryId is compulsory, warehouseId is compulsory.
   * - Strictly filters active status: status = 'ACTIVE' or status = 'TRUE'
   * - Strictly filters date validity: expires_at IS NULL OR expires_at > NOW()
   * - Returns grouped widgets with categoryId additionally included at response and widget levels.
   */
  async getCategorySponsored(dto: GetCategorySponsoredDto) {
    const categoryId =
      dto.categoryId?.trim() ||
      dto.category?.trim() ||
      dto.category_id?.trim();
    const warehouseId = dto.warehouseId?.trim() || dto.warehouse_id?.trim();
    let rawModule = dto.module || (dto as any).Module;
    if (!rawModule && dto && typeof dto === 'object') {
      const foundKey = Object.keys(dto).find((k) => k.toLowerCase() === 'module');
      if (foundKey) rawModule = (dto as any)[foundKey];
    }

    if (!rawModule) {
      throw new BadRequestException('module is mandatory (HAATZA or LITE).');
    }

    const targetModule = String(rawModule).toUpperCase() as DashboardModule;
    if (targetModule !== DashboardModule.HAATZA && targetModule !== DashboardModule.LITE) {
      throw new BadRequestException('module must be either HAATZA or LITE.');
    }

    // VALIDATION: category/categoryId is COMPULSORY for both HAATZA and LITE modules
    if (!categoryId) {
      throw new BadRequestException(
        `category (or categoryId) is mandatory for ${targetModule} module.`,
      );
    }

    // VALIDATION: warehouseId is COMPULSORY for LITE module
    if (targetModule === DashboardModule.LITE && !warehouseId) {
      throw new BadRequestException('warehouseId is mandatory for LITE module.');
    }

    const reqStatus = dto.status?.trim().toLowerCase();

    const queryParams: any[] = [targetModule];
    let sql = `SELECT id, widget_type AS "widgetType", widget_id AS "widgetId", title, 
                      CASE 
                        WHEN expires_at IS NOT NULL AND expires_at <= NOW() THEN 'INACTIVE'
                        WHEN expires_at IS NOT NULL AND expires_at > NOW() THEN 'ACTIVE'
                        WHEN LOWER(TRIM(status)) = 'inactive' THEN 'INACTIVE'
                        ELSE COALESCE(status, 'ACTIVE')
                      END AS "status",
                      sequence, category_id AS "categoryId", category_name AS "categoryName", "Item" AS item, warehouse_id AS "warehouseId", module, created_at AS "createdAt", updated_at AS "updatedAt", expires_at AS "expiresAt" 
               FROM public.category_sponsored 
               WHERE UPPER(module::text) = $1`;

    if (reqStatus === 'all') {
      // Return both active and inactive/expired widgets
    } else if (reqStatus === 'inactive') {
      sql += ` AND (expires_at <= NOW() OR LOWER(TRIM(status)) = 'inactive')`;
    } else {
      // Default: active and non-expired only
      sql += ` AND (LOWER(TRIM(status)) = 'active' OR status IS NULL OR status = 'TRUE' OR status = 'true')
               AND (expires_at IS NULL OR expires_at > NOW())`;
    }

    if (categoryId) {
      queryParams.push(categoryId);
      sql += ` AND (LOWER(TRIM(category_id)) = LOWER(TRIM($${queryParams.length})) OR LOWER(TRIM(category_id)) = 'all')`;
    }

    if (warehouseId) {
      queryParams.push(warehouseId);
      sql += ` AND (LOWER(TRIM(warehouse_id)) = LOWER(TRIM($${queryParams.length})) OR warehouse_id IS NULL OR TRIM(warehouse_id) = '' OR LOWER(TRIM(warehouse_id)) = 'all')`;
    }

    sql += ` ORDER BY sequence ASC`;

    // Proactively sync expired records in background
    this.syncExpiredStatus().catch(() => {});

    let items: any[] = [];
    try {
      items = await this.db.queryRawCategorySponsored(sql, queryParams);
    } catch (err: any) {
      this.logger.warn(`queryRawCategorySponsored error: ${err.message}`);
      items = [];
    }

    if (!items || items.length === 0) {
      items = this.getFromLocalStore({
        module: targetModule,
        categoryId,
        warehouseId,
        status: reqStatus,
      });
    }

    let matchedCategoryName = '';

    const resultWidgets: Array<{
      id?: string;
      widgetType: string;
      widgetId: string;
      sequence: number;
      title: string;
      status: string;
      categoryId: string;
      categoryName: string;
      warehouseId?: string;
      expiresAt?: Date | string | null;
      item: any[];
    }> = [];

    items.forEach((item) => {
      const widgetType = item.widgetType;
      if (!widgetType) return;

      if (item.categoryName && !matchedCategoryName) {
        matchedCategoryName = item.categoryName;
      }

      const widgetId = item.widgetId || (item as any).widget_id || item.id;
      const sequence = item.sequence ?? 0;
      const rawProductArray = this.formatProductArray(item.item);
      const itemFieldAny = item.item as any;
      const title =
        item.title ||
        (Array.isArray(itemFieldAny) && itemFieldAny[0]?.title) ||
        (Array.isArray(itemFieldAny) && itemFieldAny[0]?.Title) ||
        '';

      const itemAny = item as any;
      const mediaUrl = this.formatImageUrl(
        itemAny.image ||
          itemAny.Image ||
          (Array.isArray(rawProductArray) &&
            (rawProductArray[0]?.bannerImage ||
              rawProductArray[0]?.banner_image ||
              rawProductArray[0]?.image ||
              rawProductArray[0]?.Image)),
      );
      const isVideo =
        /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(mediaUrl) || mediaUrl.includes('/video/');

      const lowerKey = widgetType.toLowerCase();

      let formattedItems: any[] = [];

      if (lowerKey === 'seasonal_picks') {
        const catEntry: any = {
          categoryId: item.categoryId || categoryId || '',
          categoryName: item.categoryName || '',
          subCategory: [],
        };

        if (rawProductArray.length > 0) {
          for (const storedItem of rawProductArray) {
            if (typeof storedItem === 'object' && storedItem !== null) {
              catEntry.subCategory.push(storedItem);
            } else {
              catEntry.subCategory.push({
                image: mediaUrl,
              });
            }
          }
        } else {
          catEntry.subCategory.push({
            image: mediaUrl,
          });
        }
        formattedItems = [catEntry];
      } else if (rawProductArray.length > 0) {
        for (const storedItem of rawProductArray) {
          if (typeof storedItem === 'object' && storedItem !== null) {
            formattedItems.push(storedItem);
          } else {
            formattedItems.push({
              image: mediaUrl,
              categoryId: item.categoryId || categoryId || '',
              categoryName: item.categoryName || '',
              item: rawProductArray,
            });
            break;
          }
        }
      } else {
        if (lowerKey === 'special_offers') {
          formattedItems.push({
            image: isVideo ? '' : mediaUrl,
            title: item.title || '',
          });
        } else if (
          ['hero_banner', 'bank_offers', 'new_arrival', 'flash_sales', 'mega_offer'].includes(
            lowerKey,
          )
        ) {
          formattedItems.push({
            bannerImage: mediaUrl,
            categoryId: item.categoryId || categoryId || '',
          });
        } else {
          formattedItems.push({
            image: mediaUrl,
            categoryId: item.categoryId || categoryId || '',
            categoryName: item.categoryName || '',
          });
        }
      }

      // Determine status based on expiration date if provided
      let resolvedStatus: string;
      if (item.expiresAt) {
        const expTime = new Date(item.expiresAt).getTime();
        if (!isNaN(expTime)) {
          resolvedStatus = expTime <= Date.now() ? 'INACTIVE' : 'ACTIVE';
        } else {
          resolvedStatus = item.status ? String(item.status).toUpperCase() : 'ACTIVE';
        }
      } else {
        resolvedStatus = item.status ? String(item.status).toUpperCase() : 'ACTIVE';
      }
      const isExpired = resolvedStatus === 'INACTIVE';

      // STRICT DATE & STATUS VALIDATION:
      // Default (active only): strictly omit any widget that is expired or inactive!
      if (!reqStatus || reqStatus === 'active') {
        if (isExpired || resolvedStatus !== 'ACTIVE') {
          return;
        }
      } else if (reqStatus === 'inactive') {
        if (!isExpired && resolvedStatus !== 'INACTIVE') {
          return;
        }
      }
      // If reqStatus === 'all', display both active and inactive widgets with their resolvedStatus

      resultWidgets.push({
        id: item.id || undefined,
        widgetType: widgetType,
        widgetId: widgetId,
        sequence,
        title,
        status: resolvedStatus,
        categoryId: item.categoryId || categoryId || '',
        categoryName: item.categoryName || '',
        warehouseId: item.warehouseId || warehouseId || '',
        expiresAt: item.expiresAt || null,
        item: formattedItems,
      });
    });

    // Ensure strict sequence ordering (1, 2, 3...)
    resultWidgets.sort((a, b) => a.sequence - b.sequence);

    if (!resultWidgets || resultWidgets.length === 0) {
      throw new NotFoundException(
        categoryId
          ? `No sponsored widgets found for category ${categoryId}`
          : 'No sponsored widgets found for categoryId',
      );
    }

    return {
      status: 'success',
      message: {
        categoryId: categoryId || '',
        categoryName: matchedCategoryName || '',
        warehouseId: warehouseId || '',
        module: targetModule,
        data: resultWidgets,
      },
    };
  }

  /**
   * Bulk or single upsert of category sponsored widgets.
   * Automatically generates sequential unique widget IDs (WID001, WID002...) if not provided.
   */
  async upsertWidgets(widgetsPayload: any) {
    const list = Array.isArray(widgetsPayload) ? widgetsPayload : [widgetsPayload];
    const results: any[] = [];

    // Query max numerical suffix from existing 'WIDxxx' widget IDs
    let existingWidRecords: any[] = [];
    try {
      existingWidRecords = await this.db.queryRawCategorySponsored(
        `SELECT widget_id AS "widgetId" FROM public.category_sponsored WHERE widget_id LIKE 'WID%'`,
      );
    } catch (err: any) {
      this.logger.warn(`upsertWidgets query warning: ${err.message}`);
      existingWidRecords = this.localWidgetsStore;
    }

    let maxWidNum = 0;
    (existingWidRecords || []).forEach((rec) => {
      const match = rec.widgetId?.match(/^WID(\d+)$/i);
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

      // Automatically set status based on expiration date
      let computedStatus: string;
      if (expiresAtDate) {
        computedStatus = expiresAtDate.getTime() <= Date.now() ? 'INACTIVE' : 'ACTIVE';
      } else {
        computedStatus = w.status ? String(w.status).toUpperCase() : 'ACTIVE';
      }
      const isExpired = computedStatus === 'INACTIVE';

      const data: any = {
        widgetType: w.widgetType || w.widget_type || 'hero_banner',
        title: w.title ?? w.Title ?? null,
        status: computedStatus,
        sequence: Number(w.sequence) || 1,
        categoryId: w.categoryId ?? w.category_id ?? crypto.randomUUID(),
        categoryName: w.categoryName ?? null,
        item: parsedItemArray,
        warehouseId: w.warehouseId ?? null,
        module: w.module ? String(w.module).toUpperCase() : 'HAATZA',
        expiresAt: expiresAtDate,
      };

      let record: any;
      try {
        const existingRec = await this.db.queryRawCategorySponsored(
          `SELECT id FROM public.category_sponsored WHERE widget_id = $1 AND UPPER(module::text) = UPPER($2) LIMIT 1`,
          [widgetId, data.module],
        );

        if (existingRec && existingRec.length > 0) {
          const updateRes = await this.db.queryRawCategorySponsored(
            `UPDATE public.category_sponsored SET widget_type = $1, title = $2, status = $3, sequence = $4, category_id = $5, category_name = $6, "Item" = $7, warehouse_id = $8, module = $9, expires_at = $10, updated_at = NOW() WHERE id = $11 RETURNING id, widget_type AS "widgetType", widget_id AS "widgetId", title, status, sequence, category_id AS "categoryId", category_name AS "categoryName", "Item" AS item, warehouse_id AS "warehouseId", module, created_at AS "createdAt", updated_at AS "updatedAt", expires_at AS "expiresAt"`,
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
            ],
          );
          record = updateRes[0];
        } else {
          const insertRes = await this.db.queryRawCategorySponsored(
            `INSERT INTO public.category_sponsored (widget_type, title, status, sequence, category_id, category_name, "Item", warehouse_id, module, expires_at, widget_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, widget_type AS "widgetType", widget_id AS "widgetId", title, status, sequence, category_id AS "categoryId", category_name AS "categoryName", "Item" AS item, warehouse_id AS "warehouseId", module, created_at AS "createdAt", updated_at AS "updatedAt", expires_at AS "expiresAt"`,
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
            ],
          );
          record = insertRes[0];
        }
      } catch (dbErr: any) {
        this.logger.warn(`upsertWidgets DB save warning: ${dbErr.message}`);
      }

      // Fallback object if database is offline or returned empty
      if (!record) {
        record = {
          id: `CAT_SPON_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          widgetType: data.widgetType,
          widgetId,
          title: data.title,
          status: data.status,
          sequence: data.sequence,
          categoryId: data.categoryId,
          categoryName: data.categoryName,
          item: data.item,
          warehouseId: data.warehouseId,
          module: data.module,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: data.expiresAt,
        };
      }

      // Update in-memory cache
      const existingIdx = this.localWidgetsStore.findIndex((x) => x.widgetId === widgetId);
      if (existingIdx >= 0) {
        this.localWidgetsStore[existingIdx] = { ...this.localWidgetsStore[existingIdx], ...record };
      } else {
        this.localWidgetsStore.push(record);
      }

      results.push(record);
    }

    return {
      status: 'success',
      message: `Successfully upserted ${results.length} category sponsored widget(s)`,
      data: results,
    };
  }

  /**
   * Delete Category Sponsored widget by ID or widgetId.
   */
  async deleteWidget(identifier: string) {
    if (!identifier?.trim()) {
      throw new BadRequestException('ID or widgetId is required to delete widget.');
    }

    const trimmed = identifier.trim();
    let targetId: string | null = null;
    try {
      const records = await this.db.queryRawCategorySponsored(
        `SELECT id, widget_id AS "widgetId" FROM public.category_sponsored WHERE widget_id = $1 OR id = $1 LIMIT 1`,
        [trimmed],
      );

      if (records && records.length > 0) {
        targetId = records[0].id;
        await this.db.queryRawCategorySponsored(
          `DELETE FROM public.category_sponsored WHERE id = $1`,
          [targetId],
        );
      }
    } catch (err: any) {
      this.logger.warn(`deleteWidget DB warning: ${err.message}`);
    }

    this.localWidgetsStore = this.localWidgetsStore.filter(
      (x) => x.id !== trimmed && x.widgetId !== trimmed && (!targetId || x.id !== targetId),
    );

    return {
      status: 'success',
      message: `Category sponsored widget '${trimmed}' deleted successfully.`,
    };
  }

  /**
   * Cron job that runs every 5 minutes to auto-update expired widgets to 'INACTIVE'
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoExpireWidgets() {
    try {
      const updated = await this.syncExpiredStatus();
      if (updated > 0) {
        this.logger.log(
          `Auto-expired ${updated} category sponsored widget(s) to INACTIVE based on expiration timestamp.`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Error in autoExpireWidgets cron: ${err.message}`);
    }
  }

  /**
   * Synchronizes database records: sets status = 'INACTIVE' where expires_at <= NOW(), and 'ACTIVE' where expires_at > NOW()
   */
  async syncExpiredStatus(): Promise<number> {
    try {
      const inact = await this.db.executePoolQuery(
        `UPDATE public.category_sponsored 
         SET status = 'INACTIVE', updated_at = NOW() 
         WHERE expires_at IS NOT NULL 
           AND expires_at <= NOW() 
           AND (LOWER(TRIM(status)) != 'inactive' OR status IS NULL);`,
      );
      const act = await this.db.executePoolQuery(
        `UPDATE public.category_sponsored 
         SET status = 'ACTIVE', updated_at = NOW() 
         WHERE expires_at IS NOT NULL 
           AND expires_at > NOW() 
           AND LOWER(TRIM(status)) != 'active';`,
      );
      return inact + act;
    } catch (err: any) {
      this.logger.warn(`syncExpiredStatus warning: ${err.message}`);
      return 0;
    }
  }
}
