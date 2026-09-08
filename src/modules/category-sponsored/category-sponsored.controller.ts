import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { CategorySponsoredService } from './category-sponsored.service';
import { GetCategorySponsoredDto } from './dto/get-category-sponsored.dto';
import { DashboardModule } from '@prisma/client';

@ApiTags('Category Sponsored')
@Controller(['categorySponsored', 'category-sponsored'])
export class CategorySponsoredController {
  constructor(private readonly categorySponsoredService: CategorySponsoredService) {}

  @Get(['', 'haatza', 'widgets', 'v2', 'get-data', 'data'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Category Sponsored Page Widgets (GET /api/v1/categorySponsored)',
    description:
      'Retrieves active and valid (non-expired) category sponsored widgets filtered by categoryId, optional warehouseId, and module (HAATZA or LITE).',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Category ID (aliases: category, category_id)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Category ID alias (same as categoryId)',
  })
  @ApiQuery({
    name: 'category_id',
    required: false,
    type: String,
    description: 'Snake case category_id alias',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Warehouse ID (Compulsory for LITE module, optional for HAATZA module)',
  })
  @ApiQuery({
    name: 'module',
    required: true,
    enum: DashboardModule,
    description: 'Mandatory module: HAATZA or LITE (case-insensitive)',
  })
  @ApiResponse({
    status: 200,
    description: 'Category sponsored widgets retrieved successfully',
  })
  async getCategorySponsoredGet(@Query() dto: GetCategorySponsoredDto) {
    return this.categorySponsoredService.getCategorySponsored(dto);
  }

  @Post(['', 'get_dashboard', 'fetch', 'get-data'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Category Sponsored Page Widgets (POST /api/v1/categorySponsored)',
    description:
      'Retrieves active and valid (non-expired) category sponsored widgets via POST body or query parameters for HAATZA and LITE applications.',
  })
  @ApiBody({ type: GetCategorySponsoredDto })
  @ApiResponse({
    status: 200,
    description: 'Category sponsored widgets retrieved successfully',
  })
  async getCategorySponsoredPost(
    @Body() bodyDto: GetCategorySponsoredDto,
    @Query() queryDto: GetCategorySponsoredDto,
  ) {
    const mergedDto: GetCategorySponsoredDto = {
      ...queryDto,
      ...bodyDto,
      category: bodyDto?.category || queryDto?.category,
      categoryId:
        bodyDto?.categoryId ||
        queryDto?.categoryId ||
        bodyDto?.category_id ||
        queryDto?.category_id,
      module: bodyDto?.module || queryDto?.module,
      warehouseId:
        bodyDto?.warehouseId ||
        queryDto?.warehouseId ||
        bodyDto?.warehouse_id ||
        queryDto?.warehouse_id,
    };
    return this.categorySponsoredService.getCategorySponsored(mergedDto);
  }

  @Get('ping')
  @HttpCode(HttpStatus.OK)
  ping() {
    return { status: 'ok', service: 'category-sponsored', version: 'v1-active' };
  }

  @Post(['upsert', 'save'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upsert single or bulk Category Sponsored Widgets',
    description: 'Insert or update one or multiple category sponsored widgets in public.category_sponsored.',
  })
  @ApiBody({ description: 'Single widget object or array of widget objects' })
  async upsertWidgets(@Body() body: any) {
    return this.categorySponsoredService.upsertWidgets(body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete Category Sponsored Widget by ID or widgetId',
    description: 'Deletes a category sponsored widget permanently from public.category_sponsored using id or widgetId.',
  })
  async deleteWidget(@Param('id') id: string) {
    return this.categorySponsoredService.deleteWidget(id);
  }
}
