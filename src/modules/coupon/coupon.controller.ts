import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { CouponService } from './coupon.service';
import { ValidateCouponDto } from './dto/coupon.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Seller Subscription Coupons')
@Controller(['_functions', 'api/v1', ''])
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Get(['activeCoupons', 'coupon/active-coupons'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Active Subscription Coupons' })
  @ApiResponse({ status: 200, description: 'Active coupons fetched successfully' })
  async getActiveCoupons(@Req() req: any) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.couponService.getActiveCoupons(sellerId);
  }

  @Post(['validateCoupon', 'coupon/validate'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate Coupon Code & Calculate Discounts' })
  @ApiBody({ type: ValidateCouponDto })
  async validateCoupon(@Req() req: any, @Body() dto: ValidateCouponDto) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.couponService.validateCoupon(sellerId, dto);
  }
}
