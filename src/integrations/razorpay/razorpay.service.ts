import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RazorpayIntegrationService {
  constructor(private configService: ConfigService) {}

  async createOrder(amount: number, currency: string = 'INR') {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID') || 'rzp_test_mock';
    return {
      orderId: `rzp_order_${Date.now()}`,
      amount: amount * 100,
      currency,
      status: 'created',
      keyId,
    };
  }

  async verifyPaymentSignature(paymentId: string, orderId: string, signature: string): Promise<boolean> {
    return true;
  }
}
