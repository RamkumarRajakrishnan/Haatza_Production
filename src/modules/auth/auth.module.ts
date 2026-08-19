import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { JwtStrategy } from '../../common/strategies/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

import { SmsModule } from '../../integrations/sms/sms.module';

import { OtpCleanupService } from './otp-cleanup.service';

@Module({
  imports: [
    ConfigModule,
    SmsModule,

    PassportModule.register({
      defaultStrategy: 'jwt',
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_SECRET') ||
          process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is missing.');
        }
        return {
          secret,
          signOptions: {
            expiresIn: '1h',
          },
        };
      },
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    AuthRepository,
    OtpCleanupService,
    JwtStrategy,
    RolesGuard,
    PermissionsGuard,
  ],

  exports: [
    AuthService,
    AuthRepository,
    JwtModule,
    PassportModule,
    RolesGuard,
    PermissionsGuard,
  ],
})
export class AuthModule {}
