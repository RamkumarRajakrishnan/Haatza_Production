import { Module } from '@nestjs/common';
import { HaatzUpController } from './haatzup.controller';
import { HaatzUpService } from './haatzup.service';

@Module({
  controllers: [HaatzUpController],
  providers: [HaatzUpService],
  exports: [HaatzUpService],
})
export class HaatzUpModule {}
