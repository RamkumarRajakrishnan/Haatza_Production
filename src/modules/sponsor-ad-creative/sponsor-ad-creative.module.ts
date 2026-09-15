import { Module } from '@nestjs/common';
import { SponsorAdCreativeController } from './sponsor-ad-creative.controller';
import { SponsorAdCreativeService } from './sponsor-ad-creative.service';

@Module({
  controllers: [SponsorAdCreativeController],
  providers: [SponsorAdCreativeService],
  exports: [SponsorAdCreativeService],
})
export class SponsorAdCreativeModule {}
