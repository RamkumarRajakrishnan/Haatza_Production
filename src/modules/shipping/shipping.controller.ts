import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ShippingService } from './shipping.service';

@Controller()
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('getDeliveryAmount')
  getDeliveryAmount(@Body() body: any) {
    return this.shippingService.getDeliveryAmount(body);
  }

  @Post('expectedTat')
  getExpectedTat(@Body() body: any) {
    return this.shippingService.getExpectedTat(body);
  }

  @Post('createShipment')
  createShipment(@Body() body: any) {
    return this.shippingService.createShipment(body);
  }

  @Post('ExchangecreateShipment')
  createExchangeShipment(@Body() body: any) {
    return this.shippingService.createExchangeShipment(body);
  }

  @Post('cancelShipment')
  cancelShipment(@Body() body: any) {
    return this.shippingService.cancelShipment(body);
  }

  @Get('packingSlip')
  getPackingSlip(@Query('orderId') orderId: string) {
    return this.shippingService.getPackingSlip(orderId);
  }

  @Get('trackshipping')
  trackShipping(@Query('awb') awb: string) {
    return this.shippingService.trackShipping(awb);
  }
}
