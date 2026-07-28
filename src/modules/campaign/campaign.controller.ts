import { Controller, Get, Post, Put, Delete, Body, Query, Param } from '@nestjs/common';
import { CampaignService } from './campaign.service';

@Controller()
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post('newSellerCampaign')
  createCampaign(@Body() body: any) {
    return this.campaignService.createCampaign(body);
  }

  @Get('sellerCampaigns')
  getCampaigns(@Query('sellerId') sellerId: string) {
    return this.campaignService.getCampaigns(sellerId);
  }

  @Get('sellerCampaignsproducts')
  getCampaignProducts(@Query('campaignId') campaignId: string) {
    return this.campaignService.getCampaignProducts(campaignId);
  }

  @Get('campaignDetails')
  getCampaignDetails(@Query('campaignId') campaignId: string) {
    return this.campaignService.getCampaignDetails(campaignId);
  }

  @Get('CampaignProducts')
  getPublicCampaignProducts() {
    return this.campaignService.getPublicCampaignProducts();
  }

  @Get('CampaignproductPerformance')
  getProductPerformance(@Query('campaignId') campaignId: string) {
    return this.campaignService.getProductPerformance(campaignId);
  }

  @Get('Campaignsummery')
  getCampaignSummary(@Query('sellerId') sellerId: string) {
    return this.campaignService.getCampaignSummary(sellerId);
  }

  @Post('updateSellerCampaign')
  updateCampaign(@Body() body: any) {
    return this.campaignService.updateCampaign(body.campaignId, body);
  }

  @Post('offSellerCampaign')
  pauseCampaign(@Body() body: any) {
    return this.campaignService.pauseCampaign(body.campaignId);
  }

  @Post('deleteSellerCampaign')
  deleteCampaign(@Body() body: any) {
    return this.campaignService.deleteCampaign(body.campaignId);
  }

  @Get('sellerConfirmedOrdersCount')
  getConfirmedOrdersCount(@Query('sellerId') sellerId: string) {
    return this.campaignService.getConfirmedOrdersCount(sellerId);
  }

  @Get('getTopSellingProducts')
  getTopSellingProducts(@Query('sellerId') sellerId: string) {
    return this.campaignService.getTopSellingProducts(sellerId);
  }

  @Get('getProductStats')
  getProductStats(@Query('sellerId') sellerId: string) {
    return this.campaignService.getProductStats(sellerId);
  }
}
