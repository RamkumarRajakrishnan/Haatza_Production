import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class NotificationService {
  constructor(private readonly db: DatabaseService) {}

  async getUserNotifications(sellerId: string, limit = 20) {
    if (!sellerId) return [];
    return this.db.notification.findMany({
      where: { sellerId },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(notificationId: string) {
    return this.db.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async getUnreadCount(sellerId: string) {
    if (!sellerId) return { count: 0 };
    const count = await this.db.notification.count({
      where: { sellerId, isRead: false },
    });
    return { count };
  }
}
