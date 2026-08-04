import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@Controller(['inventory', 'api/inventory'])
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @ApiOperation({ summary: 'Get seller inventory list' })
  @Get(['', 'sellerproductInventory'])
  getInventory(
    @Query('sellerId') sellerId?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.inventoryService.getInventory(
      sellerId,
      limit ? parseInt(limit, 10) : 50,
      page ? parseInt(page, 10) : 1,
    );
  }

  @ApiOperation({ summary: 'Increment product stock level' })
  @Post(['increment', 'incrementInventory'])
  incrementInventory(@Body() body: any) {
    return this.inventoryService.incrementInventory(body);
  }

  @ApiOperation({ summary: 'Decrement product stock level' })
  @Post(['decrement', 'decrementInventory'])
  decrementInventory(@Body() body: any) {
    return this.inventoryService.decrementInventory(body);
  }
}
