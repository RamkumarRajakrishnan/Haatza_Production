import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * VideoCompressorService
 * ----------------------
 * Handles all video compression before upload to cloud storage.
 *
 * Strategy:
 * 1. Write incoming buffer to a temp file (FFmpeg requires file I/O)
 * 2. Probe video metadata (resolution, duration, bitrate)
 * 3. Determine target resolution: 4K→1080p, 1080p→720p, 720p→keep
 * 4. Re-encode with H.264 (video) + AAC (audio) at 1.5–2 Mbps
 * 5. Read compressed file back to buffer
 * 6. Clean up temp files
 */

export interface VideoCompressionResult {
  buffer: Buffer;
  extension: string;
  contentType: string;
  originalSize: number;
  compressedSize: number;
  compressionPercent: string;
  duration: string; // formatted as "mm:ss"
}

// Target video bitrates per resolution tier
const BITRATE_MAP: Record<string, string> = {
  '720p': '1500k',   // 1.5 Mbps for 720p
  '1080p': '2000k',  // 2.0 Mbps for 1080p
  'default': '1500k',
};

const AUDIO_BITRATE = '128k';
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB max input

@Injectable()
export class VideoCompressorService {
  private readonly logger = new Logger(VideoCompressorService.name);
  private ffmpegPath: string | null = null;
  private ffmpegModule: any = null;

  constructor() {
    this.loadFfmpeg();
  }

  private async loadFfmpeg() {
    try {
      // Load bundled FFmpeg binary path
      const installer = await import('@ffmpeg-installer/ffmpeg');
      this.ffmpegPath = installer.path;

      // Load fluent-ffmpeg
      this.ffmpegModule = await import('fluent-ffmpeg');

      // Set FFmpeg path
      const ffmpeg = this.ffmpegModule.default || this.ffmpegModule;
      ffmpeg.setFfmpegPath(this.ffmpegPath);

      this.logger.log(`FFmpeg loaded from: ${this.ffmpegPath}`);
    } catch (error) {
      this.logger.warn(
        `FFmpeg not available: ${error.message}. Video compression disabled — videos will be uploaded as-is.`,
      );
    }
  }

