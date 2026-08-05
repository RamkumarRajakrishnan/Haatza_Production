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
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SellerOrderService } from './seller-order.service';
import { CreateSellerOrderDto } from './dto/create-seller-order.dto';
import { UpdateSellerOrderDto } from './dto/update-seller-order.dto';
import { QuerySellerOrderDto } from './dto/query-seller-order.dto';
import {
  SellerOrderResponseDto,
  PaginatedSellerOrderResponseDto,
} from './dto/seller-order-response.dto';

@ApiTags('Seller Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('seller-orders')
export class SellerOrderController {
  constructor(private readonly sellerOrderService: SellerOrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new seller order' })
  @ApiResponse({ status: HttpStatus.CREATED, type: SellerOrderResponseDto })
  async create(@Body() createDto: CreateSellerOrderDto) {
    return this.sellerOrderService.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get paginated list of seller orders with search, filtering, and sorting',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedSellerOrderResponseDto })
  async findAll(@Query() queryDto: QuerySellerOrderDto) {
    return this.sellerOrderService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get seller order by ID' })
  @ApiResponse({ status: HttpStatus.OK, type: SellerOrderResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Seller order not found' })
  async findOne(@Param('id') id: string) {
    return this.sellerOrderService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a seller order' })
  @ApiResponse({ status: HttpStatus.OK, type: SellerOrderResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSellerOrderDto,
  ) {
    return this.sellerOrderService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a seller order' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Order soft deleted' })
  async remove(@Param('id') id: string) {
    return this.sellerOrderService.softDelete(id);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore a soft deleted seller order' })
  @ApiResponse({ status: HttpStatus.OK, type: SellerOrderResponseDto })
  async restore(@Param('id') id: string) {
    return this.sellerOrderService.restore(id);
  }

  @Post(':id/upload-invoice')
  @ApiOperation({ summary: 'Upload invoice document using Multer' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadInvoice(
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    return this.sellerOrderService.uploadInvoice(id, file);
  }

  @Post(':id/upload-product-image')
  @ApiOperation({ summary: 'Upload product image using Multer' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadProductImage(
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    return this.sellerOrderService.uploadProductImage(id, file);
  }

  @Post(':id/upload-return-images')
  @ApiOperation({ summary: 'Upload multiple return/exchange images using Multer' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadReturnImages(
    @Param('id') id: string,
    @UploadedFiles() files: any[],
  ) {
    return this.sellerOrderService.uploadReturnImages(id, files);
  }
}
