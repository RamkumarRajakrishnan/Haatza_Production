import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

export enum Platform {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  EMPLOYEE = 'EMPLOYEE',
}

@ValidatorConstraint({ name: 'isEmailOrPhone', async: false })
export class IsEmailOrPhoneConstraint implements ValidatorConstraintInterface {
  validate(text: string, _args: ValidationArguments) {
    if (typeof text !== 'string') return false;
    const trimmed = text.trim();

    // Check if Email
    if (trimmed.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(trimmed);
    }

    // Check if Phone (supports 10-digit, prefixed with 91 or +91, or international 10-15 digits)
    const cleaned = trimmed.replace(/[\s\-\(\)\+]/g, '');
    const phoneRegex = /^\d{10,15}$/;
    return phoneRegex.test(cleaned);
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Identifier must be a valid email address or phone number.';
  }
}

export class CheckUserDto {
  @ApiPropertyOptional({
    description: 'User email address or phone number',
  })
  @IsOptional()
  @IsString({ message: 'Identifier must be a string.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Validate(IsEmailOrPhoneConstraint)
  identifier?: string;

  @ApiPropertyOptional({
    description: 'Optional email address',
  })
  @IsOptional()
  @IsString({ message: 'Email must be a string.' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Optional mobile phone number',
  })
  @IsOptional()
  @IsString({ message: 'Mobile must be a string.' })
  mobile?: string;

  @ApiPropertyOptional({
    description: 'Target platform for user registration or login verification',
    enum: Platform,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase();
      if (normalized === 'BUYER') return Platform.BUYER;
      if (normalized === 'SELLER') return Platform.SELLER;
      if (normalized === 'EMPLOYEE') return Platform.EMPLOYEE;
      return normalized as Platform;
    }
    return value;
  })
  @IsEnum(Platform, { message: 'Platform must be BUYER, SELLER, or EMPLOYEE.' })
  platform?: Platform;
}
