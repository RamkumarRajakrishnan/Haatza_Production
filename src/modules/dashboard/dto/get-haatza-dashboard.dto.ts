import { IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DashboardModule } from '@prisma/client';

export class GetHaatzaDashboardDto {
  @ApiPropertyOptional({
    description: 'Category ID (Compulsory for both HAATZA and LITE modules)',
    example: 'cate001',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Warehouse ID (Compulsory for LITE module, optional for HAATZA module)',
    example: 'wh_001',
  })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiProperty({
    description: 'Mandatory Module to filter dashboard widgets (HAATZA or LITE)',
    enum: DashboardModule,
    example: DashboardModule.HAATZA,
  })
  @IsNotEmpty({ message: 'module is mandatory (HAATZA or LITE).' })
  @IsEnum(DashboardModule, { message: 'module must be either HAATZA or LITE.' })
  module: DashboardModule;
}
