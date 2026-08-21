import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { DatabaseModule } from '../../database/database.module';
import { RazorpayIntegrationService } from '../../integrations/razorpay/razorpay.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, RazorpayIntegrationService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
