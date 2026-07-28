import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class SubscriptionService {
  constructor(private db: DatabaseService) {}

  async getPlans() {
    let plans = await this.db.subscriptionPlan.findMany();
    if (plans.length === 0) {
      plans = [
        await this.db.subscriptionPlan.create({ data: { name: 'Starter Seller Plan', price: 999.0, duration: 'MONTHLY' } }),
        await this.db.subscriptionPlan.create({ data: { name: 'Pro Seller Plan', price: 2499.0, duration: 'MONTHLY' } }),
      ];
    }
    return plans;
  }

  async createSubscription(data: any) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return this.db.sellerSubscription.upsert({
      where: { sellerId: data.sellerId || 'seller-1' },
      update: { planId: data.planId, status: 'ACTIVE', expiresAt },
      create: { sellerId: data.sellerId || 'seller-1', planId: data.planId || 'plan-1', status: 'ACTIVE', expiresAt },
    });
  }

  async processSubscriptionOrder(data: any) {
    return { success: true, transactionId: `sub_tx_${Date.now()}`, status: 'SUCCESS' };
  }

  async getSellerSubscription(sellerId: string) {
    return this.db.sellerSubscription.findUnique({ where: { sellerId } });
  }

  getActiveCoupons() {
    return [
      { code: 'HAATZA10', discount: '10%', description: '10% off on subscription' },
      { code: 'WELCOME50', discount: '50% Off', description: '50% off first month' },
    ];
  }

  async referralWithdraw(data: any) {
    return { success: true, amount: data.amount || 500, status: 'PROCESSING' };
  }

  async referralCheck(code: string) {
    return { valid: true, code, discountPercent: 15 };
  }

  async referralUpdate(data: any) {
    return { success: true, referralId: data.referralId, status: data.status || 'QUALIFIED' };
  }

  async getSellerReferrals(sellerId: string) {
    return this.db.referral.findMany({ where: { referrerId: sellerId } });
  }

  async getSellerReferralCode(sellerId: string) {
    return { sellerId, code: `REF-${sellerId.substring(0, 6).toUpperCase()}`, shareUrl: `https://seller.haatza.com/register?ref=${sellerId}` };
  }
}
