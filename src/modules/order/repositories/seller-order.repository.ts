import { Injectable } from '@nestjs/common';
import { SellerOrder } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { BaseRepository } from '../../../common/repositories/base.repository';

export interface FindSellerOrdersParams {
  sellerId?: string;
  search?: string;
  orderId?: number;
  customerName?: string;
  buyerEmail?: string;
  trackingId?: string;
  status?: string;
  paymentStatus?: string;
  sellerPaymentStatus?: string;
  refundStatus?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

@Injectable()
export class SellerOrderRepository extends BaseRepository<SellerOrder> {
  constructor(prisma: DatabaseService) {
    super(prisma, 'sellerOrder' as any);
  }

  async findSellerOrders(params: FindSellerOrdersParams): Promise<{ data: SellerOrder[]; total: number; page: number; limit: number; totalPages: number }> {
    const {
      sellerId,
      search,
      orderId,
      customerName,
      buyerEmail,
      trackingId,
      status,
      paymentStatus,
      sellerPaymentStatus,
      refundStatus,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'createdDate',
      sortOrder = 'desc',
      includeDeleted = false,
    } = params;

    const where: any = {};

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    if (sellerId) {
      where.sellerId = sellerId;
    }

    if (status) {
      where.status = { equals: status, mode: 'insensitive' };
    }

    if (paymentStatus) {
      where.paymentStatus = { equals: paymentStatus, mode: 'insensitive' };
    }

    if (sellerPaymentStatus) {
      where.sellerPaymentStatus = { equals: sellerPaymentStatus, mode: 'insensitive' };
    }

    if (refundStatus !== undefined) {
      where.refundStatus = refundStatus;
    }

    if (startDate || endDate) {
      where.createdDate = {};
      if (startDate) where.createdDate.gte = startDate;
      if (endDate) where.createdDate.lte = endDate;
    }

    const searchConditions: any[] = [];

    if (orderId !== undefined && !isNaN(orderId)) {
      searchConditions.push({ orderId: orderId });
    }

    if (customerName) {
      searchConditions.push({ customerName: { contains: customerName, mode: 'insensitive' } });
    }

    if (buyerEmail) {
      searchConditions.push({ buyerEmail: { contains: buyerEmail, mode: 'insensitive' } });
    }

    if (trackingId) {
      searchConditions.push({ trackingId: { contains: trackingId, mode: 'insensitive' } });
    }

    if (search) {
      const parsedOrderId = parseInt(search, 10);
      const isNum = !isNaN(parsedOrderId);

      const generalOr: any[] = [
        { sellerId: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { buyerEmail: { contains: search, mode: 'insensitive' } },
        { trackingId: { contains: search, mode: 'insensitive' } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
      ];

      if (isNum) {
        generalOr.push({ orderId: parsedOrderId });
      }

      searchConditions.push({ OR: generalOr });
    }

    if (searchConditions.length > 0) {
      where.AND = searchConditions;
    }

    const skip = (page - 1) * limit;
    const orderBy = { [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.model.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async softDelete(id: string): Promise<SellerOrder> {
    return this.model.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string): Promise<SellerOrder> {
    return this.model.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
