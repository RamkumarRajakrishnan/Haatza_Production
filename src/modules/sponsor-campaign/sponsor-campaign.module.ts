import { Module } from '@nestjs/common';
import { SponsorCampaignController } from './sponsor-campaign.controller';
import { SponsorCampaignService } from './sponsor-campaign.service';

@Module({
  controllers: [SponsorCampaignController],
  providers: [SponsorCampaignService],
  exports: [SponsorCampaignService],
})
export class SponsorCampaignModule {}
