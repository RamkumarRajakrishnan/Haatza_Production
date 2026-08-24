import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateSubscriptionPayloadDto } from './dto/create-subscription.dto';
import {
  CreateRazorpayOrderDto,
  VerifyRazorpayPaymentDto,
  ProcessSubscriptionOrderDto,
  CancelSubscriptionDto,
} from './dto/subscription-payment.dto';
import { RazorpayIntegrationService } from '../../integrations/razorpay/razorpay.service';

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
    const existingSubscription = await this.databaseService.sellerSubscription.findFirst({
      where: {
        OR: [
          { razorpayOrderId: dto.razorpay_order_id },
          { paymentId: dto.razorpay_payment_id },
        ],
      },
      include: { invoices: true },
    });

    if (existingSubscription) {
      return {
        success: true,
        message: 'Subscription order already processed',
        data: {
          subscriptionId: existingSubscription.id,
          invoiceId: existingSubscription.invoices[0]?.id || null,
          status: existingSubscription.status,
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
      const subscription = await tx.sellerSubscription.create({
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
          autoRenew: true,
        },
      });

      const invoice = await tx.sellerSubscriptionInvoice.create({
        data: {
          subscriptionId: subscription.id,
          sellerId: user?.sellerId || sellerId,
          invoiceDate: new Date(),
          sellerName,
          address,
          gstin,
          itemName: `${plan.name} Plan Subscription`,
          rate: subTotal,
          subtotal: subTotal,
          taxableAmount: subTotal,
          cgst,
          sgst,
          upiAmountPaid: totalPayable,
          totalPayable,
          transactionMethod: 'RAZORPAY_ONLINE',
          paymentId: dto.razorpay_payment_id,
          razorpayOrderId: dto.razorpay_order_id,
        },
      });

      return { subscription, invoice };
    });

    return {
      success: true,
      message: 'Subscription created and invoice generated successfully',
      data: {
        subscriptionId: result.subscription.id,
        invoiceId: result.invoice.id,
        status: result.subscription.status,
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
    const subscription = await this.databaseService.sellerSubscription.findFirst({
      where: {
        OR: [
          { sellerId: effectiveSellerId },
          { sellerId },
          ...(sellerEmail ? [{ email: { equals: sellerEmail, mode: 'insensitive' as const } }] : []),
        ],
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
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
    const endDate = new Date(subscription.endedDate);
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

    const subscription = await this.databaseService.sellerSubscription.findUnique({
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
      (sellerEmail && subscription.email.toLowerCase() === sellerEmail.toLowerCase());

    if (!isOwner) {
      throw new ForbiddenException('You are not authorized to cancel this subscription.');
    }

    if (!subscription.autoRenew || subscription.status === 'CANCELLED') {
      throw new ConflictException('Subscription is already cancelled or auto-renew disabled.');
    }

    const updated = await this.databaseService.sellerSubscription.update({
      where: { id: dto.subscriptionId },
      data: {
        autoRenew: false,
        cancelledAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Subscription cancellation scheduled successfully',
      data: {
        subscriptionId: updated.id,
        autoRenew: updated.autoRenew,
        status: updated.status,
        endsAt: updated.endedDate.toISOString(),
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

    const invoice = await this.databaseService.sellerSubscriptionInvoice.findUnique({
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

    return {
      success: true,
      message: 'Invoice fetched successfully',
      data: {
        invoiceId: invoice.id,
        invoiceDate: invoice.invoiceDate,
        sellerName: invoice.sellerName,
        gstin: invoice.gstin,
        address: invoice.address,
        itemName: invoice.itemName,
        rate: invoice.rate,
        subtotal: invoice.subtotal,
        taxableAmount: invoice.taxableAmount,
        cgst: invoice.cgst,
        sgst: invoice.sgst,
        totalPayable: invoice.totalPayable,
        transactionMethod: invoice.transactionMethod,
        paymentId: invoice.paymentId,
        razorpayOrderId: invoice.razorpayOrderId,
      },
    };
  }
}
