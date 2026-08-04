import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  async getMetrics() {
    const [totalUsers, totalSellers, totalProducts, totalOrders] = await Promise.all([
      this.db.user.count(),
      this.db.seller.count(),
      this.db.product.count(),
      this.db.order.count(),
    ]);

    return {
      totalUsers,
      totalSellers,
      totalProducts,
      totalOrders,
      systemHealth: 'OPERATIONAL',
      timestamp: new Date().toISOString(),
    };
  }

  async getPendingSellers() {
    return this.db.user.findMany({
      where: {
        role: 'SELLER',
        onboardStatus: 'PENDING',
      },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        companyName: true,
        gstin: true,
        panNumber: true,
        onboardStatus: true,
        createdAt: true,
      },
    });
  }

  async approveSeller(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Seller user not found');
    }

    return this.db.user.update({
      where: { id: userId },
      data: {
        onboardStatus: 'ACTIVE',
        status: 'ACTIVE',
      },
    });
  }

  async rejectSeller(userId: string, reason?: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Seller user not found');
    }

    return this.db.user.update({
      where: { id: userId },
      data: {
        onboardStatus: 'REJECTED',
      },
    });
  }
}
