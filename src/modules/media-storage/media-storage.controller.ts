import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { MediaStorageService } from './media-storage.service';

@ApiTags('Media')
@Controller()
export class MediaStorageController {
  constructor(private readonly mediaStorageService: MediaStorageService) {}

  @Post([
    'uploadMedia',
    'uploadVideo',
    'media/upload',
    'seller/uploadMedia',
    'seller/uploadVideo',
  ])
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload media files (images, videos)' })
  async uploadMediaFiles(@UploadedFiles() files: any[], @Req() req: Request) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided for upload.');
    }

    const host = req.get('host');
    const rawProto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const protocol = Array.isArray(rawProto) ? rawProto[0] : rawProto.split(',')[0].trim();

    // Construct dynamic base URL from the actual server host handling the request
    const requestBaseUrl = `${protocol}://${host}/uploads`;

    const mediaItems: Array<{
      type: string;
      key: string;
      url: string;
      publicUrl: string;
    }> = [];

    for (const file of files) {
      const uploaded = await this.mediaStorageService.upload({ file });
      const cleanKey = uploaded.key.replace(/^\/+/, '');

      // Check if custom MEDIA_BASE_URL env is set (excluding default fallback)
      const customMediaBase = process.env.MEDIA_BASE_URL;
      let finalPublicUrl: string;

      if (customMediaBase && !customMediaBase.includes('haatza.com/uploads')) {
        finalPublicUrl = `${customMediaBase.replace(/\/+$/, '')}/${cleanKey}`;
      } else {
        // Use actual server host (e.g. Cloud Run URL or backend domain)
        finalPublicUrl = `${requestBaseUrl}/${cleanKey}`;
      }

      mediaItems.push({
        type: uploaded.type,
        key: uploaded.key,
        url: finalPublicUrl,
        publicUrl: finalPublicUrl,
      });
    }

    return mediaItems;
  }
}
