import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@Controller(['admin', 'api/admin'])
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({ summary: 'Get platform high-level metrics and system health' })
  @Get(['', 'metrics', 'dashboard'])
  getMetrics() {
    return this.adminService.getMetrics();
  }

  @ApiOperation({ summary: 'Get pending seller onboarding applications' })
  @Get('sellers/pending')
  getPendingSellers() {
    return this.adminService.getPendingSellers();
  }

  @ApiOperation({ summary: 'Approve seller onboarding application' })
  @Post('sellers/:id/approve')
  approveSeller(@Param('id') paramId: string, @Body() body: any) {
    const userId = paramId || body?.userId;
    return this.adminService.approveSeller(userId);
  }

  @ApiOperation({ summary: 'Reject seller onboarding application' })
  @Post('sellers/:id/reject')
  rejectSeller(@Param('id') paramId: string, @Body() body: any) {
    const userId = paramId || body?.userId;
    return this.adminService.rejectSeller(userId, body?.reason);
  }
}
