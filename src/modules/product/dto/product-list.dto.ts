import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ProductListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by seller email', example: 'seller@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Filter by seller ID', example: 'seller_123' })
  @IsOptional()
  @IsString()
  sellerId?: string;

  @ApiPropertyOptional({ description: 'Search term for product name, brand, sku, description, or search keywords', example: 'Nike' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by main category name', example: 'Fashion' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by subcategory name or ID', example: 'Shoes' })
  @IsOptional()
  @IsString()
  subCategory?: string;

  @ApiPropertyOptional({ description: 'Filter by status (e.g. ACTIVE, INACTIVE)', example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Page number (default 1)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page limit (default 10)', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Sort by field (default createdDate)', example: 'createdDate' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdDate';

  @ApiPropertyOptional({ description: 'Sort order (asc/desc, default desc)', enum: SortOrder, example: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
