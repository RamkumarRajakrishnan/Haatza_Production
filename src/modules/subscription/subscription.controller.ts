import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionPayloadDto } from './dto/create-subscription.dto';
import {
  CreateRazorpayOrderDto,
  VerifyRazorpayPaymentDto,
  ProcessSubscriptionOrderDto,
  CancelSubscriptionDto,
} from './dto/subscription-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

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

  @Post(['createRazorpayOrder', 'subscription/create-razorpay-order'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Razorpay Order for Subscription' })
  @ApiBody({ type: CreateRazorpayOrderDto })
  async createRazorpayOrder(@Req() req: any, @Body() dto: CreateRazorpayOrderDto) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.subscriptionService.createRazorpayOrder(sellerId, dto);
  }

  @Post(['verifyRazorpayPayment', 'subscription/verify-razorpay-payment'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Razorpay Payment Signature' })
  @ApiBody({ type: VerifyRazorpayPaymentDto })
  async verifyRazorpayPayment(@Req() req: any, @Body() dto: VerifyRazorpayPaymentDto) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.subscriptionService.verifyRazorpayPayment(sellerId, dto);
  }

  @Post(['processSubscriptionOrder', 'subscription/process-order'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process Subscription Order (Payment Verification -> Subscription -> Invoice)' })
  @ApiBody({ type: ProcessSubscriptionOrderDto })
  async processSubscriptionOrder(@Req() req: any, @Body() dto: ProcessSubscriptionOrderDto) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.subscriptionService.processSubscriptionOrder(sellerId, dto);
  }

  @Get(['seller/plan-usage', 'subscription/plan-usage'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Seller Active Plan Usage & Quota Limits' })
  async getPlanUsage(@Req() req: any) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.subscriptionService.getPlanUsage(sellerId);
  }

  @Post(['cancelSubscription', 'subscription/cancel'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel Seller Subscription Auto-Renew' })
  @ApiBody({ type: CancelSubscriptionDto })
  async cancelSubscription(@Req() req: any, @Body() dto: CancelSubscriptionDto) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.subscriptionService.cancelSubscription(sellerId, dto);
  }

  @Get(['sellerInvoice/:invoiceId/download', 'subscription/invoice/:invoiceId/download'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download Subscription GST Invoice Details' })
  async downloadInvoice(@Req() req: any, @Param('invoiceId') invoiceId: string) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.subscriptionService.downloadInvoice(sellerId, invoiceId);
  }
}
