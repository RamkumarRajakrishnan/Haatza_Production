import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QuerySponsorCampaignDto {
  @ApiPropertyOptional({ description: 'Filter by status', example: 'DRAFT' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by advertiser ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  advertiserId?: string;

  @ApiPropertyOptional({ description: 'Filter by brand ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Filter by start date (from)', example: '2026-09-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (to)', example: '2026-12-31' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Search by campaign name', example: 'Summer' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  page?: number | string;

  @ApiPropertyOptional({ description: 'Results per page', example: 10 })
  @IsOptional()
  limit?: number | string;

  @ApiPropertyOptional({ description: 'Module identifier', example: 'sponsor' })
  @IsOptional()
  @IsString()
  module?: string;
}
