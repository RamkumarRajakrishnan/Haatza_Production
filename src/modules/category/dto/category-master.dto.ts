import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CategoryType, CategoryStatus, CategoryModule } from '@prisma/client';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Target module for category (HAATZA, LITE, or ALL)',
    enum: CategoryModule,
    example: CategoryModule.HAATZA,
  })
  @IsNotEmpty({ message: 'module is mandatory (HAATZA, LITE, or ALL).' })
  @Transform(({ value }) =>
    typeof value === 'string' ? (value.toUpperCase().trim() as any) : value,
  )
  @IsEnum(CategoryModule, {
    message: 'module must be HAATZA, LITE, or ALL.',
  })
  module: CategoryModule;

  @ApiProperty({
    description: 'Required Category Name',
    example: 'Mobiles',
  })
  @IsNotEmpty({ message: 'categoryName is required.' })
  @IsString()
  categoryName: string;

  @ApiPropertyOptional({
    description: 'Parent Category ID (null for MAIN_CATEGORY)',
    example: 'CAT_001',
  })
  @IsOptional()
  @IsString()
  parentCategoryId?: string;

  @ApiPropertyOptional({
    description: 'Type of category (MAIN_CATEGORY, CATEGORY, SUBCATEGORY)',
    enum: CategoryType,
    example: CategoryType.CATEGORY,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? (value.toUpperCase().trim() as any) : value,
  )
  @IsEnum(CategoryType, {
    message: 'categoryType must be MAIN_CATEGORY, CATEGORY, or SUBCATEGORY.',
  })
  categoryType?: CategoryType;

  @ApiPropertyOptional({
    description: 'Category Image URL or Path',
    example: 'https://cdn.haatza.com/categories/mobiles.jpg',
  })
  @IsOptional()
  @IsString()
  categoryImage?: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Mobile phones and smart accessories',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Display sequence integer ordering',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sequence?: number;

  @ApiPropertyOptional({
    description: 'Status (ACTIVE or INACTIVE)',
    enum: CategoryStatus,
    example: CategoryStatus.ACTIVE,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? (value.toUpperCase().trim() as any) : value,
  )
  @IsEnum(CategoryStatus, {
    message: 'status must be ACTIVE or INACTIVE.',
  })
  status?: CategoryStatus;

  @ApiPropertyOptional({
    description: 'Creator User Reference',
  })
  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiPropertyOptional({
    description: 'Updater User Reference',
  })
  @IsOptional()
  @IsString()
  updatedBy?: string;
}

export class UpdateCategoryStatusDto {
  @ApiPropertyOptional({
    description: 'Category ID (optional if passed in URL parameter)',
    example: 'CAT_002',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({
    description: 'Target Status (ACTIVE or INACTIVE)',
    enum: CategoryStatus,
    example: CategoryStatus.INACTIVE,
  })
  @IsNotEmpty({ message: 'status is required (ACTIVE or INACTIVE).' })
  @Transform(({ value }) =>
    typeof value === 'string' ? (value.toUpperCase().trim() as any) : value,
  )
  @IsEnum(CategoryStatus, {
    message: 'status must be ACTIVE or INACTIVE.',
  })
  status: CategoryStatus;

  @ApiPropertyOptional({
    description: 'Updater User Reference',
  })
  @IsOptional()
  @IsString()
  updatedBy?: string;
}

export class QueryCategoryDto {
  @ApiPropertyOptional({
    description: 'Filter by Category ID or custom ID',
  })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Alias filter by categoryId',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;


  @ApiPropertyOptional({
    description: 'Filter by Module (HAATZA, LITE, or ALL)',
  })
  @IsOptional()
  @Transform(({ obj, value }) => {
    const raw = value || obj?.Module || obj?.module;
    return typeof raw === 'string' ? (raw.toUpperCase().trim() as any) : raw;
  })
  module?: CategoryModule;

  @ApiPropertyOptional({
    description: 'PascalCase alias for Module',
  })
  @IsOptional()
  @Transform(({ obj, value }) => {
    const raw = value || obj?.Module || obj?.module;
    return typeof raw === 'string' ? (raw.toUpperCase().trim() as any) : raw;
  })
  Module?: CategoryModule;

  @ApiPropertyOptional({
    description: 'Filter by Parent Category ID',
  })
  @IsOptional()
  @IsString()
  parent_category_id?: string;

  @ApiPropertyOptional({
    description: 'Alias filter by parentCategoryId',
  })
  @IsOptional()
  @IsString()
  parentCategoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status (ACTIVE or INACTIVE)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? (value.toUpperCase().trim() as any) : value,
  )
  status?: CategoryStatus;

  @ApiPropertyOptional({
    description: 'Filter by Category Type',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? (value.toUpperCase().trim() as any) : value,
  )
  categoryType?: CategoryType;

  @ApiPropertyOptional({
    description: 'Search string for category name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Include inactive categories (Admin query flag)',
  })
  @IsOptional()
  includeInactive?: boolean | string;
}

export class GetChildCategoriesDto {
  @ApiPropertyOptional({
    description: 'Parent Category ID',
    example: 'CAT_001',
  })
  @IsOptional()
  @IsString()
  parent_category_id?: string;

  @ApiPropertyOptional({
    description: 'Alias for Parent Category ID',
    example: 'CAT_001',
  })
  @IsOptional()
  @IsString()
  parentCategoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by Module (HAATZA, LITE, or ALL)',
  })
  @IsOptional()
  @Transform(({ obj, value }) => {
    const raw = value || obj?.Module || obj?.module;
    return typeof raw === 'string' ? (raw.toUpperCase().trim() as any) : raw;
  })
  module?: CategoryModule;

  @ApiPropertyOptional({
    description: 'PascalCase alias for Module',
  })
  @IsOptional()
  @Transform(({ obj, value }) => {
    const raw = value || obj?.Module || obj?.module;
    return typeof raw === 'string' ? (raw.toUpperCase().trim() as any) : raw;
  })
  Module?: CategoryModule;
}

export class UpdateCategorySequenceDto {
  @ApiPropertyOptional({
    description: 'Category ID (optional if passed in URL parameter)',
    example: 'CAT_002',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({
    description: 'Target Sequence Order number',
    example: 2,
  })
  @IsNotEmpty({ message: 'sequence is required.' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sequence: number;

  @ApiPropertyOptional({
    description: 'Updater User Reference',
  })
  @IsOptional()
  @IsString()
  updatedBy?: string;
}

export class GetMainCategoriesDto {
  @ApiPropertyOptional({
    description: 'Filter categories by module (e.g., haatza, lite, HAATZA, LITE)',
    example: 'haatza',
  })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiPropertyOptional({
    description: 'PascalCase alias for module',
    example: 'haatza',
  })
  @IsOptional()
  @IsString()
  Module?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination (starts from 1)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Limit of categories per page (default: 10, max: 100)',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

