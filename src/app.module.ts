import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { DatabaseModule } from './database/database.module';
import { MediaStorageModule } from './modules/media-storage/media-storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { HealthModule } from './modules/health/health.module';
import { CategoryModule } from './modules/category/category.module';
import { AdminModule } from './modules/admin/admin.module';
import { SmsModule } from './integrations/sms/sms.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AppbarCategoriesModule } from './modules/appbar-categories/appbar-categories.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { CouponModule } from './modules/coupon/coupon.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { ReferralModule } from './modules/referral/referral.module';
import { GrowPlanModule } from './modules/grow-plan/grow-plan.module';
import { ProductModule } from './modules/product/product.module';

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

    ScheduleModule.forRoot(),
    DatabaseModule,
    MediaStorageModule,
    AuthModule,
    UserModule,
    HealthModule,
    CategoryModule,
    AdminModule,
    SmsModule,
    DashboardModule,
    AppbarCategoriesModule,
    SubscriptionModule,
    CouponModule,
    WalletModule,
    ReferralModule,
    GrowPlanModule,
    ProductModule,
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
export class AppModule {}
