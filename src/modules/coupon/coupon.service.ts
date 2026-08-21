import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ValidateCouponDto } from './dto/coupon.dto';

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * GET /api/v1/activeCoupons
   * Fetch active coupons applicable for Grow Plan subscriptions.
   */
  async getActiveCoupons(sellerId?: string) {
    const now = new Date();

    const coupons = await this.databaseService.subscriptionCoupon.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    const validCoupons = coupons
      .filter((c) => c.usageLimit === null || c.usageCount < c.usageLimit)
      .map((c) => ({
        couponId: c.id,
        code: c.code,
        discountType: c.discountType,
        discountValue: Number(c.discountValue),
        description: c.description || `${c.discountValue}% off on subscription`,
        validUntil: c.endDate.toISOString().split('T')[0],
      }));

    return {
      success: true,
      message: 'Active coupons fetched successfully',
      data: validCoupons,
    };
  }

  /**
   * POST /api/v1/validateCoupon
   * Validate promo code and calculate subtotal, discount, GST, and net payable.
   */
  async validateCoupon(sellerId: string, dto: ValidateCouponDto) {
    const plan = await this.databaseService.pricingPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan || plan.status !== 'ACTIVE') {
      throw new BadRequestException('Invalid or inactive pricing plan.');
    }

    const coupon = await this.databaseService.subscriptionCoupon.findUnique({
      where: { code: dto.couponCode.toUpperCase() },
    });

    if (!coupon || coupon.status !== 'ACTIVE') {
      throw new BadRequestException('Invalid or inactive coupon code.');
    }

    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new BadRequestException('Coupon code has expired or is not active yet.');
    }

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit has been reached.');
    }

    const subtotal = Number(plan.price);
    if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
      throw new BadRequestException(`Minimum plan amount required for coupon is ₹${coupon.minOrderAmount}.`);
    }

    let discount = 0;
    const discountVal = Number(coupon.discountValue);

    if (coupon.discountType === 'PERCENTAGE') {
      discount = (subtotal * discountVal) / 100;
      if (coupon.maxDiscountAmount && discount > Number(coupon.maxDiscountAmount)) {
        discount = Number(coupon.maxDiscountAmount);
      }
    } else if (coupon.discountType === 'FLAT') {
      discount = Math.min(discountVal, subtotal);
    }

    discount = Math.round(discount * 100) / 100;
    const taxableAmount = Math.max(0, subtotal - discount);
    const gst = Math.round(taxableAmount * 0.18 * 100) / 100; // 18% GST
    const netPayable = Math.round((taxableAmount + gst) * 100) / 100;

    return {
      success: true,
      message: 'Coupon applied successfully',
      data: {
        planId: plan.id,
        subtotal,
        discount,
        gst,
        netPayable,
        couponCode: coupon.code,
      },
    };
  }
}
