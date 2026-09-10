import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ModuleQueryDto } from './module-query.dto';

export class GetOrdersQueryDto extends ModuleQueryDto {
  @ApiProperty({
    name: 'buyerEmail',
    description: 'Buyer email address to query orders for',
    example: 'buyer@example.com',
    required: true,
  })
  @IsNotEmpty({ message: 'buyerEmail is required' })
  @IsString({ message: 'buyerEmail must be a string' })
  buyerEmail: string;

  @ApiPropertyOptional({
    name: 'status',
    description:
      'Filter orders by status category (ordered, shipped, delivered, cancelled, returned, exchange)',
    example: 'ordered',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    name: 'page',
    description: 'Page number for pagination (defaults to 1)',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    name: 'limit',
    description: 'Page size limit (defaults to 10)',
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
