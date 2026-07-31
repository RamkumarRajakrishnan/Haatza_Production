import { Injectable, BadRequestException } from '@nestjs/common';
import { MediaStorageService } from '../media-storage/media-storage.service';
import { MediaType } from './dto/seller-product.dto';

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface MediaItem {
  type: MediaType;
  key?: string;
  url: string;
}

@Injectable()
export class StorageService {
  constructor(private readonly mediaStorage: MediaStorageService) {}

  /**
   * Upload single or multiple files to storage.
   * Returns array of { key: 'products/xyz.webp', type: 'image' | 'video', url: string }
   */
  async uploadFiles(files: MulterFile[]): Promise<MediaItem[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided for upload.');
    }

    const mediaItems: MediaItem[] = [];

    for (const file of files) {
      const uploaded = await this.mediaStorage.upload({ file });
      mediaItems.push({
        type: uploaded.type === 'video' ? MediaType.VIDEO : MediaType.IMAGE,
        key: uploaded.key,
        url: uploaded.url || this.mediaStorage.getPublicUrl(uploaded.key),
      });
    }

    return mediaItems;
  }
}

