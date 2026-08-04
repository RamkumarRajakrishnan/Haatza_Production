import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AddressService } from './address.service';

@ApiTags('Addresses')
@Controller(['addresses', 'api/addresses', 'address', 'api/address'])
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @ApiOperation({ summary: 'Get user saved addresses' })
  @Get()
  getUserAddresses(@Query('userId') userId: string) {
    return this.addressService.getUserAddresses(userId);
  }

  @ApiOperation({ summary: 'Save or update user address' })
  @Post()
  saveAddress(@Body() body: any) {
    return this.addressService.saveAddress(body.userId, {
      addressLine: body.addressLine || body.address,
      pincode: body.pincode,
      city: body.city,
      state: body.state,
      country: body.country,
      isDefault: body.isDefault !== undefined ? Boolean(body.isDefault) : true,
    });
  }
}
