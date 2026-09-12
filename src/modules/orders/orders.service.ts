import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateOrdersDto, OrderEntryDto } from './dto/create-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { formatImageUrl } from './utils/image-url.util';

const STATUS_MAP: Record<string, string[]> = {
  ordered: ['Order Placed', 'Order Confirmed'],
  shipped: ['Shipping Pickup Scheduled', 'Shipped', 'Out for delivery'],
  delivered: ['Delivered'],
  cancelled: ['Order Cancelled', 'Return Cancelled'],
  returned: [
    'Return Requested',
    'Return Pickup Scheduled',
    'Return Shipped',
    'Return Received',
    'Return Processing',
    'Return Completed',
  ],
  exchange: [
    'Exchange Requested',
    'Exchange Initiated',
    'Exchange Created',
    'Exchange Pickup Created',
    'Exchange Shipped',
    'Exchange Out for Delivery',
    'Exchange Delivered',
    'Exchange Delivery Attempted',
    'Exchange RTO Received',
    'Exchange Failed',
    'Exchange Closed',
    'Exchange Cancelled',
    'Exchange Converted to Return',
  ],
};

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    this.ensureOrderTablesAndSequences().catch((err) => {
      this.logger.warn(`Background orders schema verification notice: ${err.message}`);
    });
  }

  /**
   * Ensure necessary tables, columns, and sequences exist for Orders and Wallet in PostgreSQL.
   */
  private async ensureOrderTablesAndSequences(): Promise<void> {
    try {
      this.logger.log('Ensuring PostgreSQL tables, columns and sequences for Orders module...');
      const statements = [
        `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS module text DEFAULT 'haatza';`,
        `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'CUSTOMER';`,
        `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cart_id text;`,
        `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS line_items jsonb;`,
        `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS totals jsonb;`,
        `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS billing_info jsonb;`,
        `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_info jsonb;`,
        `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS channel_info jsonb;`,
        `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_language text DEFAULT 'en';`,
        `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS weight_unit text DEFAULT 'KG';`,
        `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS custom_field jsonb;`,
        `CREATE INDEX IF NOT EXISTS idx_orders_buyer_email ON public.orders(buyer_email);`,
        `CREATE INDEX IF NOT EXISTS idx_orders_module ON public.orders(module);`,
        `CREATE INDEX IF NOT EXISTS idx_orders_order_type ON public.orders(order_type);`,
        `CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON public.orders(invoice_number);`,
        `CREATE SEQUENCE IF NOT EXISTS public.seq_order_number START WITH 10001 INCREMENT BY 1;`,
        `CREATE TABLE IF NOT EXISTS public.user_wallet (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          available_balance NUMERIC(20, 2) DEFAULT 0.00,
          max_withdrawn NUMERIC(20, 2) DEFAULT 0.00,
          module VARCHAR(20) DEFAULT 'haatza',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE INDEX IF NOT EXISTS idx_user_wallet_user_id ON public.user_wallet(user_id);`,
        `CREATE INDEX IF NOT EXISTS idx_user_wallet_module ON public.user_wallet(module);`,
        `CREATE TABLE IF NOT EXISTS public.user_wallet_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          transaction_id VARCHAR(255),
          reference_id VARCHAR(255),
          wallet_id UUID,
          transaction_type VARCHAR(50) DEFAULT 'Debit',
          category VARCHAR(50) DEFAULT 'Order',
          amount NUMERIC(20, 2) NOT NULL,
          status VARCHAR(50) DEFAULT 'Paid',
          payment_method VARCHAR(50),
          order_id VARCHAR(100),
          module VARCHAR(20) DEFAULT 'haatza',
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE INDEX IF NOT EXISTS idx_user_wallet_tx_user_id ON public.user_wallet_transactions(user_id);`,
      ];

      for (const stmt of statements) {
        try {
          await this.databaseService.executePoolQuery(stmt);
        } catch (e: any) {
          this.logger.warn(`DDL statement notice: ${e.message}`);
        }
      }

      this.logger.log('✅ Orders table schema & sequences verified successfully.');
    } catch (err: any) {
      this.logger.warn(`Orders table setup notice: ${err.message}`);
    }
  }

  /**
   * Generates next sequential integer order number.
   */
  private async generateOrderNumber(): Promise<number> {
    try {
      const rows = await this.databaseService.queryRawDashboard(
        `SELECT nextval('public.seq_order_number') AS next_num;`,
      );
      if (rows && rows.length > 0 && rows[0].next_num) {
        return Number(rows[0].next_num);
      }
    } catch (e: any) {
      this.logger.warn(`Sequence nextval failed (${e.message}), using fallback max query.`);
    }

    const maxRows = await this.databaseService.queryRawDashboard(
      `SELECT COALESCE(MAX(CASE WHEN order_id ~ '^[0-9]+$' THEN order_id::bigint ELSE 0 END), 10000) + 1 AS next_num FROM public.orders;`,
    );
    return Number(maxRows?.[0]?.next_num || 10001);
  }

  /**
   * Generates a date-scoped sequential invoice number: INV-YYYYMMDD-XXX
   */
  public async generateInvoiceNumber(offset = 0): Promise<string> {
    const now = new Date();
    const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const yyyy = istDate.getFullYear();
    const mm = String(istDate.getMonth() + 1).padStart(2, '0');
    const dd = String(istDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    const prefix = `INV-${dateStr}-`;

    try {
      const countRows = await this.databaseService.queryRawDashboard(
        `SELECT COUNT(*) AS cnt FROM public.orders WHERE invoice_number LIKE $1;`,
        [`${prefix}%`],
      );
      const existingCount = Number(countRows?.[0]?.cnt || 0);
      const sequence = existingCount + 1 + offset;
      const paddedSeq = String(sequence).padStart(3, '0');
      return `${prefix}${paddedSeq}`;
    } catch (err: any) {
      const randomSeq = String(Math.floor(1 + Math.random() * 999)).padStart(3, '0');
      return `${prefix}${randomSeq}`;
    }
  }

  /**
   * Internal createOrder method: constructs and persists a master Order record.
   * Returns created order with auto-incremented `number` (orderId).
   */
  public async createOrder(orderData: any, module: 'haatza' | 'lite'): Promise<{ number: number; id: string }> {
    const orderNumber = await this.generateOrderNumber();
    const orderIdStr = String(orderNumber);

    const buyerLanguage = orderData.buyerLanguage || 'en';
    const weightUnit = orderData.weightUnit || 'KG';
    const channelInfo = orderData.channelInfo || { type: 'WEB' };
    const paymentStatus = orderData.paymentStatus || 'NOT_PAID';

    const insertQuery = `
      INSERT INTO public.orders (
        id, order_id, status, payment_status, buyer_language, cart_id,
        weight_unit, billing_info, totals, channel_info, shipping_info,
        line_items, custom_field, discount, module, order_type,
        seller_id, created_date, updated_date
      ) VALUES (
        gen_random_uuid(), $1, 'PENDING', $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, $12, $13, 'MASTER',
        $14, now(), now()
      ) RETURNING id;
    `;

    const sellerId = orderData.customerOrder?.sellerId || 'DEFAULT_SELLER';
    const rows = await this.databaseService.queryRawDashboard(insertQuery, [
      orderIdStr,
      paymentStatus,
      buyerLanguage,
      orderData.cartId || null,
      weightUnit,
      JSON.stringify(orderData.billingInfo || {}),
      JSON.stringify(orderData.totals || {}),
      JSON.stringify(channelInfo),
      JSON.stringify(orderData.shippingInfo || {}),
      JSON.stringify(orderData.lineItems || []),
      JSON.stringify(orderData.customField || null),
      typeof orderData.discount === 'number'
        ? orderData.discount
        : Number(orderData.discount?.value || orderData.discount?.amount || 0),
      module,
      sellerId,
    ]);

    const createdId = rows?.[0]?.id || orderIdStr;
    return {
      number: orderNumber,
      id: createdId,
    };
  }

  /**
   * Debits used wallet amount and logs UserWalletTransaction.
   */
  private async handleWalletDeduction(
    buyerEmail: string,
    usedWalletAmount: number,
    razorpayOrderId: string | undefined,
    couponCode: string | undefined,
    paymentMethod: string | undefined,
    orderId: string | number,
    module: 'haatza' | 'lite',
  ): Promise<void> {
    if (!usedWalletAmount || usedWalletAmount <= 0) {
      return;
    }

    // Lookup in user_wallet
    const walletRows = await this.databaseService.queryRawDashboard(
      `SELECT * FROM public.user_wallet WHERE user_id = $1 AND module = $2 LIMIT 1;`,
      [buyerEmail, module],
    );

    let wallet = walletRows?.[0];

    // Fallback: check without module or check seller_wallet
    if (!wallet) {
      const fallbackRows = await this.databaseService.queryRawDashboard(
        `SELECT * FROM public.user_wallet WHERE user_id = $1 LIMIT 1;`,
        [buyerEmail],
      );
      wallet = fallbackRows?.[0];
    }

    if (!wallet) {
      throw new Error(`User wallet not found for ${buyerEmail}`);
    }

    const currentBalance = Number(wallet.available_balance || 0);
    const currentMaxWithdrawn = Number(wallet.max_withdrawn || 0);

    const newAvailable = Math.max(0, currentBalance - usedWalletAmount);
    const newMaxWithdrawn = Math.max(0, currentMaxWithdrawn - usedWalletAmount);

    await this.databaseService.executePoolQuery(
      `UPDATE public.user_wallet 
       SET available_balance = $1, max_withdrawn = $2, updated_at = now() 
       WHERE id = $3;`,
      [newAvailable, newMaxWithdrawn, wallet.id],
    );

    await this.databaseService.executePoolQuery(
      `INSERT INTO public.user_wallet_transactions (
         id, user_id, transaction_id, reference_id, wallet_id,
         transaction_type, category, amount, status, payment_method,
         order_id, module, created_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4,
         'Debit', 'Order', $5, 'Paid', $6,
         $7, $8, now()
       );`,
      [
        buyerEmail,
        razorpayOrderId || null,
        couponCode || null,
        wallet.id,
        usedWalletAmount,
        paymentMethod || 'Wallet',
        String(orderId),
        module,
      ],
    );
  }

  /**
   * POST /createOrders?module=haatza|lite
   * Parallel order creation replicating Wix post_createorder.
   */
  async createOrders(dto: CreateOrdersDto, module: 'haatza' | 'lite') {
    if (!dto || !Array.isArray(dto.order)) {
      throw new BadRequestException({
        status: 'error',
        message: 'Server error',
        error: 'Request body must contain an "order" array.',
      });
    }

    const orderEntries = dto.order;

    try {
      const results = await Promise.all(
        orderEntries.map(async (entry: OrderEntryDto, index: number) => {
          try {
            const customerOrder = entry.customerOrder;
            if (!customerOrder) {
              return { error: 'customerOrder object is required' };
            }

            // a. Validate required orderData fields
            const hasLineItems = Array.isArray(entry.lineItems) && entry.lineItems.length > 0;
            const hasCurrency = Boolean(entry.currency);
            const hasTotals = Boolean(entry.totals);
            const hasBillingInfo = Boolean(entry.billingInfo);
            const hasShippingInfo = Boolean(entry.shippingInfo);

            if (!hasLineItems || !hasCurrency || !hasTotals || !hasBillingInfo || !hasShippingInfo) {
              const missing: string[] = [];
              if (!hasLineItems) missing.push('lineItems');
              if (!hasCurrency) missing.push('currency');
              if (!hasTotals) missing.push('totals');
              if (!hasBillingInfo) missing.push('billingInfo');
              if (!hasShippingInfo) missing.push('shippingInfo');
              return {
                error: `Validation error: missing required orderData fields: ${missing.join(', ')}`,
              };
            }

            // f. Fetch Product by customerOrder.productId
            const productId = customerOrder.productId;
            if (!productId) {
              return { error: 'Product not found', productId: null };
            }

            const product = await this.databaseService.product.findFirst({
              where: {
                OR: [{ productId }, { id: productId }],
              },
            });

            if (!product) {
              return { error: 'Product not found', productId };
            }

            // b. Internal createOrder(orderData)
            const newOrder = await this.createOrder(entry, module);
            const orderId = String(newOrder.number);

            // c. Generate invoice number format INV-YYYYMMDD-XXX
            const invoiceNumber = await this.generateInvoiceNumber(index);

            // e. Wallet logic: deduct if usedWalletAmount > 0
            const usedWalletAmount = Number(customerOrder.usedWalletAmount || 0);
            if (usedWalletAmount > 0 && customerOrder.buyerEmail) {
              await this.handleWalletDeduction(
                customerOrder.buyerEmail,
                usedWalletAmount,
                customerOrder.razorpayOrderId,
                customerOrder.couponCode,
                customerOrder.paymentMethod,
                orderId,
                module,
              );
            }

            // g. Compute pricing
            const mrp = Number(product.price ?? product.mrp ?? 0);
            const discountedPrice = Number(
              product.onsalePrice ?? product.newOnsale ?? product.price ?? mrp,
            );
            const quantity = Number(customerOrder.quantity || 1);
            const totalAmount = discountedPrice * quantity;

            // Normalize fields
            const sellerId = customerOrder.sellerId || product.sellerId || 'UNKNOWN';
            const items = customerOrder.items || product.name || 'Order Item';
            const customerName = customerOrder.customerName || null;
            const customerAddress = customerOrder.customerAddress || null;
            const customerPhone = customerOrder.customerPhone || null;
            const status = customerOrder.status || 'Order Placed';
            const paymentStatus = customerOrder.paymentStatus || 'NOT_PAID';
            const onsalePrice = Number(customerOrder.onsalePrice ?? discountedPrice);
            const discount = Number(customerOrder.discount || 0);
            const buyerEmail = customerOrder.buyerEmail || null;
            const estimatedDelivery = customerOrder.estimatedDelivery
              ? new Date(customerOrder.estimatedDelivery)
              : null;
            const productOption = customerOrder.productOption || null;
            const deliveryPincode = customerOrder.deliveryPincode || null;
            const productReturn = customerOrder.productReturn || product.productReturn || null;
            const razorpayOrderId = customerOrder.razorpayOrderId || null;
            const paymentMode = customerOrder.paymentMode || null;
            const productImage = formatImageUrl(customerOrder.productImage || product.mainMedia) || null;
            const deliveryFee = Number(customerOrder.deliveryFee || 0);
            const deliveryCharge = Boolean(customerOrder.deliveryCharge);
            const couponCode = customerOrder.couponCode || null;
            const couponDiscount = Number(customerOrder.couponDiscount || 0);
            const paymentMethod = customerOrder.paymentMethod || null;
            const codDeliveryFee = Number(customerOrder.codDeliveryFee || 0);
            const upiDeliveryFee = Number(customerOrder.upiDeliveryFee || 0);

            // d. Insert CustomerOrder record
            await this.databaseService.executePoolQuery(
              `INSERT INTO public.orders (
                 id, invoice_number, seller_id, order_id, items, total_amount,
                 customer_name, customer_address, customer_phone, status, payment_status,
                 product_id, mrp, onsale_price, discount, buyer_email,
                 estimated_delivery, product_option, delivery_pincode, product_return,
                 razorpay_order_id, payment_mode, product_image, delivery_fee,
                 delivery_charge, quantity, coupon_code, coupon_discount,
                 payment_method, cod_delivery_fee, upi_delivery_fee, used_wallet_amount,
                 module, order_type, created_date, updated_date
               ) VALUES (
                 gen_random_uuid(), $1, $2, $3, $4, $5,
                 $6, $7, $8, $9, $10,
                 $11, $12, $13, $14, $15,
                 $16, $17, $18, $19,
                 $20, $21, $22, $23,
                 $24, $25, $26, $27,
                 $28, $29, $30, $31,
                 $32, 'CUSTOMER', now(), now()
               );`,
              [
                invoiceNumber,
                sellerId,
                orderId,
                items,
                totalAmount,
                customerName,
                customerAddress,
                customerPhone,
                status,
                paymentStatus,
                productId,
                mrp,
                onsalePrice,
                discount,
                buyerEmail,
                estimatedDelivery,
                JSON.stringify(productOption),
                deliveryPincode,
                productReturn,
                razorpayOrderId,
                paymentMode,
                productImage,
                deliveryFee,
                deliveryCharge,
                quantity,
                couponCode,
                couponDiscount,
                paymentMethod,
                codDeliveryFee,
                upiDeliveryFee,
                usedWalletAmount,
                module,
              ],
            );

            // h. Insert SellerOrder record
            await this.databaseService.executePoolQuery(
              `INSERT INTO public.orders (
                 id, seller_id, order_id, items, total_amount,
                 customer_name, customer_address, customer_phone, status, payment_status,
                 seller_payment_status, item_price, product_id, mrp, buyer_email,
                 estimated_delivery, product_option, delivery_pincode, product_return,
                 razorpay_order_id, payment_mode, product_image, invoice_number,
                 delivery_charge, quantity, coupon_code, coupon_discount,
                 payment_method, cod_delivery_fee, upi_delivery_fee, used_wallet_amount,
                 module, order_type, created_date, updated_date
               ) VALUES (
                 gen_random_uuid(), $1, $2, $3, $4,
                 $5, $6, $7, $8, $9,
                 'NOT_PAID', $10, $11, $12, $13,
                 $14, $15, $16, $17,
                 $18, $19, $20, $21,
                 $22, $23, $24, $25,
                 $26, $27, $28, $29,
                 $30, 'SELLER', now(), now()
               );`,
              [
                sellerId,
                orderId,
                items,
                totalAmount,
                customerName,
                customerAddress,
                customerPhone,
                status,
                paymentStatus,
                discountedPrice,
                productId,
                mrp,
                buyerEmail,
                estimatedDelivery,
                JSON.stringify(productOption),
                deliveryPincode,
                productReturn,
                razorpayOrderId,
                paymentMode,
                productImage,
                invoiceNumber,
                deliveryCharge,
                quantity,
                couponCode,
                couponDiscount,
                paymentMethod,
                codDeliveryFee,
                upiDeliveryFee,
                usedWalletAmount,
                module,
              ],
            );

            // i. Return entry success payload
            return {
              orderId: newOrder.number,
              invoiceNumber,
              productId,
            };
          } catch (itemErr: any) {
            this.logger.error(`Error processing order entry index ${index}: ${itemErr.message}`);
            return { error: itemErr.message || 'Error processing item' };
          }
        }),
      );

      return {
        status: 'success',
        message: {
          message: 'Orders processed',
          results,
        },
      };
    } catch (err: any) {
      this.logger.error(`Outer server error during createOrders: ${err.message}`, err.stack);
      throw new BadRequestException({
        status: 'error',
        message: 'Server error',
        error: err.message,
      });
    }
  }

  /**
   * GET /getOrders?module=haatza|lite&buyerEmail=...&status=...&page=...&limit=...
   * Replicates Wix get_customerorderslist.
   */
  async getOrders(query: GetOrdersQueryDto, module: 'haatza' | 'lite') {
    const buyerEmail = (query.buyerEmail || '').trim();
    if (!buyerEmail) {
      throw new BadRequestException({
        status: 'error',
        message: 'buyerEmail is required',
      });
    }

    const statusParam = query.status?.trim().toLowerCase();
    let mappedStatuses: string[] | null = null;
    if (statusParam && STATUS_MAP[statusParam]) {
      mappedStatuses = STATUS_MAP[statusParam];
    } else if (statusParam) {
      mappedStatuses = [query.status!.trim()];
    }

    let sql = `
      SELECT 
        id, order_id, items, quantity, total_amount, product_image,
        product_id, product_option, status, created_date
      FROM public.orders
      WHERE buyer_email = $1
        AND order_type = 'CUSTOMER'
        AND module = $2
    `;
    const params: any[] = [buyerEmail, module];

    if (mappedStatuses && mappedStatuses.length > 0) {
      sql += ` AND status = ANY($3)`;
      params.push(mappedStatuses);
    }

    sql += ` ORDER BY created_date DESC;`;

    const rows = await this.databaseService.queryRawDashboard(sql, params);

    if (!rows || rows.length === 0) {
      return {
        status: 'success',
        message: {
          data: [],
          pagination: {},
        },
      };
    }

    const mappedData = rows.map((row: any) => {
      let productOption = row.product_option;
      if (typeof productOption === 'string') {
        try {
          productOption = JSON.parse(productOption);
        } catch {
          productOption = {};
        }
      }

      return {
        tableId: row.id,
        orderId: row.order_id,
        name: row.items || '',
        quantity: typeof row.quantity === 'number' ? row.quantity : Number(row.quantity || 1),
        price:
          typeof row.total_amount === 'number'
            ? row.total_amount
            : Number(row.total_amount || 0),
        src: formatImageUrl(row.product_image),
        productId: row.product_id || '',
        productOption: productOption || {},
        status: row.status || '',
      };
    });

    const totalResults = mappedData.length;
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Number(query.limit || 10));
    const totalPages = Math.ceil(totalResults / limit);
    const startIndex = (page - 1) * limit;
    const paginatedData = mappedData.slice(startIndex, startIndex + limit);

    return {
      status: 'success',
      message: {
        data: paginatedData,
        pagination: {
          totalResults,
          totalPages,
          currentPage: page,
          pageSize: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    };
  }

  /**
   * GET /orders/:tableId?module=haatza|lite or /getOrderDetails?tableId=...
   * Replicates Wix get_custmerordersdetails.
   */
  async getOrderDetails(tableId: string, module: 'haatza' | 'lite') {
    if (!tableId || tableId.trim() === '') {
      throw new BadRequestException({
        status: 'error',
        message: 'tableId is required',
      });
    }

    const trimmedTableId = tableId.trim();

    // Query order by id or order_id
    const orderRows = await this.databaseService.queryRawDashboard(
      `SELECT * FROM public.orders 
       WHERE (id = $1 OR CAST(order_id AS TEXT) = $1) 
         AND order_type = 'CUSTOMER' 
         AND module = $2 
       LIMIT 1;`,
      [trimmedTableId, module],
    );

    let order = orderRows?.[0];

    // Fallback search without order_type if not found
    if (!order) {
      const fallbackRows = await this.databaseService.queryRawDashboard(
        `SELECT * FROM public.orders 
         WHERE (id = $1 OR CAST(order_id AS TEXT) = $1) 
           AND module = $2 
         LIMIT 1;`,
        [trimmedTableId, module],
      );
      order = fallbackRows?.[0];
    }

    if (!order) {
      throw new NotFoundException({
        status: 'error',
        message: 'Order not found',
      });
    }

    // Fetch Seller details by sellerId
    let seller: any = null;
    if (order.seller_id) {
      seller = await this.databaseService.user.findFirst({
        where: {
          OR: [{ sellerId: order.seller_id }, { id: order.seller_id }],
        },
      });
    }

    // Fetch Product details by productId
    let product: any = null;
    if (order.product_id) {
      product = await this.databaseService.product.findFirst({
        where: {
          OR: [{ productId: order.product_id }, { id: order.product_id }],
        },
      });
    }

    let items: any = [];
    if (order.items) {
      if (Array.isArray(order.items)) {
        items = order.items;
      } else if (typeof order.items === 'string') {
        try {
          const parsed = JSON.parse(order.items);
          items = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          items = [];
        }
      } else {
        items = [order.items];
      }
    }

    let orderId: any = order.order_id;
    if (typeof orderId === 'string' && orderId.trim() !== '' && !isNaN(Number(orderId))) {
      orderId = Number(orderId);
    } else if (typeof orderId === 'number') {
      orderId = order.order_id;
    } else if (!orderId) {
      orderId = order.id;
    }

    let productOption = order.product_option;
    if (typeof productOption === 'string') {
      const trimmed = productOption.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          productOption = JSON.parse(productOption);
        } catch {
          // Keep raw string if JSON parsing fails
        }
      }
    }
    if (productOption === null || productOption === undefined) {
      productOption = {};
    }

    let productReturn: boolean = false;
    if (typeof order.product_return === 'boolean') {
      productReturn = order.product_return;
    } else if (order.product_return === 'true') {
      productReturn = true;
    } else if (order.product_return === 'false') {
      productReturn = false;
    } else if (order.product_return !== null && order.product_return !== undefined) {
      productReturn = Boolean(order.product_return);
    }

    let pickupAddress: any = {};
    if (order.pickup_address) {
      if (typeof order.pickup_address === 'object') {
        pickupAddress = order.pickup_address;
      } else if (typeof order.pickup_address === 'string') {
        try {
          pickupAddress = JSON.parse(order.pickup_address);
        } catch {
          pickupAddress = order.pickup_address;
        }
      }
    } else if (seller?.address) {
      if (typeof seller.address === 'object') {
        pickupAddress = seller.address;
      } else if (typeof seller.address === 'string') {
        try {
          pickupAddress = JSON.parse(seller.address);
        } catch {
          pickupAddress = seller.address;
        }
      }
    }
    if (!pickupAddress) {
      pickupAddress = {};
    }

    const rawAddress = order.customer_address || '';
    const customerAddress = rawAddress.replace(/[\r\n]+/g, ' ').trim();

    const responsePayload = {
      tableId: order.id,
      orderId,
      sellerId: order.seller_id || '',
      items,
      quantity: typeof order.quantity === 'number' ? order.quantity : Number(order.quantity || 1),
      price:
        typeof order.total_amount === 'number'
          ? order.total_amount
          : Number(order.total_amount || 0),
      src: formatImageUrl(order.product_image),
      totalAmount:
        typeof order.total_amount === 'number'
          ? order.total_amount
          : Number(order.total_amount || 0),
      customerName: order.customer_name || '',
      customerAddress,
      status: order.status || '',
      paymentStatus: order.payment_status || '',
      productId: order.product_id || '',
      trackingId: order.tracking_id || null,
      itemPrice:
        order.item_price !== null && order.item_price !== undefined
          ? Number(order.item_price)
          : null,
      buyerEmail: order.buyer_email || '',
      customerPhone: order.customer_phone || '',
      estimatedDelivery: order.estimated_delivery || null,
      productOption,
      productReturn,
      orderDate: order.created_date || null,
      deliveredDate: order.delivered_date || null,
      invoiceNumber: order.invoice_number || '',
      returnDate: order.return_date || null,
      exchangeDate: order.exchange_date || null,
      sellerName: seller?.companyName || seller?.name || '',
      sellerAddress: seller?.address || '',
      sellerGstin: seller?.gstin || '',
      sellerPincode: seller?.pincode || '',
      sellerCountry: seller?.country || '',
      sellerState: seller?.state || '',
      sellerCity: seller?.city || '',
      pickupAddress,
      paymentMethod: order.payment_method || '',
      subCategoryId: product?.subCategoryId || product?.subCategory || '',
      mainCategory: product?.mainCategory || product?.categoryId || '',
    };

    return {
      status: 'success',
      message: responsePayload,
    };
  }
}
