import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsObject,
  IsArray,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class CreateSellerOrderDto {
  @ApiProperty({ description: 'Seller ID string' })
  @IsString()
  sellerId: string;

  @ApiProperty({ description: 'Numeric Order ID' })
  @IsNumber()
  @Type(() => Number)
  orderId: number;

  @ApiPropertyOptional({ description: 'Tracking ID' })
  @IsOptional()
  @IsString()
  trackingId?: string;

  @ApiPropertyOptional({ description: 'Order Status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'JSON string or summary of items' })
  @IsOptional()
  @IsString()
  items?: string;

  @ApiPropertyOptional({ description: 'Total Order Amount' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  totalAmount?: number;

  @ApiPropertyOptional({ description: 'Customer Name' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ description: 'Customer Address Text' })
  @IsOptional()
  @IsString()
  customerAddress?: string;

  @ApiPropertyOptional({ description: 'Created Date' })
  @IsOptional()
  @IsDateString()
  createdDate?: string;

  @ApiPropertyOptional({ description: 'Payment Status' })
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @ApiPropertyOptional({ description: 'Product ID' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Seller Payment Status' })
  @IsOptional()
  @IsString()
  sellerPaymentStatus?: string;

  @ApiPropertyOptional({ description: 'Item Price' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  itemPrice?: number;

  @ApiPropertyOptional({ description: 'Buyer Email' })
  @IsOptional()
  @IsEmail()
  buyerEmail?: string;

  @ApiPropertyOptional({ description: 'Customer Phone' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({ description: 'Estimated Delivery Date' })
  @IsOptional()
  @IsDateString()
  estimatedDelivery?: string;

  @ApiPropertyOptional({ description: 'Product Options Object' })
  @IsOptional()
  @IsObject()
  productOption?: any;

  @ApiPropertyOptional({ description: 'Delivered Date' })
  @IsOptional()
  @IsDateString()
  deliveredDate?: string;

  @ApiPropertyOptional({ description: 'Invoice Number' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ description: 'Return and Exchange Date' })
  @IsOptional()
  @IsDateString()
  returnAndExchangeDate?: string;

  @ApiPropertyOptional({ description: 'Invoice File URL or path' })
  @IsOptional()
  @IsString()
  invoiceFile?: string;

  @ApiPropertyOptional({ description: 'Refund Status' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  refundStatus?: boolean;

  @ApiPropertyOptional({ description: 'Reason' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Message' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Delivery Partner' })
  @IsOptional()
  @IsString()
  deliveryPartner?: string;

  @ApiPropertyOptional({ description: 'Delivery Pincode' })
  @IsOptional()
  @IsString()
  deliveryPincode?: string;

  @ApiPropertyOptional({ description: 'Address Line 1' })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Country' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Razorpay Order ID' })
  @IsOptional()
  @IsString()
  razorpayOrderId?: string;

  @ApiPropertyOptional({ description: 'Shipping' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  shipping?: boolean;

  @ApiPropertyOptional({ description: 'Product Return' })
  @IsOptional()
  @IsString()
  productReturn?: string;

  @ApiPropertyOptional({ description: 'Return Order ID' })
  @IsOptional()
  @IsString()
  returnOrderId?: string;

  @ApiPropertyOptional({ description: 'Exchange Order ID' })
  @IsOptional()
  @IsString()
  exchangeOrderId?: string;

  @ApiPropertyOptional({ description: 'Return Date' })
  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @ApiPropertyOptional({ description: 'Exchange Date' })
  @IsOptional()
  @IsDateString()
  exchangeDate?: string;

  @ApiPropertyOptional({ description: 'Return/Exchange Images (Array or JSON)' })
  @IsOptional()
  returnExchangeImages?: any;

  @ApiPropertyOptional({ description: 'MRP' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  mrp?: number;

  @ApiPropertyOptional({ description: 'Payment Mode' })
  @IsOptional()
  @IsString()
  paymentMode?: string;

  @ApiPropertyOptional({ description: 'Haatza Free Delivery' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  haatzaFreeDelivery?: boolean;

  @ApiPropertyOptional({ description: 'Product Image URL or path' })
  @IsOptional()
  @IsString()
  productImage?: string;

  @ApiPropertyOptional({ description: 'UPI Delivery Fee' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  upiDeliveryFee?: number;

  @ApiPropertyOptional({ description: 'Coupon Code' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ description: 'Coupon Discount' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  couponDiscount?: number;

  @ApiPropertyOptional({ description: 'Delivery Charge' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  deliveryCharge?: boolean;

  @ApiPropertyOptional({ description: 'Payment Method' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Quantity' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({ description: 'COD Delivery Fee' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  codDeliveryFee?: number;

  @ApiPropertyOptional({ description: 'Return Exchange Tracking ID' })
  @IsOptional()
  @IsString()
  returnExchangeTrackingId?: string;

  @ApiPropertyOptional({ description: 'Return Order Tracking ID' })
  @IsOptional()
  @IsString()
  returnOrderTrackingId?: string;

  @ApiPropertyOptional({ description: 'Pickup Address' })
  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @ApiPropertyOptional({ description: 'Used Wallet Amount' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  usedWalletAmount?: number;
}
