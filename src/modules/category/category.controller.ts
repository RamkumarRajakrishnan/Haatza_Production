import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateCategoryStatusDto,
  QueryCategoryDto,
  GetChildCategoriesDto,
  UpdateCategorySequenceDto,
  GetMainCategoriesDto,
} from './dto/category-master.dto';
import { CategoryModule } from '@prisma/client';

@ApiTags('Category Master')
@Controller(['category', 'categories', 'api/categories', 'api/v1/categories', 'api/v1/category', 'api/v1'])
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get(['main', 'categories/main'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Main Top-Level Categories (GET /api/categories/main)',
    description: 'Returns only top-level categories where parent_category_id is NULL or 0, filtered by status=1 and optional module, sorted by sequence.',
  })
  @ApiResponse({ status: 200, description: 'List of main categories with pagination metadata' })
  async getMainCategories(@Query() query: GetMainCategoriesDto) {
    return this.categoryService.getMainCategories(query);
  }

  @Post(['create_category', 'createCategory', 'categories'])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Category (POST /create_category)',
    description: 'Creates a new Category Master record with auto-generated unique category_id (CAT_001, CAT_002...).',
  })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoryService.createCategory(dto);
  }

  @Get(['get_category', 'getCategory'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Category by ID (GET /get_category)',
    description: 'Retrieves single category details by category_id or database ID.',
  })
  @ApiQuery({ name: 'category_id', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'module', required: false, type: String, description: 'Filter by module (haatza or lite)' })
  @ApiQuery({ name: 'Module', required: false, type: String, description: 'Filter by Module (PascalCase alias)' })
  async getCategory(
    @Query('category_id') queryCategoryId?: string,
    @Query('categoryId') queryAliasId?: string,
    @Query('module') queryModule?: string,
    @Query('Module') queryPascalModule?: string,
    @Param('categoryId') paramCategoryId?: string,
  ) {
    const targetId = paramCategoryId || queryCategoryId || queryAliasId;
    const targetModule = queryModule || queryPascalModule;
    return this.categoryService.getCategory(targetId || '', targetModule);
  }

  @Get(['get_categories', 'getCategories', 'category-list'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Categories List (GET /get_categories)',
    description: 'Returns active categories list filtered by module, parent_category_id, and status, sorted by sequence.',
  })
  async getCategoriesGet(@Query() query: QueryCategoryDto) {
    return this.categoryService.getCategories(query);
  }

  @Post(['get_categories', 'getCategories', 'category-list'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Categories List (POST /get_categories)',
    description: 'Returns active categories list via POST body for complex filtering.',
  })
  async getCategoriesPost(@Body() query: QueryCategoryDto) {
    return this.categoryService.getCategories(query);
  }

  @Put(['update_category', 'updateCategory', 'categories/:id'])
  @Post(['update_category', 'updateCategory'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update Category Details (PUT /update_category)',
    description: 'Updates category details, re-validates duplicate names, and prevents circular hierarchy relationships.',
  })
  async updateCategory(
    @Param('id') paramId: string,
    @Query('category_id') queryCategoryId: string,
    @Body() body: any,
  ) {
    const targetId = paramId || queryCategoryId || body.category_id || body.categoryId || body.id;
    return this.categoryService.updateCategory(targetId, body);
  }

  @Put(['update_category_status', 'updateCategoryStatus'])
  @Post(['update_category_status', 'updateCategoryStatus'])
  @Patch(['patch_categoryStatus', 'categoryStatus', 'status'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate / Deactivate Category (PUT / PATCH /update_category_status)',
    description: 'Toggles status between ACTIVE and INACTIVE. Checks product/dashboard/order dependencies when deactivating.',
  })
  async updateCategoryStatus(
    @Query('category_id') queryCategoryId: string,
    @Body() dto: UpdateCategoryStatusDto,
  ) {
    const targetId = dto.categoryId || queryCategoryId;
    return this.categoryService.updateCategoryStatus(targetId, dto);
  }

  @Patch(['patch_categorySequence', 'categorySequence', 'sequence'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update Category Sequence (PATCH /patch_categorySequence)',
    description: 'Updates sequence order number for category display sequence.',
  })
  async updateCategorySequence(
    @Query('category_id') queryCategoryId: string,
    @Body() dto: UpdateCategorySequenceDto,
  ) {
    const targetId = dto.categoryId || queryCategoryId;
    return this.categoryService.updateCategorySequence(targetId, dto);
  }

  @Get(['get_category_hierarchy', 'getCategoryHierarchy', 'hierarchy'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Category Hierarchy Tree (GET /get_category_hierarchy)',
    description: 'Returns complete 3-tier tree: Main Category -> Category -> Subcategory, scoped by module.',
  })
  @ApiQuery({ name: 'module', required: false, enum: CategoryModule })
  async getCategoryHierarchyGet(@Query('module') module?: CategoryModule) {
    return this.categoryService.getCategoryHierarchy(module);
  }

  @Post(['get_category_hierarchy', 'getCategoryHierarchy', 'hierarchy'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Category Hierarchy Tree (POST /get_category_hierarchy)',
    description: 'Returns complete 3-tier hierarchy tree via POST body.',
  })
  async getCategoryHierarchyPost(@Body('module') module?: CategoryModule) {
    return this.categoryService.getCategoryHierarchy(module);
  }

  @Get(['get_child_categories', 'getChildCategories', 'children'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Child Categories (GET /get_child_categories)',
    description: 'Returns direct child categories under a parent_category_id sorted by sequence.',
  })
  @ApiQuery({ name: 'parent_category_id', required: false, type: String })
  @ApiQuery({ name: 'parentCategoryId', required: false, type: String })
  @ApiQuery({ name: 'module', required: false, enum: CategoryModule })
  async getChildCategoriesGet(@Query() query: GetChildCategoriesDto) {
    const parentId = query.parent_category_id || query.parentCategoryId;
    return this.categoryService.getChildCategories(parentId || '', query.module);
  }

  @Post(['get_child_categories', 'getChildCategories', 'children'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Child Categories (POST /get_child_categories)',
    description: 'Returns direct child categories under parent_category_id via POST body.',
  })
  async getChildCategoriesPost(@Body() query: GetChildCategoriesDto) {
    const parentId = query.parent_category_id || query.parentCategoryId;
    return this.categoryService.getChildCategories(parentId || '', query.module);
  }

  @Delete(['delete_category/:id', 'deleteCategory/:id', 'categories/:id'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete Category (DELETE /delete_category/:id)',
    description: 'Safely deletes category; performs soft-delete (INACTIVE) if products or widgets depend on it.',
  })
  async deleteCategory(@Param('id') id: string) {
    return this.categoryService.deleteCategory(id);
  }

  @Get([
    '',
    'categories',
    'subcategories',
    'subcategories/:parentCategoryId',
    'subcategories/:parent_category_id',
    'parent/:parentCategoryId',
    'parent/:parent_category_id',
    'category/:parentCategoryId',
    'category/:parent_category_id',
    ':parentCategoryId',
    ':parent_category_id',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Subcategories by Category ID (GET /api/v1/categories?categoryId=CAT_FASH)',
    description: 'Returns direct and recursively nested subcategories under categoryId / parentCategoryId (Flipkart-style drill-down).',
  })
  @ApiQuery({ name: 'categoryId', required: false, type: String, description: 'Category ID of parent category (e.g. CAT_FASH)' })
  @ApiQuery({ name: 'category_id', required: false, type: String, description: 'Legacy alias for categoryId' })
  @ApiQuery({ name: 'parentCategoryId', required: false, type: String, description: 'Parent Category ID' })
  @ApiQuery({ name: 'parent_category_id', required: false, type: String, description: 'Legacy alias for parentCategoryId' })
  @ApiQuery({ name: 'module', required: false, type: String, description: 'Filter by module (haatza or lite)' })
  @ApiQuery({ name: 'Module', required: false, type: String, description: 'Filter by Module (PascalCase alias)' })
  @ApiResponse({ status: 200, description: 'Nested subcategories hierarchy tree' })
  @ApiResponse({ status: 404, description: 'Parent category not found' })
  async getSubcategoriesByParentId(
    @Param('parentCategoryId') paramAliasParentId?: string,
    @Param('parent_category_id') paramParentId?: string,
    @Query('parentCategoryId') queryAliasParentId?: string,
    @Query('parent_category_id') queryParentId?: string,
    @Query('categoryId') queryAliasId?: string,
    @Query('category_id') queryCategoryId?: string,
    @Query('module') queryModule?: string,
    @Query('Module') queryPascalModule?: string,
    @Query() allQueries?: any,
  ) {
    let targetId = queryAliasId || queryCategoryId || queryAliasParentId || queryParentId || paramAliasParentId || paramParentId || '';
    
    // Support URL paths like /categories/categoryId=CAT_FASH or /categories/category_id=CAT_FASH cleanly
    if (targetId.includes('=')) {
      const parts = targetId.split('=');
      targetId = parts[1] || targetId;
    }

    const targetModule = queryModule || queryPascalModule || allQueries?.module || allQueries?.Module;

    if (targetId.trim()) {
      return this.categoryService.getSubcategoriesByParentId(targetId.trim(), targetModule);
    }

    // If no categoryId or parentCategoryId is provided on GET /categories, return category list
    return this.categoryService.getCategories({
      ...allQueries,
      module: targetModule ? (targetModule.toUpperCase() as any) : allQueries?.module,
    });
  }
}
