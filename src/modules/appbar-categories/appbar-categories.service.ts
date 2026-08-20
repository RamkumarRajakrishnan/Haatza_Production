import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GetAppbarCategoriesDto } from './dto/get-appbar-categories.dto';

@Injectable()
export class AppbarCategoriesService {
  private readonly logger = new Logger(AppbarCategoriesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Calculates Haversine distance in Kilometers between two Geographic coordinates.
   */
  private calculateHaversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in KM
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;
    return parseFloat(dist.toFixed(2));
  }

  /**
   * Evaluates if the current server time falls within the warehouse operating hours.
   */
  private isStoreCurrentlyOpen(
    startTimeStr?: string | null,
    endTimeStr?: string | null,
  ): boolean {
    if (!startTimeStr || !endTimeStr) return true;

    const parseMinutes = (tStr: string): number => {
      const parts = String(tStr).split(':').map((p) => parseInt(p, 10) || 0);
      return parts[0] * 60 + (parts[1] || 0);
    };

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = parseMinutes(startTimeStr);
    const endMinutes = parseMinutes(endTimeStr);

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Handles overnight operating windows (e.g. 22:00 to 06:00)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  /**
   * Main Appbar Categories Fetch API Handler supporting HAATZA and LITE modules.
   */
  async getAppbarCategories(dto: GetAppbarCategoriesDto) {
    if (!dto.module || typeof dto.module !== 'string' || !dto.module.trim()) {
      throw new BadRequestException('Module is required');
    }

    const rawModule = dto.module.trim().toLowerCase();

    if (rawModule !== 'haatza' && rawModule !== 'lite') {
      throw new BadRequestException(
        'Invalid module. Allowed values are haatza and lite',
      );
    }

    // ----------------------------------------------------
    // HAATZA MODULE LOGIC
    // ----------------------------------------------------
    if (rawModule === 'haatza') {
      const categories = await this.db.queryRawDashboard(
        `SELECT 
           category_id AS "categoryId",
           category_name AS "categoryName",
           image,
           appbar_color AS "appbarColor",
           appbar_image AS "appbarImage",
           category_text_color AS "categoryTextColor",
           appbarbackground,
           COALESCE(warehouse_id, 'WH00001') AS "warehouseId"
         FROM public.appbar_categories
         WHERE LOWER(TRIM(module)) = 'haatza'
           AND (LOWER(TRIM(status)) = 'active' OR status IS NULL OR status = 'TRUE' OR status = 'true')
           AND (expire_date IS NULL OR expire_date >= NOW())
         ORDER BY created_date DESC`,
      );

      const formattedData = categories.map((cat: any) => ({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        image: cat.image || '',
        appbarColor: cat.appbarColor || '',
        appbarImage: cat.appbarImage || '',
        categoryTextColor: cat.categoryTextColor || '',
        appbarbackground: Boolean(cat.appbarbackground),
        warehouseId: cat.warehouseId || '',
        nearestWarehouseDistanceKm: 0,
      }));

      return {
        status: 'success',
        message: {
          message: 'Available',
          nearestWarehouseDistanceKm: 0,
          estimatedDeliveryTimeMinutes: 0,
          data: formattedData,
        },
      };
    }

    // ----------------------------------------------------
    // LITE MODULE LOGIC
    // ----------------------------------------------------
    const hasLat = dto.latitude !== undefined && dto.latitude !== null && dto.latitude !== ('' as any);
    const hasLon = dto.longitude !== undefined && dto.longitude !== null && dto.longitude !== ('' as any);

    if (!hasLat && !hasLon) {
      throw new BadRequestException(
        'Latitude and longitude are required for lite module',
      );
    }
    if (!hasLat) {
      throw new BadRequestException('Latitude is required for lite module');
    }
    if (!hasLon) {
      throw new BadRequestException('Longitude is required for lite module');
    }

    const customerLat = Number(dto.latitude);
    const customerLon = Number(dto.longitude);

    if (isNaN(customerLat) || isNaN(customerLon)) {
      throw new BadRequestException('Invalid latitude or longitude');
    }

    // Fetch active warehouses from warehouse_master
    const warehouses = await this.db.queryRawDashboard(
      `SELECT 
         warehouse_id AS "warehouseId",
         warehouse_name AS "warehouseName",
         latitude::float AS latitude,
         longitude::float AS longitude,
         service_radius_km::float AS "serviceRadiusKm",
         status,
         operating_start_time::text AS "operatingStartTime",
         operating_end_time::text AS "operatingEndTime",
         estimated_delivery_time_minutes AS "estimatedDeliveryTimeMinutes"
       FROM public.warehouse_master
       WHERE LOWER(TRIM(status)) = 'active'`,
    );

    if (!warehouses || warehouses.length === 0) {
      return {
        status: 'success',
        message: {
          message: 'No store available',
          nearestWarehouseDistanceKm: 0,
          estimatedDeliveryTimeMinutes: 0,
          data: [],
        },
      };
    }

    // Calculate distance to each warehouse
    const evaluatedWarehouses = warehouses.map((wh: any) => {
      const distance = this.calculateHaversineDistanceKm(
        customerLat,
        customerLon,
        wh.latitude,
        wh.longitude,
      );
      return {
        ...wh,
        distance,
        serviceRadiusKm: wh.serviceRadiusKm ?? 10.0,
        estimatedDeliveryTimeMinutes: wh.estimatedDeliveryTimeMinutes ?? 10,
      };
    });

    // Sort warehouses by distance ascending
    evaluatedWarehouses.sort((a, b) => a.distance - b.distance);

    const overallNearestWh = evaluatedWarehouses[0];

    // Filter warehouses within service radius
    const eligibleWarehouses = evaluatedWarehouses.filter(
      (wh) => wh.distance <= wh.serviceRadiusKm,
    );

    // Case 1: Out of service radius
    if (eligibleWarehouses.length === 0) {
      return {
        status: 'success',
        message: {
          message: 'No store available',
          nearestWarehouseDistanceKm: overallNearestWh.distance,
          estimatedDeliveryTimeMinutes: 0,
          data: [],
        },
      };
    }

    const nearestWh = eligibleWarehouses[0];

    // Case 2: Check store operating hours
    const isOpen = this.isStoreCurrentlyOpen(
      nearestWh.operatingStartTime,
      nearestWh.operatingEndTime,
    );

    if (!isOpen) {
      return {
        status: 'success',
        message: {
          message: 'Store closed',
          nearestWarehouseDistanceKm: nearestWh.distance,
          estimatedDeliveryTimeMinutes: nearestWh.estimatedDeliveryTimeMinutes,
          data: [],
        },
      };
    }

    // Query categories for nearest warehouse
    const categories = await this.db.queryRawDashboard(
      `SELECT 
         category_id AS "categoryId",
         category_name AS "categoryName",
         image,
         appbar_color AS "appbarColor",
         appbar_image AS "appbarImage",
         category_text_color AS "categoryTextColor",
         appbarbackground,
         warehouse_id AS "warehouseId"
       FROM public.appbar_categories
       WHERE LOWER(TRIM(module)) = 'lite'
         AND (LOWER(TRIM(warehouse_id)) = LOWER(TRIM($1)) OR warehouse_id IS NULL OR TRIM(warehouse_id) = '' OR LOWER(TRIM(warehouse_id)) = 'all')
         AND (LOWER(TRIM(status)) = 'active' OR status IS NULL OR status = 'TRUE' OR status = 'true')
         AND (expire_date IS NULL OR expire_date >= NOW())
       ORDER BY created_date DESC`,
      [nearestWh.warehouseId],
    );

    if (!categories || categories.length === 0) {
      return {
        status: 'success',
        message: {
          message: 'No categories available',
          nearestWarehouseDistanceKm: nearestWh.distance,
          estimatedDeliveryTimeMinutes: nearestWh.estimatedDeliveryTimeMinutes,
          data: [],
        },
      };
    }

    const formattedData = categories.map((cat: any) => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      image: cat.image || '',
      appbarColor: cat.appbarColor || '',
      appbarImage: cat.appbarImage || '',
      categoryTextColor: cat.categoryTextColor || '',
      appbarbackground: Boolean(cat.appbarbackground),
      warehouseId: nearestWh.warehouseId,
      nearestWarehouseDistanceKm: nearestWh.distance,
    }));

    return {
      status: 'success',
      message: {
        message: 'Store open',
        nearestWarehouseDistanceKm: nearestWh.distance,
        estimatedDeliveryTimeMinutes: nearestWh.estimatedDeliveryTimeMinutes,
        data: formattedData,
      },
    };
  }
}
