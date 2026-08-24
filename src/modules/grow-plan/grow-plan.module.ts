import { Module } from '@nestjs/common';
import { GrowPlanService } from './grow-plan.service';
import { GrowPlanController } from './grow-plan.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [GrowPlanController],
  providers: [GrowPlanService],
  exports: [GrowPlanService],
})
export class GrowPlanModule {}
