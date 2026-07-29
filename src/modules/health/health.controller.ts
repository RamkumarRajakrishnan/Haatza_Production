import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  getLiveness() {
    return {
      status: 'up',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async getReadiness() {
    if (!this.database.getIsConnected()) {
      return {
        status: 'starting',
        database: 'connecting',
        timestamp: new Date().toISOString(),
      };
    }
    try {
      await this.database.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'disconnected',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }
}

