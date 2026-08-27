import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class RazorpayIntegrationService {
  private readonly logger = new Logger(RazorpayIntegrationService.name);

  constructor(private readonly configService: ConfigService) {}

  async createOrder(amountInPaise: number, currency: string = 'INR', receipt?: string) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID') || 'rzp_test_mock';
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    // If real Razorpay keySecret is present, call Razorpay REST API directly via fetch
    if (keySecret && keyId !== 'rzp_test_mock') {
      try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const payload = {
          amount: amountInPaise,
          currency,
          receipt: receipt || `receipt_${Date.now()}`,
        };

        const response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data: any = await response.json();

        if (!response.ok) {
          throw new Error(`Razorpay error: ${response.status} - ${data.error?.description || 'Unknown'}`);
        }

        return {
          orderId: data.id,
          amount: data.amount,
          currency: data.currency,
          status: data.status,
          keyId,
        };
      } catch (err: any) {
        this.logger.error(`Razorpay API call failed: ${err.message}`);
        throw err;
      }
    }

    // Fallback for mock/test environment
    return {
      orderId: `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      amount: amountInPaise,
      currency,
      status: 'created',
      keyId,
    };
  }

  async verifyPaymentSignature(
    paymentId: string,
    orderId: string,
    signature: string,
  ): Promise<boolean> {
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (!paymentId || !orderId || !signature) {
      return false;
    }

    if (keySecret) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      return generatedSignature === signature;
    }

    // In test/mock mode without keySecret, accept test signature or non-empty signature string
    return signature.length > 5;
  }
}
