import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QuerySponsorAdCreativeDto {
  @ApiPropertyOptional({
    description: 'Filter by campaign ID (numeric ID or UUID campaignUid)',
    example: '61ae8c62-e7dc-4452-ab0d-f583ac4b4b81',
  })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status (DRAFT, ACTIVE, PAUSED, REJECTED, DELETED)',
    example: 'DRAFT',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Search creative name, headline, or primary text',
    example: 'Diwali',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number (default: 1)',
    example: 1,
  })
  @IsOptional()
  page?: number | string;

  @ApiPropertyOptional({
    description: 'Items per page (default: 50, max: 100)',
    example: 10,
  })
  @IsOptional()
  limit?: number | string;

  @ApiPropertyOptional({
    description: 'Module identifier (must be sponsor)',
    example: 'sponsor',
    default: 'sponsor',
  })
  @IsOptional()
  @IsString()
  module?: string;
}
