import { IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DashboardModule } from '@prisma/client';

export class GetHaatzaDashboardDto {
  @ApiPropertyOptional({
    description: 'Optional Category ID to filter dashboard widgets',
    example: 'c6d480e9-52c4-7b1c-c14c-de187bb61f3c',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Optional Warehouse ID to filter dashboard widgets',
    example: 'WH00001',
  })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiProperty({
    description: 'Mandatory Module to filter dashboard widgets (HAATZA or LITE)',
    enum: DashboardModule,
    example: 'HAATZA',
  })
  @IsNotEmpty()
  @IsEnum(DashboardModule)
  module: DashboardModule;
}
