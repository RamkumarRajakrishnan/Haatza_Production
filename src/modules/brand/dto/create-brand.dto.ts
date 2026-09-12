import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ description: 'Brand Name', example: 'Nike' })
  @IsNotEmpty()
  @IsString()
  brandName!: string;

  @ApiPropertyOptional({ description: 'Brand Logo photo URL', example: 'https://storage.googleapis.com/.../logo.jpg' })
  @IsOptional()
  @IsString()
  brandLogo?: string;

  @ApiPropertyOptional({ description: 'Brand Website URL', example: 'https://www.nike.com' })
  @IsOptional()
  @IsString()
  brandWebsite?: string;

  @ApiProperty({ description: 'Industry dropdown choice', example: 'Fashion' })
  @IsNotEmpty()
  @IsString()
  industry!: string;

  @ApiPropertyOptional({ description: 'Short Description of the Brand', example: 'Leading athletic footwear and apparel brand' })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional({ description: 'Self Declaration PDF URL', example: 'https://storage.googleapis.com/.../self_declaration.pdf' })
  @IsOptional()
  @IsString()
  selfDeclaration?: string;

  @ApiPropertyOptional({ description: 'Letter of Authorization / Trademark Certificate PDF URL', example: 'https://storage.googleapis.com/.../letter_of_auth.pdf' })
  @IsOptional()
  @IsString()
  letterOfAuthorization?: string;

  @ApiPropertyOptional({ description: 'Sponsor / Advertiser Reference ID', example: 'adv_1789113415875' })
  @IsOptional()
  @IsString()
  advertiserId?: string;

  @ApiPropertyOptional({ description: 'Status (ACTIVE, INACTIVE, PENDING)', example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Module identifier', example: 'sponsor' })
  @IsOptional()
  @IsString()
  module?: string;
}
