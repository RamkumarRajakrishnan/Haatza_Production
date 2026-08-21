import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PayWithWalletDto } from './dto/wallet.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * GET /api/v1/checkWalletBalance
   * Fetch current available seller wallet balance.
   */
  async checkWalletBalance(sellerId: string) {
    const user = await this.databaseService.user.findFirst({
      where: { OR: [{ sellerId }, { id: sellerId }] },
    });
    const effectiveSellerId = user?.sellerId || sellerId;

    let wallet = await this.databaseService.sellerWallet.findUnique({
      where: { sellerId: effectiveSellerId },
    });

    if (!wallet) {
      wallet = await this.databaseService.sellerWallet.create({
        data: {
          sellerId: effectiveSellerId,
          balance: 0.0,
          currency: 'INR',
        },
      });
    }

    return {
      success: true,
      data: {
        availableBalance: Number(wallet.balance),
        currency: wallet.currency || 'INR',
      },
    };
  }

  /**
   * POST /api/v1/payWithWallet
   * Deduct wallet balance and activate Grow Plan subscription atomically.
   */
  async payWithWallet(sellerId: string, dto: PayWithWalletDto) {
    const user = await this.databaseService.user.findFirst({
      where: { OR: [{ sellerId }, { id: sellerId }] },
    });
    const effectiveSellerId = user?.sellerId || sellerId;

    // 1. Fetch Plan
    const plan = await this.databaseService.pricingPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan || plan.status !== 'ACTIVE') {
      throw new BadRequestException('Pricing plan not found or inactive.');
    }

    // 2. Calculate Pricing & Discounts
    let subtotal = Number(plan.price);
    let discount = 0;
    let appliedCouponCode: string | null = null;

    if (dto.couponCode) {
      const coupon = await this.databaseService.subscriptionCoupon.findUnique({
        where: { code: dto.couponCode.toUpperCase() },
      });

      if (coupon && coupon.status === 'ACTIVE') {
        const now = new Date();
        if (now >= coupon.startDate && now <= coupon.endDate) {
          const discountVal = Number(coupon.discountValue);
          if (coupon.discountType === 'PERCENTAGE') {
            discount = (subtotal * discountVal) / 100;
            if (coupon.maxDiscountAmount && discount > Number(coupon.maxDiscountAmount)) {
              discount = Number(coupon.maxDiscountAmount);
            }
          } else if (coupon.discountType === 'FLAT') {
            discount = Math.min(discountVal, subtotal);
          }
          appliedCouponCode = coupon.code;
        }
      }
    }

    discount = Math.round(discount * 100) / 100;
    const taxableAmount = Math.max(0, subtotal - discount);
    const cgst = Math.round(taxableAmount * 0.09 * 100) / 100;
    const sgst = Math.round(taxableAmount * 0.09 * 100) / 100;
    const netPayable = Math.round((taxableAmount + cgst + sgst) * 100) / 100;

    // 3. Fetch Wallet
    let wallet = await this.databaseService.sellerWallet.findUnique({
      where: { sellerId: effectiveSellerId },
    });

    if (!wallet) {
      wallet = await this.databaseService.sellerWallet.create({
        data: {
          sellerId: effectiveSellerId,
          balance: 0.0,
          currency: 'INR',
        },
      });
    }

    const currentBalance = Number(wallet.balance);

    if (currentBalance < netPayable) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ₹${currentBalance}, Required: ₹${netPayable}`,
      );
    }

    // 4. Atomic Prisma Transaction
    const transactionResult = await this.databaseService.$transaction(async (tx) => {
      // Deduct wallet balance
      const updatedWallet = await tx.sellerWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: netPayable },
        },
      });

      // Record wallet transaction
      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          sellerId: effectiveSellerId,
          amount: netPayable,
          type: 'DEBIT',
          description: `Subscription payment for ${plan.name} Plan`,
          referenceId: `SUB_PAY_${Date.now()}`,
        },
      });

      const startedDate = new Date();
      const endedDate = new Date(startedDate);
      const unit = (plan.periodUnit || 'MONTH').toUpperCase();
      if (unit === 'YEAR' || unit === 'ANNUAL') {
        endedDate.setFullYear(endedDate.getFullYear() + 1);
      } else if (unit === 'WEEK') {
        endedDate.setDate(endedDate.getDate() + 7);
      } else {
        endedDate.setDate(endedDate.getDate() + 30);
      }

      // Create subscription
      const subscription = await tx.sellerSubscription.create({
        data: {
          sellerId: effectiveSellerId,
          email: user?.email || `seller_${effectiveSellerId}@haatza.com`,
          phone: user?.mobile || null,
          planId: plan.id,
          planName: plan.name,
          startedDate,
          endedDate,
          status: 'ACTIVE',
          paymentId: walletTx.id,
          autoRenew: true,
        },
      });

      // Create invoice
      const invoice = await tx.sellerSubscriptionInvoice.create({
        data: {
          subscriptionId: subscription.id,
          sellerId: effectiveSellerId,
          invoiceDate: new Date(),
          sellerName: user?.companyName || user?.name || 'Valued Seller',
          address: user?.address || null,
          gstin: user?.gstin || null,
          itemName: `${plan.name} Plan Subscription`,
          rate: subtotal,
          subtotal,
          couponCode: appliedCouponCode,
          discountAmount: discount,
          taxableAmount,
          cgst,
          sgst,
          walletAmountUsed: netPayable,
          upiAmountPaid: 0.0,
          totalPayable: netPayable,
          transactionMethod: 'WALLET',
          paymentId: walletTx.id,
        },
      });

      // Update coupon usage count if used after verifying limit atomically inside transaction
      if (appliedCouponCode) {
        const dbCoupon = await tx.subscriptionCoupon.findUnique({
          where: { code: appliedCouponCode },
        });

        if (dbCoupon && dbCoupon.usageLimit !== null && dbCoupon.usageCount >= dbCoupon.usageLimit) {
          throw new BadRequestException('Coupon usage limit reached under concurrent processing.');
        }

        await tx.subscriptionCoupon.update({
          where: { code: appliedCouponCode },
          data: { usageCount: { increment: 1 } },
        });
      }

      return { subscription, invoice, newBalance: Number(updatedWallet.balance) };
    });

    return {
      success: true,
      message: 'Subscription paid successfully using wallet',
      data: {
        subscriptionId: transactionResult.subscription.id,
        invoiceId: transactionResult.invoice.id,
        amountDeducted: netPayable,
        remainingWalletBalance: transactionResult.newBalance,
        status: transactionResult.subscription.status,
      },
    };
  }
}
