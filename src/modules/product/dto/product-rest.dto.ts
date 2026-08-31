import { IsOptional, IsString, IsInt, Min, IsBoolean, IsArray, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: 'Product Name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Seller Unique ID' })
  @IsString()
  @IsNotEmpty()
  seller_id: string;

  @ApiProperty({ description: 'MRP Price' })
  @IsNumber()
  mrp: number;

  @ApiProperty({ description: 'Selling Price' })
  @IsNumber()
  price: number;

  @ApiPropertyOptional({ description: 'Main Media image URL' })
  @IsOptional()
  @IsString()
  main_media?: string;

  @ApiPropertyOptional({ description: 'Is one Rs store product' })
  @IsOptional()
  @IsBoolean()
  one_rs_store?: boolean;

  @ApiPropertyOptional({ description: 'Product Images list' })
  @IsOptional()
  @IsArray()
  product_images?: any[];

  @ApiPropertyOptional({ description: 'Search Keywords' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  search_keywords?: string[];

  @ApiPropertyOptional({ description: 'Sub Category Name' })
  @IsOptional()
  @IsString()
  sub_category?: string;

  @ApiPropertyOptional({ description: 'Sub Category ID' })
  @IsOptional()
  @IsString()
  sub_category_id?: string;

  @ApiPropertyOptional({ description: 'Product Brand' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Inventory stock level' })
  @IsOptional()
  @IsInt()
  @Min(0)
  inventory?: number;

  @ApiPropertyOptional({ description: 'Variant Price structure' })
  @IsOptional()
  variant_price?: any;

  @ApiPropertyOptional({ description: 'Wix Product ID link' })
  @IsOptional()
  @IsString()
  wix_product_id?: string;

  @ApiPropertyOptional({ description: 'New Variant Price structure' })
  @IsOptional()
  new_variant_price?: any;

  @ApiPropertyOptional({ description: 'On-sale discount price' })
  @IsOptional()
  @IsNumber()
  onsale_price?: number;

  @ApiPropertyOptional({ description: 'Cash on delivery limit/value' })
  @IsOptional()
  @IsNumber()
  cod?: number;

  @ApiPropertyOptional({ description: 'UPI price/value' })
  @IsOptional()
  @IsNumber()
  upi?: number;

  @ApiPropertyOptional({ description: 'Discount detail' })
  @IsOptional()
  discount?: any;

  @ApiPropertyOptional({ description: 'Product Status (active, inactive, pending, Approved, Under Review, Reject)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Has delivery charges' })
  @IsOptional()
  @IsBoolean()
  delivery_charges?: boolean;

  @ApiPropertyOptional({ description: 'Main Category Name' })
  @IsOptional()
  @IsString()
  main_category?: string;

  @ApiPropertyOptional({ description: 'Shipping weight of product' })
  @IsOptional()
  @IsNumber()
  shipping_weight?: number;

  @ApiPropertyOptional({ description: 'Collections assigned to product' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  collections?: string[];

  @ApiPropertyOptional({ description: 'Seller Pin Code' })
  @IsOptional()
  @IsString()
  seller_pincode?: string;

  @ApiPropertyOptional({ description: 'Owner ID' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiPropertyOptional({ description: 'Product Options structure' })
  @IsOptional()
  product_options?: any;

  @ApiPropertyOptional({ description: 'Additional Info Sections' })
  @IsOptional()
  @IsArray()
  additional_info_sections?: any[];

  @ApiPropertyOptional({ description: 'Active Campaign Ad status' })
  @IsOptional()
  @IsBoolean()
  active_ad?: boolean;

  @ApiPropertyOptional({ description: 'Average cost per click' })
  @IsOptional()
  @IsNumber()
  average_cpc?: number;

  @ApiPropertyOptional({ description: 'Priority Score' })
  @IsOptional()
  @IsInt()
  priority_score?: number;

  @ApiPropertyOptional({ description: 'Active Campaign ID link' })
  @IsOptional()
  @IsString()
  campaign_id?: string;

  @ApiPropertyOptional({ description: 'Total reach count' })
  @IsOptional()
  @IsInt()
  reach?: number;

  @ApiPropertyOptional({ description: 'Total impression count' })
  @IsOptional()
  @IsInt()
  impression?: number;

  @ApiPropertyOptional({ description: 'Total clicks count' })
  @IsOptional()
  @IsInt()
  clicks?: number;

  @ApiPropertyOptional({ description: 'Total sales count' })
  @IsOptional()
  @IsInt()
  sales?: number;

  @ApiPropertyOptional({ description: 'Total campaign revenue' })
  @IsOptional()
  @IsNumber()
  revenue?: number;

  @ApiPropertyOptional({ description: 'Category Name hierarchy list' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  category_name?: string[];

  @ApiPropertyOptional({ description: 'SKU Code' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ description: 'Product Type (physical, digital)' })
  @IsOptional()
  @IsString()
  product_type?: string;

  @ApiPropertyOptional({ description: 'Enable variants management' })
  @IsOptional()
  @IsBoolean()
  manage_variants?: boolean;

  @ApiPropertyOptional({ description: 'Product Ribbon text' })
  @IsOptional()
  @IsString()
  ribbon?: string;

  @ApiPropertyOptional({ description: 'Track Inventory' })
  @IsOptional()
  @IsBoolean()
  track_inventory?: boolean;

  @ApiPropertyOptional({ description: 'Enable influencer branding' })
  @IsOptional()
  @IsBoolean()
  influencer_branding?: boolean;

  @ApiPropertyOptional({ description: 'Is verified by Haatza' })
  @IsOptional()
  @IsBoolean()
  haatza_verified?: boolean;

  @ApiPropertyOptional({ description: 'Promotion Photos list' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  promotion_photos?: string[];

  @ApiPropertyOptional({ description: 'Accepted payment type' })
  @IsOptional()
  @IsString()
  payment_type?: string;

  @ApiPropertyOptional({ description: 'Product return eligibility' })
  @IsOptional()
  @IsString()
  product_return?: string;

  @ApiPropertyOptional({ description: 'Size Chart URL' })
  @IsOptional()
  @IsString()
  size_chart?: string;

  @ApiPropertyOptional({ description: 'Product Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'GST rate of seller' })
  @IsOptional()
  @IsNumber()
  gst_seller?: number;

  @ApiPropertyOptional({ description: 'Discount for paying via UPI' })
  @IsOptional()
  @IsNumber()
  upi_payment_discount?: number;

  @ApiPropertyOptional({ description: 'Manage listing products link' })
  @IsOptional()
  @IsString()
  manage_listing_products?: string;

  @ApiPropertyOptional({ description: 'Commission rate for sell and earn' })
  @IsOptional()
  @IsNumber()
  sell_and_earn_commission?: number;

  @ApiPropertyOptional({ description: 'Sell and earn flag status' })
  @IsOptional()
  @IsString()
  sell_and_earn?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ description: 'Product Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Seller Unique ID' })
  @IsOptional()
  @IsString()
  seller_id?: string;

  @ApiPropertyOptional({ description: 'MRP Price' })
  @IsOptional()
  @IsNumber()
  mrp?: number;

  @ApiPropertyOptional({ description: 'Selling Price' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ description: 'Main Media image URL' })
  @IsOptional()
  @IsString()
  main_media?: string;

  @ApiPropertyOptional({ description: 'Is one Rs store product' })
  @IsOptional()
  @IsBoolean()
  one_rs_store?: boolean;

  @ApiPropertyOptional({ description: 'Product Images list' })
  @IsOptional()
  @IsArray()
  product_images?: any[];

  @ApiPropertyOptional({ description: 'Search Keywords' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  search_keywords?: string[];

  @ApiPropertyOptional({ description: 'Sub Category Name' })
  @IsOptional()
  @IsString()
  sub_category?: string;

  @ApiPropertyOptional({ description: 'Sub Category ID' })
  @IsOptional()
  @IsString()
  sub_category_id?: string;

  @ApiPropertyOptional({ description: 'Product Brand' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Inventory stock level' })
  @IsOptional()
  @IsInt()
  @Min(0)
  inventory?: number;

  @ApiPropertyOptional({ description: 'Variant Price structure' })
  @IsOptional()
  variant_price?: any;

  @ApiPropertyOptional({ description: 'Wix Product ID link' })
  @IsOptional()
  @IsString()
  wix_product_id?: string;

  @ApiPropertyOptional({ description: 'New Variant Price structure' })
  @IsOptional()
  new_variant_price?: any;

  @ApiPropertyOptional({ description: 'On-sale discount price' })
  @IsOptional()
  @IsNumber()
  onsale_price?: number;

  @ApiPropertyOptional({ description: 'Cash on delivery limit/value' })
  @IsOptional()
  @IsNumber()
  cod?: number;

  @ApiPropertyOptional({ description: 'UPI price/value' })
  @IsOptional()
  @IsNumber()
  upi?: number;

  @ApiPropertyOptional({ description: 'Discount detail' })
  @IsOptional()
  discount?: any;

  @ApiPropertyOptional({ description: 'Product Status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Has delivery charges' })
  @IsOptional()
  @IsBoolean()
  delivery_charges?: boolean;

  @ApiPropertyOptional({ description: 'Main Category Name' })
  @IsOptional()
  @IsString()
  main_category?: string;

  @ApiPropertyOptional({ description: 'Shipping weight of product' })
  @IsOptional()
  @IsNumber()
  shipping_weight?: number;

  @ApiPropertyOptional({ description: 'Collections assigned to product' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  collections?: string[];

  @ApiPropertyOptional({ description: 'Seller Pin Code' })
  @IsOptional()
  @IsString()
  seller_pincode?: string;

  @ApiPropertyOptional({ description: 'Owner ID' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiPropertyOptional({ description: 'Product Options structure' })
  @IsOptional()
  product_options?: any;

  @ApiPropertyOptional({ description: 'Additional Info Sections' })
  @IsOptional()
  @IsArray()
  additional_info_sections?: any[];

  @ApiPropertyOptional({ description: 'Active Campaign Ad status' })
  @IsOptional()
  @IsBoolean()
  active_ad?: boolean;

  @ApiPropertyOptional({ description: 'Average cost per click' })
  @IsOptional()
  @IsNumber()
  average_cpc?: number;

  @ApiPropertyOptional({ description: 'Priority Score' })
  @IsOptional()
  @IsInt()
  priority_score?: number;

  @ApiPropertyOptional({ description: 'Active Campaign ID link' })
  @IsOptional()
  @IsString()
  campaign_id?: string;

  @ApiPropertyOptional({ description: 'Total reach count' })
  @IsOptional()
  @IsInt()
  reach?: number;

  @ApiPropertyOptional({ description: 'Total impression count' })
  @IsOptional()
  @IsInt()
  impression?: number;

  @ApiPropertyOptional({ description: 'Total clicks count' })
  @IsOptional()
  @IsInt()
  clicks?: number;

  @ApiPropertyOptional({ description: 'Total sales count' })
  @IsOptional()
  @IsInt()
  sales?: number;

  @ApiPropertyOptional({ description: 'Total campaign revenue' })
  @IsOptional()
  @IsNumber()
  revenue?: number;

  @ApiPropertyOptional({ description: 'Category Name hierarchy list' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  category_name?: string[];

  @ApiPropertyOptional({ description: 'SKU Code' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ description: 'Product Type' })
  @IsOptional()
  @IsString()
  product_type?: string;

  @ApiPropertyOptional({ description: 'Enable variants management' })
  @IsOptional()
  @IsBoolean()
  manage_variants?: boolean;

  @ApiPropertyOptional({ description: 'Product Ribbon text' })
  @IsOptional()
  @IsString()
  ribbon?: string;

  @ApiPropertyOptional({ description: 'Track Inventory' })
  @IsOptional()
  @IsBoolean()
  track_inventory?: boolean;

  @ApiPropertyOptional({ description: 'Enable influencer branding' })
  @IsOptional()
  @IsBoolean()
  influencer_branding?: boolean;

  @ApiPropertyOptional({ description: 'Is verified by Haatza' })
  @IsOptional()
  @IsBoolean()
  haatza_verified?: boolean;

  @ApiPropertyOptional({ description: 'Promotion Photos list' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  promotion_photos?: string[];

  @ApiPropertyOptional({ description: 'Accepted payment type' })
  @IsOptional()
  @IsString()
  payment_type?: string;

  @ApiPropertyOptional({ description: 'Product return eligibility' })
  @IsOptional()
  @IsString()
  product_return?: string;

  @ApiPropertyOptional({ description: 'Size Chart URL' })
  @IsOptional()
  @IsString()
  size_chart?: string;

  @ApiPropertyOptional({ description: 'Product Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'GST rate of seller' })
  @IsOptional()
  @IsNumber()
  gst_seller?: number;

  @ApiPropertyOptional({ description: 'Discount for paying via UPI' })
  @IsOptional()
  @IsNumber()
  upi_payment_discount?: number;

  @ApiPropertyOptional({ description: 'Manage listing products link' })
  @IsOptional()
  @IsString()
  manage_listing_products?: string;

  @ApiPropertyOptional({ description: 'Commission rate for sell and earn' })
  @IsOptional()
  @IsNumber()
  sell_and_earn_commission?: number;

  @ApiPropertyOptional({ description: 'Sell and earn flag status' })
  @IsOptional()
  @IsString()
  sell_and_earn?: string;
}

export class InventoryUpdateDto {
  @ApiProperty({ description: 'Inventory stock change quantity' })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CollectionsUpdateDto {
  @ApiProperty({ description: 'List of collection UUIDs' })
  @IsArray()
  @IsString({ each: true })
  collections: string[];
}

export class MediaUpdateDto {
  @ApiPropertyOptional({ description: 'Primary Media image URL' })
  @IsOptional()
  @IsString()
  main_media?: string;

  @ApiPropertyOptional({ description: 'Sub-photos list' })
  @IsOptional()
  @IsArray()
  product_images?: any[];
}

export class StatusUpdateDto {
  @ApiProperty({ description: 'Product Status (active, inactive, pending, etc.)' })
  @IsString()
  @IsNotEmpty()
  status: string;
}

export class PricingUpdateDto {
  @ApiPropertyOptional({ description: 'Regular price' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ description: 'MRP list price' })
  @IsOptional()
  @IsNumber()
  mrp?: number;

  @ApiPropertyOptional({ description: 'Discounted sale price' })
  @IsOptional()
  @IsNumber()
  onsale_price?: number;

  @ApiPropertyOptional({ description: 'Discount details object/JSON' })
  @IsOptional()
  discount?: any;

  @ApiPropertyOptional({ description: 'Variant Price structure' })
  @IsOptional()
  variant_price?: any;

  @ApiPropertyOptional({ description: 'New Variant Price structure' })
  @IsOptional()
  new_variant_price?: any;
}

export class AdStatsUpdateDto {
  @ApiPropertyOptional({ description: 'Campaign reach count' })
  @IsOptional()
  @IsInt()
  reach?: number;

  @ApiPropertyOptional({ description: 'Campaign impression count' })
  @IsOptional()
  @IsInt()
  impression?: number;

  @ApiPropertyOptional({ description: 'Campaign clicks count' })
  @IsOptional()
  @IsInt()
  clicks?: number;

  @ApiPropertyOptional({ description: 'Total sales generated' })
  @IsOptional()
  @IsInt()
  sales?: number;

  @ApiPropertyOptional({ description: 'Total revenue generated' })
  @IsOptional()
  @IsNumber()
  revenue?: number;
}
