import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpPurpose, OtpChannel } from '@prisma/client';

export class GenerateOtpDto {
  @ApiProperty({ description: 'Mobile number or email identifier' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiPropertyOptional({ enum: OtpPurpose, default: OtpPurpose.LOGIN })
  @IsEnum(OtpPurpose)
  @IsOptional()
  purpose?: OtpPurpose = OtpPurpose.LOGIN;

  @ApiPropertyOptional({ enum: OtpChannel, default: OtpChannel.SMS })
  @IsEnum(OtpChannel)
  @IsOptional()
  channel?: OtpChannel = OtpChannel.SMS;
}
