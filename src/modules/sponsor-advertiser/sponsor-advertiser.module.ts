import { Module } from '@nestjs/common';
import { SponsorAdvertiserController } from './sponsor-advertiser.controller';
import { SponsorAdvertiserService } from './sponsor-advertiser.service';
import { MediaStorageModule } from '../media-storage/media-storage.module';

@Module({
  imports: [MediaStorageModule],
  controllers: [SponsorAdvertiserController],
  providers: [SponsorAdvertiserService],
  exports: [SponsorAdvertiserService],
})
export class SponsorAdvertiserModule {}
