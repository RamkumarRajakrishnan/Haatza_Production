import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';

/**
 * ImageCompressorService
 * ---------------------
 * Handles all image compression before upload to cloud storage.
 *
 * Strategy:
 * 1. Resize to max 1920px width/height (preserve aspect ratio)
 * 2. Convert to WebP format (best compression-to-quality ratio)
 * 3. Multi-pass quality targeting: start at quality 82, reduce until under 500 KB
 * 4. If sharp is not available, return the original buffer (graceful fallback)
 */

export interface ImageCompressionResult {
  buffer: Buffer;
  extension: string;
  contentType: string;
  originalSize: number;
  compressedSize: number;
  compressionPercent: string;
}

// Maximum dimension (width or height) for resized images
const MAX_DIMENSION = 1920;

// Target file size in bytes (500 KB)
const TARGET_SIZE_BYTES = 500 * 1024;

// Quality settings for multi-pass compression
const INITIAL_QUALITY = 82;
const MIN_QUALITY = 40;
const QUALITY_STEP = 8;

@Injectable()
export class ImageCompressorService {
  private readonly logger = new Logger(ImageCompressorService.name);
  private sharpModule: typeof import('sharp') | null = null;

  constructor() {
    this.loadSharp();
  }

  private async loadSharp() {
    try {
      this.sharpModule = await import('sharp');
      this.logger.log('Sharp image processing module loaded successfully.');
    } catch {
      this.logger.warn(
        'Sharp module not available. Image compression disabled — images will be uploaded as-is.',
      );
    }
  }

