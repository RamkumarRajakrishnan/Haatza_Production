import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class SellerService {
  constructor(private db: DatabaseService) {}

  async getProfile(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { seller: true },
    });
    if (!user) throw new NotFoundException('User profile not found');
    return user;
  }

  async updateOnboarding(userId: string, data: any) {
    return this.db.seller.upsert({
      where: { userId },
      update: { businessName: data.businessName || 'Seller Store', gstNumber: data.gstNumber, address: data.address },
      create: { userId, businessName: data.businessName || 'Seller Store', gstNumber: data.gstNumber, address: data.address },
    });
  }

  async getOnboardStatus(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    return { onboardStatus: user?.onboardStatus || 'PENDING' };
  }

  getBankList() {
    return [
      { id: '1', name: 'State Bank of India', code: 'SBIN' },
      { id: '2', name: 'HDFC Bank', code: 'HDFC' },
      { id: '3', name: 'ICICI Bank', code: 'ICIC' },
      { id: '4', name: 'Axis Bank', code: 'UTIB' },
    ];
  }

  async checkGst(gst: string) {
    return { valid: true, gstin: gst, businessName: 'Verified Merchant' };
  }

  checkVersion() {
    return { minVersion: '1.0.0', latestVersion: '2.5.0', forceUpdate: false };
  }

  async checkSeller(mobile: string, email: string) {
    const existing = await this.db.user.findFirst({
      where: { OR: [{ mobile }, { email }] },
    });
    return { exists: !!existing, user: existing };
  }

  async deleteAccount(userId: string) {
    await this.db.user.update({ where: { id: userId }, data: { status: 'INACTIVE', deletedAt: new Date() } });
    return { success: true, message: 'Seller account deleted successfully' };
  }
}
