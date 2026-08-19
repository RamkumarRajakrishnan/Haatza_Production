import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaStorageService } from './media-storage.service';
import { MediaStorageController } from './media-storage.controller';
import { ImageCompressorService } from '../../integrations/media-processing/image-compressor.service';
import { VideoCompressorService } from '../../integrations/media-processing/video-compressor.service';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [MediaStorageController],
  providers: [
    MediaStorageService,
    ImageCompressorService,
    VideoCompressorService,
  ],
  exports: [
    MediaStorageService,
    ImageCompressorService,
    VideoCompressorService,
  ],
})
export class MediaStorageModule {}
