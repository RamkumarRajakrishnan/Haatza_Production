import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class WarehouseService {
  constructor(private db: DatabaseService) {}

  async getWarehouseRequests(sellerId: string) {
    return this.db.warehouse.findMany({ where: { sellerId } });
  }

  async createWarehouse(data: any) {
    return this.db.warehouse.create({
      data: {
        sellerId: data.sellerId || 'seller-1',
        name: data.name || 'Main Warehouse',
        address: data.address || 'Industrial Area',
        pincode: data.pincode || '560001',
        city: data.city || 'Bangalore',
        state: data.state || 'Karnataka',
      },
    });
  }
}
