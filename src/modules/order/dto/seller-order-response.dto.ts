import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SellerOrderResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() sellerId: string;
  @ApiProperty() orderId: number;
  @ApiPropertyOptional() trackingId?: string;
  @ApiPropertyOptional() status?: string;
  @ApiPropertyOptional() items?: string;
  @ApiPropertyOptional() totalAmount?: number;
  @ApiPropertyOptional() customerName?: string;
  @ApiPropertyOptional() customerAddress?: string;
  @ApiProperty() createdDate: Date;
  @ApiPropertyOptional() paymentStatus?: string;
  @ApiPropertyOptional() productId?: string;
  @ApiPropertyOptional() sellerPaymentStatus?: string;
  @ApiPropertyOptional() itemPrice?: number;
  @ApiPropertyOptional() buyerEmail?: string;
  @ApiPropertyOptional() customerPhone?: string;
  @ApiPropertyOptional() estimatedDelivery?: Date;
  @ApiPropertyOptional() productOption?: any;
  @ApiPropertyOptional() deliveredDate?: Date;
  @ApiPropertyOptional() invoiceNumber?: string;
  @ApiPropertyOptional() returnAndExchangeDate?: Date;
  @ApiPropertyOptional() invoiceFile?: string;
  @ApiPropertyOptional() refundStatus?: boolean;
  @ApiPropertyOptional() reason?: string;
  @ApiPropertyOptional() message?: string;
  @ApiPropertyOptional() deliveryPartner?: string;
  @ApiPropertyOptional() deliveryPincode?: string;
  @ApiPropertyOptional() addressLine1?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() state?: string;
  @ApiPropertyOptional() country?: string;
  @ApiPropertyOptional() razorpayOrderId?: string;
  @ApiPropertyOptional() shipping?: boolean;
  @ApiPropertyOptional() productReturn?: string;
  @ApiPropertyOptional() returnOrderId?: string;
  @ApiPropertyOptional() exchangeOrderId?: string;
  @ApiPropertyOptional() returnDate?: Date;
  @ApiPropertyOptional() exchangeDate?: Date;
  @ApiPropertyOptional() returnExchangeImages?: any;
  @ApiPropertyOptional() mrp?: number;
  @ApiPropertyOptional() paymentMode?: string;
  @ApiPropertyOptional() haatzaFreeDelivery?: boolean;
  @ApiPropertyOptional() productImage?: string;
  @ApiPropertyOptional() upiDeliveryFee?: number;
  @ApiPropertyOptional() couponCode?: string;
  @ApiPropertyOptional() couponDiscount?: number;
  @ApiPropertyOptional() deliveryCharge?: boolean;
  @ApiPropertyOptional() paymentMethod?: string;
  @ApiPropertyOptional() quantity?: number;
  @ApiPropertyOptional() codDeliveryFee?: number;
  @ApiPropertyOptional() returnExchangeTrackingId?: string;
  @ApiPropertyOptional() returnOrderTrackingId?: string;
  @ApiPropertyOptional() pickupAddress?: string;
  @ApiPropertyOptional() usedWalletAmount?: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() deletedAt?: Date;
}

export class PaginatedSellerOrderResponseDto {
  @ApiProperty({ type: [SellerOrderResponseDto] })
  data: SellerOrderResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
