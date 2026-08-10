import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GetHaatzaDashboardDto } from './dto/get-haatza-dashboard.dto';
import { DashboardModule } from '@prisma/client';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly db: DatabaseService) {}

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

    const whereCondition: any = {
      module: DashboardModule.HAATZA,
      status: { in: ['TRUE', 'ACTIVE'] },
      categoryId,
    };

    if (warehouseId && warehouseId.trim() !== '') {
      whereCondition.warehouseId = warehouseId.trim();
    }

    const items = await this.db.dashboard.findMany({
      where: whereCondition,
      orderBy: {
        sequence: 'asc',
      },
    });

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
        case 'Promobanner':
        case 'Haatza_Promobanner':
          row = {
            backgroundImage: this.formatImageUrl(item.image),
            page: item.redirectLink || '',
            categoryId: item.categoryId || '',
          };
          break;

        case 'Lite_Shopbycategory':
        case 'Shopbycategory':
        case 'Haatza_Shopbycategory':
          row = {
            title: item.title || '',
            backgroundImage: this.formatImageUrl(item.image),
            categoryId: item.categoryId || '',
            productId: item.productId || '',
            categoryName: item.categoryName || '',
            page: item.redirectLink || '',
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
            widgetbackgroundColor: item.subtitle || '',
            showMore: item.status === 'TRUE' || item.status === 'ACTIVE',
            showMorePage: item.redirectLink || '',
            showMoreButtonColor: '',
            textColor: '',
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
        data: groupedData,
      },
    };
  }
}
