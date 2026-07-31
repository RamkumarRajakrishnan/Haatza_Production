import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

import { DOMAIN_CONFIG } from '../../config/domain.config';

export interface UploadFileOptions {
  file: {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  };
  folder?: string;
  productId?: string;
}

export interface MediaObjectMeta {
  key: string;
  type: 'image' | 'video';
  url?: string;
}

@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);
  private readonly mediaBaseUrl: string;
  private readonly s3Client?: S3Client;
  private readonly bucketName?: string;
  private readonly localStorageDir: string;
  private sharpModule: typeof import('sharp') | null = null;

  constructor(private readonly configService: ConfigService) {
    this.mediaBaseUrl = (
      this.configService.get<string>('MEDIA_BASE_URL') ||
      DOMAIN_CONFIG.mediaUrl
    ).replace(/\/+$/, '');

    const s3Region = this.configService.get<string>('AWS_REGION') || 'auto';
    const s3Endpoint = this.configService.get<string>('S3_ENDPOINT');
    const accessKeyId =
      this.configService.get<string>('AWS_ACCESS_KEY_ID') ||
      this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey =
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ||
      this.configService.get<string>('S3_SECRET_ACCESS_KEY');
    this.bucketName =
      this.configService.get<string>('AWS_S3_BUCKET') ||
      this.configService.get<string>('S3_BUCKET_NAME');

    if (accessKeyId && secretAccessKey && this.bucketName) {
      this.s3Client = new S3Client({
        region: s3Region,
        endpoint: s3Endpoint || undefined,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: !!s3Endpoint, // Cloudflare R2 / MinIO compatibility
      });
      this.logger.log(`Initialized S3/R2 storage driver for bucket: ${this.bucketName}`);
    } else {
      this.logger.warn(
        'S3/R2 credentials not provided. Falling back to local disk storage driver.',
      );
    }

    this.localStorageDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(this.localStorageDir)) {
      fs.mkdirSync(this.localStorageDir, { recursive: true });
    }

    this.initSharp();
  }

  private async initSharp() {
    try {
      // Dynamic import to support optional sharp compilation
      this.sharpModule = await import('sharp');
    } catch {
      this.logger.warn('Sharp module not found or failed to load. Falling back to uncompressed buffer upload.');
    }
  }

  /**
   * Validate file, compress if image, calculate unique object key, and upload to storage.
   * Store ONLY the key in PostgreSQL.
   */
  async upload(options: UploadFileOptions): Promise<MediaObjectMeta> {
    const { file, folder = 'products', productId } = options;

    if (!file || !file.buffer) {
      throw new BadRequestException('Invalid file provided for upload.');
    }

    const isVideo = this.isVideoFile(file.mimetype, file.originalname);
    const isImage = this.isImageFile(file.mimetype, file.originalname);

    if (!isImage && !isVideo) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Only image and video files are supported.`,
      );
    }

    const type: 'image' | 'video' = isVideo ? 'video' : 'image';
    let targetBuffer = file.buffer;
    let extension = isVideo ? path.extname(file.originalname).toLowerCase() || '.mp4' : '.webp';

    // Compress image to WebP if sharp is available
    if (isImage && this.sharpModule) {
      try {
        const sharpFn = (this.sharpModule as any).default || this.sharpModule;
        targetBuffer = await sharpFn(file.buffer)
          .webp({ quality: 80 })
          .toBuffer();
        extension = '.webp';
      } catch (err) {
        this.logger.error(`Image compression failed, using original buffer: ${err.message}`);
      }
    }

    // Generate unique UUID-based object key
    const uuid = crypto.randomUUID();
    const productSegment = productId ? `${productId}/` : '';
    const key = `${folder}/${productSegment}${uuid}${extension}`;

    // Check if key exists (deduplication check)
    const exists = await this.exists(key);
    if (exists) {
      this.logger.log(`Key ${key} already exists in storage. Reusing existing key.`);
      return { key, type, url: this.getPublicUrl(key) };
    }

    // Perform upload
    try {
      if (this.s3Client && this.bucketName) {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: targetBuffer,
            ContentType: isVideo ? file.mimetype : 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
      } else {
        const destPath = path.join(this.localStorageDir, key);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.writeFileSync(destPath, targetBuffer);
      }
      this.logger.log(`Successfully uploaded object key: ${key}`);
      return { key, type, url: this.getPublicUrl(key) };
    } catch (error) {
      this.logger.error(`Upload failed for key ${key}: ${error.message}`);
      throw new InternalServerErrorException(`Failed to upload media object: ${error.message}`);
    }
  }

  /**
   * Check if object key exists in storage
   */
  async exists(key: string): Promise<boolean> {
    if (!key) return false;
    const cleanKey = this.extractKey(key);

    if (this.s3Client && this.bucketName) {
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: cleanKey,
          }),
        );
        return true;
      } catch {
        return false;
      }
    } else {
      const localPath = path.join(this.localStorageDir, cleanKey);
      return fs.existsSync(localPath);
    }
  }

  /**
   * Delete object key from storage
   */
  async delete(key: string): Promise<void> {
    if (!key) return;
    const cleanKey = this.extractKey(key);

    try {
      if (this.s3Client && this.bucketName) {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: cleanKey,
          }),
        );
      } else {
        const localPath = path.join(this.localStorageDir, cleanKey);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }
      this.logger.log(`Deleted object key: ${cleanKey}`);
    } catch (error) {
      this.logger.error(`Failed to delete key ${cleanKey}: ${error.message}`);
    }
  }

  /**
   * Get public CDN URL for a given object key or Wix image reference
   */
  getPublicUrl(key?: string | null): string {
    if (!key) return '';
    if (key.startsWith('http://') || key.startsWith('https://')) {
      return key; // Already a full URL
    }

    // Handle Wix image protocol strings (e.g. wix:image://v1/aca349_.../image.jpg#originWidth=...)
    if (key.startsWith('wix:image://')) {
      const parts = key.split('/');
      const filenameWithHash = parts[parts.length - 1] || '';
      const filename = filenameWithHash.split('#')[0] || '';
      return `https://static.wixstatic.com/media/${filename}`;
    }

    const cleanKey = key.replace(/^\/+/, '');
    return `${this.mediaBaseUrl}/${cleanKey}`;
  }

  /**
   * Extract relative object key from absolute URL or relative key string
   */
  extractKey(urlOrKey: string): string {
    if (!urlOrKey) return '';
    if (urlOrKey.startsWith(this.mediaBaseUrl)) {
      return urlOrKey.replace(`${this.mediaBaseUrl}/`, '').replace(/^\/+/, '');
    }
    if (urlOrKey.startsWith('wix:image://')) {
      return urlOrKey; // Retain exact string if legacy wix key
    }
    try {
      const parsed = new URL(urlOrKey);
      return parsed.pathname.replace(/^\/+/, '');
    } catch {
      return urlOrKey.replace(/^\/+/, '');
    }
  }

  /**
   * Recursively transform entity stored keys into full CDN public URLs for outgoing API responses
   */
  transformMediaToUrls<T>(data: T): T {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.transformMediaToUrls(item)) as unknown as T;
    }

    const result: any = { ...data };

    for (const key of Object.keys(result)) {
      const val = result[key];

      if (key === 'mainMedia' && typeof val === 'string') {
        result[key] = this.getPublicUrl(val);
      } else if ((key === 'media' || key === 'productImages' || key === 'mediaUrls') && val) {
        if (Array.isArray(val)) {
          result[key] = val.map((item) => {
            if (typeof item === 'string') {
              return this.getPublicUrl(item);
            }
            if (item && typeof item === 'object') {
              const itemKey = item.key || item.url;
              return {
                ...item,
                key: item.key ? item.key : this.extractKey(itemKey),
                url: this.getPublicUrl(itemKey),
              };
            }
            return item;
          });
        } else if (typeof val === 'object') {
          result[key] = this.transformMediaToUrls(val);
        }
      } else if (val && typeof val === 'object') {
        result[key] = this.transformMediaToUrls(val);
      }
    }

    return result;
  }

  private isImageFile(mimetype: string, filename: string): boolean {
    return (
      mimetype.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(filename)
    );
  }

  private isVideoFile(mimetype: string, filename: string): boolean {
    return (
      mimetype.startsWith('video/') ||
      /\.(mp4|mov|avi|mkv|webm)$/i.test(filename)
    );
  }
}
