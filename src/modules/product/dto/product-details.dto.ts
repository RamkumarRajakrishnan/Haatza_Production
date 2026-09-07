import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ProductDetailsQueryDto {
  @ApiProperty({
    description: 'Product unique identifier (UUID or Product ID)',
    example: '528d6ec4-126b-44a9-a880-5185f0272dd5',
  })
  @IsNotEmpty({ message: 'Product ID is required' })
  @IsString()
  productId: string;

  @ApiProperty({
    description: 'Buyer destination pincode for delivery charge calculation',
    example: '600001',
  })
  @IsNotEmpty({ message: 'toPincode is required' })
  @IsString()
  toPincode: string;

  @ApiPropertyOptional({
    description: 'Optional buyer user ID to check cart and wishlist status',
    example: 'usr_12345678',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Optional subcategory ID to target sponsored campaign ads',
    example: '271c29fd-5d1d-76f3-94e3-5532f84651be',
  })
  @IsOptional()
  @IsString()
  subcategoryId?: string;

  @ApiProperty({
    description: 'Module name (haatza or lite)',
    example: 'haatza',
    required: true,
  })
  @IsNotEmpty({ message: 'module is required' })
  @IsString()
  module: string;
}