  /**
   * Check if the given mimetype/filename represents an image we can compress.
   */
  isSupported(mimetype: string, filename: string): boolean {
    return (
      mimetype.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|avif|heic|heif|bmp|tiff?)$/i.test(filename)
    );
  }

  /**
   * Compress an image buffer.
   *
   * Pipeline:
   *   1. Read metadata (width, height)
   *   2. Resize if either dimension exceeds MAX_DIMENSION
   *   3. Convert to WebP at INITIAL_QUALITY
   *   4. If result > TARGET_SIZE_BYTES, re-compress at lower quality (multi-pass)
   *   5. Return the smallest buffer that still looks good
   */
  async compress(
    fileBuffer: Buffer,
    originalMimetype?: string,
    originalFilename?: string,
  ): Promise<ImageCompressionResult> {
    const originalSize = fileBuffer.length;

    // Helper to get fallback info
    const getFallbackInfo = () => {
      let extension = '.jpg';
      let contentType = 'image/jpeg';

      if (originalMimetype && originalMimetype.startsWith('image/')) {
        contentType = originalMimetype;
        if (originalMimetype === 'image/png') extension = '.png';
        else if (originalMimetype === 'image/webp') extension = '.webp';
        else if (originalMimetype === 'image/gif') extension = '.gif';
        else if (originalMimetype === 'image/heic') extension = '.heic';
        else if (originalMimetype === 'image/heif') extension = '.heif';
        else if (originalMimetype === 'image/avif') extension = '.avif';
        else if (originalMimetype === 'image/bmp') extension = '.bmp';
        else if (originalMimetype === 'image/tiff') extension = '.tiff';
      } else if (originalFilename) {
        const ext = path.extname(originalFilename).toLowerCase();
        if (ext) {
          extension = ext;
          if (ext === '.png') contentType = 'image/png';
          else if (ext === '.webp') contentType = 'image/webp';
          else if (ext === '.gif') contentType = 'image/gif';
          else if (ext === '.heic') contentType = 'image/heic';
          else if (ext === '.heif') contentType = 'image/heif';
          else if (ext === '.avif') contentType = 'image/avif';
          else if (ext === '.bmp') contentType = 'image/bmp';
          else if (ext === '.tiff' || ext === '.tif') contentType = 'image/tiff';
        }
      }
      return { extension, contentType };
    };

    const fallbackInfo = getFallbackInfo();

    // Fallback: if sharp is not loaded, return original
    if (!this.sharpModule) {
      this.logger.warn('Sharp not available — returning original image buffer.');
      return {
        buffer: fileBuffer,
        extension: fallbackInfo.extension,
        contentType: fallbackInfo.contentType,
        originalSize,
        compressedSize: originalSize,
        compressionPercent: '0%',
      };
    }

    const sharpFn = (this.sharpModule as any).default || this.sharpModule;

    try {
      // Step 1: Read image metadata
      const metadata = await sharpFn(fileBuffer).metadata();
      const { width = 0, height = 0 } = metadata;

      this.logger.log(
        `Image input: ${width}x${height}, ${this.formatBytes(originalSize)}, format: ${metadata.format}`,
      );

      const needsResize = width > MAX_DIMENSION || height > MAX_DIMENSION;
      const getResizeOptions = () => {
        if (!needsResize) return undefined;
        return {
          width: width > height ? MAX_DIMENSION : undefined,
          height: height >= width ? MAX_DIMENSION : undefined,
          fit: 'inside' as const,
          withoutEnlargement: true,
        };
      };

      // Step 2: Build base sharp pipeline with optional resize
      let pipeline = sharpFn(fileBuffer).rotate(); // auto-rotate based on EXIF
      const resizeOpts = getResizeOptions();
      if (resizeOpts) {
        pipeline = pipeline.resize(resizeOpts);
        this.logger.log(`Resizing image to fit within ${MAX_DIMENSION}px.`);
      }

      // Step 3: First pass — WebP at initial quality
      let compressedBuffer = await pipeline
        .webp({ quality: INITIAL_QUALITY })
        .toBuffer();

      this.logger.log(
        `Pass 1 (quality ${INITIAL_QUALITY}): ${this.formatBytes(compressedBuffer.length)}`,
      );

      // Step 4: Multi-pass — reduce quality until under target size
      let currentQuality = INITIAL_QUALITY;

      while (
        compressedBuffer.length > TARGET_SIZE_BYTES &&
        currentQuality > MIN_QUALITY
      ) {
        currentQuality -= QUALITY_STEP;
        let passPipeline = sharpFn(fileBuffer).rotate();
        const passResizeOpts = getResizeOptions();
        if (passResizeOpts) {
          passPipeline = passPipeline.resize(passResizeOpts);
        }

        compressedBuffer = await passPipeline
          .webp({ quality: currentQuality })
          .toBuffer();

        this.logger.log(
          `Pass (quality ${currentQuality}): ${this.formatBytes(compressedBuffer.length)}`,
        );
      }

      // If compressed buffer is larger than original and no resize was performed, fallback to original
      if (compressedBuffer.length > originalSize && !needsResize) {
        this.logger.log('Compressed buffer larger than original file without resize — returning original.');
        return {
          buffer: fileBuffer,
          extension: fallbackInfo.extension,
          contentType: fallbackInfo.contentType,
          originalSize,
          compressedSize: originalSize,
          compressionPercent: '0%',
        };
      }

      // Step 5: Calculate compression stats
      const compressedSize = compressedBuffer.length;
      const savedPercent =
        originalSize > 0
          ? ((1 - compressedSize / originalSize) * 100).toFixed(1)
          : '0';

      this.logger.log(
        `Image compressed: ${this.formatBytes(originalSize)} → ${this.formatBytes(compressedSize)} (${savedPercent}% saved, quality ${currentQuality})`,
      );

      return {
        buffer: compressedBuffer,
        extension: '.webp',
        contentType: 'image/webp',
        originalSize,
        compressedSize,
        compressionPercent: `${savedPercent}%`,
      };
    } catch (error) {
      this.logger.error(`Image compression failed: ${error.message}`);
      // Graceful fallback — return original buffer
      return {
        buffer: fileBuffer,
        extension: fallbackInfo.extension,
        contentType: fallbackInfo.contentType,
        originalSize,
        compressedSize: originalSize,
        compressionPercent: '0%',
      };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
}
