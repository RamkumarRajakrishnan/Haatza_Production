import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

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
  @ApiProperty({
    description: 'User email address or phone number',
    example: 'user@example.com',
  })
  @IsNotEmpty({ message: 'Identifier is required.' })
  @IsString({ message: 'Identifier must be a string.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Validate(IsEmailOrPhoneConstraint)
  identifier: string;
}
