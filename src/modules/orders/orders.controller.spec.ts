import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CreateOrdersDto } from './dto/create-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: jest.Mocked<OrdersService>;

  beforeEach(async () => {
    const mockOrdersService = {
      createOrders: jest.fn(),
      getOrders: jest.fn(),
      getOrderDetails: jest.fn(),
      createOrder: jest.fn(),
      generateInvoiceNumber: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get(OrdersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createOrders', () => {
    it('should forward to service with module and return success payload', async () => {
      const dto: CreateOrdersDto = {
        order: [
          {
            customerOrder: {
              productId: 'prod_123',
              quantity: 2,
            },
            lineItems: [{ id: 'item1' }],
            currency: 'INR',
            totals: { total: 1998 },
            billingInfo: { name: 'John Doe' },
            shippingInfo: { address: '123 Test St' },
          },
        ],
      };

      const expectedResponse = {
        status: 'success',
        message: {
          message: 'Orders processed',
          results: [
            {
              orderId: 10001,
              invoiceNumber: 'INV-20260910-001',
              productId: 'prod_123',
            },
          ],
        },
      };

      service.createOrders.mockResolvedValue(expectedResponse as any);

      const result = await controller.createOrders('haatza', dto);
      expect(result).toEqual(expectedResponse);
      expect(service.createOrders).toHaveBeenCalledWith(dto, 'haatza');
    });
  });

  describe('getOrders', () => {
    it('should forward to service with query dto and module', async () => {
      const query: GetOrdersQueryDto = {
        module: 'haatza',
        buyerEmail: 'test@haatza.com',
        status: 'ordered',
        page: 1,
        limit: 10,
      };

      const expectedResponse = {
        status: 'success',
        message: {
          data: [],
          pagination: {},
        },
      };

      service.getOrders.mockResolvedValue(expectedResponse as any);

      const result = await controller.getOrders('haatza', query);
      expect(result).toEqual(expectedResponse);
      expect(service.getOrders).toHaveBeenCalledWith(query, 'haatza');
    });
  });

  describe('getOrderDetails', () => {
    it('should forward tableId and module to service', async () => {
      const expectedResponse = {
        status: 'success',
        message: {
          tableId: 'order-uuid-1',
          orderId: '10001',
          items: 'Test Product',
          totalAmount: 999,
          customerName: 'Alice',
          customerAddress: 'Bangalore, India',
          status: 'Order Placed',
          paymentStatus: 'NOT_PAID',
          productId: 'prod_123',
        },
      };

      service.getOrderDetails.mockResolvedValue(expectedResponse as any);

      const result = await controller.getOrderDetails('haatza', 'order-uuid-1');
      expect(result).toEqual(expectedResponse);
      expect(service.getOrderDetails).toHaveBeenCalledWith('order-uuid-1', 'haatza');
    });
  });
});
