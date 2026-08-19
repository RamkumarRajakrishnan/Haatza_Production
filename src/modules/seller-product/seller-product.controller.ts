import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { SellerProductService } from './seller-product.service';
import {
  CreateSellerProductDto,
  UpdateSellerProductDto,
  FilterSellerProductDto,
} from './dto/seller-product.dto';

@ApiTags('Seller Products')
@Controller(['seller-products', 'seller_products'])
export class SellerProductController {
  constructor(
    private readonly sellerProductService: SellerProductService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new seller product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
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

  @Get('detail/:id')
  @ApiOperation({ summary: 'Get a seller product by ID' })
  async findOne(@Param('id') id: string) {
    return this.sellerProductService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a seller product' })
  async update(@Param('id') id: string, @Body() dto: UpdateSellerProductDto) {
    return this.sellerProductService.update(id, dto);
  }

  @Patch('bulk-update')
  @ApiOperation({ summary: 'Bulk update seller products' })
  async bulkUpdate(@Body() updates: Array<{ id: string; data: UpdateSellerProductDto }>) {
    return this.sellerProductService.bulkUpdate(updates);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a seller product' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.sellerProductService.remove(id);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk import products from Wix CSV file or raw CSV text' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Wix seller_products.csv file (optional if csvData is provided)' },
        csvData: {
          type: 'string',
          description: 'Raw CSV text content',
        },
      },
    },
  })
  async importCsv(
    @UploadedFile() file?: any,
    @Body('csvData') csvData?: string,
  ) {
    let content: string | undefined;

    if (file && file.buffer) {
      content = file.buffer.toString('utf-8');
    } else if (csvData && csvData.trim() !== '' && csvData.trim() !== 'string') {
      content = csvData;
    }

    if (!content) {
      throw new BadRequestException('Please upload a CSV file or provide valid CSV text string in "csvData".');
    }

    return this.sellerProductService.importCsvContent(content);
  }

  @Post('upload-media')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiOperation({ summary: 'Upload image and video files to storage and return object key metadata' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Image or video files to upload to cloud object storage',
        },
      },
    },
  })
  async uploadMedia(@UploadedFiles() files: any[]) {
    return this.sellerProductService.uploadMedia(files);
  }
}