  /**
   * Check if the given mimetype/filename represents a video we can compress.
   */
  isSupported(mimetype: string, filename: string): boolean {
    return (
      mimetype.startsWith('video/') ||
      /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v)$/i.test(filename)
    );
  }

  /**
   * Compress a video buffer.
   *
   * Pipeline:
   *   1. Write buffer to temp input file
   *   2. Probe to get resolution & duration
   *   3. Calculate target resolution and bitrate
   *   4. Re-encode with FFmpeg (H.264 + AAC)
   *   5. Read output file to buffer
   *   6. Clean up temp files
   */
  async compress(fileBuffer: Buffer, originalFilename: string): Promise<VideoCompressionResult> {
    const originalSize = fileBuffer.length;

    // Check file size limit
    if (originalSize > MAX_FILE_SIZE_BYTES) {
      this.logger.warn(
        `Video file size ${this.formatBytes(originalSize)} exceeds ${this.formatBytes(MAX_FILE_SIZE_BYTES)} limit.`,
      );
      throw new Error(`Video file exceeds maximum allowed size of ${this.formatBytes(MAX_FILE_SIZE_BYTES)}.`);
    }

    // Fallback: if FFmpeg is not loaded, return original
    if (!this.ffmpegModule || !this.ffmpegPath) {
      this.logger.warn('FFmpeg not available — returning original video buffer.');
      return {
        buffer: fileBuffer,
        extension: path.extname(originalFilename).toLowerCase() || '.mp4',
        contentType: 'video/mp4',
        originalSize,
        compressedSize: originalSize,
        compressionPercent: '0%',
        duration: '00:00',
      };
    }

    // Generate unique temp file paths
    const tempId = crypto.randomUUID();
    const tempDir = path.join(os.tmpdir(), 'haatza-video-compress');
    const inputPath = path.join(tempDir, `input-${tempId}${path.extname(originalFilename) || '.mp4'}`);
    const outputPath = path.join(tempDir, `output-${tempId}.mp4`);

    try {
      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Step 1: Write input buffer to temp file
      fs.writeFileSync(inputPath, fileBuffer);
      this.logger.log(`Temp input written: ${inputPath} (${this.formatBytes(originalSize)})`);

      // Step 2: Probe video metadata
      const metadata = await this.probeVideo(inputPath);
      const { width, height, durationSeconds } = metadata;

      this.logger.log(
        `Video input: ${width}x${height}, duration: ${this.formatDuration(durationSeconds)}, size: ${this.formatBytes(originalSize)}`,
      );

      // Step 3: Determine target resolution and bitrate
      const { targetWidth, targetHeight, bitrate, tier } = this.getTargetSettings(width, height);

      this.logger.log(
        `Target: ${targetWidth}x${targetHeight} (${tier}), bitrate: ${bitrate}`,
      );

      // Step 4: Compress with FFmpeg
      await this.runFfmpeg(inputPath, outputPath, targetWidth, targetHeight, bitrate);

      // Step 5: Read compressed output
      const compressedBuffer = fs.readFileSync(outputPath);
      const compressedSize = compressedBuffer.length;

      // Calculate stats
      const savedPercent =
        originalSize > 0
          ? ((1 - compressedSize / originalSize) * 100).toFixed(1)
          : '0';

      this.logger.log(
        `Video compressed: ${this.formatBytes(originalSize)} → ${this.formatBytes(compressedSize)} (${savedPercent}% saved)`,
      );

      return {
        buffer: compressedBuffer,
        extension: '.mp4',
        contentType: 'video/mp4',
        originalSize,
        compressedSize,
        compressionPercent: `${savedPercent}%`,
        duration: this.formatDuration(durationSeconds),
      };
    } catch (error) {
      this.logger.error(`Video compression failed: ${error.message}`);
      // Graceful fallback — return original buffer
      return {
        buffer: fileBuffer,
        extension: path.extname(originalFilename).toLowerCase() || '.mp4',
        contentType: 'video/mp4',
        originalSize,
        compressedSize: originalSize,
        compressionPercent: '0%',
        duration: '00:00',
      };
    } finally {
      // Step 6: Clean up temp files
      this.cleanupFile(inputPath);
      this.cleanupFile(outputPath);
    }
  }

  /**
   * Probe video to extract resolution and duration using FFmpeg.
   */
  private probeVideo(filePath: string): Promise<{ width: number; height: number; durationSeconds: number }> {
    const ffmpeg = this.ffmpegModule.default || this.ffmpegModule;

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err: any, data: any) => {
        if (err) {
          return reject(new Error(`FFprobe failed: ${err.message}`));
        }

        const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
        if (!videoStream) {
          return reject(new Error('No video stream found in file.'));
        }

        resolve({
          width: videoStream.width || 1920,
          height: videoStream.height || 1080,
          durationSeconds: parseFloat(data.format?.duration) || 0,
        });
      });
    });
  }

  /**
   * Determine target resolution and bitrate based on input resolution.
   *
   * Rules:
   *   4K (2160p+) → downscale to 1080p at 2 Mbps
   *   1080p       → downscale to 720p at 1.5 Mbps
   *   720p        → keep 720p at 1.5 Mbps (lower bitrate only)
   *   < 720p      → keep original resolution at 1.5 Mbps
   */
  private getTargetSettings(width: number, height: number): {
    targetWidth: number;
    targetHeight: number;
    bitrate: string;
    tier: string;
  } {
    const maxDim = Math.max(width, height);
    const isLandscape = width >= height;

    if (maxDim >= 2160) {
      // 4K → 1080p
      return {
        targetWidth: isLandscape ? 1920 : -2,
        targetHeight: isLandscape ? -2 : 1080,
        bitrate: BITRATE_MAP['1080p'],
        tier: '4K → 1080p',
      };
    } else if (maxDim >= 1080) {
      // 1080p → 720p
      return {
        targetWidth: isLandscape ? 1280 : -2,
        targetHeight: isLandscape ? -2 : 720,
        bitrate: BITRATE_MAP['720p'],
        tier: '1080p → 720p',
      };
    } else if (maxDim >= 720) {
      // 720p → keep, lower bitrate
      return {
        targetWidth: isLandscape ? 1280 : -2,
        targetHeight: isLandscape ? -2 : 720,
        bitrate: BITRATE_MAP['720p'],
        tier: '720p (bitrate only)',
      };
    } else {
      // Below 720p — keep as-is, just re-encode
      return {
        targetWidth: width,
        targetHeight: height,
        bitrate: BITRATE_MAP['default'],
        tier: `${maxDim}p (re-encode)`,
      };
    }
  }

  /**
   * Execute FFmpeg compression pipeline.
   */
  private runFfmpeg(
    inputPath: string,
    outputPath: string,
    targetWidth: number,
    targetHeight: number,
    videoBitrate: string,
  ): Promise<void> {
    const ffmpeg = this.ffmpegModule.default || this.ffmpegModule;

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .videoBitrate(videoBitrate)
        .audioBitrate(AUDIO_BITRATE)
        .size(`${targetWidth}x${targetHeight}`)
        .outputOptions([
          '-preset fast',           // Encoding speed vs compression tradeoff
          '-crf 23',                // Constant Rate Factor (visual quality control)
          '-movflags +faststart',   // Enable progressive download / streaming
          '-pix_fmt yuv420p',       // Maximum device compatibility
          '-max_muxing_queue_size 1024',
        ])
        .output(outputPath)
        .on('start', (cmd: string) => {
          this.logger.log(`FFmpeg started: ${cmd.substring(0, 200)}...`);
        })
        .on('progress', (progress: any) => {
          if (progress.percent) {
            this.logger.log(`FFmpeg progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          this.logger.log('FFmpeg compression completed successfully.');
          resolve();
        })
        .on('error', (err: any) => {
          reject(new Error(`FFmpeg error: ${err.message}`));
        });

      command.run();
    });
  }

  /**
   * Safely delete a temp file.
   */
  private cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`Cleaned up temp file: ${filePath}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to clean up temp file ${filePath}: ${error.message}`);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  private formatDuration(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}
