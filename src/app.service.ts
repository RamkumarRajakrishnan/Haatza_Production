import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {

  constructor(
    private configService: ConfigService,
  ) {}

  getHello() {
    return {
      app: this.configService.get('APP_NAME'),
      port: this.configService.get('PORT'),
      message: 'Haatza API Running',
    };
  }
}