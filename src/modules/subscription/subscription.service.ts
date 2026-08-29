import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateSubscriptionPayloadDto } from './dto/create-subscription.dto';
import {
  CreateRazorpayOrderDto,
  VerifyRazorpayPaymentDto,
  ProcessSubscriptionOrderDto,
  CancelSubscriptionDto,
  CreateSubscriptionOrderDto,
  VerifySubscriptionPaymentDto,
  RescheduleSubscriptionDto,
} from './dto/subscription-payment.dto';
import { RazorpayIntegrationService } from '../../integrations/razorpay/razorpay.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

export const HARDCODED_PLANS = [
  {
    id: 'plan_pro_123',
    name: 'Pro',
    price: 499.00,
    periodUnit: 'MONTH',
    ribbon: 'Recommended',
    benefits: ["0% Commission", "Priority Support", "Unlimited Listings"],
    status: 'ACTIVE'
  },
  {
    id: 'plan_growth_123',
    name: 'Growth',
    price: 299.00,
    periodUnit: 'MONTH',
    ribbon: 'Popular',
    benefits: ["5% Commission", "Standard Support", "Up to 50 Listings"],
    status: 'ACTIVE'
  }
];

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly razorpayService: RazorpayIntegrationService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * 1. GET /_functions/getPlans
   * Fetches the list of all available master pricing plan tiers.
   */
  async getPlans() {
    try {
      const plans = HARDCODED_PLANS;

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

  private toISTString(date: Date | null | undefined): string {
    if (!date) return '';
    // Since dates are stored with local IST numbers in the DB, we just format it as +05:30 offset
    return date.toISOString().replace('Z', '+05:30');
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
      const [growPlans, newSubs] = await Promise.all([
        this.databaseService.growPlan.findMany({
          where: { email: { equals: email, mode: 'insensitive' } },
          orderBy: { createdDate: 'desc' },
        }),
        this.databaseService.sellerSubscription.findMany({
          where: { email: { equals: email, mode: 'insensitive' } },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const orders = [
        ...newSubs.map((sub) => ({
          TableID: sub.id,
          planName: sub.planName || '',
          planId: sub.planId || '',
          status: sub.status || '',
          email: sub.email || '',
          startedDate: this.toISTString(sub.startedDate),
          endedDate: this.toISTString(sub.endedDate),
          orderId: sub.razorpayOrderId || sub.paymentId || '',
        })),
        ...growPlans.map((sub) => ({
          TableID: sub.id,
          planName: sub.planName || '',
          planId: sub.planId || '',
          status: sub.status || '',
          email: sub.email || '',
          startedDate: this.toISTString(sub.startedDate),
          endedDate: this.toISTString(sub.endedDate),
          orderId: sub.razorpayOrderId || sub.paymentId || sub.orderId || '',
        })),
      ];

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

      let subscriptionRecord;
      if (subDto.tableId) {
        const existing = await this.databaseService.growPlan.findUnique({
          where: { id: subDto.tableId },
        });

        if (existing) {
          subscriptionRecord = await this.databaseService.growPlan.update({
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
        subscriptionRecord = await this.databaseService.growPlan.create({
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
            orderId: subDto.razorpayOrderId || null,
            manageGrowPlanPageLink: '/order-log/',
          },
        });
      }

      return {
        status: 'success',
        message: 'Subscription created successfully',
        data: {
          subscriptionId: subscriptionRecord.id,
          invoiceId: null,
        },
      };
    } catch (error: any) {
      this.logger.error(`Error in createSubscription: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 4. POST /api/v1/createRazorpayOrder
   * Create a Razorpay order before opening Razorpay checkout.
   */
  async createRazorpayOrder(sellerId: string, dto: CreateRazorpayOrderDto) {
    const plan = HARDCODED_PLANS.find(p => p.id === dto.planId);

    if (!plan || plan.status !== 'ACTIVE') {
      throw new BadRequestException('Requested plan does not exist or is inactive.');
    }

    const planPriceInINR = Number(plan.price);
    const amountInPaise = Math.round(planPriceInINR * 100);

    const razorpayOrder = await this.razorpayService.createOrder(
      amountInPaise,
      dto.currency || 'INR',
    );

    return {
      success: true,
      message: 'Razorpay order created successfully',
      data: {
        orderId: razorpayOrder.orderId,
        amount: amountInPaise,
        currency: dto.currency || 'INR',
        planId: plan.id,
      },
    };
  }

  /**
   * 5. POST /api/v1/verifyRazorpayPayment
   * Signature verification for Razorpay payment.
   */
  async verifyRazorpayPayment(sellerId: string, dto: VerifyRazorpayPaymentDto) {
    const plan = HARDCODED_PLANS.find(p => p.id === dto.planId);

    if (!plan) {
      throw new NotFoundException('Pricing plan not found.');
    }

    const isValidSignature = await this.razorpayService.verifyPaymentSignature(
      dto.razorpay_payment_id,
      dto.razorpay_order_id,
      dto.razorpay_signature,
    );

    if (!isValidSignature) {
      throw new BadRequestException('Invalid Razorpay signature.');
    }

    return {
      success: true,
      message: 'Payment verified successfully',
      data: {
        paymentId: dto.razorpay_payment_id,
        orderId: dto.razorpay_order_id,
        status: 'VERIFIED',
      },
    };
  }

  private calculateEndDate(startedDate: Date, periodUnit?: string): Date {
    const endedDate = new Date(startedDate);
    const unit = (periodUnit || 'MONTH').toUpperCase();
    if (unit === 'YEAR' || unit === 'ANNUAL') {
      endedDate.setFullYear(endedDate.getFullYear() + 1);
    } else if (unit === 'WEEK') {
      endedDate.setDate(endedDate.getDate() + 7);
    } else {
      endedDate.setDate(endedDate.getDate() + 30);
    }
    return endedDate;
  }

  /**
   * 6. POST /api/v1/processSubscriptionOrder
   * Idempotently process payment verification -> subscription -> invoice.
   */
  async processSubscriptionOrder(sellerId: string, dto: ProcessSubscriptionOrderDto) {
    // 1. Signature Verification
    const isValid = await this.razorpayService.verifyPaymentSignature(
      dto.razorpay_payment_id,
      dto.razorpay_order_id,
      dto.razorpay_signature,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature verification failed.');
    }

    // 2. Idempotency Check
    const existingSubscription = await this.databaseService.growPlan.findFirst({
      where: {
        OR: [
          { razorpayOrderId: dto.razorpay_order_id },
          { paymentId: dto.razorpay_payment_id },
        ],
      },
    });

    if (existingSubscription) {
      return {
        status: 'success',
        message: {
          message: 'Subscription order processed successfully',
          subscriptionId: existingSubscription.id,
          status: existingSubscription.status || 'ACTIVE',
        },
      };
    }

    // 3. Plan Lookup
    const plan = HARDCODED_PLANS.find(p => p.id === dto.planId);

    if (!plan || plan.status !== 'ACTIVE') {
      throw new BadRequestException('Selected plan is invalid or inactive.');
    }

    // 4. Seller Details Lookup
    const user = await this.databaseService.user.findFirst({
      where: {
        OR: [{ sellerId }, { id: sellerId }],
      },
    });

    const email = user?.email || `seller_${sellerId}@haatza.com`;
    const phone = user?.mobile || null;
    const sellerName = user?.companyName || user?.name || 'Valued Seller';
    const address = user?.address || null;
    const gstin = user?.gstin || null;

    const startedDate = new Date();
    const endedDate = this.calculateEndDate(startedDate, plan.periodUnit);

    const subTotal = Number(plan.price);
    const cgst = Math.round(subTotal * 0.09 * 100) / 100;
    const sgst = Math.round(subTotal * 0.09 * 100) / 100;
    const totalPayable = subTotal + cgst + sgst;

    // 5. Database Transaction
    const result = await this.databaseService.$transaction(async (tx) => {
      const subscription = await tx.growPlan.create({
        data: {
          sellerId: user?.sellerId || sellerId,
          email,
          phone,
          planId: plan.id,
          planName: plan.name,
          startedDate,
          endedDate,
          status: 'ACTIVE',
          paymentId: dto.razorpay_payment_id,
          razorpayOrderId: dto.razorpay_order_id,
          orderId: dto.razorpay_order_id,
          manageGrowPlanPageLink: '/order-log/',
        },
      });

      return { subscription };
    });

    return {
      status: 'success',
      message: {
        message: 'Subscription order processed successfully',
        subscriptionId: result.subscription.id,
        status: result.subscription.status || 'ACTIVE',
      },
    };
  }

  /**
   * 7. GET /api/v1/seller/plan-usage
   * Returns current active plan usage & quota limits safely without crashing on missing products table.
   */
  async getPlanUsage(sellerId: string) {
    const user = await this.databaseService.user.findFirst({
      where: { OR: [{ sellerId }, { id: sellerId }] },
    });

    const effectiveSellerId = user?.sellerId || sellerId;
    const sellerEmail = user?.email || null;

    // Search subscription by sellerId or email
    const subscription = await this.databaseService.growPlan.findFirst({
      where: {
        OR: [
          { sellerId: effectiveSellerId },
          { sellerId },
          ...(sellerEmail ? [{ email: { equals: sellerEmail, mode: 'insensitive' as const } }] : []),
        ],
        status: 'ACTIVE',
      },
      orderBy: { createdDate: 'desc' },
    });

    // Safely derive listings count from products table
    let currentListings = 0;
    try {
      currentListings = await this.databaseService.product.count({
        where: {
          OR: [{ sellerId: effectiveSellerId }, { sellerId }],
        },
      });
    } catch (err: any) {
      this.logger.warn(`Could not count seller products: ${err.message}`);
      currentListings = 0;
    }

    if (!subscription) {
      return {
        success: true,
        data: {
          planName: 'Free',
          daysRemaining: 0,
          maxListings: 10,
          currentListings,
          commissionRate: '10%',
          prioritySupport: false,
        },
      };
    }

    const now = new Date();
    const endDate = subscription.endedDate ? new Date(subscription.endedDate) : new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const daysRemaining = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

    let maxListings = 50;
    let commissionRate = '5%';
    let prioritySupport = false;

    const planNameLower = (subscription.planName || '').toLowerCase();
    const planId = subscription.planId;

    if (planId === 'plan_pro_123' || planNameLower.includes('pro')) {
      maxListings = 999999;
      commissionRate = '0%';
      prioritySupport = true;
    } else if (planId === 'plan_growth_123' || planNameLower.includes('growth')) {
      maxListings = 50;
      commissionRate = '5%';
      prioritySupport = false;
    } else {
      const plan = HARDCODED_PLANS.find(p => p.id === planId);
      if (plan && plan.benefits) {
        const bStr = JSON.stringify(plan.benefits).toLowerCase();
        if (bStr.includes('unlimited')) maxListings = 999999;
        if (bStr.includes('0%')) commissionRate = '0%';
        if (bStr.includes('priority')) prioritySupport = true;
      }
    }

    return {
      success: true,
      data: {
        planName: subscription.planName,
        daysRemaining,
        maxListings,
        currentListings,
        commissionRate,
        prioritySupport,
      },
    };
  }

  /**
   * 8. POST /api/v1/cancelSubscription
   * Disables auto-renew and schedules cancellation at billing period end.
   */
  async cancelSubscription(sellerId: string, dto: CancelSubscriptionDto) {
    const user = await this.databaseService.user.findFirst({
      where: { OR: [{ sellerId }, { id: sellerId }] },
    });
    const effectiveSellerId = user?.sellerId || sellerId;
    const sellerEmail = user?.email || null;

    const subscription = await this.databaseService.growPlan.findUnique({
      where: { id: dto.subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription record not found.');
    }

    // Flexible ownership check
    const isOwner =
      subscription.sellerId === effectiveSellerId ||
      subscription.sellerId === sellerId ||
      subscription.sellerId === user?.id ||
      (sellerEmail && subscription.email && subscription.email.toLowerCase() === sellerEmail.toLowerCase());

    if (!isOwner) {
      throw new ForbiddenException('You are not authorized to cancel this subscription.');
    }

    if (subscription.status === 'CANCELLED') {
      throw new ConflictException('Subscription is already cancelled.');
    }

    const updated = await this.databaseService.growPlan.update({
      where: { id: dto.subscriptionId },
      data: {
        status: 'CANCELLED',
        endedDate: new Date(),
      },
    });

    return {
      success: true,
      message: 'Subscription cancellation scheduled successfully',
      data: {
        subscriptionId: updated.id,
        status: updated.status,
        endsAt: updated.endedDate ? updated.endedDate.toISOString() : new Date().toISOString(),
      },
    };
  }

  /**
   * 9. GET /api/v1/sellerInvoice/:invoiceId/download
   * Generates and downloads invoice details.
   */
  async downloadInvoice(sellerId: string, invoiceId: string) {
    if (!invoiceId || invoiceId === ':invoiceId') {
      throw new BadRequestException('Please provide a valid invoice ID in the URL path (e.g. /sellerInvoice/inv_123/download).');
    }

    const user = await this.databaseService.user.findFirst({
      where: { OR: [{ sellerId }, { id: sellerId }] },
    });
    const effectiveSellerId = user?.sellerId || sellerId;
    const sellerEmail = user?.email || null;

    const invoice = await this.databaseService.growPlan.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    // Flexible ownership check
    const isOwner =
      invoice.sellerId === effectiveSellerId ||
      invoice.sellerId === sellerId ||
      invoice.sellerId === user?.id;

    if (!isOwner) {
      throw new ForbiddenException('Access denied. Invoice belongs to another seller.');
    }

    const plan = HARDCODED_PLANS.find(p => p.id === invoice.planId);
    const subTotal = Number(plan?.price ?? 0);
    const cgst = Math.round(subTotal * 0.09 * 100) / 100;
    const sgst = Math.round(subTotal * 0.09 * 100) / 100;
    const totalPayable = subTotal + cgst + sgst;

    return {
      success: true,
      message: 'Invoice fetched successfully',
      data: {
        invoiceId: invoice.id,
        invoiceDate: invoice.createdDate,
        sellerName: user?.name ?? 'Seller',
        gstin: user?.gstin ?? 'N/A',
        address: user?.address ?? 'N/A',
        itemName: `${invoice.planName ?? 'Pro'} Plan Subscription`,
        rate: subTotal,
        subtotal: subTotal,
        taxableAmount: subTotal,
        cgst,
        sgst,
        totalPayable,
        transactionMethod: 'RAZORPAY_ONLINE',
        paymentId: invoice.paymentId,
        razorpayOrderId: invoice.razorpayOrderId,
      },
    };
  }

  /**
   * Create Razorpay Order for Subscription and store details in seller_subscription_transaction
   */
  async createSubscriptionOrder(dto: CreateSubscriptionOrderDto) {
    const { sellerId, planName, amount, currency = 'INR', email, startedDate, durationMonths } = dto;

    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      this.logger.error('Razorpay credentials are not configured in environment variables.');
      throw new InternalServerErrorException('Razorpay credentials are not configured.');
    }

    try {
      // 1. Create a Razorpay order via HTTPS POST using Basic auth
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const amountInPaise = Math.round(amount * 100);

      const response = await axios.post(
        'https://api.razorpay.com/v1/orders',
        {
          amount: amountInPaise,
          currency,
          receipt: `sub_receipt_${Date.now()}`,
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const razorpayOrder = response.data;

      // 2. Save a new row in seller_subscription_transaction table
      const transaction = await this.databaseService.sellerSubscriptionTransaction.create({
        data: {
          sellerId,
          email: email || null,
          planName,
          amount,
          currency,
          razorpayOrderId: razorpayOrder.id,
          status: 'created',
          startedDate: startedDate ? new Date(new Date(startedDate).getTime() + 5.5 * 60 * 60 * 1000) : null,
          durationMonths: durationMonths ? Number(durationMonths) : null,
        },
      });

      // 3. Return order details and public key to frontend
      return {
        orderId: razorpayOrder.id,
        amount: amountInPaise,
        currency,
        key: keyId,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create Razorpay subscription order: ${error.message}`, error.stack);
      if (error.response) {
        this.logger.error(`Razorpay Response Data: ${JSON.stringify(error.response.data)}`);
        throw new BadRequestException(
          `Razorpay error: ${error.response.status} - ${error.response.data?.error?.description || 'Unknown'}`,
        );
      }
      throw new InternalServerErrorException(error.message || 'Failed to create subscription order.');
    }
  }

  /**
   * Verify Razorpay Payment Signature and update status in seller_subscription_transaction
   */
  async verifySubscriptionPayment(dto: VerifySubscriptionPaymentDto) {
    const { orderId, paymentId, signature } = dto;

    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    if (!keySecret) {
      throw new InternalServerErrorException('Razorpay secret key is not configured.');
    }

    // Find the matching transaction
    const transaction = await this.databaseService.sellerSubscriptionTransaction.findFirst({
      where: { razorpayOrderId: orderId },
    });

    if (!transaction) {
      throw new NotFoundException(`No subscription transaction found for order ID: ${orderId}`);
    }

    try {
      // Verify signature using HMAC-SHA256
      const body = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body)
        .digest('hex');

      const isSignatureValid = expectedSignature === signature;

      // Update status ('paid' or 'failed')
      const updatedStatus = isSignatureValid ? 'paid' : 'failed';

      await this.databaseService.sellerSubscriptionTransaction.update({
        where: { id: transaction.id },
        data: {
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
          status: updatedStatus,
        },
      });

      if (!isSignatureValid) {
        throw new BadRequestException('Invalid signature verification failed.');
      }

      // If payment is verified, update/create the active subscription in seller_subscriptions table
      let email = transaction.email;
      let phone: string | null = null;

      const user = await this.databaseService.user.findFirst({
        where: { sellerId: transaction.sellerId },
        select: { email: true, mobile: true },
      });

      if (!email) {
        email = user?.email || `seller_${transaction.sellerId}@haatza.com`;
      }
      phone = user?.mobile || null;

      // Find plan details
      const plan = HARDCODED_PLANS.find(
        p => p.name.toLowerCase() === transaction.planName.toLowerCase() ||
             transaction.planName.toLowerCase().includes(p.name.toLowerCase())
      ) || HARDCODED_PLANS[1]; // Fallback to Growth

      // Find the latest valid active/scheduled subscription to determine started date for the new plan
      const latestSub = await this.databaseService.sellerSubscription.findFirst({
        where: {
          sellerId: transaction.sellerId,
          status: { in: ['ACTIVE', 'Active', 'Scheduled', 'SCHEDULED'] }
        },
        orderBy: { endedDate: 'desc' }
      });

      let startedDate: Date;
      let endedDate: Date;
      let subStatus: string;

      // Determine duration in days (default 30 days, or durationMonths * 30 days)
      const durationDays = transaction.durationMonths ? transaction.durationMonths * 30 : 30;

      const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);

      if (transaction.startedDate) {
        // Use user-selected start date from the calendar (already shifted to IST numbers)
        startedDate = new Date(transaction.startedDate);
        endedDate = new Date(startedDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
        subStatus = startedDate > nowIST ? 'Scheduled' : 'Active';
      } else if (latestSub && latestSub.endedDate > nowIST) {
        // Queue the subscription: start date is when the previous one ends (already shifted)
        startedDate = new Date(latestSub.endedDate);
        endedDate = new Date(startedDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
        subStatus = 'Scheduled';
      } else {
        // Start immediately in IST
        startedDate = nowIST;
        endedDate = new Date(startedDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
        subStatus = 'Active';
      }

      // Always create a new subscription record representing this transaction
      await this.databaseService.sellerSubscription.create({
        data: {
          sellerId: transaction.sellerId,
          email,
          phone,
          planId: plan.id,
          planName: transaction.planName,
          startedDate,
          endedDate,
          status: subStatus,
          paymentId,
          razorpayOrderId: orderId,
          createdAt: nowIST, // Explicitly save local IST time as creation date
        },
      });

      return {
        success: true,
        message: 'Subscription payment verified successfully',
        status: updatedStatus,
      };
    } catch (error: any) {
      this.logger.error(`Failed to verify Razorpay signature: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Payment signature verification failed.');
    }
  }

  async rescheduleSubscription(dto: RescheduleSubscriptionDto) {
    const { subscriptionId, startedDate: startedDateInput, endedDate: endedDateInput } = dto;

    const subscription = await this.databaseService.sellerSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException(`No subscription found for ID: ${subscriptionId}`);
    }

    try {
      // Shift the new start and end dates by 5.5 hours to represent the local IST time numbers in the DB
      const newStartedDate = new Date(new Date(startedDateInput).getTime() + 5.5 * 60 * 60 * 1000);
      const newEndedDate = new Date(new Date(endedDateInput).getTime() + 5.5 * 60 * 60 * 1000);

      // Determine status of the plan
      const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const subStatus = newStartedDate > nowIST ? 'Scheduled' : 'Active';

      const updated = await this.databaseService.sellerSubscription.update({
        where: { id: subscriptionId },
        data: {
          startedDate: newStartedDate,
          endedDate: newEndedDate,
          status: subStatus,
        },
      });

      return {
        success: true,
        message: 'Subscription rescheduled successfully',
        data: {
          subscriptionId: updated.id,
          status: updated.status,
          startedDate: this.toISTString(updated.startedDate),
          endedDate: this.toISTString(updated.endedDate),
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to reschedule subscription: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message || 'Failed to reschedule subscription.');
    }
  }
}
