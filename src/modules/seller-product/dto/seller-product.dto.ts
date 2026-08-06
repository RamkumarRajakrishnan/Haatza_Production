import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsInt,
  Min,
  IsEnum,
  IsUrl,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export class MediaItemDto {
  @ApiProperty({ enum: MediaType, description: 'Media type (image or video)' })
  @IsEnum(MediaType, { message: 'Media type must be either "image" or "video"' })
  type: MediaType;

  @ApiProperty({ description: 'Public HTTP/HTTPS URL of the media file' })
  @IsUrl({ require_protocol: true }, { message: 'URL must be a valid HTTP or HTTPS URL' })
  url: string;
}

export class CreateSellerProductDto {
  @ApiPropertyOptional({ description: 'Main media image URL' })
  @IsOptional()
  @IsString()
  mainMedia?: string;

  @ApiPropertyOptional({
    type: [MediaItemDto],
    description: 'JSONB array of media objects with public URLs and types',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  media?: MediaItemDto[];

  @ApiPropertyOptional({ description: 'One RS store indicator' })
  @IsOptional()
  @IsBoolean()
  oneRsStore?: boolean;

  @ApiPropertyOptional({ description: 'JSON array of product images' })
  @IsOptional()
  productImages?: any;

  @ApiProperty({ description: 'Product title / name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'JSON array of search keywords' })
  @IsOptional()
  searchKeywords?: any;

  @ApiPropertyOptional({ description: 'Sub category name' })
  @IsOptional()
  @IsString()
  subCategory?: string;

  @ApiPropertyOptional({ description: 'Sub category UUID' })
  @IsOptional()
  @IsUUID()
  subCategoryId?: string;

  @ApiPropertyOptional({ description: 'Brand name' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Stock inventory count' })
  @IsOptional()
  @IsInt()
  @Min(0)
  inventory?: number;

  @ApiPropertyOptional({ description: 'JSON object/array of variant prices' })
  @IsOptional()
  variantPrice?: any;

  @ApiPropertyOptional({ description: 'Wix / External Product ID' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'New variant price' })
  @IsOptional()
  @IsNumber()
  newVariantPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum Retail Price (MRP)' })
  @IsOptional()
  @IsNumber()
  mrp?: number;

  @ApiPropertyOptional({ description: 'On-sale price' })
  @IsOptional()
  @IsNumber()
  onsalePrice?: number;

  @ApiPropertyOptional({ description: 'Cash on delivery available' })
  @IsOptional()
  @IsBoolean()
  cod?: boolean;

  @ApiPropertyOptional({ description: 'UPI payment available' })
  @IsOptional()
  @IsBoolean()
  upi?: boolean;

  @ApiPropertyOptional({ description: 'Standard selling price' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ description: 'JSON discount info' })
  @IsOptional()
  discount?: any;

  @ApiPropertyOptional({ description: 'Product status (e.g. ACTIVE, INACTIVE)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Delivery charges applicable' })
  @IsOptional()
  @IsBoolean()
  deliveryCharges?: boolean;

  @ApiPropertyOptional({ description: 'Main category name' })
  @IsOptional()
  @IsString()
  mainCategory?: string;

  @ApiPropertyOptional({ description: 'Seller UUID' })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ description: 'Shipping weight in kg' })
  @IsOptional()
  @IsNumber()
  shippingWeight?: number;

  @ApiPropertyOptional({ description: 'JSON collections data' })
  @IsOptional()
  collections?: any;

  @ApiPropertyOptional({ description: 'Seller pincode' })
  @IsOptional()
  @IsString()
  sellerPincode?: string;

  @ApiPropertyOptional({ description: 'Created date in Wix' })
  @IsOptional()
  createdDate?: Date;

  @ApiPropertyOptional({ description: 'Updated date in Wix' })
  @IsOptional()
  updatedDate?: Date;

  @ApiPropertyOptional({ description: 'JSON product options' })
  @IsOptional()
  productOptions?: any;

  @ApiPropertyOptional({ description: 'JSON additional info sections' })
  @IsOptional()
  additionalInfoSections?: any;

  @ApiPropertyOptional({ description: 'Active ad campaign indicator' })
  @IsOptional()
  @IsBoolean()
  activeAd?: boolean;

  @ApiPropertyOptional({ description: 'Average cost per click' })
  @IsOptional()
  @IsNumber()
  averageCpc?: number;

  @ApiPropertyOptional({ description: 'Priority score string' })
  @IsOptional()
  @IsString()
  priorityScore?: string;

  @ApiPropertyOptional({ description: 'Campaign ID' })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional({ description: 'Reach count' })
  @IsOptional()
  @IsInt()
  reach?: number;

  @ApiPropertyOptional({ description: 'Impression count' })
  @IsOptional()
  @IsInt()
  impression?: number;

  @ApiPropertyOptional({ description: 'Clicks count' })
  @IsOptional()
  @IsInt()
  clicks?: number;

  @ApiPropertyOptional({ description: 'Sales count' })
  @IsOptional()
  @IsInt()
  sales?: number;

  @ApiPropertyOptional({ description: 'Revenue amount' })
  @IsOptional()
  @IsNumber()
  revenue?: number;

  @ApiPropertyOptional({ description: 'JSON category name info' })
  @IsOptional()
  categoryName?: any;

  @ApiPropertyOptional({ description: 'Stock Keeping Unit (SKU)' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ description: 'Product type' })
  @IsOptional()
  @IsString()
  productType?: string;

  @ApiPropertyOptional({ description: 'Manage variants boolean' })
  @IsOptional()
  @IsBoolean()
  manageVariants?: boolean;

  @ApiPropertyOptional({ description: 'Ribbon badge text' })
  @IsOptional()
  @IsString()
  ribbon?: string;

  @ApiPropertyOptional({ description: 'Track inventory boolean' })
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional({ description: 'Influencer branding boolean' })
  @IsOptional()
  @IsBoolean()
  influencerBranding?: boolean;

  @ApiPropertyOptional({ description: 'Haatza verified boolean' })
  @IsOptional()
  @IsBoolean()
  haatzaVerified?: boolean;

  @ApiPropertyOptional({ description: 'JSON promotion photos' })
  @IsOptional()
  promotionPhotos?: any;

  @ApiPropertyOptional({ description: 'Payment type text' })
  @IsOptional()
  @IsString()
  paymentType?: string;

  @ApiPropertyOptional({ description: 'Product return policy text' })
  @IsOptional()
  @IsString()
  productReturn?: string;

  @ApiPropertyOptional({ description: 'Size chart info' })
  @IsOptional()
  @IsString()
  sizeChart?: string;

  @ApiPropertyOptional({ description: 'Detailed product description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'GST seller boolean' })
  @IsOptional()
  @IsBoolean()
  gstSeller?: boolean;

  @ApiPropertyOptional({ description: 'UPI payment discount' })
  @IsOptional()
  @IsNumber()
  upiPaymentDiscount?: number;

  @ApiPropertyOptional({ description: 'Manage listing products' })
  @IsOptional()
  @IsString()
  manageListingProducts?: string;

  @ApiPropertyOptional({ description: 'Sell and earn commission' })
  @IsOptional()
  @IsNumber()
  sellAndEarnCommission?: number;

  @ApiPropertyOptional({ description: 'Sell and earn boolean' })
  @IsOptional()
  @IsBoolean()
  sellAndEarn?: boolean;
}

export class UpdateSellerProductDto extends PartialType(CreateSellerProductDto) {}

export class FilterSellerProductDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search term across name, SKU, brand, and description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by Seller UUID' })
  @IsOptional()
  @IsString()
  sellerId?: string;

  @ApiPropertyOptional({ description: 'Filter by Brand' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Filter by Status (e.g. ACTIVE)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by Sub Category' })
  @IsOptional()
  @IsString()
  subCategory?: string;

  @ApiPropertyOptional({ description: 'Filter by Main Category' })
  @IsOptional()
  @IsString()
  mainCategory?: string;

  @ApiPropertyOptional({ description: 'Sort field (default: createdAt)' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order: asc | desc (default: desc)' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
