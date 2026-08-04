import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CategoryService } from './category.service';

@ApiTags('Categories')
@Controller(['categories', 'api/categories'])
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @ApiOperation({ summary: 'Get root categories list' })
  @Get(['', 'category'])
  getCategories() {
    return this.categoryService.getCategories();
  }

  @ApiOperation({ summary: 'Get subcategories for a category' })
  @Get(['sub', 'subCategories', 'subcategorylist'])
  getSubCategories(@Query('categoryId') categoryId: string, @Query('parentId') parentId: string) {
    return this.categoryService.getSubcategories(categoryId || parentId);
  }

  @ApiOperation({ summary: 'Search categories by query string' })
  @Get(['search', 'searchcategorylist'])
  searchCategories(@Query('query') query: string) {
    return this.categoryService.searchCategories(query || '');
  }

  @ApiOperation({ summary: 'Get attributes and custom fields for a category' })
  @Get(['fields', 'CategoryFields'])
  getCategoryFields(@Query('categoryId') categoryId: string) {
    return this.categoryService.getCategoryFields(categoryId);
  }
}
