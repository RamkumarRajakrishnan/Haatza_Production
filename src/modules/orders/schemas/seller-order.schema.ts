/**
 * SellerOrder Schema & Interface.
 * Mirrors the Wix SellerOrders collection / PostgreSQL orders representation.
 */
export interface ISellerOrder {
  id?: string;
  tableId?: string;
  sellerId?: string;
  orderId?: string | number;
  items?: string;
  totalAmount?: number;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  status?: string;
  paymentStatus?: string;
  sellerPaymentStatus?: string;
  itemPrice?: number;
  productId?: string;
  mrp?: number;
  buyerEmail?: string;
  estimatedDelivery?: Date | string | null;
  productOption?: any;
  deliveryPincode?: string;
  productReturn?: string;
  razorpayOrderId?: string;
  paymentMode?: string;
  productImage?: string;
  invoiceNumber?: string;
  deliveryCharge?: boolean;
  quantity?: number;
  couponCode?: string;
  couponDiscount?: number;
  paymentMethod?: string;
  codDeliveryFee?: number;
  upiDeliveryFee?: number;
  usedWalletAmount?: number;
  module?: string;
  trackingId?: string;
  createdDate?: Date | string;
  updatedDate?: Date | string;
  [key: string]: any;
}

export class SellerOrder implements ISellerOrder {
  id: string;
  tableId: string;
  sellerId: string;
  orderId: string | number;
  items: string;
  totalAmount: number;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  status: string;
  paymentStatus: string;
  sellerPaymentStatus: string;
  itemPrice: number;
  productId: string;
  mrp: number;
  buyerEmail: string;
  estimatedDelivery: Date | string | null;
  productOption: any;
  deliveryPincode: string;
  productReturn: string;
  razorpayOrderId: string;
  paymentMode: string;
  productImage: string;
  invoiceNumber: string;
  deliveryCharge: boolean;
  quantity: number;
  couponCode: string;
  couponDiscount: number;
  paymentMethod: string;
  codDeliveryFee: number;
  upiDeliveryFee: number;
  usedWalletAmount: number;
  module: string;
  trackingId?: string;
  createdDate: Date | string;
  updatedDate: Date | string;

  constructor(partial: Partial<SellerOrder>) {
    Object.assign(this, partial);
  }
}
