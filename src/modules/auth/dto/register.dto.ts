import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @IsString()
  name: string;

  @IsString()
  mobile: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : value))
  @IsEnum(UserRole, {
    message:
      'role must be one of the following values: ADMIN, SELLER, BUYER, NEST_WORKER, DELIVERY_PARTNER, SUPPORT, SELLER_OWNER, SELLER_STAFF, ACCOUNT_MANAGER',
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
}
