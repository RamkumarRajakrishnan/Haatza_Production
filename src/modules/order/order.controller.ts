import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { OrderService } from './order.service';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get('sellernewOrders')
  getNewOrders(@Query('sellerId') sellerId: string) {
    return this.orderService.getSellerOrders(sellerId);
  }

  @Get('sellerOrderdetails')
  getOrderDetails(@Query('orderId') orderId: string) {
    return this.orderService.getOrderDetails(orderId);
  }

  @Post('updateOrdersstatus')
  updateOrderStatus(@Body() body: any) {
    return this.orderService.updateOrderStatus(body.orderId, body.status);
  }

  @Get('returns')
  getReturns(@Query('sellerId') sellerId: string) {
    return this.orderService.getReturns(sellerId);
  }

  @Get('sellerreturnDetails')
  getReturnDetails(@Query('returnId') returnId: string) {
    return this.orderService.getReturnDetails(returnId);
  }

  @Get('SellerReturnExchangeOrders')
  getExchangeOrders(@Query('sellerId') sellerId: string) {
    return this.orderService.getExchangeOrders(sellerId);
  }

  @Get('SellerClaimslist')
  getClaimsList(@Query('sellerId') sellerId: string) {
    return this.orderService.getClaimsList(sellerId);
  }

  @Post('sellerClaim')
  createClaim(@Body() body: any) {
    return this.orderService.createClaim(body);
  }
}
