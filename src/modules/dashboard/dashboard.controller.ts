import { Controller, Get, Post, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { GetHaatzaDashboardDto } from './dto/get-haatza-dashboard.dto';
import { DashboardModule } from '@prisma/client';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(['', 'haatza', 'widgets', 'v2', 'get-data', 'data'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Dashboard Page Widgets',
    description: 'Retrieves grouped dashboard widgets filtered by categoryId, optional warehouseId, and module (HAATZA or LITE).',
  })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'module', required: true, enum: DashboardModule })
  @ApiResponse({
    status: 200,
    description: 'HAATZA dashboard widgets retrieved successfully',
  })
  async getHaatzaDashboard(@Query() dto: GetHaatzaDashboardDto) {
    return this.dashboardService.getHaatzaDashboard(dto);
  }

  @Get('ping')
  @HttpCode(HttpStatus.OK)
  ping() {
    return { status: 'ok', version: 'v2-raw-sql-active' };
  }

  @Post(['upsert', ''])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upsert single or bulk Dashboard Widgets',
    description: 'Insert or update one or multiple dashboard widgets.',
  })
  @ApiBody({ description: 'Single widget object or array of widget objects' })
  async upsertWidgets(@Body() body: any) {
    return this.dashboardService.upsertWidgets(body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete Dashboard Widget by ID or widgetId',
    description: 'Deletes a dashboard widget permanently from the database using id or widgetId.',
  })
  async deleteWidget(@Param('id') id: string) {
    return this.dashboardService.deleteWidget(id);
  }
}
