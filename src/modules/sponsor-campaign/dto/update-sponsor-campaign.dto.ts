import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateSponsorCampaignDto {
  @ApiPropertyOptional({ description: 'Campaign Name', example: 'Winter Sale 2026' })
  @IsOptional()
  @IsString()
  campaignName?: string;

  @ApiPropertyOptional({
    description: 'Campaign Objective',
    enum: ['DRIVE_SALES', 'BRAND_VISIBILITY'],
    example: 'BRAND_VISIBILITY',
  })
  @IsOptional()
  @IsString()
  campaignObjective?: string;

  @ApiPropertyOptional({ description: 'Primary Category name or ID', example: 'Fashion' })
  @IsOptional()
  @IsString()
  primaryCategory?: string;

  @ApiPropertyOptional({ description: 'Daily Budget', example: 1000 })
  @IsOptional()
  dailyBudget?: number | string;

  @ApiPropertyOptional({ description: 'Currency code', example: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Campaign start date (YYYY-MM-DD)', example: '2026-09-25' })
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Campaign end date (YYYY-MM-DD)', example: '2026-11-25' })
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Status override (admin use)', example: 'PAUSED' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Updated by user ID', example: 'uuid-of-user' })
  @IsOptional()
  @IsString()
  updatedBy?: string;

  @ApiPropertyOptional({ description: 'Module identifier', example: 'sponsor' })
  @IsOptional()
  @IsString()
  module?: string;
}
