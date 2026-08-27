import { Controller, Get, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { API_ROUTES } from './common/constants/api-routes.constant';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return {
      status: 'ok',
      service: 'Haatza Seller Backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('media/*')
  redirectToGcs(@Req() req: any, @Res() res: any) {
    const wildCardPath = req.params[0] || '';
    const bucket = process.env.AWS_S3_BUCKET || 'haatza-media-bucket';
    const gcsUrl = `https://storage.googleapis.com/${bucket}/${wildCardPath}`;
    return res.redirect(gcsUrl);
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

