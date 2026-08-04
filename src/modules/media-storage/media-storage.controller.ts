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
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const requestBaseUrl = `${protocol}://${host}/uploads`;

    const mediaItems: Array<{
      type: string;
      key: string;
      url: string;
      publicUrl: string;
    }> = [];

    for (const file of files) {
      const uploaded = await this.mediaStorageService.upload({ file });
      let publicUrl = uploaded.url || this.mediaStorageService.getPublicUrl(uploaded.key);

      // Prepend host URL if publicUrl is relative
      if (publicUrl && !publicUrl.startsWith('http://') && !publicUrl.startsWith('https://')) {
        const cleanKey = uploaded.key.replace(/^\/+/, '');
        publicUrl = `${requestBaseUrl}/${cleanKey}`;
      }

      mediaItems.push({
        type: uploaded.type,
        key: uploaded.key,
        url: publicUrl,
        publicUrl: publicUrl,
      });
    }

    return mediaItems;
  }
}
