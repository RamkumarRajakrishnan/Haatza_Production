import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';
import { SponsorAdvertiserStatus } from '@prisma/client';

export class CreateSponsorAdvertiserDto {
  @ApiProperty({ description: 'Advertiser Name', example: 'Acme Media Pvt Ltd' })
  @IsNotEmpty()
  @IsString()
  advertiserName!: string;

  @ApiPropertyOptional({ description: 'Advertiser Logo photo URL', example: 'https://storage.googleapis.com/.../logo.jpg' })
  @IsOptional()
  @IsString()
  advertiserLogo?: string;

  @ApiProperty({ description: 'GST Number', example: '22AAAAA0000A1Z5' })
  @IsNotEmpty()
  @IsString()
  gstNumber!: string;

  @ApiPropertyOptional({ description: 'GST Certificate PDF URL', example: 'https://storage.googleapis.com/.../gst.pdf' })
  @IsOptional()
  @IsString()
  gstCertificate?: string;

  @ApiProperty({ description: 'PAN Number', example: 'ABCDE1234F' })
  @IsNotEmpty()
  @IsString()
  pan!: string;

  @ApiPropertyOptional({ description: 'PAN Card photo URL', example: 'https://storage.googleapis.com/.../pan.jpg' })
  @IsOptional()
  @IsString()
  panCard?: string;

  @ApiPropertyOptional({
    description: 'Status (PENDING, ACTIVE, INACTIVE)',
    enum: SponsorAdvertiserStatus,
    default: SponsorAdvertiserStatus.PENDING,
  })
  @IsOptional()
  status?: SponsorAdvertiserStatus | string;

  @ApiPropertyOptional({ description: 'Module identifier', example: 'sponsor' })
  @IsOptional()
  @IsString()
  module?: string;
}
