import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy'; // ✅ Add this


@Module({
  imports: [

    ConfigModule,

    JwtModule.registerAsync({

      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({

        secret: configService.get<string>('JWT_SECRET'),

        signOptions: {
          expiresIn: '15m',
        },

      }),

    }),

  ],

  controllers: [
    AuthController
  ],

  providers: [
    AuthService,
    JwtStrategy, // ✅ Add this
  ],

  exports: [
    AuthService
  ]

})
export class AuthModule {}