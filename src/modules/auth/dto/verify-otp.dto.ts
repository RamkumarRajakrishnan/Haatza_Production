import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OtpPurpose } from '@prisma/client';

export class VerifyOtpDto {
  @ApiPropertyOptional({ description: 'Mobile number or email identifier' })
  @IsString()
  @IsOptional()
  identifier?: string;

  @ApiPropertyOptional({ description: 'Registered mobile number alias' })
  @IsString()
  @IsOptional()
  mobile?: string;

  @ApiPropertyOptional({ description: 'Registered phone number alias' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Registered email address alias' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: '6-digit OTP code' })
  @IsString()
  @IsOptional()
  @Length(4, 6)
  otp?: string;

  @ApiPropertyOptional({ description: 'OTP code alias' })
  @IsString()
  @IsOptional()
  otpCode?: string;

  @ApiPropertyOptional({ enum: OtpPurpose, default: OtpPurpose.LOGIN })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase();
      if (normalized === 'LOGIN') return OtpPurpose.LOGIN;
      if (normalized === 'FORGOT_PASSWORD' || normalized === 'FORGOTPASSWORD') return OtpPurpose.FORGOT_PASSWORD;
      if (normalized === 'REGISTRATION') return OtpPurpose.REGISTRATION;
      if (normalized === 'EMAIL_VERIFICATION') return OtpPurpose.EMAIL_VERIFICATION;
      if (normalized === 'MOBILE_VERIFICATION') return OtpPurpose.MOBILE_VERIFICATION;
      return normalized as OtpPurpose;
    }
    return value;
  })
  @IsEnum(OtpPurpose)
  @IsOptional()
  purpose?: OtpPurpose = OtpPurpose.LOGIN;
}
