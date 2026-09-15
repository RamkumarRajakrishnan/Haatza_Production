import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';

export class CreateSponsorCampaignDto {
  @ApiProperty({ description: 'Brand ID (FK)', example: 'uuid-of-brand' })
  @IsNotEmpty()
  @IsString()
  brandId!: string;

  @ApiProperty({ description: 'Advertiser ID (FK)', example: 'uuid-of-advertiser' })
  @IsNotEmpty()
  @IsString()
  advertiserId!: string;

  @ApiProperty({ description: 'Campaign Name', example: 'Summer Sale 2026' })
  @IsNotEmpty()
  @IsString()
  campaignName!: string;

  @ApiProperty({
    description: 'Campaign Objective',
    enum: ['DRIVE_SALES', 'BRAND_VISIBILITY'],
    example: 'DRIVE_SALES',
  })
  @IsNotEmpty()
  @IsString()
  campaignObjective!: string;

  @ApiPropertyOptional({ description: 'Primary Category name or ID', example: 'Electronics' })
  @IsOptional()
  @IsString()
  primaryCategory?: string;

  @ApiProperty({ description: 'Daily Budget (minimum 100 INR for launch)', example: 500 })
  @IsNotEmpty()
  dailyBudget!: number | string;

  @ApiPropertyOptional({ description: 'Currency code', example: 'INR', default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Campaign start date (YYYY-MM-DD)', example: '2026-09-20' })
  @IsNotEmpty()
  startDate!: string;

  @ApiPropertyOptional({ description: 'Campaign end date (YYYY-MM-DD)', example: '2026-10-20' })
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Created by user ID', example: 'uuid-of-user' })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Module identifier', example: 'sponsor' })
  @IsOptional()
  @IsString()
  module?: string;
}
