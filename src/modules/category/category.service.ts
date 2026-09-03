import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateCategoryStatusDto,
  QueryCategoryDto,
  UpdateCategorySequenceDto,
  GetMainCategoriesDto,
} from './dto/category-master.dto';
import {
  CategoryType,
  CategoryStatus,
  CategoryModule,
} from '@prisma/client';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);
  private readonly mainCategoryCache = new Map<string, { data: any; expiry: number }>();

  constructor(private readonly db: DatabaseService) { }

  /**
   * Generates next sequential unique category ID (CAT_001, CAT_002, CAT_003...)
   */
  private async generateCategoryId(): Promise<string> {
    const records = await this.db.categoryMaster.findMany({
      where: { categoryId: { startsWith: 'CAT' } },
      select: { categoryId: true },
    });

    let maxNum = 0;
    for (const r of records) {
      const match = r.categoryId.match(/^CAT_?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    const nextNum = maxNum + 1;
    return `CAT_${String(nextNum).padStart(3, '0')}`;
  }

  /**
   * Create a new category with duplicate validation & parent verification.
   */
  async createCategory(dto: CreateCategoryDto) {
    const categoryName = dto.categoryName.trim();
    const parentCategoryId = dto.parentCategoryId?.trim() || null;
    const targetModule = dto.module || CategoryModule.HAATZA;

    // 1. Validate Parent Category if provided
    let parentCategory: any = null;
    if (parentCategoryId) {
      parentCategory = await this.db.categoryMaster.findFirst({
        where: {
          OR: [{ categoryId: parentCategoryId }, { id: parentCategoryId }],
        },
      });

      if (!parentCategory) {
        throw new BadRequestException(
          `Parent category '${parentCategoryId}' does not exist.`,
        );
      }

      if (parentCategory.status === CategoryStatus.INACTIVE) {
        throw new BadRequestException(
          `Cannot create child under inactive parent category '${parentCategoryId}'.`,
        );
      }
    }

    // 2. Prevent duplicate category name under the same parent & module
    const duplicate = await this.db.categoryMaster.findFirst({
      where: {
        categoryName: { equals: categoryName, mode: 'insensitive' },
        parentCategoryId: parentCategory ? parentCategory.categoryId : null,
        module: { in: [targetModule, CategoryModule.ALL] },
      },
    });

    if (duplicate) {
      throw new BadRequestException(
        `Category '${categoryName}' already exists under the requested parent category and module.`,
      );
    }

    // 3. Determine Category Type based on parent if omitted
    let categoryType = dto.categoryType;
    if (!categoryType) {
      if (!parentCategory) {
        categoryType = CategoryType.MAIN_CATEGORY;
      } else if (parentCategory.categoryType === CategoryType.MAIN_CATEGORY) {
        categoryType = CategoryType.CATEGORY;
      } else {
        categoryType = CategoryType.SUBCATEGORY;
      }
    }

    // 4. Generate unique category ID
    const categoryId = await this.generateCategoryId();

    // 5. Persist record
    const category = await this.db.categoryMaster.create({
      data: {
        categoryId,
        categoryName,
        parentCategoryId: parentCategory ? parentCategory.categoryId : null,
        categoryType,
        categoryImage: dto.categoryImage || null,
        description: dto.description || null,
        sequence: dto.sequence ?? 0,
        status: dto.status || CategoryStatus.ACTIVE,
        module: targetModule,
        createdBy: dto.createdBy || null,
      },
    });

    this.logger.log(`Created Category Master: ${category.categoryId} (${category.categoryName})`);

    return {
      status: 'success',
      message: 'Category created successfully',
      data: this.formatCategoryOutput(category),
    };
  }

  /**
   * Get single category details by ID or custom categoryId.
   */
  async getCategory(identifier: string, module?: string) {
    if (!identifier?.trim()) {
      throw new BadRequestException('category_id parameter is required.');
    }

    const trimmed = identifier.trim();
    const rawModule = (module || '').trim().toUpperCase();
    const moduleEnum =
      rawModule === 'LITE'
        ? CategoryModule.LITE
        : rawModule === 'HAATZA'
          ? CategoryModule.HAATZA
          : undefined;

    let category = await this.db.categoryMaster.findFirst({
      where: {
        OR: [{ categoryId: trimmed }, { id: trimmed }],
        ...(moduleEnum ? { module: { in: [moduleEnum, CategoryModule.ALL] } } : {}),
      },
      include: {
        parent: true,
        children: {
          where: {
            status: CategoryStatus.ACTIVE,
            ...(moduleEnum ? { module: { in: [moduleEnum, CategoryModule.ALL] } } : {}),
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!category) {
      // Fallback to categoryList
      category = (await this.db.categoryList.findFirst({
        where: {
          OR: [{ categoryId: trimmed }, { id: trimmed }],
          ...(moduleEnum ? { module: { in: [moduleEnum, CategoryModule.ALL] } } : {}),
        },
        include: {
          parent: true,
          children: {
            where: {
              status: CategoryStatus.ACTIVE,
              ...(moduleEnum ? { module: { in: [moduleEnum, CategoryModule.ALL] } } : {}),
            },
            orderBy: { sequence: 'asc' },
          },
        },
      })) as any;
    }

    if (!category) {
      throw new NotFoundException(`Category '${trimmed}' not found.`);
    }

    return {
      status: 'success',
      message: 'Category details retrieved successfully',
      data: this.formatCategoryOutput(category),
    };
  }

  /**
   * Get list of categories with filtering by module, parent, status, and sequence.
   */
  async getCategories(query: QueryCategoryDto) {
    const parentId = query.parent_category_id || query.parentCategoryId;
    const targetCategoryId = query.category_id || query.categoryId;
    const isIncludeInactive =
      query.includeInactive === true ||
      query.includeInactive === 'true' ||
      query.includeInactive === '1';

    const where: any = {};

    if (targetCategoryId?.trim()) {
      where.OR = [
        { categoryId: targetCategoryId.trim() },
        { id: targetCategoryId.trim() },
      ];
    }

    if (parentId !== undefined) {
      where.parentCategoryId = parentId ? parentId.trim() : null;
    }

    if (query.module) {
      where.module = { in: [query.module, CategoryModule.ALL] };
    }

    if (query.categoryType) {
      where.categoryType = query.categoryType;
    }

    if (query.status) {
      where.status = query.status;
    } else if (!isIncludeInactive) {
      where.status = CategoryStatus.ACTIVE;
    }

    if (query.search?.trim()) {
      where.categoryName = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    let categories = await this.db.categoryMaster.findMany({
      where,
      orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
    });

    if (categories.length === 0) {
      try {
        categories = (await this.db.categoryList.findMany({
          where,
          orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
        })) as any;
      } catch {
        // ignore fallback errors
      }
    }

    if (categories.length === 0) {
      return {
        status: 'success',
        message: 'No records found',
        data: [],
      };
    }

    return {
      status: 'success',
      message: 'Categories retrieved successfully',
      data: categories.map((c) => this.formatCategoryOutput(c)),
    };
  }

  /**
   * Update category details with duplicate check and circular hierarchy guard.
   */
  async updateCategory(idOrCategoryId: string, dto: UpdateCategoryDto) {
    if (!idOrCategoryId?.trim()) {
      throw new BadRequestException('Category identifier is required for update.');
    }

    const trimmed = idOrCategoryId.trim();
    const existing = await this.db.categoryMaster.findFirst({
      where: {
        OR: [{ categoryId: trimmed }, { id: trimmed }],
      },
    });

    if (!existing) {
      throw new NotFoundException(`Category '${trimmed}' not found.`);
    }

    const categoryName =
      dto.categoryName !== undefined
        ? dto.categoryName.trim()
        : existing.categoryName;
    let parentCategoryId =
      dto.parentCategoryId !== undefined
        ? dto.parentCategoryId?.trim() || null
        : existing.parentCategoryId;
    const targetModule = dto.module || existing.module;

    // 1. Verify parent category existence and prevent self-parenting
    if (parentCategoryId) {
      if (
        parentCategoryId === existing.categoryId ||
        parentCategoryId === existing.id
      ) {
        throw new BadRequestException(
          'A category cannot be assigned as its own parent.',
        );
      }

      const parentCategory = await this.db.categoryMaster.findFirst({
        where: {
          OR: [{ categoryId: parentCategoryId }, { id: parentCategoryId }],
        },
      });

      if (!parentCategory) {
        throw new BadRequestException(
          `Parent category '${parentCategoryId}' does not exist.`,
        );
      }

      parentCategoryId = parentCategory.categoryId;

      // Circular Reference Guard: Ensure new parent is not a descendant of this category
      const isDescendant = await this.isDescendantCategory(
        existing.categoryId,
        parentCategoryId,
      );
      if (isDescendant) {
        throw new BadRequestException(
          `Invalid hierarchy relationship: Category '${parentCategoryId}' is a descendant of '${existing.categoryName}'.`,
        );
      }
    }

    // 2. Duplicate Category Name Validation
    const duplicate = await this.db.categoryMaster.findFirst({
      where: {
        id: { not: existing.id },
        categoryName: { equals: categoryName, mode: 'insensitive' },
        parentCategoryId,
        module: { in: [targetModule, CategoryModule.ALL] },
      },
    });

    if (duplicate) {
      throw new BadRequestException(
        `Another category named '${categoryName}' already exists under the same parent and module.`,
      );
    }

    // 3. Update category record
    const updated = await this.db.categoryMaster.update({
      where: { id: existing.id },
      data: {
        categoryName,
        parentCategoryId,
        categoryType: dto.categoryType || existing.categoryType,
        categoryImage:
          dto.categoryImage !== undefined
            ? dto.categoryImage
            : existing.categoryImage,
        description:
          dto.description !== undefined
            ? dto.description
            : existing.description,
        sequence: dto.sequence !== undefined ? dto.sequence : existing.sequence,
        status: dto.status || existing.status,
        module: targetModule,
        updatedBy: dto.updatedBy || null,
      },
    });

    this.logger.log(`Updated Category Master: ${updated.categoryId} (${updated.categoryName})`);

    return {
      status: 'success',
      message: 'Category details updated successfully',
      data: this.formatCategoryOutput(updated),
    };
  }

  /**
   * Update category status (ACTIVE / INACTIVE) with dependency check on deactivation.
   */
  async updateCategoryStatus(
    idOrCategoryId: string,
    dto: UpdateCategoryStatusDto,
  ) {
    const targetId = (dto.categoryId || idOrCategoryId)?.trim();
    if (!targetId) {
      throw new BadRequestException('Category identifier is required.');
    }

    const existing = await this.db.categoryMaster.findFirst({
      where: {
        OR: [{ categoryId: targetId }, { id: targetId }],
      },
    });

    if (!existing) {
      throw new NotFoundException(`Category '${targetId}' not found.`);
    }

    // If deactivating, run dependency checks
    if (dto.status === CategoryStatus.INACTIVE) {
      const dependencies = await this.checkCategoryDependencies(existing.categoryId);
      if (dependencies.hasDependencies) {
        this.logger.warn(
          `Deactivating category '${existing.categoryId}' with dependencies: ${dependencies.reason}`,
        );
      }
    }

    const updated = await this.db.categoryMaster.update({
      where: { id: existing.id },
      data: {
        status: dto.status,
        updatedBy: dto.updatedBy || null,
      },
    });

    return {
      status: 'success',
      message: `Category status updated to ${updated.status} successfully`,
      data: this.formatCategoryOutput(updated),
    };
  }

  /**
   * Get complete 3-tier hierarchy tree (MAIN_CATEGORY -> CATEGORY -> SUBCATEGORY).
   */
  async getCategoryHierarchy(module?: CategoryModule) {
    const where: any = {
      status: CategoryStatus.ACTIVE,
    };

    if (module) {
      where.module = { in: [module, CategoryModule.ALL] };
    }

    const allActiveCategories = await this.db.categoryMaster.findMany({
      where,
      orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
    });

    const categoryMap = new Map<string, any>();
    const rootNodes: any[] = [];

    // Format all nodes
    allActiveCategories.forEach((cat) => {
      const node = {
        ...this.formatCategoryOutput(cat),
        children: [],
      };
      categoryMap.set(cat.categoryId, node);
    });

    // Build hierarchy links
    allActiveCategories.forEach((cat) => {
      const node = categoryMap.get(cat.categoryId);
      if (cat.parentCategoryId && categoryMap.has(cat.parentCategoryId)) {
        const parentNode = categoryMap.get(cat.parentCategoryId);
        parentNode.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return {
      status: 'success',
      message: 'Category hierarchy retrieved successfully',
      data: rootNodes,
    };
  }

  /**
   * Get direct children under a parent category.
   */
  async getChildCategories(parentCategoryId: string, module?: CategoryModule) {
    if (!parentCategoryId?.trim()) {
      throw new BadRequestException('parent_category_id parameter is required.');
    }

    const trimmedParent = parentCategoryId.trim();

    // Verify parent existence
    const parent = await this.db.categoryMaster.findFirst({
      where: {
        OR: [{ categoryId: trimmedParent }, { id: trimmedParent }],
      },
    });

    if (!parent) {
      throw new NotFoundException(`Parent category '${trimmedParent}' not found.`);
    }

    const where: any = {
      parentCategoryId: parent.categoryId,
      status: CategoryStatus.ACTIVE,
    };

    if (module) {
      where.module = { in: [module, CategoryModule.ALL] };
    }

    const children = await this.db.categoryMaster.findMany({
      where,
      orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      status: 'success',
      message:
        children.length > 0
          ? 'Child categories retrieved successfully'
          : 'No child categories found',
      data: children.map((c) => this.formatCategoryOutput(c)),
    };
  }

  /**
   * Soft-delete / delete category with dependency enforcement.
   */
  async deleteCategory(idOrCategoryId: string) {
    if (!idOrCategoryId?.trim()) {
      throw new BadRequestException('Category identifier is required.');
    }

    const trimmed = idOrCategoryId.trim();
    const existing = await this.db.categoryMaster.findFirst({
      where: {
        OR: [{ categoryId: trimmed }, { id: trimmed }],
      },
    });

    if (!existing) {
      throw new NotFoundException(`Category '${trimmed}' not found.`);
    }

    // Check if dependent child categories exist
    const childCount = await this.db.categoryMaster.count({
      where: { parentCategoryId: existing.categoryId },
    });

    if (childCount > 0) {
      throw new BadRequestException(
        `Cannot delete category '${existing.categoryName}' because it has ${childCount} child subcategories. Deactivate or reassign child categories first.`,
      );
    }

    // Check dependencies in Products, Dashboard, Orders
    const dependencies = await this.checkCategoryDependencies(existing.categoryId);

    if (dependencies.hasDependencies) {
      // Soft-delete policy: Force status to INACTIVE
      const softDeleted = await this.db.categoryMaster.update({
        where: { id: existing.id },
        data: { status: CategoryStatus.INACTIVE },
      });

      return {
        status: 'success',
        message: `Category has active dependencies (${dependencies.reason}). Soft-deleted by setting status to INACTIVE.`,
        data: this.formatCategoryOutput(softDeleted),
      };
    }

    // No dependencies exist — hard delete allowed
    await this.db.categoryMaster.delete({
      where: { id: existing.id },
    });

    return {
      status: 'success',
      message: `Category '${existing.categoryId}' permanently deleted.`,
      data: { id: existing.id, categoryId: existing.categoryId },
    };
  }

  /**
   * Update category sequence order.
   */
  async updateCategorySequence(idOrCategoryId: string, dto: UpdateCategorySequenceDto) {
    const targetId = (dto.categoryId || idOrCategoryId)?.trim();
    if (!targetId) {
      throw new BadRequestException('Category identifier is required.');
    }

    const existing = await this.db.categoryMaster.findFirst({
      where: {
        OR: [{ categoryId: targetId }, { id: targetId }],
      },
    });

    if (!existing) {
      throw new NotFoundException(`Category '${targetId}' not found.`);
    }

    const updated = await this.db.categoryMaster.update({
      where: { id: existing.id },
      data: {
        sequence: dto.sequence,
        updatedBy: dto.updatedBy || null,
      },
    });

    return {
      status: 'success',
      message: `Category sequence updated to ${updated.sequence} successfully`,
      data: this.formatCategoryOutput(updated),
    };
  }

  /** Helper to recursively check if targetId is a descendant of sourceId */
  private async isDescendantCategory(
    ancestorCategoryId: string,
    targetCategoryId: string,
  ): Promise<boolean> {
    let currentId: string | null = targetCategoryId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === ancestorCategoryId) {
        return true;
      }
      if (visited.has(currentId)) {
        break; // Guard against existing cycles
      }
      visited.add(currentId);

      const cat = await this.db.categoryMaster.findUnique({
        where: { categoryId: currentId },
        select: { parentCategoryId: true },
      });

      currentId = cat?.parentCategoryId || null;
    }

    return false;
  }

  /** Helper to check category usage in SellerProduct, Dashboard, Orders */
  private async checkCategoryDependencies(categoryId: string): Promise<{
    hasDependencies: boolean;
    reason: string;
  }> {
    const reasons: string[] = [];

    // 1. Check SellerProduct count
    try {
      const prodRecords = await this.db.queryRawDashboard(
        `SELECT COUNT(*) AS count FROM public.seller_products WHERE category_id = $1 OR category = $1 OR sub_category_id = $1`,
        [categoryId],
      );
      const prodCount = parseInt(prodRecords[0]?.count || '0', 10);
      if (prodCount > 0) {
        reasons.push(`${prodCount} seller product(s)`);
      }
    } catch {
      // Ignore if table/field structure varies
    }

    // 2. Check Dashboard Widget count
    try {
      const dashboardRecords = await this.db.queryRawDashboard(
        `SELECT COUNT(*) AS count FROM public.dashboard WHERE category_id = $1`,
        [categoryId],
      );
      const dashCount = parseInt(dashboardRecords[0]?.count || '0', 10);
      if (dashCount > 0) {
        reasons.push(`${dashCount} dashboard widget(s)`);
      }
    } catch {
      // Ignore if table not created
    }

    if (reasons.length > 0) {
      return {
        hasDependencies: true,
        reason: `Linked to ${reasons.join(', ')}`,
      };
    }

    return { hasDependencies: false, reason: '' };
  }

  /** Standardized DTO Output Formatter */
  private formatCategoryOutput(category: any) {
    return {
      id: category.id,
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      parentCategoryId: category.parentCategoryId || null,
      categoryType: category.categoryType,
      categoryImage: category.categoryImage || '',
      description: category.description || '',
      sequence: category.sequence,
      status: category.status,
      module: category.module,
      createdBy: category.createdBy || null,
      updatedBy: category.updatedBy || null,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      children: category.children
        ? category.children.map((c: any) => this.formatCategoryOutput(c))
        : undefined,
    };
  }

  /**
   * 1. GET /api/categories/main
   * Retrieves top-level main categories (parent_category_id IS NULL or '0')
   * with pagination, module filtering, sorting by sequence, and in-memory TTL caching.
   */
  async getMainCategories(query: GetMainCategoriesDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const offset = (page - 1) * limit;
    const moduleFilter = query.module?.trim();

    // Check In-Memory Cache (TTL: 5 minutes = 300,000 ms)
    const cacheKey = `main_cat_${moduleFilter || 'ALL'}_p${page}_l${limit}`;
    const cached = this.mainCategoryCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    // Build parameterized query safely
    const params: any[] = [];
    let whereClause = `WHERE (parent_category_id IS NULL OR parent_category_id = '0' OR parent_category_id = '') 
                       AND (status::text = 'ACTIVE' OR status::text = '1' OR status::text = 'active')`;

    if (moduleFilter) {
      params.push(moduleFilter);
      whereClause += ` AND (LOWER(module::text) = LOWER($${params.length}) OR LOWER(module::text) = 'all')`;
    }

    try {
      // 1. Get total count for pagination metadata
      const countSql = `SELECT COUNT(*)::int AS total FROM public.category_list ${whereClause}`;
      const countRes = await this.db.query(countSql, params);
      let total = countRes?.rows?.[0]?.total || 0;

      // 2. Fetch paginated main categories
      const dataParams = [...params, limit, offset];
      const dataSql = `
        SELECT 
          id,
          category_id,
          category_name,
          category_image,
          description,
          sequence
        FROM public.category_list
        ${whereClause}
        ORDER BY sequence ASC, id ASC
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
      `;
      let dataRes = await this.db.query(dataSql, dataParams);
      let rows = dataRes?.rows || [];

      // Fallback to category_master if category_list has no rows yet
      if (rows.length === 0 && total === 0) {
        const fallbackCountSql = `SELECT COUNT(*)::int AS total FROM public.category_master ${whereClause}`;
        try {
          const fbCountRes = await this.db.query(fallbackCountSql, params);
          total = fbCountRes?.rows?.[0]?.total || 0;
          if (total > 0) {
            const fallbackDataSql = `
              SELECT 
                id,
                category_id,
                category_name,
                category_image,
                description,
                sequence
              FROM public.category_master
              ${whereClause}
              ORDER BY sequence ASC, id ASC
              LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
            `;
            const fbDataRes = await this.db.query(fallbackDataSql, dataParams);
            rows = fbDataRes?.rows || [];
          }
        } catch {
          // ignore fallback if table doesn't match
        }
      }

      const response = {
        success: true,
        data: rows.map((r: any) => ({
          id: r.id,
          categoryId: r.categoryId || r.category_id,
          categoryName: r.categoryName || r.category_name,
          categoryImage: r.categoryImage || r.category_image || '',
          description: r.description || '',
          sequence: Number(r.sequence) || 0,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };

      // Store in cache for 5 minutes
      this.mainCategoryCache.set(cacheKey, {
        data: response,
        expiry: Date.now() + 300000,
      });

      return response;
    } catch (err: any) {
      this.logger.error(`Failed to fetch main categories: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * 2. GET /api/categories/:parent_category_id
   * Validates parent category and retrieves all direct + nested subcategories
   * in a recursive Flipkart-style hierarchy drill-down.
   */
  async getSubcategoriesByParentId(parentCategoryId: string, module?: string) {
    if (!parentCategoryId || !parentCategoryId.trim()) {
      throw new BadRequestException('parent_category_id parameter is required.');
    }

    const trimmedParentId = parentCategoryId.trim();
    const trimmedModule = module?.trim();

    // 1. Verify parent category existence
    let parentExists = false;
    try {
      const moduleCondition = trimmedModule
        ? `AND (LOWER(module::text) = LOWER('${trimmedModule}') OR LOWER(module::text) = 'all')`
        : '';

      const parentCheck = await this.db.query(
        `SELECT id, category_id, category_name FROM public.category_list WHERE (category_id = $1 OR id = $1) ${moduleCondition} LIMIT 1`,
        [trimmedParentId],
      );
      if (parentCheck?.rows?.length > 0) {
        parentExists = true;
      } else {
        // Check fallback table category_master
        const fbCheck = await this.db.query(
          `SELECT id, category_id, category_name FROM public.category_master WHERE (category_id = $1 OR id = $1) ${moduleCondition} LIMIT 1`,
          [trimmedParentId],
        );
        if (fbCheck?.rows?.length > 0) {
          parentExists = true;
        }
      }
    } catch (err: any) {
      this.logger.error(`Error checking parent category existence: ${err.message}`);
    }

    if (!parentExists) {
      throw new NotFoundException(`Parent category with category_id '${trimmedParentId}' not found.`);
    }

    // 2. Fetch all descendants with a Recursive CTE
    const modSql = trimmedModule
      ? `AND (LOWER(module::text) = LOWER('${trimmedModule}') OR LOWER(module::text) = 'all')`
      : '';
    const modSqlRecursive = trimmedModule
      ? `AND (LOWER(c.module::text) = LOWER('${trimmedModule}') OR LOWER(c.module::text) = 'all')`
      : '';

    const recursiveQuery = `
      WITH RECURSIVE category_tree AS (
        -- Anchor: Direct child categories
        SELECT 
          id,
          category_id,
          category_name,
          parent_category_id,
          category_image,
          description,
          sequence,
          module,
          1 AS level
        FROM public.category_list
        WHERE parent_category_id = $1 AND (status::text = 'ACTIVE' OR status::text = '1' OR status::text = 'active') ${modSql}

        UNION ALL

        -- Recursive: Sub-subcategories and deeper levels
        SELECT 
          c.id,
          c.category_id,
          c.category_name,
          c.parent_category_id,
          c.category_image,
          c.description,
          c.sequence,
          c.module,
          ct.level + 1
        FROM public.category_list c
        INNER JOIN category_tree ct ON c.parent_category_id = ct.category_id
        WHERE (c.status::text = 'ACTIVE' OR c.status::text = '1' OR c.status::text = 'active') ${modSqlRecursive}
      )
      SELECT * FROM category_tree ORDER BY sequence ASC, id ASC;
    `;

    try {
      let result = await this.db.query(recursiveQuery, [trimmedParentId]);
      let allDescendants = result?.rows || [];

      // Fallback to category_master if category_list has no rows
      if (allDescendants.length === 0) {
        const fallbackRecursiveQuery = `
          WITH RECURSIVE category_tree AS (
            SELECT 
              id,
              category_id,
              category_name,
              parent_category_id,
              category_image,
              description,
              sequence,
              module,
              1 AS level
            FROM public.category_master
            WHERE parent_category_id = $1 AND (status::text = 'ACTIVE' OR status::text = '1' OR status::text = 'active') ${modSql}

            UNION ALL

            SELECT 
              c.id,
              c.category_id,
              c.category_name,
              c.parent_category_id,
              c.category_image,
              c.description,
              c.sequence,
              c.module,
              ct.level + 1
            FROM public.category_master c
            INNER JOIN category_tree ct ON c.parent_category_id = ct.category_id
            WHERE (c.status::text = 'ACTIVE' OR c.status::text = '1' OR c.status::text = 'active') ${modSqlRecursive}
          )
          SELECT * FROM category_tree ORDER BY sequence ASC, id ASC;
        `;
        try {
          const fbResult = await this.db.query(fallbackRecursiveQuery, [trimmedParentId]);
          allDescendants = fbResult?.rows || [];
        } catch {
          // ignore fallback
        }
      }

      // 3. Assemble nested subcategories tree in O(N) time
      const tree = this.buildNestedCategoryTree(allDescendants, trimmedParentId);

      return {
        success: true,
        parentCategoryId: trimmedParentId,
        module: trimmedModule || 'all',
        data: tree,
      };
    } catch (err: any) {
      this.logger.error(`Failed to fetch subcategories: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Helper to build nested subcategories tree in O(N) time
   */
  private buildNestedCategoryTree(items: any[], rootParentId: string): any[] {
    const itemMap = new Map<string, any>();
    const roots: any[] = [];

    // Initialize all items in Map
    items.forEach((item) => {
      const catId = item.categoryId || item.category_id;
      itemMap.set(catId, {
        id: item.id,
        categoryId: catId,
        categoryName: item.categoryName || item.category_name || '',
        categoryImage: item.categoryImage || item.category_image || '',
        description: item.description || '',
        sequence: Number(item.sequence) || 0,
        module: item.module || '',
        subcategories: [],
      });
    });

    // Link child nodes to their respective parents
    items.forEach((item) => {
      const catId = item.categoryId || item.category_id;
      const parentId = item.parentCategoryId || item.parent_category_id;
      const node = itemMap.get(catId);
      if (parentId === rootParentId) {
        roots.push(node);
      } else {
        const parentNode = itemMap.get(parentId);
        if (parentNode) {
          parentNode.subcategories.push(node);
        }
      }
    });

    // Remove empty subcategories property from leaf nodes
    itemMap.forEach((node) => {
      if (node.subcategories && node.subcategories.length === 0) {
        delete node.subcategories;
      }
    });

    return roots;
  }
}
