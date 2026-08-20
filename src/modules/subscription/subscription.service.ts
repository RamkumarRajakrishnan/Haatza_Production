import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateSubscriptionPayloadDto } from './dto/create-subscription.dto';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * 1. GET /_functions/getPlans
   * Fetches the list of all available master pricing plan tiers.
   */
  async getPlans() {
    try {
      const plans = await this.databaseService.pricingPlan.findMany({
        orderBy: { createdAt: 'asc' },
      });

      const items = plans.map((plan) => {
        let benefitsArray: string[] = [];
        if (Array.isArray(plan.benefits)) {
          benefitsArray = plan.benefits as string[];
        } else if (typeof plan.benefits === 'string') {
          try {
            benefitsArray = JSON.parse(plan.benefits);
          } catch {
            benefitsArray = [plan.benefits];
          }
        }

        return {
          _id: plan.id,
          name: plan.name,
          price: plan.price.toString(),
          currency: 'INR',
          periodUnit: plan.periodUnit,
          ribbon: plan.ribbon || '',
          benefits: benefitsArray,
        };
      });

      return {
        status: 'success',
        message: {
          items,
        },
      };
    } catch (error: any) {
      this.logger.error(`Error in getPlans: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 2. GET /_functions/sellersubscription?email={email}
   * Fetches the seller's active plan subscription as well as previous subscription history.
   */
  async getSellerSubscription(email: string) {
    if (!email) {
      throw new BadRequestException('Email query parameter is required.');
    }

    try {
      const subscriptions = await this.databaseService.sellerSubscription.findMany({
        where: { email: { equals: email, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
      });

      const orders = subscriptions.map((sub) => ({
        TableID: sub.id,
        planName: sub.planName,
        planId: sub.planId,
        status: sub.status,
        email: sub.email,
        startedDate: sub.startedDate.toISOString(),
        endedDate: sub.endedDate.toISOString(),
        orderId: sub.razorpayOrderId || sub.paymentId || '',
      }));

      return {
        status: 'success',
        message: {
          orders,
        },
      };
    } catch (error: any) {
      this.logger.error(`Error in getSellerSubscription: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 3. POST /_functions/createSubscription
   * Handles new plan activation, plan renewal, plan upgrade, or plan date change.
   */
  async createSubscription(payload: CreateSubscriptionPayloadDto) {
    const { createSubscription: subDto, createSellerInvoice: invoiceDto } = payload;

    if (!subDto) {
      throw new BadRequestException('createSubscription object is required.');
    }

    try {
      let sellerId = subDto.sellerId;

      // If sellerId is missing, try looking up user by email
      if (!sellerId && subDto.email) {
        const user = await this.databaseService.user.findFirst({
          where: { email: { equals: subDto.email, mode: 'insensitive' } },
          select: { sellerId: true, id: true },
        });
        if (user) {
          sellerId = user.sellerId || user.id;
        }
      }

      sellerId = sellerId || 'UNKNOWN_SELLER';

      // 1. Create or Update seller_subscription
      let subscriptionRecord;
      if (subDto.tableId) {
        const existing = await this.databaseService.sellerSubscription.findUnique({
          where: { id: subDto.tableId },
        });

        if (existing) {
          subscriptionRecord = await this.databaseService.sellerSubscription.update({
            where: { id: subDto.tableId },
            data: {
              planName: subDto.planName,
              planId: subDto.planId,
              status: subDto.status || 'Active',
              email: subDto.email,
              phone: subDto.phone || existing.phone,
              startedDate: new Date(subDto.startedDate),
              endedDate: new Date(subDto.endedDate),
              paymentId: subDto.paymentId || existing.paymentId,
              razorpayOrderId: subDto.razorpayOrderId || existing.razorpayOrderId,
            },
          });
        }
      }

      if (!subscriptionRecord) {
        subscriptionRecord = await this.databaseService.sellerSubscription.create({
          data: {
            id: subDto.tableId || undefined,
            sellerId,
            email: subDto.email,
            phone: subDto.phone || null,
            planId: subDto.planId,
            planName: subDto.planName,
            startedDate: new Date(subDto.startedDate),
            endedDate: new Date(subDto.endedDate),
            status: subDto.status || 'Active',
            paymentId: subDto.paymentId || null,
            razorpayOrderId: subDto.razorpayOrderId || null,
          },
        });
      }

      // 2. Create seller_subscription_invoice if provided
      let invoiceRecord: any = null;
      if (invoiceDto) {
        const walletUsed = invoiceDto.payments?.wallet ?? 0;
        const upiPaid = invoiceDto.payments?.upi ?? invoiceDto.totalPayable ?? 0;

        invoiceRecord = await this.databaseService.sellerSubscriptionInvoice.create({
          data: {
            subscriptionId: subscriptionRecord.id,
            sellerId: invoiceDto.sellerId || sellerId,
            invoiceDate: invoiceDto.invoiceDate ? new Date(invoiceDto.invoiceDate) : new Date(),
            sellerName: invoiceDto.sellerName,
            address: invoiceDto.address || null,
            gstin: invoiceDto.gstin || null,
            itemName: invoiceDto.item,
            rate: invoiceDto.rate,
            subtotal: invoiceDto.subtotal,
            taxableAmount: invoiceDto.amount ?? invoiceDto.subtotal,
            cgst: invoiceDto.cgst ?? 0,
            sgst: invoiceDto.sgst ?? 0,
            walletAmountUsed: walletUsed,
            upiAmountPaid: upiPaid,
            totalPayable: invoiceDto.totalPayable,
            transactionMethod: invoiceDto.transactionMethod || 'UPI',
            paymentId: subDto.paymentId || null,
            razorpayOrderId: subDto.razorpayOrderId || null,
          },
        });
      }

      return {
        status: 'success',
        message: 'Subscription created successfully',
        data: {
          subscriptionId: subscriptionRecord.id,
          invoiceId: invoiceRecord?.id || null,
        },
      };
    } catch (error: any) {
      this.logger.error(`Error in createSubscription: ${error.message}`, error.stack);
      throw error;
    }
  }
}
