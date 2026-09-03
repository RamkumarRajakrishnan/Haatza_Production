import { IsNotEmpty, IsOptional, IsNumber, Min, Max, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AppbarModule {
  HAATZA = 'haatza',
  LITE = 'lite',
}

export class GetAppbarCategoriesDto {
  @ApiProperty({
    description: 'Mandatory Module (haatza or lite, case-insensitive)',
    example: 'haatza',
    enum: ['haatza', 'lite'],
  })
  @IsOptional()
  @IsString()
  @Transform(({ obj, value }) => {
    const raw = value || obj?.Module || obj?.module;
    return typeof raw === 'string' ? raw.toLowerCase().trim() : raw;
  })
  module?: string;

  @ApiPropertyOptional({
    description: 'PascalCase alias for Module',
    example: 'haatza',
  })
  @IsOptional()
  @IsString()
  Module?: string;

  @ApiPropertyOptional({
    description: 'Customer Latitude (-90 to 90). Mandatory for lite module.',
    example: 12.8456,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Invalid latitude or longitude' })
  @Min(-90, { message: 'Invalid latitude or longitude' })
  @Max(90, { message: 'Invalid latitude or longitude' })
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Customer Longitude (-180 to 180). Mandatory for lite module.',
    example: 77.6603,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Invalid latitude or longitude' })
  @Min(-180, { message: 'Invalid latitude or longitude' })
  @Max(180, { message: 'Invalid latitude or longitude' })
  longitude?: number;
}
