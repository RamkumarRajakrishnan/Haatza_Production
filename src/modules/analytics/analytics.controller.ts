import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Reports')
@Controller(['analytics', 'reports', 'api/analytics', 'api/reports'])
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get(['', 'analytics'])
  getAnalytics(@Query('sellerId') sellerId: string) {
    return this.analyticsService.getAnalytics(sellerId);
  }

  @Get(['dashboard'])
  getDashboard(@Query('sellerId') sellerId: string) {
    return this.analyticsService.getDashboard(sellerId);
  }
}
