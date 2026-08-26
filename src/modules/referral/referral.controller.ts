import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ReferralService } from './referral.service';
import { UpdateReferralRewardDto } from './dto/referral.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Seller Subscription Referrals')
@Controller(['_functions', 'api/v1', ''])
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get(['sellerReferralcode', 'referral/code'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Seller Unique Referral Code & Link' })
  async getReferralCode(@Req() req: any) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.referralService.getReferralCode(sellerId);
  }

  @Get('referral/balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check Available Referral Reward Points & Credit' })
  async checkReferralBalance(@Req() req: any) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.referralService.checkReferralBalance(sellerId);
  }

  @Get(['referralCheck', 'referral/verify'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a Referral/Promo Code' })
  async verifyReferralCode(@Query('referralCode') referralCode: string) {
    if (!referralCode) {
      return { success: false, message: 'referralCode is required' };
    }
    return await this.referralService.verifyReferralCode(referralCode);
  }

  @Post(['referralUpdate', 'referral/update'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redeem Referral Reward Points for Subscription' })
  @ApiBody({ type: UpdateReferralRewardDto })
  async referralUpdate(@Req() req: any, @Body() dto: UpdateReferralRewardDto) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.referralService.referralUpdate(sellerId, dto);
  }

  @Get(['sellerreferral', 'referral/sellers'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get List of Referred Sellers and Earned Rewards' })
  async getSellerReferrals(@Req() req: any) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.referralService.getSellerReferrals(sellerId);
  }
}
