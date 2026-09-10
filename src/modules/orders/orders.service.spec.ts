import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { DatabaseService } from '../../database/database.service';
import { formatImageUrl } from './utils/image-url.util';

describe('OrdersService', () => {
  let service: OrdersService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      executePoolQuery: jest.fn().mockResolvedValue(1),
      queryRawDashboard: jest.fn().mockResolvedValue([]),
      product: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('formatImageUrl utility', () => {
    it('converts wix:image://v1/{mediaId}/{filename} to GCS haatza-media-bucket URL', () => {
      const wixUrl = 'wix:image://v1/abc12345/my-image.jpg#originWidth=800&originHeight=600';
      expect(formatImageUrl(wixUrl)).toBe('https://storage.googleapis.com/haatza-media-bucket/products/abc12345');
    });

    it('converts wix:image://v1/{mediaId} to GCS haatza-media-bucket URL', () => {
      const wixUrl = 'wix:image://v1/media999';
      expect(formatImageUrl(wixUrl)).toBe('https://storage.googleapis.com/haatza-media-bucket/products/media999');
    });

    it('converts relative media key products/{filename} to full GCS URL', () => {
      const relativeKey = 'products/5fba3390-f2ce-4a4a-a9e9-5daa4f543d3f.webp';
      expect(formatImageUrl(relativeKey)).toBe(
        'https://storage.googleapis.com/haatza-media-bucket/products/5fba3390-f2ce-4a4a-a9e9-5daa4f543d3f.webp',
      );
    });

    it('passes through standard HTTP / HTTPS GCS URLs as-is', () => {
      const normalUrl = 'https://storage.googleapis.com/haatza-media-bucket/products/prod1.jpg';
      expect(formatImageUrl(normalUrl)).toBe(normalUrl);
    });

    it('handles empty or null safely', () => {
      expect(formatImageUrl(null)).toBe('');
      expect(formatImageUrl(undefined)).toBe('');
      expect(formatImageUrl('')).toBe('');
    });
  });

  describe('generateInvoiceNumber', () => {
    it('generates INV-YYYYMMDD-XXX format', async () => {
      mockDb.queryRawDashboard.mockResolvedValueOnce([{ cnt: '5' }]);
      const invoice = await service.generateInvoiceNumber();
      expect(invoice).toMatch(/^INV-\d{8}-006$/);
    });
  });

  describe('createOrders', () => {
    it('returns per-item error when required orderData fields are missing', async () => {
      const dto = {
        order: [
          {
            customerOrder: {
              productId: 'prod_test',
              quantity: 1,
            },
            // Missing lineItems, currency, totals, billingInfo, shippingInfo
          },
        ],
      };

      const result = await service.createOrders(dto as any, 'haatza');
      expect(result.status).toBe('success');
      expect(result.message.results).toHaveLength(1);
      expect(result.message.results[0]).toHaveProperty('error');
      expect(result.message.results[0].error).toContain('Validation error: missing required orderData fields');
    });

    it('returns { error: "Product not found", productId } when product does not exist in DB', async () => {
      mockDb.product.findFirst.mockResolvedValueOnce(null);

      const dto = {
        order: [
          {
            customerOrder: {
              productId: 'missing_prod',
              quantity: 1,
            },
            lineItems: [{ id: 'item1' }],
            currency: 'INR',
            totals: { total: 500 },
            billingInfo: { name: 'Bob' },
            shippingInfo: { address: 'Delhi' },
          },
        ],
      };

      const result = await service.createOrders(dto as any, 'haatza');
      expect(result.status).toBe('success');
      expect(result.message.results[0]).toEqual({
        error: 'Product not found',
        productId: 'missing_prod',
      });
    });

    it('successfully processes order entry and returns { orderId, invoiceNumber, productId }', async () => {
      mockDb.product.findFirst.mockResolvedValueOnce({
        id: 'uuid-1',
        productId: 'prod_real',
        name: 'Cotton Shirt',
        price: 1000,
        onsalePrice: 800,
        sellerId: 'SELLER_1',
      });

      mockDb.queryRawDashboard
        .mockResolvedValueOnce([{ next_num: '10005' }]) // generateOrderNumber
        .mockResolvedValueOnce([{ id: 'master-order-id' }]) // createOrder insert
        .mockResolvedValueOnce([{ cnt: '0' }]); // invoice count

      const dto = {
        order: [
          {
            customerOrder: {
              productId: 'prod_real',
              quantity: 2,
              customerName: 'Bob',
              customerPhone: '9876543210',
            },
            lineItems: [{ id: 'item1' }],
            currency: 'INR',
            totals: { total: 1600 },
            billingInfo: { name: 'Bob' },
            shippingInfo: { address: 'Delhi' },
          },
        ],
      };

      const result = await service.createOrders(dto as any, 'haatza');
      expect(result.status).toBe('success');
      expect(result.message.results[0]).toEqual({
        orderId: 10005,
        invoiceNumber: expect.stringMatching(/^INV-\d{8}-001$/),
        productId: 'prod_real',
      });
    });
  });

  describe('getOrders', () => {
    it('throws BadRequestException if buyerEmail is missing', async () => {
      await expect(
        service.getOrders({ buyerEmail: '' } as any, 'haatza'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns empty results with pagination when no orders exist', async () => {
      mockDb.queryRawDashboard.mockResolvedValueOnce([]);

      const result = await service.getOrders(
        { buyerEmail: 'empty@haatza.com' } as any,
        'haatza',
      );

      expect(result).toEqual({
        status: 'success',
        message: {
          data: [],
          pagination: {},
        },
      });
    });

    it('maps orders to camelCase and applies in-memory pagination', async () => {
      const mockRows = [
        {
          id: 'table-1',
          order_id: '10001',
          items: 'Product A',
          quantity: 1,
          total_amount: 500,
          product_image: 'wix:image://v1/img1/pic.jpg',
          product_id: 'prod_1',
          product_option: '{"Size":"M"}',
          status: 'Order Placed',
          created_date: new Date(),
        },
        {
          id: 'table-2',
          order_id: '10002',
          items: 'Product B',
          quantity: 2,
          total_amount: 1200,
          product_image: 'https://example.com/img2.jpg',
          product_id: 'prod_2',
          product_option: { Size: 'L' },
          status: 'Order Confirmed',
          created_date: new Date(),
        },
      ];

      mockDb.queryRawDashboard.mockResolvedValueOnce(mockRows);

      const result = await service.getOrders(
        {
          buyerEmail: 'buyer@haatza.com',
          status: 'ordered',
          page: 1,
          limit: 1,
        } as any,
        'haatza',
      );

      expect(result.status).toBe('success');
      expect(result.message.data).toHaveLength(1);
      expect(result.message.data[0]).toEqual({
        tableId: 'table-1',
        orderId: '10001',
        name: 'Product A',
        quantity: 1,
        price: 500,
        src: 'https://storage.googleapis.com/haatza-media-bucket/products/img1',
        productId: 'prod_1',
        productOption: { Size: 'M' },
        status: 'Order Placed',
      });
      expect(result.message.pagination).toEqual({
        totalResults: 2,
        totalPages: 2,
        currentPage: 1,
        pageSize: 1,
        hasNextPage: true,
        hasPrevPage: false,
      });
    });
  });

  describe('getOrderDetails', () => {
    it('throws NotFoundException when order does not exist', async () => {
      mockDb.queryRawDashboard.mockResolvedValue([]);
      await expect(
        service.getOrderDetails('non-existent-id', 'haatza'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns enriched order details with newline-stripped address', async () => {
      const mockOrderRow = {
        id: 'ord-123',
        order_id: '10001',
        seller_id: 'SELLER_A',
        items: 'Silk Scarf',
        quantity: 1,
        total_amount: 450,
        product_image: 'wix:image://v1/img_scarf',
        customer_name: 'Jane Doe',
        customer_address: 'Line 1\nLine 2\r\nCity',
        customer_phone: '9998887776',
        status: 'Delivered',
        payment_status: 'PAID',
        product_id: 'prod_scarf',
        buyer_email: 'jane@example.com',
        created_date: new Date('2026-09-01'),
        invoice_number: 'INV-20260901-001',
      };

      mockDb.queryRawDashboard.mockResolvedValueOnce([mockOrderRow]);

      mockDb.user.findFirst.mockResolvedValueOnce({
        sellerId: 'SELLER_A',
        name: 'Seller One',
        companyName: 'Seller Co',
        address: 'Market Street',
        gstin: '29ABCDE1234F1Z5',
        pincode: '560001',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
      });

      mockDb.product.findFirst.mockResolvedValueOnce({
        productId: 'prod_scarf',
        subCategoryId: 'Scarves',
        mainCategory: 'Accessories',
      });

      const result = await service.getOrderDetails('ord-123', 'haatza');
      expect(result.status).toBe('success');
      const data = result.message;

      expect(data.tableId).toBe('ord-123');
      expect(data.orderId).toBe(10001);
      expect(data.sellerName).toBe('Seller Co');
      expect(data.sellerGstin).toBe('29ABCDE1234F1Z5');
      expect(data.subCategoryId).toBe('Scarves');
      expect(data.mainCategory).toBe('Accessories');
      expect(data.customerAddress).toBe('Line 1 Line 2 City'); // Newlines stripped!
      expect(data.src).toBe('https://storage.googleapis.com/haatza-media-bucket/products/img_scarf');
    });
  });
});
