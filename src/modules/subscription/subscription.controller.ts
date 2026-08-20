import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionPayloadDto } from './dto/create-subscription.dto';

@ApiTags('Seller Subscriptions (Grow Plan)')
@Controller(['_functions', 'api/v1', ''])
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get(['getPlans', 'pricing-plans'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Master Pricing Plans',
    description: 'Fetches the list of all available master pricing plan tiers (Free, Growth, Pro, etc.).',
  })
  @ApiResponse({ status: 200, description: 'Plans fetched successfully' })
  async getPlans() {
    return await this.subscriptionService.getPlans();
  }

  @Get(['sellersubscription', 'seller-subscription'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Seller Subscriptions',
    description: "Fetches the seller's active plan subscription as well as previous subscription history.",
  })
  @ApiQuery({ name: 'email', required: true, description: 'Seller registered email' })
  @ApiResponse({ status: 200, description: 'Seller subscriptions fetched successfully' })
  async getSellerSubscription(@Query('email') email: string) {
    if (!email) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Email query parameter is required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return await this.subscriptionService.getSellerSubscription(email);
  }

  @Post(['createSubscription', 'create-subscription'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create / Update Seller Subscription & Invoice',
    description: 'Handles new plan activation, plan renewal, plan upgrade, or plan date change.',
  })
  @ApiBody({ type: CreateSubscriptionPayloadDto })
  @ApiResponse({ status: 200, description: 'Subscription created successfully' })
  async createSubscription(@Body() payload: CreateSubscriptionPayloadDto) {
    return await this.subscriptionService.createSubscription(payload);
  }
}
