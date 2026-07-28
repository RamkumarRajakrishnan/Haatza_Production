import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';

@Controller()
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get('sellerwarehouseRequest')
  getWarehouseRequests(@Query('sellerId') sellerId: string) {
    return this.warehouseService.getWarehouseRequests(sellerId);
  }

  @Post('Createwarehouse')
  createWarehouse(@Body() body: any) {
    return this.warehouseService.createWarehouse(body);
  }
}
