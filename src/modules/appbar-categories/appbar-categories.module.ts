import { Module } from '@nestjs/common';
import { AppbarCategoriesController } from './appbar-categories.controller';
import { AppbarCategoriesService } from './appbar-categories.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AppbarCategoriesController],
  providers: [AppbarCategoriesService],
  exports: [AppbarCategoriesService],
})
export class AppbarCategoriesModule {}
