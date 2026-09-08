import { Module } from '@nestjs/common';
import { CategorySponsoredController } from './category-sponsored.controller';
import { CategorySponsoredService } from './category-sponsored.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CategorySponsoredController],
  providers: [CategorySponsoredService],
  exports: [CategorySponsoredService],
})
export class CategorySponsoredModule {}
