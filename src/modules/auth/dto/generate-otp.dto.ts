import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpPurpose, OtpChannel } from '@prisma/client';

@ValidatorConstraint({ name: 'isEmailOrTenDigitPhone', async: false })
export class IsEmailOrTenDigitPhoneConstraint
  implements ValidatorConstraintInterface
{
  validate(text: string, _args: ValidationArguments) {
    if (typeof text !== 'string') return false;
    const trimmed = text.trim();

    // Check if Email
    if (trimmed.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(trimmed);
    }

    // Check if Phone (supports 10-digit, optionally prefixed with +91 or 91)
    let cleaned = trimmed.replace(/[\s\-\(\)\+]/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      cleaned = cleaned.substring(2);
    }
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(cleaned);
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Identifier must be a valid email address or a valid 10-digit mobile number starting with 6-9.';
  }
}

export class GenerateOtpDto {
  @ApiProperty({ description: 'Mobile number (10 digits) or email address' })
  @IsString()
  @IsNotEmpty({ message: 'Identifier is required' })
  @Validate(IsEmailOrTenDigitPhoneConstraint)
  identifier: string;

  @ApiPropertyOptional({ enum: OtpPurpose, default: OtpPurpose.LOGIN })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase().replace(/[\s\-]/g, '_');
      if (normalized === 'LOGIN') return OtpPurpose.LOGIN;
      if (normalized === 'FORGOT_PASSWORD' || normalized === 'FORGOTPASSWORD') return OtpPurpose.FORGOT_PASSWORD;
      if (normalized === 'REGISTRATION' || normalized === 'REGISTER') return OtpPurpose.REGISTRATION;
      if (normalized === 'EMAIL_VERIFICATION' || normalized === 'EMAILVERIFICATION') return OtpPurpose.EMAIL_VERIFICATION;
      if (normalized === 'MOBILE_VERIFICATION' || normalized === 'MOBILEVERIFICATION') return OtpPurpose.MOBILE_VERIFICATION;
      return normalized as OtpPurpose;
    }
    return value;
  })
  @IsEnum(OtpPurpose)
  @IsOptional()
  purpose?: OtpPurpose = OtpPurpose.LOGIN;

  @ApiPropertyOptional({ enum: OtpChannel, default: OtpChannel.SMS })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase();
      if (normalized === 'SMS') return OtpChannel.SMS;
      if (normalized === 'EMAIL') return OtpChannel.EMAIL;
      if (normalized === 'WHATSAPP') return OtpChannel.WHATSAPP;
      return normalized as OtpChannel;
    }
    return value;
  })
  @IsEnum(OtpChannel)
  @IsOptional()
  channel?: OtpChannel = OtpChannel.SMS;
}

