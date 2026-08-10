import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetHaatzaDashboardDto {
  @ApiProperty({
    description: 'Category ID to filter dashboard widgets',
    example: 'c6d480e9-52c4-7b1c-c14c-de187bb61f3c',
  })
  @IsNotEmpty()
  @IsString()
  categoryId: string;

  @ApiPropertyOptional({
    description: 'Optional Warehouse ID to filter dashboard widgets',
    example: 'WH00001',
  })
  @IsOptional()
  @IsString()
  warehouseId?: string;
}
