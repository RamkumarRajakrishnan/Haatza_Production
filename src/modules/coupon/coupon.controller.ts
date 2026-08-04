import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CouponService } from './coupon.service';

@ApiTags('Coupons')
@Controller(['coupons', 'api/coupons'])
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @ApiOperation({ summary: 'Validate and apply discount coupon' })
  @Post(['validate', 'apply'])
  validateCoupon(@Body() body: any) {
    return this.couponService.validateCoupon(
      body.code || body.couponCode,
      Number(body.cartTotal || body.total) || 0,
    );
  }
}
