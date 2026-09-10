import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SponsorSignUpDto {
  @ApiPropertyOptional({
    description: 'Full Name of the Sponsor',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Alias for fullName',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Business or Company Name',
    example: 'Acme Global Corp',
  })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Alias for companyName',
    example: 'Acme Global Corp',
  })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiProperty({
    description: 'Email Address of the Sponsor',
    example: 'sponsor@example.com',
  })
  @IsNotEmpty({ message: 'email is required' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  @ApiPropertyOptional({
    description: 'Phone Number of the Sponsor',
    example: '9876543210',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Alias for phone (phoneNumber)',
    example: '9876543210',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Alias for phone (mobile)',
    example: '9876543210',
  })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiProperty({
    description: 'Password for the account (minimum 6 characters)',
    example: 'SecurePassword123',
  })
  @IsNotEmpty({ message: 'password is required' })
  @IsString()
  @MinLength(6, { message: 'password must be at least 6 characters long' })
  password: string;

  @ApiProperty({
    description: 'Confirm Password (must match password)',
    example: 'SecurePassword123',
  })
  @IsNotEmpty({ message: 'confirmPassword is required' })
  @IsString()
  confirmPassword: string;
}
