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

// High Quality Audio Bitrate (192 kbps AAC)
const AUDIO_BITRATE = '192k';
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB max input

// Optimal CRF setting for near-lossless / visually transparent quality
// CRF 18-20 = Near-lossless / visually transparent quality
// CRF 22 = Good quality, higher compression
const OPTIMAL_CRF = 20;

@Injectable()
export class VideoCompressorService {
  private readonly logger = new Logger(VideoCompressorService.name);
  private ffmpegPath: string | null = null;
  private ffmpegModule: any = null;

  constructor() {
    this.loadFfmpeg();
  }

  private async loadFfmpeg(): Promise<boolean> {
    if (this.ffmpegModule && this.ffmpegPath) {
      return true;
    }

    try {
      // Load bundled FFmpeg binary path
      const installer = await import('@ffmpeg-installer/ffmpeg');
      this.ffmpegPath = installer.path;

      // Load fluent-ffmpeg
      this.ffmpegModule = await import('fluent-ffmpeg');

      // Set FFmpeg path
      const ffmpeg = this.ffmpegModule.default || this.ffmpegModule;
      ffmpeg.setFfmpegPath(this.ffmpegPath);

      // Load bundled FFprobe binary path if available
      try {
        const ffprobeInstaller = await import('@ffprobe-installer/ffprobe');
        if (ffprobeInstaller && ffprobeInstaller.path) {
          ffmpeg.setFfprobePath(ffprobeInstaller.path);
          this.logger.log(`FFprobe loaded from: ${ffprobeInstaller.path}`);
        }
      } catch (ffprobeErr) {
        this.logger.warn(`FFprobe installer not loaded: ${ffprobeErr.message}`);
      }

      this.logger.log(`FFmpeg loaded from: ${this.ffmpegPath}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `FFmpeg not available: ${error.message}. Video compression disabled — videos will be uploaded as-is.`,
      );
      return false;
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
   * Compress a video buffer with near-lossless quality preservation.
   *
   * Strategy:
   * 1. Preserve original resolution (1080p, 720p, etc.) to prevent blurriness.
   *    Downscale only ultra-high 4K (2160p+) to 1080p max for web compatibility.
   * 2. Use Constant Rate Factor (CRF 20) with H.264 High Profile instead of hard bitrate caps.
   * 3. Preserve high-fidelity stereo audio at 192 kbps AAC.
   * 4. Ensure output dimensions are even numbers required by H.264 macroblocks.
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

    // Ensure FFmpeg is fully initialized before proceeding
    const isLoaded = await this.loadFfmpeg();
    if (!isLoaded || !this.ffmpegModule || !this.ffmpegPath) {
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

      // Step 2: Probe video metadata safely
      const metadata = await this.probeVideo(inputPath);
      const { width, height, durationSeconds } = metadata;

      this.logger.log(
        `Video input: ${width}x${height}, duration: ${this.formatDuration(durationSeconds)}, size: ${this.formatBytes(originalSize)}`,
      );

      // Step 3: Determine target resolution (preserve resolution up to 1080p)
      const { targetWidth, targetHeight, tier } = this.getTargetSettings(width, height);

      this.logger.log(
        `Target resolution: ${targetWidth}x${targetHeight} (${tier}), CRF: ${OPTIMAL_CRF}`,
      );

      // Step 4: Compress with FFmpeg using near-lossless CRF 20 settings
      await this.runFfmpeg(inputPath, outputPath, targetWidth, targetHeight);

      // Step 5: Read compressed output
      const compressedBuffer = fs.readFileSync(outputPath);
      const compressedSize = compressedBuffer.length;

      // If compressed buffer is larger than original, return original file buffer
      if (compressedSize > originalSize) {
        this.logger.log('Compressed video larger than original — returning original video buffer.');
        return {
          buffer: fileBuffer,
          extension: path.extname(originalFilename).toLowerCase() || '.mp4',
          contentType: 'video/mp4',
          originalSize,
          compressedSize: originalSize,
          compressionPercent: '0%',
          duration: this.formatDuration(durationSeconds),
        };
      }

      // Calculate stats
      const savedPercent =
        originalSize > 0
          ? ((1 - compressedSize / originalSize) * 100).toFixed(1)
          : '0';

      this.logger.log(
        `Video compressed with near-lossless quality: ${this.formatBytes(originalSize)} → ${this.formatBytes(compressedSize)} (${savedPercent}% saved)`,
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
   * Probe video to extract resolution and duration using FFmpeg safely.
   */
  private probeVideo(filePath: string): Promise<{ width: number; height: number; durationSeconds: number }> {
    const ffmpeg = this.ffmpegModule.default || this.ffmpegModule;

    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err: any, data: any) => {
        if (err) {
          this.logger.warn(`FFprobe warning: ${err.message}. Using default metadata fallback.`);
          return resolve({ width: 1920, height: 1080, durationSeconds: 0 });
        }

        const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
        if (!videoStream) {
          this.logger.warn('No video stream found in file. Using default resolution fallback.');
          return resolve({ width: 1920, height: 1080, durationSeconds: 0 });
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
   * Determine target resolution preserving original quality.
   *
   * Strategy:
   * - 4K (2160p+) → scale down to 1080p max for web browser playback compatibility.
   * - 1080p / 720p / lower → preserve 100% of original resolution to prevent visual quality loss.
   * - Ensures output width and height are valid even integers (required by H.264).
   */
  private getTargetSettings(width: number, height: number): {
    targetWidth: number;
    targetHeight: number;
    tier: string;
  } {
    const safeWidth = width > 0 ? width : 1920;
    const safeHeight = height > 0 ? height : 1080;
    const maxDim = Math.max(safeWidth, safeHeight);
    const aspect = safeWidth / safeHeight;

    const makeEven = (val: number): number => {
      const rounded = Math.round(val);
      return rounded % 2 === 0 ? rounded : rounded - 1;
    };

    if (maxDim >= 2160) {
      // 4K → scale down to 1080p max
      const targetHeight = safeWidth >= safeHeight ? 1080 : makeEven(1080 / aspect);
      const targetWidth = safeWidth >= safeHeight ? makeEven(1080 * aspect) : 1080;
      return {
        targetWidth,
        targetHeight,
        tier: '4K → 1080p (web max)',
      };
    } else {
      // 1080p, 720p, etc. → preserve 100% of original resolution
      return {
        targetWidth: makeEven(safeWidth),
        targetHeight: makeEven(safeHeight),
        tier: `${safeWidth}x${safeHeight} (original resolution preserved)`,
      };
    }
  }

  /**
   * Execute FFmpeg high-quality near-lossless compression pipeline.
   * Uses H.264 High Profile, CRF 20, Preset Medium, and AAC 192k audio.
   */
  private runFfmpeg(
    inputPath: string,
    outputPath: string,
    targetWidth: number,
    targetHeight: number,
  ): Promise<void> {
    const ffmpeg = this.ffmpegModule.default || this.ffmpegModule;

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .audioBitrate(AUDIO_BITRATE)
        .size(`${targetWidth}x${targetHeight}`)
        .outputOptions([
          '-preset medium',                   // Better rate-distortion balance & visual detail
          `-crf ${OPTIMAL_CRF}`,             // Constant Rate Factor (20 = near-lossless)
          '-profile:v high',                 // H.264 High Profile for optimal color & sharpness
          '-level:v 4.1',                    // Level 4.1 for universal mobile & web playback
          '-movflags +faststart',             // Web progressive download streaming
          '-pix_fmt yuv420p',                 // Standard 8-bit YUV 4:2:0 color sampling
          '-ar 48000',                        // High-fidelity 48kHz audio sampling
          '-max_muxing_queue_size 1024',
        ])
        .output(outputPath)
        .on('start', (cmd: string) => {
          this.logger.log(`FFmpeg high-quality command: ${cmd.substring(0, 200)}...`);
        })
        .on('progress', (progress: any) => {
          if (progress.percent) {
            this.logger.log(`FFmpeg progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          this.logger.log('FFmpeg high-quality compression completed successfully.');
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
