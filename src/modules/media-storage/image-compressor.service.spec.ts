import { Test, TestingModule } from '@nestjs/testing';
import { ImageCompressorService } from './image-compressor.service';

describe('ImageCompressorService', () => {
  let service: ImageCompressorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageCompressorService],
    }).compile();

    service = module.get<ImageCompressorService>(ImageCompressorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should detect supported image formats (JPG, JPEG, PNG, WEBP, HEIC, HEIF, BMP, AVIF)', () => {
    expect(service.isSupported('image/jpeg', 'photo.jpg')).toBe(true);
    expect(service.isSupported('image/png', 'graphic.png')).toBe(true);
    expect(service.isSupported('image/webp', 'banner.webp')).toBe(true);
    expect(service.isSupported('image/heic', 'apple.heic')).toBe(true);
    expect(service.isSupported('image/bmp', 'picture.bmp')).toBe(true);
    expect(service.isSupported('application/octet-stream', 'test.heif')).toBe(true);
  });

  it('should reject non-image file types', () => {
    expect(service.isSupported('video/mp4', 'movie.mp4')).toBe(false);
    expect(service.isSupported('application/pdf', 'document.pdf')).toBe(false);
    expect(service.isSupported('text/plain', 'notes.txt')).toBe(false);
  });
});
