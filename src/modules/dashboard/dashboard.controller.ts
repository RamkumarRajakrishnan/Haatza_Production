import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
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
}
