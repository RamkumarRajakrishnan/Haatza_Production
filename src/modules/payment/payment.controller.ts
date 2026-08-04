import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Payments')
@Controller(['payments', 'api/payments'])
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('wallet')
  @Get('checkWalletBalance')
  getWalletBalance(@Query('sellerId') sellerId: string) {
    return this.paymentService.getWalletBalance(sellerId);
  }

  @Get('wallet/transactions')
  @Get('transactionHistory')
  getTransactions(@Query('walletId') walletId: string) {
    return this.paymentService.getTransactions(walletId);
  }

  @Post('payments/razorpay/order')
  @Post('createRazorpayOrder')
  createOrder(@Body() body: { amount: number }) {
    return this.paymentService.createRazorpayOrder(body.amount);
  }

  @Post('payments/razorpay/verify')
  @Post('verifyRazorpayPayment')
  verifyPayment(@Body() body: any) {
    return this.paymentService.verifyRazorpayPayment(body);
  }

  @Get('sellerpayments')
  getSellerPayments(@Query('sellerId') sellerId: string) {
    return this.paymentService.getSellerPayments(sellerId);
  }

  @Post('addFunds')
  addFunds(@Body() body: any) {
    return this.paymentService.addFunds(body.walletId, Number(body.amount));
  }

  @Post('updateWallet')
  updateWallet(@Body() body: any) {
    return this.paymentService.updateWallet(body.sellerId, Number(body.amount));
  }

  @Get('settlementsummary')
  getSettlementSummary(@Query('sellerId') sellerId: string) {
    return this.paymentService.getSettlementSummary(sellerId);
  }

  @Post('createSellerInvoice')
  createInvoice(@Body() body: any) {
    return this.paymentService.createInvoice(body);
  }

  @Get('sellerInvoices')
  getInvoices(@Query('sellerId') sellerId: string) {
    return this.paymentService.getInvoices(sellerId);
  }
}
