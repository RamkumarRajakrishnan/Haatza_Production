import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MediaStorageService } from './media-storage.service';
import { ImageCompressorService } from './image-compressor.service';
import { VideoCompressorService } from './video-compressor.service';

describe('MediaStorageService', () => {
  let service: MediaStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaStorageService,
        ImageCompressorService,
        VideoCompressorService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'MEDIA_BASE_URL') return 'https://cdn.haatza.com';
              return null;
            },
          },
        },
      ],
    }).compile();

    service = module.get<MediaStorageService>(MediaStorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should extract relative key correctly', () => {
    const fullUrl = 'https://cdn.haatza.com/products/123/image.webp';
    const key = service.extractKey(fullUrl);
    expect(key).toBe('products/123/image.webp');
  });

  it('should generate public URL from key', () => {
    const key = 'products/123/image.webp';
    const url = service.getPublicUrl(key);
    expect(url).toBe('https://cdn.haatza.com/products/123/image.webp');
  });

  it('should transform stored keys to public URLs in response object', () => {
    const entity = {
      id: 'prod-1',
      name: 'Sample Item',
      mainMedia: 'products/123/main.webp',
      media: [
        { key: 'products/123/1.webp', type: 'image' },
        { key: 'products/123/video.mp4', type: 'video' },
      ],
    };

    const transformed: any = service.transformMediaToUrls(entity);
    expect(transformed.mainMedia).toBe('https://cdn.haatza.com/products/123/main.webp');
    expect(transformed.media[0].url).toBe('https://cdn.haatza.com/products/123/1.webp');
    expect(transformed.media[1].url).toBe('https://cdn.haatza.com/products/123/video.mp4');
  });
});
