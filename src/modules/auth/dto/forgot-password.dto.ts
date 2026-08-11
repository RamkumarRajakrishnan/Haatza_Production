import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Registered mobile number or email address', required: false })
  @IsString()
  @IsOptional()
  identifier?: string;

  @ApiProperty({ description: 'Registered email address', required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Registered mobile number', required: false })
  @IsString()
  @IsOptional()
  mobile?: string;
}
