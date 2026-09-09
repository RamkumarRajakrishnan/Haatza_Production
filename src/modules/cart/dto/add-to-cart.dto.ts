import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class AddToCartDto {
  @ApiProperty({
    description: 'Unique User identifier',
    example: 'Jane Doe',
  })
  @IsNotEmpty({ message: 'userId is required' })
  @IsString({ message: 'userId must be a string' })
  userId: string;

  @ApiProperty({
    description: 'Product unique ID',
    example: 'd2106b2f-3a5c-441c-8cc3-a05cd8a3acd5',
  })
  @IsNotEmpty({ message: 'productId is required' })
  @IsString({ message: 'productId must be a string' })
  productId: string;

  @ApiProperty({
    description: 'Seller ID for the product',
    example: 'HS1245',
  })
  @IsNotEmpty({ message: 'sellerId is required' })
  @IsString({ message: 'sellerId must be a string' })
  sellerId: string;

  @ApiPropertyOptional({
    description: 'Optional variant ID (empty string if product has no variant)',
    example: '',
  })
  @IsOptional()
  @IsString({ message: 'variantId must be a string' })
  variantId?: string;

  @ApiPropertyOptional({
    description: 'Price at the time product is added to cart/wishlist',
    example: 450,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'priceAtAddedTime must be a number' })
  priceAtAddedTime?: number;

  @ApiPropertyOptional({
    description: 'Discount at the time product is added to cart/wishlist',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'discountAtAddedTime must be a number' })
  discountAtAddedTime?: number;
}
