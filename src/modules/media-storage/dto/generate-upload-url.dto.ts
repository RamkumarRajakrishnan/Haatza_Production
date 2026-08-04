import { IsString, IsNotEmpty, IsNumber, IsOptional, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateUploadUrlDto {
  @ApiProperty({ example: 'product-image.png' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ example: 5242880, required: false })
  @IsOptional()
  @IsNumber()
  @Max(500 * 1024 * 1024, { message: 'File size cannot exceed 500 MB' })
  fileSize?: number;

  @ApiProperty({ example: 'products', required: false })
  @IsOptional()
  @IsString()
  folder?: string;
}
