import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CampaignService {
  constructor(private db: DatabaseService) {}

  async createCampaign(data: any) {
    return this.db.campaign.create({
      data: {
        sellerId: data.sellerId || 'seller-1',
        name: data.name || 'New Campaign',
        budget: Number(data.budget) || 1000,
        productIds: data.productIds || [],
      },
    });
  }

  async getCampaigns(sellerId: string) {
    return this.db.campaign.findMany({ where: { sellerId } });
  }

  async getCampaignProducts(campaignId: string) {
    const campaign = await this.db.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return this.db.product.findMany({ where: { id: { in: campaign.productIds } } });
  }

  async getCampaignDetails(campaignId: string) {
    const campaign = await this.db.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async getPublicCampaignProducts() {
    return this.db.product.findMany({ take: 20 });
  }

  async getProductPerformance(campaignId: string) {
    return { campaignId, clicks: 350, impressions: 2400, conversions: 28, ctr: '14.58%' };
  }

  async getCampaignSummary(sellerId: string) {
    const campaigns = await this.db.campaign.findMany({ where: { sellerId } });
    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((c) => c.status === 'ACTIVE').length,
      totalBudgetSpent: campaigns.reduce((acc, c) => acc + c.budget, 0),
    };
  }

  async updateCampaign(campaignId: string, data: any) {
    return this.db.campaign.update({
      where: { id: campaignId },
      data: {
        name: data.name,
        budget: data.budget ? Number(data.budget) : undefined,
        productIds: data.productIds,
      },
    });
  }

  async pauseCampaign(campaignId: string) {
    return this.db.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    });
  }

  async deleteCampaign(campaignId: string) {
    return this.db.campaign.delete({ where: { id: campaignId } });
  }

  async getConfirmedOrdersCount(sellerId: string) {
    const count = await this.db.order.count({ where: { sellerId, status: 'CONFIRMED' } });
    return { count };
  }

  async getTopSellingProducts(sellerId: string) {
    return this.db.product.findMany({ where: { sellerId }, take: 5 });
  }

  async getProductStats(sellerId: string) {
    return {
      sellerId,
      totalViews: 1250,
      conversionRate: 3.2,
      addedToCart: 140,
    };
  }
}
