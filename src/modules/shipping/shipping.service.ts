import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ShippingService {
  constructor(private db: DatabaseService) {}

  getDeliveryAmount(payload: any) {
    const pincode = payload.pincode || '560001';
    const weight = payload.weight || 0.5;
    return {
      pincode,
      weight,
      deliveryFee: 60.0,
      codCharges: 30.0,
      totalShippingFee: 90.0,
    };
  }

  getExpectedTat(payload: any) {
    return {
      originPincode: payload.originPincode || '110001',
      destinationPincode: payload.destinationPincode || '560001',
      estimatedDays: 3,
      expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async createShipment(payload: any) {
    const awbNumber = `AWB-${Date.now()}`;
    if (payload.orderId) {
      await this.db.order.update({ where: { id: payload.orderId }, data: { awbNumber } }).catch(() => null);
    }
    return {
      success: true,
      awbNumber,
      courierPartner: 'Delhivery / BlueDart',
      pickupDate: new Date().toISOString(),
    };
  }

  async createExchangeShipment(payload: any) {
    return {
      success: true,
      exchangeAwbNumber: `EX-AWB-${Date.now()}`,
      reversePickupStatus: 'SCHEDULED',
    };
  }

  async cancelShipment(payload: any) {
    return {
      success: true,
      awb: payload.awbNumber || payload.awb,
      status: 'CANCELLED',
    };
  }

  getPackingSlip(orderId: string) {
    return {
      orderId,
      packingSlipUrl: `https://cdn.haatza.com/slips/packing-slip-${orderId}.pdf`,
    };
  }

  trackShipping(awb: string) {
    return {
      awb,
      currentStatus: 'IN_TRANSIT',
      location: 'Bangalore Sorting Hub',
      scans: [
        { status: 'PICKED_UP', timestamp: new Date(Date.now() - 86400000).toISOString() },
        { status: 'IN_TRANSIT', timestamp: new Date().toISOString() },
      ],
    };
  }
}
