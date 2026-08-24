import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'mobile must be a valid 10-digit phone number starting with 6-9',
  })
  mobile: string;

  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  @IsNotEmpty({ message: 'name is required' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'gender is required' })
  @IsString()
  gender: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase().replace(/[\s\-]/g, '_');
      if (normalized === 'BUYER') return UserRole.BUYER;
      if (normalized === 'SELLER') return UserRole.SELLER;
      if (normalized === 'EMPLOYEE') return UserRole.EMPLOYEE;
      if (normalized === 'ADMIN') return UserRole.ADMIN;
      if (normalized === 'DELIVERY_PARTNER' || normalized === 'DELIVERYPARTNER') return UserRole.DELIVERY_PARTNER;
      if (normalized === 'NEST_WORKER' || normalized === 'NESTWORKER') return UserRole.NEST_WORKER;
      if (normalized === 'SUPPORT') return UserRole.SUPPORT;
      if (normalized === 'SELLER_OWNER' || normalized === 'SELLEROWNER') return UserRole.SELLER_OWNER;
      if (normalized === 'SELLER_STAFF' || normalized === 'SELLERSTAFF') return UserRole.SELLER_STAFF;
      if (normalized === 'ACCOUNT_MANAGER' || normalized === 'ACCOUNTMANAGER') return UserRole.ACCOUNT_MANAGER;
      return normalized as UserRole;
    }
    return value;
  })
  @IsEnum(UserRole, {
    message:
      'role must be one of the following values: ADMIN, SELLER, BUYER, NEST_WORKER, DELIVERY_PARTNER, SUPPORT, SELLER_OWNER, SELLER_STAFF, ACCOUNT_MANAGER, EMPLOYEE',
  })
  role?: UserRole;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
    return value;
  })
  @IsBoolean()
  buyer?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
    return value;
  })
  @IsBoolean()
  employee?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
    return value;
  })
  @IsBoolean()
  isEmployee?: boolean;
}
