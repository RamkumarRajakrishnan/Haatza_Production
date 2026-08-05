import { IsOptional, IsString, IsNumber, IsBoolean, IsDateString, Min, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class QuerySellerOrderDto {
  @ApiPropertyOptional({ description: 'Filter by Seller ID' })
  @IsOptional()
  @IsString()
  sellerId?: string;

  @ApiPropertyOptional({ description: 'Search term for Order ID, Customer Name, Buyer Email, Tracking ID, Invoice Number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Search/Filter by exact Numeric Order ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  orderId?: number;

  @ApiPropertyOptional({ description: 'Filter by Customer Name' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ description: 'Filter by Buyer Email' })
  @IsOptional()
  @IsString()
  buyerEmail?: string;

  @ApiPropertyOptional({ description: 'Filter by Tracking ID' })
  @IsOptional()
  @IsString()
  trackingId?: string;

  @ApiPropertyOptional({ description: 'Filter by Status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by Payment Status' })
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @ApiPropertyOptional({ description: 'Filter by Seller Payment Status' })
  @IsOptional()
  @IsString()
  sellerPaymentStatus?: string;

  @ApiPropertyOptional({ description: 'Filter by Refund Status' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  refundStatus?: boolean;

  @ApiPropertyOptional({ description: 'Date Range Start (ISO string)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Date Range End (ISO string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size limit', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Sort by field', default: 'createdDate' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdDate';

  @ApiPropertyOptional({ description: 'Sort order: asc or desc', default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Include soft deleted records', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeDeleted?: boolean = false;
}
