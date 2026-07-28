import { IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpPurpose } from '@prisma/client';

export class VerifyOtpDto {
  @ApiProperty({ description: 'Mobile number or email identifier', example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ description: '6-digit OTP code', example: '123456' })
  @IsString()
  @Length(4, 6)
  otp: string;

  @ApiPropertyOptional({ enum: OtpPurpose, default: OtpPurpose.LOGIN })
  @IsEnum(OtpPurpose)
  @IsOptional()
  purpose?: OtpPurpose = OtpPurpose.LOGIN;
}
