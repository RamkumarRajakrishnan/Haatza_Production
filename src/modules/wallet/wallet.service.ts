import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PayWithWalletDto } from './dto/wallet.dto';
import { HARDCODED_PLANS } from '../subscription/subscription.service';

const toISTDate = (dateInput: Date | string | number | null | undefined): Date | null => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
};

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * GET /api/v1/checkWalletBalance
   * Fetch current available seller wallet balance.
   */
  async checkWalletBalance(sellerId: string, email?: string) {
    const user = await this.databaseService.user.findFirst({
      where: {
        OR: [
          ...(sellerId ? [{ sellerId }, { id: sellerId }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    });
    const effectiveSellerId = user?.sellerId || sellerId;

    if (!effectiveSellerId) {
      throw new BadRequestException('Seller ID or email is required.');
    }

    let wallet = await this.databaseService.sellerWallet.findUnique({
      where: { sellerId: effectiveSellerId },
    });

    if (!wallet) {
      wallet = await this.databaseService.sellerWallet.create({
        data: {
          sellerId: effectiveSellerId,
          usableBalance: 0.0,
          remainingBalance: 0.0,
          totalAddedAmount: 0.0,
          gstAmount: 0.0,
        },
      });
    }

    return {
      success: true,
      data: {
        availableBalance: Number(wallet.usableBalance ?? 0.0),
        currency: 'INR',
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
    const plan = HARDCODED_PLANS.find(p => p.id === dto.planId);

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
          usableBalance: 0.0,
          remainingBalance: 0.0,
          totalAddedAmount: 0.0,
          gstAmount: 0.0,
        },
      });
    }

    const currentBalance = Number(wallet.usableBalance ?? 0.0);

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
          usableBalance: { decrement: netPayable },
          remainingBalance: { decrement: netPayable },
        },
      });

      // Record wallet transaction
      const walletTx = await tx.walletTransaction.create({
        data: {
          sellerId: effectiveSellerId,
          transactionType: 'Debit',
          transactionAmount: netPayable,
          gstDeducted: cgst + sgst,
          remainingBalance: Number(updatedWallet.remainingBalance ?? 0.0),
          campaignSpends: false,
          total: netPayable,
          paymentId: `SUB_PAY_${Date.now()}`,
        },
      });

      const startedDate = toISTDate(new Date())!;
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
          createdAt: startedDate, // Explicitly save creation time as IST
        },
      });

      // Create invoice
      const invoice = await tx.sellerSubscriptionInvoice.create({
        data: {
          subscriptionId: subscription.id,
          sellerId: effectiveSellerId,
          invoiceDate: toISTDate(new Date())!,
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

      return { subscription, invoice, newBalance: Number(updatedWallet.usableBalance ?? 0.0) };
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
