import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { API_ROUTES } from './common/constants/api-routes.constant';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @Get('routes')
  getAllRoutes() {
    return {
      message: 'All API routes catalog',
      totalCategories: Object.keys(API_ROUTES).length,
      routes: API_ROUTES,
    };
  }
}
