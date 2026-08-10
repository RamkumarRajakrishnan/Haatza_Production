import { IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DashboardModule } from '@prisma/client';

export class GetHaatzaDashboardDto {
  @ApiPropertyOptional({
    description: 'Optional Category ID to filter dashboard widgets',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Optional Warehouse ID to filter dashboard widgets',
  })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiProperty({
    description: 'Mandatory Module to filter dashboard widgets (HAATZA or LITE)',
    enum: DashboardModule,
  })
  @IsNotEmpty()
  @IsEnum(DashboardModule)
  module: DashboardModule;
}
