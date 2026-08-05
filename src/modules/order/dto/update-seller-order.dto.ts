import { PartialType } from '@nestjs/swagger';
import { CreateSellerOrderDto } from './create-seller-order.dto';

export class UpdateSellerOrderDto extends PartialType(CreateSellerOrderDto) {}
