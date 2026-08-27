import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { MediaStorageService } from './media-storage.service';
import { ImageCompressorService } from '../../integrations/media-processing/image-compressor.service';

@Injectable()
export class WixImageMigrationService {
  private readonly logger = new Logger(WixImageMigrationService.name);

  constructor(
    private readonly mediaStorage: MediaStorageService,
    private readonly imageCompressor: ImageCompressorService,
  ) {}

  /**
   * Helper to identify if a string is a Wix image reference
   */
  isWixUrl(urlOrRef?: string | null): boolean {
    if (!urlOrRef) return false;
    return (
      urlOrRef.startsWith('wix:image://') ||
      urlOrRef.includes('wixstatic.com')
    );
  }

  /**
   * Parse Wix reference/URL into filename and direct Wix download URL
   */
  parseWixRef(wixUrl: string): { filename: string; downloadUrl: string } {
    if (wixUrl.startsWith('wix:image://')) {
      // Format: wix:image://v1/8aa0ef_8ab4cccfa9444df5b6843e476b28b264~mv2.jpg/image.jpg#originWidth=1080&originHeight=1440
      const parts = wixUrl.split('/');
      // The unique filename is the third part
      const rawFilename = parts[3] || '';
      const filename = rawFilename.split('#')[0] || '';
      return {
        filename,
        downloadUrl: `https://static.wixstatic.com/media/${filename}`,
      };
    }

    // Format: https://static.wixstatic.com/media/8aa0ef_8ab4cccfa9444df5b6843e476b28b264~mv2.jpg
    const parts = wixUrl.split('/');
    const filename = parts[parts.length - 1] || '';
    return {
      filename,
      downloadUrl: wixUrl,
    };
  }

  /**
   * Downloads image with timeout and retry logic
   */
  async downloadImage(url: string, retries = 3): Promise<Buffer> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Wix download failed with status ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error) {
        this.logger.warn(
          `Failed download attempt ${attempt}/${retries} for ${url}: ${error.message}`
        );
        if (attempt === retries) throw error;
        // Wait before retry (exponential backoff)
        await new Promise((res) => setTimeout(res, attempt * 1000));
      }
    }
    throw new Error(`Failed to download after ${retries} attempts`);
  }

  /**
   * Migrate a single Wix image reference to GCS/S3
   */
  async migrateWixUrl(productId: string, wixUrl: string): Promise<string> {
    if (!this.isWixUrl(wixUrl)) {
      return wixUrl; // Not a Wix URL, return unmodified
    }

    const { filename, downloadUrl } = this.parseWixRef(wixUrl);
    const originalExt = path.extname(filename).toLowerCase() || '.jpg';
    const baseName = path.basename(filename, originalExt);

    // GCS/S3 path structure: products/{productId}/{unique_wix_basename}.webp (or original extension)
    const webpKey = `products/${productId}/${baseName}.webp`;
    const originalKey = `products/${productId}/${baseName}${originalExt}`;

    // 1. Check if WebP version already exists in cloud storage
    if (await this.mediaStorage.exists(webpKey)) {
      this.logger.log(`[Idempotent Skip] Image already migrated: ${webpKey}`);
      return this.mediaStorage.getPublicUrl(webpKey);
    }

    // 2. Check if original extension version exists in cloud storage
    if (await this.mediaStorage.exists(originalKey)) {
      this.logger.log(`[Idempotent Skip] Image already migrated: ${originalKey}`);
      return this.mediaStorage.getPublicUrl(originalKey);
    }

    // 3. Download the image
    this.logger.log(`Downloading Wix image: ${downloadUrl}`);
    const originalBuffer = await this.downloadImage(downloadUrl);

    // 4. Compress the image
    let targetBuffer = originalBuffer;
    let extension = originalExt;
    let contentType = 'image/jpeg';

    if (this.imageCompressor.isSupported(contentType, filename)) {
      try {
        const compressed = await this.imageCompressor.compress(
          originalBuffer,
          contentType,
          filename,
        );
        targetBuffer = compressed.buffer;
        extension = compressed.extension;
        contentType = compressed.contentType;
      } catch (err) {
        this.logger.warn(`Compression failed, falling back to original upload: ${err.message}`);
      }
    }

    const destKey = `products/${productId}/${baseName}${extension}`;

    // 5. Upload to S3/GCS or Local directory
    this.logger.log(`Uploading to cloud: ${destKey}`);
    let uploadedToCloud = false;

    if (this.mediaStorage['s3Client'] && this.mediaStorage['bucketName']) {
      try {
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');
        await this.mediaStorage['s3Client'].send(
          new PutObjectCommand({
            Bucket: this.mediaStorage['bucketName'],
            Key: destKey,
            Body: targetBuffer,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000, immutable',
          })
        );
        uploadedToCloud = true;
      } catch (err) {
        this.logger.warn(
          `⚠️ Cloud upload failed for key ${destKey} (${err.message}). Falling back to local storage.`
        );
      }
    }

    if (!uploadedToCloud) {
      // Local fallback
      const fs = await import('fs');
      const destPath = path.join(this.mediaStorage['localStorageDir'], destKey);
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.writeFileSync(destPath, targetBuffer);
      this.logger.log(`💾 Saved locally: public/uploads/${destKey}`);
    }

    return this.mediaStorage.getPublicUrl(destKey);
  }

  /**
   * Recursively traverse and migrate JSON structures (arrays/objects) for productImages
   */
  async migrateProductImagesJson(productId: string, json: any): Promise<any> {
    if (!json) return json;

    if (typeof json === 'string') {
      if (this.isWixUrl(json)) {
        return this.migrateWixUrl(productId, json);
      }
      // Check if it's stringified JSON itself
      if (json.trim().startsWith('[') || json.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(json);
          const migrated = await this.migrateProductImagesJson(productId, parsed);
          return migrated;
        } catch {
          return json;
        }
      }
      return json;
    }

    if (Array.isArray(json)) {
      const migratedArray: any[] = [];
      for (const item of json) {
        migratedArray.push(await this.migrateProductImagesJson(productId, item));
      }
      return migratedArray;
    }

    if (typeof json === 'object') {
      const result: any = { ...json };
      for (const key of Object.keys(result)) {
        const value = result[key];
        if (typeof value === 'string' && this.isWixUrl(value)) {
          result[key] = await this.migrateWixUrl(productId, value);
        } else if (value && typeof value === 'object') {
          result[key] = await this.migrateProductImagesJson(productId, value);
        }
      }
      return result;
    }

    return json;
  }
}
