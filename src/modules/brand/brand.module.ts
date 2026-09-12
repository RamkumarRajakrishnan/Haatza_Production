import { Module } from '@nestjs/common';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { DatabaseModule } from '../../database/database.module';
import { MediaStorageModule } from '../media-storage/media-storage.module';

@Module({
  imports: [DatabaseModule, MediaStorageModule],
  controllers: [BrandController],
  providers: [BrandService],
  exports: [BrandService],
})
export class BrandModule {}
