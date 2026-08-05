import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiPropertyOptional({
    description: 'Email address or mobile phone number',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  identifier?: string;

  @ApiPropertyOptional({
    description: 'Mobile phone number (alias for identifier)',
    example: '9876543210',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  mobile?: string;

  @ApiProperty({
    description: 'User password',
    example: 'UserPassword123!',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
