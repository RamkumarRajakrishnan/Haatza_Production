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
});
