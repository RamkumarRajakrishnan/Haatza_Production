import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateRazorpayOrderDto {
  @ApiProperty() @IsNumber() amount: number;
}

export class VerifyRazorpayPaymentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() razorpay_order_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() razorpay_payment_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() razorpay_signature?: string;
}
