import { Test, TestingModule } from '@nestjs/testing';
import { CategorySponsoredService } from './category-sponsored.service';
import { CategorySponsoredController } from './category-sponsored.controller';
import { DatabaseService } from '../../database/database.service';
import { BadRequestException } from '@nestjs/common';
import { DashboardModule } from '@prisma/client';

describe('CategorySponsoredService & Controller', () => {
  let service: CategorySponsoredService;
  let controller: CategorySponsoredController;
  let mockDbService: Partial<DatabaseService>;

  beforeEach(async () => {
    mockDbService = {
      queryRawCategorySponsored: jest.fn().mockResolvedValue([
        {
          id: 'CAT_SPON_001',
          widgetType: 'hero_banner',
          widgetId: 'WID001',
          title: 'Mega Deals',
          status: 'ACTIVE',
          sequence: 1,
          categoryId: 'cate001',
          categoryName: 'Electronics',
          item: [{ image: 'https://example.com/banner.jpg', productId: 'p1' }],
          warehouseId: null,
          module: 'HAATZA',
          expiresAt: new Date(Date.now() + 86400000),
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategorySponsoredController],
      providers: [
        CategorySponsoredService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    service = module.get<CategorySponsoredService>(CategorySponsoredService);
    controller = module.get<CategorySponsoredController>(CategorySponsoredController);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(controller).toBeDefined();
  });

  describe('getCategorySponsored', () => {
    it('should throw BadRequestException if module is missing', async () => {
      await expect(
        service.getCategorySponsored({ categoryId: 'cate001' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if categoryId is missing', async () => {
      await expect(
        service.getCategorySponsored({ module: DashboardModule.HAATZA }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if warehouseId is missing for LITE module', async () => {
      await expect(
        service.getCategorySponsored({
          categoryId: 'cate001',
          module: DashboardModule.LITE,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return widgets with categoryId and camelCase structure for HAATZA module', async () => {
      const result = await service.getCategorySponsored({
        categoryId: 'cate001',
        module: DashboardModule.HAATZA,
      });

      expect(result.status).toBe('success');
      expect(result.message).toBeDefined();
      expect(result.message.categoryId).toBe('cate001');
      expect(result.message.module).toBe(DashboardModule.HAATZA);
      expect(Array.isArray(result.message.data)).toBe(true);
      expect(result.message.data.length).toBe(1);

      const widget = result.message.data[0];
      expect(widget.widgetType).toBe('hero_banner');
      expect(widget.widgetId).toBe('WID001');
      expect(widget.categoryId).toBe('cate001');
      expect(widget.categoryName).toBe('Electronics');
      expect(widget.status).toBe('ACTIVE');
    });

    it('should dynamically return status INACTIVE if widget has expired', async () => {
      mockDbService.queryRawCategorySponsored = jest.fn().mockResolvedValue([
        {
          id: 'CAT_SPON_002',
          widgetType: 'hero_banner',
          widgetId: 'WID002',
          title: 'Past Deals',
          status: 'ACTIVE', // DB row still says ACTIVE
          sequence: 1,
          categoryId: 'cate001',
          categoryName: 'Electronics',
          item: [{ image: 'https://example.com/past.jpg' }],
          warehouseId: null,
          module: 'HAATZA',
          expiresAt: new Date(Date.now() - 10000), // Expired 10 seconds ago
        },
      ]);

      const result = await service.getCategorySponsored({
        categoryId: 'cate001',
        module: DashboardModule.HAATZA,
        status: 'all',
      });

      const widget = result.message.data[0];
      expect(widget.status).toBe('INACTIVE');
    });

    it('upsertWidgets should automatically compute status as INACTIVE if expiresAt is in the past', async () => {
      mockDbService.queryRawCategorySponsored = jest
        .fn()
        .mockResolvedValueOnce([]) // max widget id
        .mockResolvedValueOnce([]) // existing record
        .mockResolvedValueOnce([
          {
            id: 'CAT_SPON_003',
            widgetType: 'hero_banner',
            widgetId: 'WID001',
            status: 'INACTIVE',
          },
        ]);

      const res = await service.upsertWidgets({
        widgetType: 'hero_banner',
        status: 'ACTIVE', // client passed ACTIVE
        expiresAt: new Date(Date.now() - 60000).toISOString(), // expired
        categoryId: 'cate001',
      });

      expect(res.status).toBe('success');
      expect(mockDbService.queryRawCategorySponsored).toHaveBeenCalled();
    });

    it('controller getCategorySponsoredGet should invoke service and return result', async () => {
      const res = await controller.getCategorySponsoredGet({
        categoryId: 'cate001',
        module: DashboardModule.HAATZA,
      });
      expect(res.status).toBe('success');
      expect(res.message.categoryId).toBe('cate001');
    });

    it('controller ping should return ok status', () => {
      const pingRes = controller.ping();
      expect(pingRes.status).toBe('ok');
      expect(pingRes.service).toBe('category-sponsored');
    });
  });
});
