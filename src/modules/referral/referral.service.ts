import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { UpdateReferralRewardDto } from './dto/referral.dto';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  private async getOrCreateSellerReferral(sellerId: string) {
    let referral = await this.databaseService.sellerReferral.findUnique({
      where: { sellerId },
    });

    if (!referral) {
      const user = await this.databaseService.user.findFirst({
        where: { OR: [{ sellerId }, { id: sellerId }] },
      });
      const namePart = (user?.name || 'SELLER').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 5);
      const randomPart = Math.floor(100 + Math.random() * 900);
      const referralCode = `${namePart}${randomPart}`;

      const baseUrl = process.env.FRONTEND_URL || 'https://seller.haatza.com';
      const referralLink = `${baseUrl}/register?ref=${referralCode}`;

      referral = await this.databaseService.sellerReferral.create({
        data: {
          sellerId,
          referralCode,
          referralLink,
          pointsBalance: 500.0, // Initial bonus points for testing
          totalEarned: 500.0,
        },
      });
    }

    return referral;
  }

  /**
   * GET /api/v1/sellerReferralcode
   */
  async getReferralCode(sellerId: string) {
    const user = await this.databaseService.user.findFirst({
      where: { OR: [{ sellerId }, { id: sellerId }] },
    });
    const effectiveSellerId = user?.sellerId || sellerId;

    const referral = await this.getOrCreateSellerReferral(effectiveSellerId);

    return {
      success: true,
      data: {
        referralCode: referral.referralCode,
        referralLink: referral.referralLink || `https://haatza.com/register?ref=${referral.referralCode}`,
      },
    };
  }

  /**
   * GET /api/v1/referral/balance
   */
  async checkReferralBalance(sellerId: string) {
    const user = await this.databaseService.user.findFirst({
      where: { OR: [{ sellerId }, { id: sellerId }] },
    });
    const effectiveSellerId = user?.sellerId || sellerId;

    const referral = await this.getOrCreateSellerReferral(effectiveSellerId);
    const balance = Number(referral.pointsBalance);

    return {
      success: true,
      data: {
        availablePoints: balance,
        availableCredit: balance,
        currency: 'INR',
      },
    };
  }

  /**
   * GET /_functions/referralCheck?referralCode={code}
   */
  async verifyReferralCode(referralCode: string) {
    const referral = await this.databaseService.sellerReferral.findUnique({
      where: { referralCode },
    });

    if (!referral) {
      throw new BadRequestException('Invalid or expired referral code');
    }

    return {
      success: true,
      data: {
        valid: true,
        sellerId: referral.sellerId,
        referralCode: referral.referralCode,
      },
      message: 'Referral code is valid',
    };
  }

  /**
   * POST /api/v1/referralUpdate
   * Atomically deduct referral points used for subscription discount.
   */
  async referralUpdate(sellerId: string, dto: UpdateReferralRewardDto) {
    const user = await this.databaseService.user.findFirst({
      where: { OR: [{ sellerId }, { id: sellerId }] },
    });
    const effectiveSellerId = user?.sellerId || sellerId;

    const referral = await this.getOrCreateSellerReferral(effectiveSellerId);
    const currentPoints = Number(referral.pointsBalance);

    if (dto.pointsToUse > currentPoints) {
      throw new BadRequestException(
        `Insufficient referral points. Available: ${currentPoints}, Requested: ${dto.pointsToUse}`,
      );
    }

    const subscription = await this.databaseService.sellerSubscription.findUnique({
      where: { id: dto.subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription record not found.');
    }

    const result = await this.databaseService.$transaction(async (tx) => {
      const updatedReferral = await tx.sellerReferral.update({
        where: { id: referral.id },
        data: {
          pointsBalance: { decrement: dto.pointsToUse },
        },
      });

      await tx.referralTransaction.create({
        data: {
          referralId: referral.id,
          sellerId: effectiveSellerId,
          points: dto.pointsToUse,
          type: 'REDEEMED',
          description: `Redeemed ${dto.pointsToUse} referral points for subscription ${dto.subscriptionId}`,
        },
      });

      return updatedReferral;
    });

    return {
      success: true,
      message: 'Referral points redeemed successfully',
      data: {
        subscriptionId: dto.subscriptionId,
        pointsUsed: dto.pointsToUse,
        remainingPoints: Number(result.pointsBalance),
      },
    };
  }

  /**
   * GET /api/v1/sellerreferral
   */
  async getSellerReferrals(sellerId: string) {
    const user = await this.databaseService.user.findFirst({
      where: { OR: [{ sellerId }, { id: sellerId }] },
    });
    const effectiveSellerId = user?.sellerId || sellerId;

    const referral = await this.getOrCreateSellerReferral(effectiveSellerId);

    const transactions = await this.databaseService.referralTransaction.findMany({
      where: { referralId: referral.id },
      orderBy: { createdAt: 'desc' },
    });

    const referredSellers = transactions.map((t, idx) => ({
      sellerId: t.referredSellerId || `seller_ref_${idx + 1}`,
      name: `Referred Seller #${idx + 1}`,
      joinedAt: t.createdAt.toISOString(),
      status: 'ACTIVE',
      rewardEarned: Number(t.points),
    }));

    return {
      success: true,
      data: referredSellers,
    };
  }
}
