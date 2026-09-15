import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSponsorAdCreativeDto {
  @ApiPropertyOptional({
    description: 'Creative Name',
    example: 'Updated Diwali Banner Ad - 60% Off Electronics',
  })
  @IsOptional()
  @IsString()
  creativeName?: string;

  @ApiPropertyOptional({
    description: 'Primary text / Ad body copy (max 150 characters)',
    example: 'Grab up to 60% off on top smartphones and electronics today!',
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'primaryText must not exceed 150 characters' })
  primaryText?: string;

  @ApiPropertyOptional({
    description: 'Headline text (max 60 characters)',
    example: 'Huge Diwali Discounts - Shop Today',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'headline must not exceed 60 characters' })
  headline?: string;

  @ApiPropertyOptional({
    description: 'Image URL for the creative banner/ad',
    example: 'https://cdn.haatza.com/creatives/diwali-banner-updated.png',
  })
  @IsOptional()
  @IsString()
  creativeImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Image aspect ratio: 1:1 or 4:5',
    example: '1:1',
    enum: ['1:1', '4:5', 'RATIO_1_1', 'RATIO_4_5'],
  })
  @IsOptional()
  @IsString()
  imageAspectRatio?: string;

  @ApiPropertyOptional({
    description: 'Destination landing page type',
    example: 'PRODUCT_PAGE',
    enum: ['PRODUCT_PAGE', 'BRAND_STORE', 'CATEGORY_PAGE', 'CUSTOM_URL'],
  })
  @IsOptional()
  @IsString()
  destinationType?: string;

  @ApiPropertyOptional({
    description: 'Destination landing URL link',
    example: 'https://haatza.com/products/festive-deal-456',
  })
  @IsOptional()
  @IsString()
  destinationLink?: string;

  @ApiPropertyOptional({
    description: 'Call to action (CTA) button text',
    example: 'ORDER_NOW',
    enum: ['SHOP_NOW', 'LEARN_MORE', 'BOOK_NOW', 'SIGN_UP', 'ORDER_NOW'],
  })
  @IsOptional()
  @IsString()
  ctaButtonText?: string;

  @ApiPropertyOptional({
    description: 'Creative status (DRAFT, ACTIVE, PAUSED, REJECTED, DELETED)',
    example: 'PAUSED',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'User ID of updater',
    example: 'admin-user-id',
  })
  @IsOptional()
  @IsString()
  updatedBy?: string;

  @ApiPropertyOptional({
    description: 'Module identifier (must be sponsor)',
    example: 'sponsor',
    default: 'sponsor',
  })
  @IsOptional()
  @IsString()
  module?: string;
}
