import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
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
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CheckUserDto } from './dto/check-user.dto';
import { CheckUserResponseDto } from './dto/check-user-response.dto';
import { VerifyOtpSessionDto } from './dto/verify-otp-session.dto';
import { RefreshTokenSessionDto } from './dto/refresh-token-session.dto';

@ApiTags('Auth')
@Controller('auth')
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
  @HttpCode(HttpStatus.OK)
  checkUser(@Body() data: CheckUserDto) {
    return this.authService.checkUser(data);
  }

  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 200, description: 'User successfully registered' })
  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.OK)
  @Post(['login', 'api/login'])
  login(@Body() data: LoginDto, @Req() req: Request) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'];

    return this.authService.login(data, { ipAddress, userAgent });
  }

  @ApiOperation({ summary: 'Refresh access token using refresh token or session token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refreshSession(@Body() data: RefreshTokenSessionDto | RefreshTokenDto) {
    if ('deviceId' in data) {
      return this.authService.refreshTokenSession(data as RefreshTokenSessionDto);
    }
    return this.authService.refreshToken((data as RefreshTokenDto).refreshToken);
  }

  @ApiOperation({ summary: 'Logout user and revoke refresh token session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Body() data: LogoutDto) {
    return this.authService.logout(data.refreshToken);
  }

  @ApiOperation({ summary: 'Request password reset OTP' })
  @ApiResponse({ status: 200, description: 'Password reset OTP generated and sent' })
  @HttpCode(HttpStatus.OK)
  @Post(['forgot-password', 'forgotpassword', 'forgotPassword'])
  forgotPassword(@Body() data: ForgotPasswordDto) {
    return this.authService.forgotPassword(data);
  }

  @ApiOperation({ summary: 'Reset user password' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @HttpCode(HttpStatus.OK)
  @Post(['reset-password', 'resetpassword', 'resetPassword'])
  resetPassword(@Body() data: ResetPasswordDto) {
    return this.authService.resetPassword(data);
  }

  @ApiOperation({ summary: 'Generate OTP for authentication/verification' })
  @ApiResponse({ status: 200, description: 'OTP generated successfully' })
  @HttpCode(HttpStatus.OK)
  @Post(['generate-otp', 'generateotp', 'generateOtp'])
  generateOtp(@Body() data: GenerateOtpDto) {
    return this.authService.generateOtp(data);
  }

  @ApiOperation({ summary: 'Verify OTP code and create session / login' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @HttpCode(HttpStatus.OK)
  @Post(['verify-otp', 'verifyotp', 'verifyOtp'])
  verifyOtp(@Body() data: VerifyOtpSessionDto | VerifyOtpDto, @Req() req: Request) {
    if ('phoneNumber' in data) {
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
      const userAgent = req.headers['user-agent'];
      return this.authService.verifyOtpSession(data as VerifyOtpSessionDto, { ipAddress, userAgent });
    }
    return this.authService.verifyOtp(data as VerifyOtpDto);
  }

  @ApiOperation({ summary: 'Resend OTP code' })
  @ApiResponse({ status: 200, description: 'OTP resent successfully' })
  @HttpCode(HttpStatus.OK)
  @Post(['resend-otp', 'resendotp', 'resendOtp'])
  resendOtp(@Body() data: GenerateOtpDto) {
    return this.authService.resendOtp(data);
  }

  @ApiOperation({ summary: 'Get role-based page permissions for frontend RBAC' })
  @ApiResponse({ status: 200, description: 'Returns page-level permission matrix for the given role' })
  @Get(['permissions', 'user-permissions'])
  getUserPermissions(@Query('role') role: string) {
    return this.authService.getUserPermissions(role || 'EMPLOYEE');
  }
}
