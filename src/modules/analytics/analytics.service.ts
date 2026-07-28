import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AnalyticsService {
  constructor(private db: DatabaseService) {}

  async getDashboard(sellerId: string) {
    const totalOrders = await this.db.order.count({ where: { sellerId } });
    const totalProducts = await this.db.product.count({ where: { sellerId } });
    return {
      sellerId,
      totalOrders,
      totalProducts,
      totalRevenue: 12500.0,
      activeCampaigns: 2,
    };
  }

  async getAnalytics(sellerId: string) {
    return this.getDashboard(sellerId);
  }
}
