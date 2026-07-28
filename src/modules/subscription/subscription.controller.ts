import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

@Controller()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('getPlans')
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  @Post('createSubscription')
  createSubscription(@Body() body: any) {
    return this.subscriptionService.createSubscription(body);
  }

  @Post('processSubscriptionOrder')
  processSubscriptionOrder(@Body() body: any) {
    return this.subscriptionService.processSubscriptionOrder(body);
  }

  @Get('sellersubscription')
  getSellerSubscription(@Query('sellerId') sellerId: string) {
    return this.subscriptionService.getSellerSubscription(sellerId);
  }

  @Get('activeCoupons')
  getActiveCoupons() {
    return this.subscriptionService.getActiveCoupons();
  }

  @Post('referralWithdraw')
  referralWithdraw(@Body() body: any) {
    return this.subscriptionService.referralWithdraw(body);
  }

  @Get('referralCheck')
  referralCheck(@Query('code') code: string) {
    return this.subscriptionService.referralCheck(code);
  }

  @Post('referralUpdate')
  referralUpdate(@Body() body: any) {
    return this.subscriptionService.referralUpdate(body);
  }

  @Get('sellerreferral')
  getSellerReferrals(@Query('sellerId') sellerId: string) {
    return this.subscriptionService.getSellerReferrals(sellerId);
  }

  @Get('sellerReferralcode')
  getSellerReferralCode(@Query('sellerId') sellerId: string) {
    return this.subscriptionService.getSellerReferralCode(sellerId);
  }
}
