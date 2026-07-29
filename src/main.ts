import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

// Process-level global unhandled error handlers
process.on('unhandledRejection', (reason: unknown) => {
  console.error('CRITICAL: Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('CRITICAL: Uncaught Exception:', error.stack || error.message);
  process.exit(1);
});

process.env.UV_THREADPOOL_SIZE = '4';

async function bootstrap() {
  const port = Number(process.env.PORT) || 8080;
  console.log('Starting server...');
  console.log('PORT:', port);
  console.log('NODE_ENV:', process.env.NODE_ENV);

  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);

    // Enable Graceful Shutdown Hooks
    app.enableShutdownHooks();

    // Parse CORS allowed origins from environment
    const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
    const allowedOrigins = allowedOriginsEnv
      ? allowedOriginsEnv.split(',').map((origin) => origin.trim())
      : ['https://seller.haatza.com', 'https://www.haatza.com'];

    // Enable CORS for allowed clients
    app.enableCors({
      origin: true,
      credentials: true,
    });

    // Security Headers
    app.use(helmet());

    // Request correlation ID middleware
    app.use((req: any, res: any, next: any) => {
      const requestId =
        req.headers['x-request-id'] ||
        `req-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      req.headers['x-request-id'] = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // Validation - do NOT forbid unknown properties to prevent strict rejection of client payloads
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    // API Versioning Prefix (excluding root '/' and '/health' for Cloud Run health checks)
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: '/', method: RequestMethod.GET },
        { path: 'health', method: RequestMethod.GET },
      ],
    });

    // Swagger Documentation Setup
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
      const swaggerConfig = new DocumentBuilder()
        .setTitle('Haatza Seller API')
        .setDescription('Enterprise NestJS + PostgreSQL Backend API Documentation for Haatza')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup('api/docs', app, document);
      logger.log('📄 Swagger documentation available at /api/docs');
    }

    const port = Number(process.env.PORT) || 8080;
    await app.listen(port, '0.0.0.0');

    console.log('Server listening on port', port);
    logger.log(`🚀 Application is running on port ${port}`);
    logger.log(`🚀 API endpoint prefix: /api/v1`);
  } catch (error: any) {
    logger.error('Failed to start NestJS application during bootstrap', error.stack || error);
    process.exit(1);
  }
}

void bootstrap();



