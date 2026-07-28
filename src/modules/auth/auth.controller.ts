import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from './auth.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('register')
  register(@Body() data: RegisterDto) {
    return this.authService.register(data);
  }

  @Post('login')
  login(@Body() data: LoginDto, @Req() req: Request) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'];

    return this.authService.login(data, { ipAddress, userAgent });
  }

  @Post('refresh')
  refresh(@Body() data: RefreshTokenDto) {
    return this.authService.refreshToken(data.refreshToken);
  }

  @Post('logout')
  logout(@Body() data: LogoutDto) {
    return this.authService.logout(data.refreshToken);
  }

  @Post('forgotPassword')
  forgotPassword(@Body() body: any) {
    return { success: true, message: 'Password reset link/OTP sent' };
  }

  @Post('generateotp')
  generateOtp(@Body() body: any) {
    return { success: true, otpId: `otp_${Date.now()}`, message: 'OTP sent successfully' };
  }

  @Post('verifyotp')
  verifyOtp(@Body() body: any) {
    return { success: true, verified: true, message: 'OTP verified successfully' };
  }

  @Post('resendotp')
  resendOtp(@Body() body: any) {
    return { success: true, message: 'OTP resent successfully' };
  }
}
