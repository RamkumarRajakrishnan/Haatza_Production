import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { ContactModule } from './modules/contact/contact.module';
import { SellerModule } from './modules/seller/seller.module';
import { ProductModule } from './modules/product/product.module';
import { PaymentModule } from './modules/payment/payment.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SupportModule } from './modules/support/support.module';
import { OrderModule } from './modules/order/order.module';
import { CampaignModule } from './modules/campaign/campaign.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { HaatzUpModule } from './modules/haatzup/haatzup.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { SellerProductModule } from './modules/seller-product/seller-product.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isLoadTestMode =
          configService.get<string>('LOAD_TEST_MODE') === 'true' ||
          configService.get<string>('NODE_ENV') === 'test';

        return [
          {
            name: 'short',
            ttl: 1000,
            limit: isLoadTestMode ? 200000 : 20,
          },
          {
            name: 'medium',
            ttl: 10000,
            limit: isLoadTestMode ? 500000 : 50,
          },
          {
            name: 'login',
            ttl: 60000,
            limit: isLoadTestMode ? 1000000 : 100,
          },
        ];
      },
    }),

    DatabaseModule,
    AuthModule,
    HealthModule,
    ContactModule,
    SellerModule,
    ProductModule,
    PaymentModule,
    AnalyticsModule,
    SupportModule,
    OrderModule,
    CampaignModule,
    ShippingModule,
    SubscriptionModule,
    HaatzUpModule,
    WarehouseModule,
    SellerProductModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule { }
