import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class SupportService {
  constructor(private db: DatabaseService) {}

  async getNotifications(sellerId: string) {
    return this.db.notification.findMany({ where: { sellerId } });
  }

  async updateNotification(id: string, isRead: boolean) {
    return this.db.notification.update({ where: { id }, data: { isRead } });
  }

  async getTickets(sellerId: string) {
    return this.db.supportTicket.findMany({ where: { sellerId } });
  }

  async createTicket(data: any) {
    return this.db.supportTicket.create({
      data: {
        sellerId: data.sellerId || 'seller-1',
        subject: data.subject || 'Support Ticket',
        description: data.description || '',
      },
    });
  }

  getTutorials() {
    return [
      { id: '1', title: 'Getting Started as a Seller', videoUrl: 'https://cdn.haatza.com/tutorials/intro.mp4' },
      { id: '2', title: 'Managing Products & Inventory', videoUrl: 'https://cdn.haatza.com/tutorials/products.mp4' },
    ];
  }
}
