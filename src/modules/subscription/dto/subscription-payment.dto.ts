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

export class CreateSubscriptionOrderDto {
  @ApiProperty({ example: 'seller_123', description: 'Seller ID' })
  @IsNotEmpty()
  @IsString()
  sellerId: string;

  @ApiProperty({ example: 'Growth', description: 'Plan Name' })
  @IsNotEmpty()
  @IsString()
  planName: string;

  @ApiProperty({ example: 299, description: 'Amount in INR' })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ example: 'INR', default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'seller@example.com', description: 'Seller Email' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000+05:30', description: 'Custom Start Date from Frontend UI' })
  @IsOptional()
  @IsString()
  startedDate?: string;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Subscription Duration in Months' })
  @IsOptional()
  @IsNumber()
  durationMonths?: number;
}

export class VerifySubscriptionPaymentDto {
  @ApiProperty({ example: 'order_Kxxxxx', description: 'Razorpay Order ID' })
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @ApiProperty({ example: 'pay_Kxxxxx', description: 'Razorpay Payment ID' })
  @IsNotEmpty()
  @IsString()
  paymentId: string;

  @ApiProperty({ example: 'sig_Kxxxxx', description: 'Razorpay Signature' })
  @IsNotEmpty()
  @IsString()
  signature: string;
}
