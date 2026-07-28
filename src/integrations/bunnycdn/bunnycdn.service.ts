import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BunnyCdnIntegrationService {
  constructor(private configService: ConfigService) {}

  async uploadFile(fileName: string, buffer: Buffer, folder: string = 'uploads') {
    const storageZone = this.configService.get<string>('BUNNYCDN_STORAGE_ZONE') || 'haatza-cdn';
    const cdnUrl = this.configService.get<string>('BUNNYCDN_PULL_ZONE_URL') || 'https://cdn.haatza.com';
    return {
      url: `${cdnUrl}/${folder}/${Date.now()}-${fileName}`,
      storageZone,
    };
  }
}
