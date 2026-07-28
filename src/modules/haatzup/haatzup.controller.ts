import { Controller, Get, Post, Delete, Body, Query, Param } from '@nestjs/common';
import { HaatzUpService } from './haatzup.service';

@Controller()
export class HaatzUpController {
  constructor(private readonly haatzupService: HaatzUpService) {}

  @Get('sellerhaatzupProducts')
  getHaatzUpProducts(@Query('sellerId') sellerId: string) {
    return this.haatzupService.getHaatzUpProducts(sellerId);
  }

  @Post('generateHashtags')
  generateHashtags(@Body() body: any) {
    return this.haatzupService.generateHashtags(body.title || body.description);
  }

  @Post('uploadhaatzupVideo')
  uploadVideo(@Body() body: any) {
    return this.haatzupService.uploadVideo(body);
  }

  @Get('SellerwiseHaatzUp')
  getSellerHaatzUp(@Query('sellerId') sellerId: string) {
    return this.haatzupService.getSellerHaatzUp(sellerId);
  }

  @Get('sellerHaatzUpdetails')
  getHaatzUpDetails(@Query('videoId') videoId: string) {
    return this.haatzupService.getHaatzUpDetails(videoId);
  }

  @Post('deletehaatzupVideo')
  deleteVideo(@Body() body: any) {
    return this.haatzupService.deleteVideo(body.videoId);
  }
}
