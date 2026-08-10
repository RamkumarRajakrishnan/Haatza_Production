import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { GetHaatzaDashboardDto } from './dto/get-haatza-dashboard.dto';

@ApiTags('Dashboard')
@Controller(['dashboard', 'api/dashboard', 'api/v1/dashboard'])
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('haatza')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get HAATZA Dashboard Page Widgets',
    description: 'Retrieves grouped dashboard widgets for HAATZA module filtered by categoryId and optional warehouseId.',
  })
  @ApiQuery({ name: 'categoryId', required: true, type: String, example: 'c6d480e9-52c4-7b1c-c14c-de187bb61f3c' })
  @ApiQuery({ name: 'warehouseId', required: false, type: String, example: 'WH00001' })
  @ApiResponse({
    status: 200,
    description: 'HAATZA dashboard widgets retrieved successfully',
  })
  async getHaatzaDashboard(@Query() dto: GetHaatzaDashboardDto) {
    return this.dashboardService.getHaatzaDashboard(dto);
  }
}
