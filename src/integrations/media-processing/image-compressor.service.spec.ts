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
});
