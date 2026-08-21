import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRazorpayOrderDto {
  @ApiPropertyOptional({ example: 299 })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ example: 'INR', default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'plan_growth_123', description: 'Master pricing plan ID' })
  @IsNotEmpty()
  @IsString()
  planId: string;
}

export class VerifyRazorpayPaymentDto {
  @ApiProperty({ example: 'pay_xxxxx' })
  @IsNotEmpty()
  @IsString()
  razorpay_payment_id: string;

  @ApiProperty({ example: 'order_xxxxx' })
  @IsNotEmpty()
  @IsString()
  razorpay_order_id: string;

  @ApiProperty({ example: 'signature_xxxxx' })
  @IsNotEmpty()
  @IsString()
  razorpay_signature: string;

  @ApiProperty({ example: 'plan_growth_123' })
  @IsNotEmpty()
  @IsString()
  planId: string;
}

export class ProcessSubscriptionOrderDto {
  @ApiProperty({ example: 'pay_xxxxx' })
  @IsNotEmpty()
  @IsString()
  razorpay_payment_id: string;

  @ApiProperty({ example: 'order_xxxxx' })
  @IsNotEmpty()
  @IsString()
  razorpay_order_id: string;

  @ApiProperty({ example: 'signature_xxxxx' })
  @IsNotEmpty()
  @IsString()
  razorpay_signature: string;

  @ApiProperty({ example: 'plan_growth_123' })
  @IsNotEmpty()
  @IsString()
  planId: string;
}

export class CancelSubscriptionDto {
  @ApiProperty({ example: 'sub_001' })
  @IsNotEmpty()
  @IsString()
  subscriptionId: string;
}
