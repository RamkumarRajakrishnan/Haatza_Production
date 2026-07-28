import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class OrderService {
  constructor(private db: DatabaseService) {}

  async getSellerOrders(sellerId: string) {
    return this.db.order.findMany({ where: { sellerId } });
  }

  async getOrderDetails(orderId: string) {
    const order = await this.db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.db.order.update({ where: { id: orderId }, data: { status } });
  }

  async getReturns(sellerId: string) {
    return this.db.orderReturn.findMany({ where: { sellerId } });
  }

  async getReturnDetails(returnId: string) {
    const ret = await this.db.orderReturn.findUnique({ where: { id: returnId } });
    if (!ret) throw new NotFoundException('Return not found');
    return ret;
  }

  async getExchangeOrders(sellerId: string) {
    return this.db.orderReturn.findMany({ where: { sellerId, isExchange: true } });
  }

  async getClaimsList(sellerId: string) {
    return this.db.claim.findMany({ where: { sellerId } });
  }

  async createClaim(data: any) {
    return this.db.claim.create({
      data: {
        sellerId: data.sellerId || 'seller-1',
        orderId: data.orderId,
        subject: data.subject || 'Order Claim',
        description: data.description || '',
      },
    });
  }
}
