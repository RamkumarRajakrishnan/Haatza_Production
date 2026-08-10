import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GetDashboardWidgetsDto } from './dto/get-dashboard-widgets.dto';
import { DashboardModule } from '@prisma/client';

interface CacheEntry {
  data: any;
  time: number;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL in ms

  constructor(private readonly db: DatabaseService) {}

  /**
   * Helper to ensure image URLs are valid public HTTPS URLs
   */
  private convertImageUrl(wixString: string | null | undefined): string {
    if (!wixString || wixString.trim() === '' || wixString.trim() === 'FALSE') {
      return '';
    }

    const trimmed = wixString.trim();

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    if (trimmed.startsWith('wix:image://v1/')) {
      const parts = trimmed.replace('wix:image://v1/', '').split('/');
      const mediaId = parts[0];
      return `https://static.wixstatic.com/media/${mediaId}`;
    }

    return `https://static.wixstatic.com/media/${trimmed}`;
  }

  /**
   * Fetches, transforms, and caches dashboard widgets matching Wix get_LitePageWidgets logic
   */
  async getLitePageWidgets(dto: GetDashboardWidgetsDto) {
    const { categoryId, warehouseId, module = DashboardModule.LITE } = dto;

    if (!categoryId || !warehouseId) {
      throw new BadRequestException('categoryId and warehouseId are required');
    }

    const cacheKey = `${categoryId}_${warehouseId}_${module}`;
    const now = Date.now();

    // 1. CACHE HIT
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.time < this.CACHE_TTL_MS) {
      this.logger.log(`Serving Dashboard Widgets from cache for key: ${cacheKey}`);
      return {
        success: true,
        statusCode: 200,
        data: cached.data,
        error: null,
      };
    }

    // 2. DB QUERY (Fetch widgets from PostgreSQL dashboard table)
    const items = await this.db.dashboard.findMany({
      where: {
        categoryId,
        warehouseId,
        status: 'ACTIVE',
        module,
      },
      orderBy: {
        sequence: 'asc',
      },
      take: 100,
    });

    // 3. GROUPING & TRANSFORMATION LOGIC
    const groupedData: Record<string, { widgetsequence: number; items: any[] }> = {};

    items.forEach((item) => {
      const widgetType = item.widgetType || 'Others';

      if (!groupedData[widgetType]) {
        groupedData[widgetType] = {
          widgetsequence: item.sequence || 0,
          items: [],
        };
      }

      let row: any = {};

      switch (widgetType) {
        case 'Lite_Promobanner':
          row = {
            backgroundImage: this.convertImageUrl(item.image),
            page: item.redirectLink || '',
            categoryId: item.categoryId || 0,
            productId: item.productId || '',
          };
          break;

        case 'Lite_Shopbycategory':
          row = {
            title: item.title || '',
            backgroundImage: this.convertImageUrl(item.image),
            categoryId: item.categoryId || 0,
            productId: item.productId || '',
            categoryName: item.categoryName || '',
            page: item.redirectLink || '',
          };
          break;

        case 'Lite_freshmarketSection':
          let parsedProducts: any[] = [];
          if (item.product) {
            try {
              parsedProducts = typeof item.product === 'string' ? JSON.parse(item.product) : item.product;
            } catch {
              parsedProducts = [];
            }
          }

          row = {
            titleimage: this.convertImageUrl(item.titleImage),
            categoryId: item.categoryId || 0,
            widgetProducts: parsedProducts,
            page: item.redirectLink || '',
            widgetbackgroundColor: item.subtitle || '',
            showMore: item.status === 'ACTIVE',
            showMorePage: item.redirectLink || '',
            showMoreButtonColor: '',
            textColor: '#FFFFFF',
          };
          break;

        case 'Lite_hurryDeals':
          row = {
            title: item.title || '',
            backgroundImage: this.convertImageUrl(item.image),
            categoryId: item.categoryId || 0,
            productId: item.productId || '',
            page: item.redirectLink || '',
            placement: item.module || '',
          };
          break;

        default:
          row = {
            widgettitle: item.title || '',
            backgroundImage: this.convertImageUrl(item.image),
            widgetsequence: item.sequence || 0,
          };
      }

      groupedData[widgetType].items.push(row);
    });

    const finalResponse = {
      categoryId,
      warehouseId,
      data: groupedData,
    };

    // 4. SAVE TO IN-MEMORY CACHE
    this.cache.set(cacheKey, {
      data: finalResponse,
      time: now,
    });

    return {
      success: true,
      statusCode: 200,
      data: finalResponse,
      error: null,
    };
  }

  /**
   * Flushes the in-memory dashboard cache
   */
  clearCache() {
    this.cache.clear();
    return { success: true, message: 'Dashboard cache cleared' };
  }
}
