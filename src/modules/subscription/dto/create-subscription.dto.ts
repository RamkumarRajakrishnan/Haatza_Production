import { IsString, IsOptional, IsNumber, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubscriptionDetailsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tableId?: string;

  @ApiProperty()
  @IsString()
  planName: string;

  @ApiProperty()
  @IsString()
  planId: string;

  @ApiPropertyOptional({ default: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsString()
  startedDate: string;

  @ApiProperty()
  @IsString()
  endedDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  razorpayOrderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sellerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

export class PaymentsDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  wallet?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  upi?: number;
}

export class CreateSellerInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @ApiProperty()
  @IsString()
  sellerName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sellerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstin?: string;

  @ApiProperty()
  @IsString()
  item: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  qty?: number;

  @ApiProperty()
  @IsNumber()
  rate: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiProperty()
  @IsNumber()
  subtotal: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  cgst?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  sgst?: number;

  @ApiProperty()
  @IsNumber()
  totalPayable: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PaymentsDto)
  payments?: PaymentsDto;

  @ApiProperty()
  @IsString()
  transactionMethod: string;
}

export class CreateSubscriptionPayloadDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => CreateSubscriptionDetailsDto)
  createSubscription: CreateSubscriptionDetailsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSellerInvoiceDto)
  createSellerInvoice?: CreateSellerInvoiceDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  referralUpdate?: Record<string, any>;
}
