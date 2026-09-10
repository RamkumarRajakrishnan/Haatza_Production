/**
 * CustomerOrder Schema & Interface.
 * Mirrors the Wix CustomerOrders collection / PostgreSQL orders representation.
 */
export interface ICustomerOrder {
  id?: string;
  tableId?: string;
  invoiceNumber?: string;
  sellerId?: string;
  orderId?: string | number;
  items?: string;
  totalAmount?: number;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  status?: string;
  paymentStatus?: string;
  productId?: string;
  mrp?: number;
  onsalePrice?: number;
  discount?: number;
  buyerEmail?: string;
  estimatedDelivery?: Date | string | null;
  productOption?: any;
  deliveryPincode?: string;
  productReturn?: string;
  razorpayOrderId?: string;
  paymentMode?: string;
  productImage?: string;
  deliveryFee?: number;
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
  deliveredDate?: Date | string | null;
  returnDate?: Date | string | null;
  exchangeDate?: Date | string | null;
  pickupAddress?: string;
  [key: string]: any;
}

export class CustomerOrder implements ICustomerOrder {
  id: string;
  tableId: string;
  invoiceNumber: string;
  sellerId: string;
  orderId: string | number;
  items: string;
  totalAmount: number;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  status: string;
  paymentStatus: string;
  productId: string;
  mrp: number;
  onsalePrice: number;
  discount: number;
  buyerEmail: string;
  estimatedDelivery: Date | string | null;
  productOption: any;
  deliveryPincode: string;
  productReturn: string;
  razorpayOrderId: string;
  paymentMode: string;
  productImage: string;
  deliveryFee: number;
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

  constructor(partial: Partial<CustomerOrder>) {
    Object.assign(this, partial);
  }
}
