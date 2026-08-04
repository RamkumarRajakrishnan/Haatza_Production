import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CouponService {
  constructor(private readonly db: DatabaseService) {}

  async validateCoupon(code: string, cartTotal: number) {
    if (!code) {
      throw new BadRequestException('Coupon code is required');
    }

    const uppercaseCode = code.trim().toUpperCase();

    // Sample default coupon logic for testing/checkout integrations
    if (uppercaseCode === 'WELCOME10') {
      const discount = Math.round(cartTotal * 0.1);
      return {
        valid: true,
        code: uppercaseCode,
        discountType: 'PERCENTAGE',
        discountValue: 10,
        discountAmount: discount,
        finalTotal: Math.max(0, cartTotal - discount),
        message: 'Coupon WELCOME10 applied successfully!',
      };
    }

    if (uppercaseCode === 'HAATZA50') {
      const discount = Math.min(50, cartTotal);
      return {
        valid: true,
        code: uppercaseCode,
        discountType: 'FIXED',
        discountValue: 50,
        discountAmount: discount,
        finalTotal: Math.max(0, cartTotal - discount),
        message: 'Coupon HAATZA50 applied successfully!',
      };
    }

    throw new BadRequestException('Invalid or expired coupon code');
  }
}
