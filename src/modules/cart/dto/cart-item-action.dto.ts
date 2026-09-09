import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CartItemActionDto {
  @ApiProperty({
    description: 'Cart identifier',
    example: 'CART_1736412345678',
  })
  @IsNotEmpty({ message: 'cartId is required' })
  @IsString({ message: 'cartId must be a string' })
  cartId: string;

  @ApiProperty({
    description: 'Product unique ID',
    example: 'd2106b2f-3a5c-441c-8cc3-a05cd8a3acd5',
  })
  @IsNotEmpty({ message: 'productId is required' })
  @IsString({ message: 'productId must be a string' })
  productId: string;

  @ApiPropertyOptional({
    description: 'Optional variant ID',
    example: '',
  })
  @IsOptional()
  @IsString({ message: 'variantId must be a string' })
  variantId?: string;
}
