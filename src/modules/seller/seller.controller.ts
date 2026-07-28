import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { SellerService } from './seller.service';

@Controller()
export class SellerController {
  constructor(private readonly sellerService: SellerService) {}

  @Get('seller/profile')
  getProfile(@Query('userId') userId: string) {
    return this.sellerService.getProfile(userId);
  }

  @Get('sellerdata')
  getSellerData(@Query('userId') userId: string) {
    return this.sellerService.getProfile(userId);
  }

  @Get('onboardStatus')
  getOnboardStatus(@Query('userId') userId: string) {
    return this.sellerService.getOnboardStatus(userId);
  }

  @Post('Selleronboarding')
  onboardSeller(@Body() body: any) {
    return this.sellerService.updateOnboarding(body.userId, body);
  }

  @Post('updateSelleronboarding')
  updateSelleronboarding(@Body() body: any) {
    return this.sellerService.updateOnboarding(body.userId, body);
  }

  @Get('bankList')
  getBankList() {
    return this.sellerService.getBankList();
  }

  @Get('checksellergst')
  checkGst(@Query('gstin') gstin: string) {
    return this.sellerService.checkGst(gstin);
  }

  @Get('sellercheckVersion')
  checkVersion() {
    return this.sellerService.checkVersion();
  }

  @Get('checkseller')
  checkSeller(@Query('mobile') mobile: string, @Query('email') email: string) {
    return this.sellerService.checkSeller(mobile, email);
  }

  @Post('deleteAccount')
  deleteAccount(@Body() body: any) {
    return this.sellerService.deleteAccount(body.userId);
  }
}
