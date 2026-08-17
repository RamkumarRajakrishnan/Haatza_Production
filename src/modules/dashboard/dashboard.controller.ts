import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { GetHaatzaDashboardDto } from './dto/get-haatza-dashboard.dto';
import { DashboardModule } from '@prisma/client';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(['', 'haatza'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Dashboard Page Widgets',
    description:
      'Retrieves grouped dashboard widgets filtered by categoryId, module (HAATZA or LITE), and warehouseId. Note: warehouseId is MANDATORY for LITE module and optional for HAATZA module.',
  })
  @ApiQuery({ name: 'categoryId', required: false, type: String, description: 'Optional category ID' })
  @ApiQuery({ name: 'warehouseId', required: false, type: String, description: 'Mandatory for LITE, optional for HAATZA' })
  @ApiQuery({ name: 'module', required: true, enum: DashboardModule, description: 'Mandatory module name' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard widgets retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request (e.g. missing warehouseId for LITE module)',
  })
  async getHaatzaDashboard(@Query() dto: GetHaatzaDashboardDto) {
    return this.dashboardService.getHaatzaDashboard(dto);
  }

  @Post(['upsert', ''])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upsert single or bulk Dashboard Widgets',
    description: 'Insert or update one or multiple dashboard widgets. Unique sequential widget IDs (WID001, WID002...) are generated automatically if not provided.',
  })
  @ApiBody({ description: 'Single widget object or array of widget objects' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard widget(s) upserted successfully',
  })
  async upsertWidgets(@Body() body: any) {
    return this.dashboardService.upsertWidgets(body);
  }
}
