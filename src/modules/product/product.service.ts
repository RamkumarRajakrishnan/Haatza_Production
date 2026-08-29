import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProductListQueryDto, SortOrder } from './dto/product-list.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private readonly db: DatabaseService) {}

  async getProductsList(query: ProductListQueryDto, authenticatedSellerId?: string) {
    const {
      sellerId,
      search,
      category,
      subCategory,
      status,
      page = 1,
      limit = 10,
      sortBy = 'createdDate',
      sortOrder = SortOrder.DESC,
    } = query;

    const skip = (page - 1) * limit;

    // Build the query filter object
    const where: Prisma.ProductWhereInput = {};

    // Prioritize active JWT session sellerId if present
    const targetSellerId = authenticatedSellerId || sellerId;
    if (targetSellerId) {
      where.sellerId = targetSellerId;
    }

    if (status) {
      where.status = {
        equals: status,
        mode: 'insensitive',
      };
    }

    if (category) {
      where.mainCategory = {
        equals: category,
        mode: 'insensitive',
      };
    }

    if (subCategory) {
      where.OR = [
        { subCategory: { equals: subCategory, mode: 'insensitive' } },
        { subCategoryId: { equals: subCategory } },
      ];
    }

    if (search?.trim()) {
      const searchTrimmed = search.trim();
      where.OR = [
        ...(where.OR || []),
        { name: { contains: searchTrimmed, mode: 'insensitive' } },
        { brand: { contains: searchTrimmed, mode: 'insensitive' } },
        { sku: { contains: searchTrimmed, mode: 'insensitive' } },
        { description: { contains: searchTrimmed, mode: 'insensitive' } },
        { searchKeywords: { has: searchTrimmed } },
      ];
    }

    // Determine sorting field
    const orderBy: any = {};
    const validSortFields = ['createdDate', 'updatedDate', 'price', 'mrp', 'name', 'inventory', 'sales', 'revenue'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdDate';
    orderBy[sortField] = sortOrder.toLowerCase();

    // Execute queries in parallel
    const [total, products] = await Promise.all([
      this.db.product.count({ where }),
      this.db.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      status: 'success',
      message: 'Products list retrieved successfully',
      data: {
        products,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    };
  }
}
