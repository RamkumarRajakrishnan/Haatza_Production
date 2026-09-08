import { IsOptional, IsString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DashboardModule } from '@prisma/client';

export class GetCategorySponsoredDto {
  @ApiPropertyOptional({
    description: 'Category ID or Code (e.g. cate001, CAT_ELEC)',
    example: 'cate001',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Category ID alias (same as category)',
    example: 'cate001',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Snake case category_id alias',
    example: 'cate001',
  })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Warehouse ID (Compulsory for LITE module, optional for HAATZA module)',
    example: 'wh_001',
  })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Snake case warehouse_id alias',
    example: 'wh_001',
  })
  @IsOptional()
  @IsString()
  warehouse_id?: string;

  @ApiProperty({
    description: 'Mandatory Module to filter category sponsored widgets (HAATZA or LITE, case-insensitive)',
    enum: DashboardModule,
    example: DashboardModule.HAATZA,
  })
  @IsOptional()
  @Transform(({ obj, value }) => {
    const raw = value || obj?.Module || obj?.module;
    return typeof raw === 'string' ? (raw.toUpperCase().trim() as any) : raw;
  })
  @IsEnum(DashboardModule, { message: 'module must be either HAATZA or LITE.' })
  module?: DashboardModule;

  @ApiPropertyOptional({
    description: 'PascalCase alias for module',
    enum: DashboardModule,
    example: DashboardModule.HAATZA,
  })
  @IsOptional()
  @IsString()
  Module?: string;

  @ApiPropertyOptional({
    description: 'Optional status filter: ACTIVE (default), INACTIVE, or ALL',
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsString()
  status?: string;
}
