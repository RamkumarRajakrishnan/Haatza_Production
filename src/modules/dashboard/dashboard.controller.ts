import { Controller, Get, Query, Post } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { GetDashboardWidgetsDto } from './dto/get-dashboard-widgets.dto';

@Controller(['dashboard', 'api/dashboard', 'api/lite'])
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('widgets')
  @Get('get_LitePageWidgets')
  async getLitePageWidgets(@Query() query: GetDashboardWidgetsDto) {
    return this.dashboardService.getLitePageWidgets(query);
  }

  @Post('clear-cache')
  async clearCache() {
    return this.dashboardService.clearCache();
  }
}
