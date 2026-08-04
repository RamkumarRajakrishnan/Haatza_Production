import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaStorageService } from './media-storage.service';
import { MediaStorageController } from './media-storage.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [MediaStorageController],
  providers: [MediaStorageService],
  exports: [MediaStorageService],
})
export class MediaStorageModule {}
