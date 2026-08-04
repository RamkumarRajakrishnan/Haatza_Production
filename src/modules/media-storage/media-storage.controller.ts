import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { MediaStorageService } from './media-storage.service';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

@ApiTags('Media')
@Controller()
export class MediaStorageController {
  constructor(private readonly mediaStorageService: MediaStorageService) {}

  @Post(['uploadUrl', 'media/uploadUrl', 'upload-url', 'media/upload-url'])
  @ApiOperation({ summary: 'Generate instant direct signed upload URL (<30ms latency)' })
  async getSignedUploadUrl(@Body() dto: GenerateUploadUrlDto) {
    return this.mediaStorageService.generateSignedUploadUrl({
      filename: dto.filename,
      mimeType: dto.mimeType,
      folder: dto.folder || 'products',
    });
  }

  @Post([
    'uploadMedia',
    'uploadVideo',
    'media/upload',
    'seller/uploadMedia',
    'seller/uploadVideo',
  ])
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 100 * 1024 * 1024, // 100 MB max per file
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload media files (images, videos) with auto-compression' })
  async uploadMediaFiles(@UploadedFiles() files: any[], @Req() req: Request) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided for upload.');
    }

    const host = req.get('host');
    const rawProto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const protocol = Array.isArray(rawProto) ? rawProto[0] : rawProto.split(',')[0].trim();

    const requestBaseUrl = `${protocol}://${host}/uploads`;

    const mediaItems: Array<{
      type: string;
      key: string;
      originalSize: number;
      originalSizeFormatted: string;
      compressedSize: number;
      compressedSizeFormatted: string;
      compressionPercent: string;
      duration?: string;
      url: string;
      publicUrl: string;
    }> = [];

    for (const file of files) {
      const uploaded = await this.mediaStorageService.upload({ file });
      const cleanKey = uploaded.key.replace(/^\/+/, '');

      const customMediaBase = process.env.MEDIA_BASE_URL;
      let finalPublicUrl: string;

      if (customMediaBase && !customMediaBase.includes('haatza.com/uploads')) {
        finalPublicUrl = `${customMediaBase.replace(/\/+$/, '')}/${cleanKey}`;
      } else {
        finalPublicUrl = `${requestBaseUrl}/${cleanKey}`;
      }

      mediaItems.push({
        type: uploaded.type,
        key: uploaded.key,
        originalSize: uploaded.originalSize,
        originalSizeFormatted: formatBytes(uploaded.originalSize),
        compressedSize: uploaded.compressedSize,
        compressedSizeFormatted: formatBytes(uploaded.compressedSize),
        compressionPercent: uploaded.compressionPercent,
        duration: uploaded.duration,
        url: finalPublicUrl,
        publicUrl: finalPublicUrl,
      });
    }

    return mediaItems;
  }
}
