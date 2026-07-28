import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { SupportService } from './support.service';

@Controller()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('notifications')
  getNotifications(@Query('sellerId') sellerId: string) {
    return this.supportService.getNotifications(sellerId);
  }

  @Post('updateNotification')
  updateNotification(@Body() body: any) {
    return this.supportService.updateNotification(body.id, body.isRead);
  }

  @Get('sellertickets')
  getTickets(@Query('sellerId') sellerId: string) {
    return this.supportService.getTickets(sellerId);
  }

  @Post('createTicket')
  createTicket(@Body() body: any) {
    return this.supportService.createTicket(body);
  }

  @Get('SellerTutorials')
  getTutorials() {
    return this.supportService.getTutorials();
  }
}
