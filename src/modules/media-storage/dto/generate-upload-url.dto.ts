import { IsString, IsNotEmpty, IsNumber, IsOptional, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateUploadUrlDto {
  @ApiProperty({ description: 'Filename' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ description: 'MIME type' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ description: 'File size in bytes', required: false })
  @IsOptional()
  @IsNumber()
  @Max(500 * 1024 * 1024, { message: 'File size cannot exceed 500 MB' })
  fileSize?: number;

  @ApiProperty({ description: 'Target folder', required: false })
  @IsOptional()
  @IsString()
  folder?: string;
}
