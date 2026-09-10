import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrdersDto } from './dto/create-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { ModuleParam } from './decorators/module-param.decorator';

@ApiTags('Orders')
@Controller([
  '',
  'api',
  'api/v1',
  'api/cart',
  'api/v1/cart',
  'api/orders',
  'api/v1/orders',
  'orders',
  '_functions',
])
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({
    summary: 'Create orders in parallel (POST /createOrders or /api/cart/createOrders)',
    description:
      'Replicates Wix post_createorder handler. Processes order entries in parallel, persists Order, CustomerOrder, SellerOrder records, handles wallet deduction, and generates date-scoped invoice numbers.',
  })
  @ApiQuery({
    name: 'module',
    enum: ['haatza', 'lite'],
    required: true,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders processed successfully',
    schema: {
      example: {
        status: 'success',
        message: {
          message: 'Orders processed',
          results: [
            {
              orderId: 10001,
              invoiceNumber: 'INV-20260910-001',
              productId: 'PROD_123',
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid module or validation error',
  })
  @Post(['createOrders', 'orders/createOrders'])
  @HttpCode(HttpStatus.OK)
  async createOrders(
    @ModuleParam() module: 'haatza' | 'lite',
    @Body() dto: CreateOrdersDto,
  ) {
    return this.ordersService.createOrders(dto, module);
  }

  @ApiOperation({
    summary: 'Get customer orders list (GET /getOrders or /api/cart/getOrders)',
    description:
      'Replicates Wix get_customerorderslist handler. Retrieves customer orders filtered by buyerEmail and status category, sorted descending by createdDate with in-memory pagination.',
  })
  @ApiQuery({
    name: 'module',
    enum: ['haatza', 'lite'],
    required: true,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiQuery({
    name: 'buyerEmail',
    required: true,
    type: String,
    description: 'Buyer email address',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Status category (ordered, shipped, delivered, cancelled, returned, exchange)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size limit (default 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    schema: {
      example: {
        status: 'success',
        message: {
          data: [
            {
              tableId: 'uuid',
              orderId: '10001',
              name: 'Product Name',
              quantity: 1,
              price: 999,
              src: 'https://static.wixstatic.com/media/...',
              productId: 'PROD_123',
              productOption: {},
              status: 'Order Placed',
            },
          ],
          pagination: {
            totalResults: 1,
            totalPages: 1,
            currentPage: 1,
            pageSize: 10,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid module or missing parameters',
  })
  @Get(['getOrders', 'orders/getOrders', 'cart/getOrders', 'api/cart/getOrders'])
  @HttpCode(HttpStatus.OK)
  async getOrders(
    @ModuleParam() module: 'haatza' | 'lite',
    @Query() query: GetOrdersQueryDto,
  ) {
    return this.ordersService.getOrders(query, module);
  }

  @ApiOperation({
    summary: 'Get order details (GET /orders/:tableId or /getOrderDetails)',
    description:
      'Replicates Wix get_custmerordersdetails handler. Fetches CustomerOrder record enriched with seller profile and product category metadata.',
  })
  @ApiParam({
    name: 'tableId',
    required: false,
    description: 'Order table UUID or orderId',
  })
  @ApiQuery({
    name: 'tableId',
    required: false,
    type: String,
    description: 'Order table UUID or orderId (query parameter alternative)',
  })
  @ApiQuery({
    name: 'module',
    enum: ['haatza', 'lite'],
    required: true,
    description: 'Target module (strictly case-sensitive: haatza or lite)',
  })
  @ApiResponse({
    status: 200,
    description: 'Order details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid module or tableId parameter',
  })
  @Get([
    'getOrderDetails',
    'getOrderDetails/:tableId',
    'orders/getOrderDetails',
    'orders/getOrderDetails/:tableId',
    'orders/:tableId',
  ])
  @HttpCode(HttpStatus.OK)
  async getOrderDetails(
    @ModuleParam() module: 'haatza' | 'lite',
    @Param('tableId') paramTableId?: string,
    @Query('tableId') queryTableId?: string,
  ) {
    const tableId = paramTableId || queryTableId || '';
    return this.ordersService.getOrderDetails(tableId, module);
  }
}
