import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CustomerOrderPayloadDto {
  @ApiProperty({ description: 'Product ID' })
  @IsNotEmpty({ message: 'productId is required in customerOrder' })
  productId: string;

  @ApiPropertyOptional({ description: 'Seller ID' })
  @IsOptional()
  sellerId?: string;

  @ApiPropertyOptional({ description: 'Product title or item name' })
  @IsOptional()
  items?: string;

  @ApiPropertyOptional({ description: 'Item quantity' })
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ description: 'Total price or amount' })
  @IsOptional()
  totalAmount?: number;

  @ApiPropertyOptional({ description: 'Customer full name' })
  @IsOptional()
  customerName?: string;

  @ApiPropertyOptional({ description: 'Customer delivery address' })
  @IsOptional()
  customerAddress?: string;

  @ApiPropertyOptional({ description: 'Customer phone number' })
  @IsOptional()
  customerPhone?: string;

  @ApiPropertyOptional({ description: 'Order status' })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Payment status' })
  @IsOptional()
  paymentStatus?: string;

  @ApiPropertyOptional({ description: 'MRP of product' })
  @IsOptional()
  mrp?: number;

  @ApiPropertyOptional({ description: 'On-sale price' })
  @IsOptional()
  onsalePrice?: number;

  @ApiPropertyOptional({ description: 'Discount applied' })
  @IsOptional()
  discount?: number;

  @ApiPropertyOptional({ description: 'Buyer email address' })
  @IsOptional()
  buyerEmail?: string;

  @ApiPropertyOptional({ description: 'Estimated delivery date' })
  @IsOptional()
  estimatedDelivery?: string | Date;

  @ApiPropertyOptional({ description: 'Product options / variant selection' })
  @IsOptional()
  productOption?: any;

  @ApiPropertyOptional({ description: 'Delivery pincode' })
  @IsOptional()
  deliveryPincode?: string;

  @ApiPropertyOptional({ description: 'Product return eligibility' })
  @IsOptional()
  productReturn?: string;

  @ApiPropertyOptional({ description: 'Razorpay order ID' })
  @IsOptional()
  razorpayOrderId?: string;

  @ApiPropertyOptional({ description: 'Payment mode (COD/UPI/PREPAID)' })
  @IsOptional()
  paymentMode?: string;

  @ApiPropertyOptional({ description: 'Product image URL' })
  @IsOptional()
  productImage?: string;

  @ApiPropertyOptional({ description: 'Delivery fee' })
  @IsOptional()
  deliveryFee?: number;

  @ApiPropertyOptional({ description: 'Delivery charge flag' })
  @IsOptional()
  deliveryCharge?: boolean;

  @ApiPropertyOptional({ description: 'Coupon code applied' })
  @IsOptional()
  couponCode?: string;

  @ApiPropertyOptional({ description: 'Coupon discount amount' })
  @IsOptional()
  couponDiscount?: number;

  @ApiPropertyOptional({ description: 'Payment method' })
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'COD delivery fee' })
  @IsOptional()
  codDeliveryFee?: number;

  @ApiPropertyOptional({ description: 'UPI delivery fee' })
  @IsOptional()
  upiDeliveryFee?: number;

  @ApiPropertyOptional({ description: 'Amount debited from user wallet' })
  @IsOptional()
  usedWalletAmount?: number;

  [key: string]: any;
}

export class OrderEntryDto {
  @ApiProperty({
    description: 'Customer order metadata for this entry',
    type: CustomerOrderPayloadDto,
  })
  @ValidateNested()
  @Type(() => CustomerOrderPayloadDto)
  @IsNotEmpty({ message: 'customerOrder is required' })
  customerOrder: CustomerOrderPayloadDto;

  @ApiPropertyOptional({ description: 'Line items in cart' })
  @IsOptional()
  lineItems?: any[];

  @ApiPropertyOptional({ description: 'Currency code (e.g. INR)' })
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Totals object' })
  @IsOptional()
  totals?: any;

  @ApiPropertyOptional({ description: 'Billing info object' })
  @IsOptional()
  billingInfo?: any;

  @ApiPropertyOptional({ description: 'Shipping info object' })
  @IsOptional()
  shippingInfo?: any;

  @ApiPropertyOptional({ description: 'Cart ID' })
  @IsOptional()
  cartId?: string;

  @ApiPropertyOptional({ description: 'Buyer language (default: en)' })
  @IsOptional()
  buyerLanguage?: string;

  @ApiPropertyOptional({ description: 'Weight unit (default: KG)' })
  @IsOptional()
  weightUnit?: string;

  @ApiPropertyOptional({ description: 'Custom field payload' })
  @IsOptional()
  customField?: any;

  @ApiPropertyOptional({ description: 'Discount object' })
  @IsOptional()
  discount?: any;

  [key: string]: any;
}

export class CreateOrdersDto {
  @ApiProperty({
    description: 'Array of orders to process in parallel',
    type: [OrderEntryDto],
  })
  @IsArray({ message: 'order must be an array' })
  @ValidateNested({ each: true })
  @Type(() => OrderEntryDto)
  order: OrderEntryDto[];
}
