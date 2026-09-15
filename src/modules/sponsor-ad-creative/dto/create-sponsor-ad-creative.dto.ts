import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
} from 'class-validator';

export class CreateSponsorAdCreativeDto {
  @ApiProperty({
    description: 'Campaign ID (numeric ID or UUID campaignUid)',
    example: '61ae8c62-e7dc-4452-ab0d-f583ac4b4b81',
  })
  @IsNotEmpty({ message: 'campaignId is required' })
  campaignId: string | number;

  @ApiProperty({
    description: 'Creative Name',
    example: 'Diwali Banner Ad - 50% Off Electronics',
  })
  @IsNotEmpty({ message: 'creativeName is required' })
  @IsString()
  creativeName: string;

  @ApiProperty({
    description: 'Primary text / Ad body copy (max 150 characters)',
    example: 'Get up to 50% off on top-brand smartphones and gadgets this Diwali festive season!',
    maxLength: 150,
  })
  @IsNotEmpty({ message: 'primaryText is required' })
  @IsString()
  @MaxLength(150, { message: 'primaryText must not exceed 150 characters' })
  primaryText: string;

  @ApiProperty({
    description: 'Headline text (max 60 characters)',
    example: 'Biggest Diwali Sale Ever - Shop Now',
    maxLength: 60,
  })
  @IsNotEmpty({ message: 'headline is required' })
  @IsString()
  @MaxLength(60, { message: 'headline must not exceed 60 characters' })
  headline: string;

  @ApiProperty({
    description: 'Image URL for the creative banner/ad',
    example: 'https://cdn.haatza.com/creatives/diwali-banner-2026.png',
  })
  @IsNotEmpty({ message: 'creativeImageUrl is required' })
  @IsString()
  creativeImageUrl: string;

  @ApiProperty({
    description: 'Image aspect ratio: 1:1 or 4:5',
    example: '1:1',
    enum: ['1:1', '4:5', 'RATIO_1_1', 'RATIO_4_5'],
  })
  @IsNotEmpty({ message: 'imageAspectRatio is required' })
  @IsString()
  imageAspectRatio: string;

  @ApiProperty({
    description: 'Destination landing page type',
    example: 'PRODUCT_PAGE',
    enum: ['PRODUCT_PAGE', 'BRAND_STORE', 'CATEGORY_PAGE', 'CUSTOM_URL'],
  })
  @IsNotEmpty({ message: 'destinationType is required' })
  @IsString()
  destinationType: string;

  @ApiProperty({
    description: 'Destination landing URL link',
    example: 'https://haatza.com/products/festive-deal-123',
  })
  @IsNotEmpty({ message: 'destinationLink is required' })
  @IsString()
  destinationLink: string;

  @ApiProperty({
    description: 'Call to action (CTA) button text',
    example: 'SHOP_NOW',
    enum: ['SHOP_NOW', 'LEARN_MORE', 'BOOK_NOW', 'SIGN_UP', 'ORDER_NOW'],
  })
  @IsNotEmpty({ message: 'ctaButtonText is required' })
  @IsString()
  ctaButtonText: string;

  @ApiPropertyOptional({
    description: 'User ID of creator',
    example: 'admin-user-id',
  })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({
    description: 'Module identifier (must be sponsor)',
    example: 'sponsor',
    default: 'sponsor',
  })
  @IsOptional()
  @IsString()
  module?: string;
}
