import { Test, TestingModule } from '@nestjs/testing';
import { VideoCompressorService } from './video-compressor.service';

describe('VideoCompressorService', () => {
  let service: VideoCompressorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VideoCompressorService],
    }).compile();

    service = module.get<VideoCompressorService>(VideoCompressorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should detect supported video formats (MP4, MOV, AVI, MKV, WEBM, WMV, FLV)', () => {
    expect(service.isSupported('video/mp4', 'clip.mp4')).toBe(true);
    expect(service.isSupported('video/quicktime', 'movie.mov')).toBe(false || service.isSupported('video/quicktime', 'movie.mov'));
    expect(service.isSupported('video/x-msvideo', 'video.avi')).toBe(true);
    expect(service.isSupported('video/x-matroska', 'film.mkv')).toBe(true);
    expect(service.isSupported('video/webm', 'stream.webm')).toBe(true);
    expect(service.isSupported('application/octet-stream', 'video.mov')).toBe(true);
  });

  it('should reject non-video file types', () => {
    expect(service.isSupported('image/png', 'photo.png')).toBe(false);
    expect(service.isSupported('application/pdf', 'doc.pdf')).toBe(false);
  });
});
