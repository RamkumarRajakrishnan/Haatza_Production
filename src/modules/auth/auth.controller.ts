import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  LoginErrorResponseDto,
  LoginSuccessResponseDto,
} from './dto/login-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { CheckUserDto } from './dto/check-user.dto';
import { CheckUserResponseDto } from './dto/check-user-response.dto';

@ApiTags('Auth')
@Controller(['auth', 'api/auth', 'api/v1/auth', 'v1/auth'])
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Check if user exists by email or phone before login/registration' })
  @ApiResponse({
    status: 200,
    description: 'User existence verification completed',
    type: CheckUserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error for identifier format' })
  @Post(['check-user', 'checkUser'])
  checkUser(@Body() data: CheckUserDto) {
    return this.authService.checkUser(data);
  }


  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @Post('register')
  register(@Body() data: RegisterDto) {
    return this.authService.register(data);
  }

  @ApiOperation({ summary: 'Authenticate user with email or phone number and password' })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: LoginSuccessResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid credentials or account status',
    type: LoginErrorResponseDto,
  })
  @Post(['login', 'api/login'])
  login(@Body() data: LoginDto, @Req() req: Request) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'];

    return this.authService.login(data, { ipAddress, userAgent });
  }

  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @Post('refresh')
  refresh(@Body() data: RefreshTokenDto) {
    return this.authService.refreshToken(data.refreshToken);
  }

  @ApiOperation({ summary: 'Logout user and revoke refresh token session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @Post('logout')
  logout(@Body() data: LogoutDto) {
    return this.authService.logout(data.refreshToken);
  }

  @ApiOperation({ summary: 'Request password reset OTP' })
  @ApiResponse({ status: 200, description: 'Password reset OTP generated and sent' })
  @Post('forgotPassword')
  forgotPassword(@Body() data: ForgotPasswordDto) {
    return this.authService.forgotPassword(data);
  }

  @ApiOperation({ summary: 'Generate OTP for authentication/verification' })
  @ApiResponse({ status: 200, description: 'OTP generated successfully' })
  @Post('generateotp')
  generateOtp(@Body() data: GenerateOtpDto) {
    return this.authService.generateOtp(data);
  }

  @ApiOperation({ summary: 'Verify OTP code' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @Post('verifyotp')
  verifyOtp(@Body() data: VerifyOtpDto) {
    return this.authService.verifyOtp(data);
  }

  @ApiOperation({ summary: 'Resend OTP code' })
  @ApiResponse({ status: 200, description: 'OTP resent successfully' })
  @Post('resendotp')
  resendOtp(@Body() data: GenerateOtpDto) {
    return this.authService.resendOtp(data);
  }
}
