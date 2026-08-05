import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SellerOrderRepository } from './repositories/seller-order.repository';
import { CreateSellerOrderDto } from './dto/create-seller-order.dto';
import { UpdateSellerOrderDto } from './dto/update-seller-order.dto';
import { QuerySellerOrderDto } from './dto/query-seller-order.dto';
import { MediaStorageService } from '../media-storage/media-storage.service';

@Injectable()
export class SellerOrderService {
  constructor(
    private readonly repository: SellerOrderRepository,
    private readonly db: DatabaseService,
    private readonly mediaStorageService: MediaStorageService,
  ) {}

  async create(createDto: CreateSellerOrderDto) {
    try {
      return await this.db.$transaction(async (tx) => {
        const data: any = { ...createDto };
        if (createDto.createdDate) data.createdDate = new Date(createDto.createdDate);
        if (createDto.estimatedDelivery) data.estimatedDelivery = new Date(createDto.estimatedDelivery);
        if (createDto.deliveredDate) data.deliveredDate = new Date(createDto.deliveredDate);
        if (createDto.returnAndExchangeDate) data.returnAndExchangeDate = new Date(createDto.returnAndExchangeDate);
        if (createDto.returnDate) data.returnDate = new Date(createDto.returnDate);
        if (createDto.exchangeDate) data.exchangeDate = new Date(createDto.exchangeDate);

        return await tx.sellerOrder.create({
          data,
        });
      });
    } catch (error) {
      throw new BadRequestException(`Failed to create seller order: ${error.message}`);
    }
  }

  async findAll(queryDto: QuerySellerOrderDto) {
    const { startDate, endDate, refundStatus, ...rest } = queryDto;

    const parsedStartDate = startDate ? new Date(startDate) : undefined;
    const parsedEndDate = endDate ? new Date(endDate) : undefined;

    const result = await this.repository.findSellerOrders({
      ...rest,
      refundStatus,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    });

    result.data = result.data.map((order) => this.transformOrderUrls(order));

    return result;
  }

  async findOne(id: string) {
    const order = await this.repository.findById(id);
    if (!order || order.deletedAt) {
      throw new NotFoundException(`Seller order with ID '${id}' not found`);
    }
    return this.transformOrderUrls(order);
  }

  async update(id: string, updateDto: UpdateSellerOrderDto) {
    await this.findOne(id); // Ensure order exists

    try {
      return await this.db.$transaction(async (tx) => {
        const data: any = { ...updateDto };
        if (updateDto.createdDate) data.createdDate = new Date(updateDto.createdDate);
        if (updateDto.estimatedDelivery) data.estimatedDelivery = new Date(updateDto.estimatedDelivery);
        if (updateDto.deliveredDate) data.deliveredDate = new Date(updateDto.deliveredDate);
        if (updateDto.returnAndExchangeDate) data.returnAndExchangeDate = new Date(updateDto.returnAndExchangeDate);
        if (updateDto.returnDate) data.returnDate = new Date(updateDto.returnDate);
        if (updateDto.exchangeDate) data.exchangeDate = new Date(updateDto.exchangeDate);

        const updated = await tx.sellerOrder.update({
          where: { id },
          data,
        });

        return this.transformOrderUrls(updated);
      });
    } catch (error) {
      throw new BadRequestException(`Failed to update seller order: ${error.message}`);
    }
  }

  async softDelete(id: string) {
    await this.findOne(id);
    const deleted = await this.repository.softDelete(id);
    return { message: 'Seller order soft deleted successfully', id: deleted.id };
  }

  async restore(id: string) {
    const order = await this.repository.findById(id);
    if (!order) {
      throw new NotFoundException(`Seller order with ID '${id}' not found`);
    }
    const restored = await this.repository.restore(id);
    return this.transformOrderUrls(restored);
  }

  async uploadInvoice(id: string, file: any) {
    if (!file) {
      throw new BadRequestException('Invoice file is required');
    }

    const order = await this.findOne(id);
    const uploaded = await this.mediaStorageService.upload({
      file,
      folder: 'seller-orders/invoices',
    });

    const updated = await this.repository.update(id, {
      invoiceFile: uploaded.key,
    });

    return this.transformOrderUrls(updated);
  }

  async uploadProductImage(id: string, file: any) {
    if (!file) {
      throw new BadRequestException('Product image file is required');
    }

    const order = await this.findOne(id);
    const uploaded = await this.mediaStorageService.upload({
      file,
      folder: 'seller-orders/product-images',
    });

    const updated = await this.repository.update(id, {
      productImage: uploaded.key,
    });

    return this.transformOrderUrls(updated);
  }

  async uploadReturnImages(id: string, files: any[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one return image file is required');
    }

    const order = await this.findOne(id);
    const uploadPromises = files.map((file) =>
      this.mediaStorageService.upload({
        file,
        folder: 'seller-orders/return-images',
      }),
    );

    const uploadedResults = await Promise.all(uploadPromises);
    const newImageKeys = uploadedResults.map((res) => res.key);

    const existingImages = Array.isArray(order.returnExchangeImages)
      ? (order.returnExchangeImages as string[])
      : [];

    const updatedKeys = [...existingImages, ...newImageKeys];

    const updated = await this.repository.update(id, {
      returnExchangeImages: updatedKeys,
    });

    return this.transformOrderUrls(updated);
  }

  private transformOrderUrls(order: any) {
    if (!order) return order;

    const transformed = { ...order };
    if (transformed.invoiceFile) {
      transformed.invoiceFile = this.mediaStorageService.getPublicUrl(transformed.invoiceFile);
    }
    if (transformed.productImage) {
      transformed.productImage = this.mediaStorageService.getPublicUrl(transformed.productImage);
    }
    if (transformed.returnExchangeImages && Array.isArray(transformed.returnExchangeImages)) {
      transformed.returnExchangeImages = transformed.returnExchangeImages.map((imgKey: string) =>
        this.mediaStorageService.getPublicUrl(imgKey),
      );
    }

    return transformed;
  }
}
