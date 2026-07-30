import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { SellerProductService } from './seller-product.service';
import {
  CreateSellerProductDto,
  UpdateSellerProductDto,
  FilterSellerProductDto,
} from './dto/seller-product.dto';

@ApiTags('Seller Products')
@Controller('seller-products')
export class SellerProductController {
  constructor(private readonly sellerProductService: SellerProductService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new seller product' })
  @ApiResponse({ status: 210, description: 'Product created successfully' })
  async create(@Body() dto: CreateSellerProductDto) {
    return this.sellerProductService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get seller products with pagination, search, and filtering' })
  async findAll(@Query() query: FilterSellerProductDto) {
    return this.sellerProductService.findAll(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search seller products' })
  async search(@Query() query: FilterSellerProductDto) {
    return this.sellerProductService.findAll(query);
  }

  @Get('filter')
  @ApiOperation({ summary: 'Filter seller products' })
  async filter(@Query() query: FilterSellerProductDto) {
    return this.sellerProductService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a seller product by ID' })
  async findOne(@Param('id') id: string) {
    return this.sellerProductService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a seller product' })
  async update(@Param('id') id: string, @Body() dto: UpdateSellerProductDto) {
    return this.sellerProductService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a seller product' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.sellerProductService.remove(id);
  }

  @Post('import')
  @ApiOperation({ summary: 'Bulk import products from CSV content' })
  @ApiBody({ schema: { type: 'object', properties: { csvData: { type: 'string' } } } })
  async importCsv(@Body('csvData') csvData: string) {
    if (!csvData) {
      throw new BadRequestException('Field "csvData" is required in request body');
    }
    return this.sellerProductService.importCsvContent(csvData);
  }
}
