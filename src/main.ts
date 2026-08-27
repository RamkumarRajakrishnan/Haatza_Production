import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { DOMAIN_CONFIG } from './config/domain.config';

// Process-level global unhandled error handlers
process.on('unhandledRejection', (reason: unknown) => {
  console.error('CRITICAL: Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('CRITICAL: Uncaught Exception:', error.stack || error.message);
  process.exit(1);
});

process.env.UV_THREADPOOL_SIZE = '4';

import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import * as express from 'express';

async function bootstrap() {
  const port = Number(process.env.PORT) || 8080;
  console.log('Starting server...');
  console.log('PORT:', port);
  console.log('NODE_ENV:', process.env.NODE_ENV);

  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Increase Express body parser limit to 100MB for file uploads
    app.use(express.json({ limit: '100mb' }));
    app.use(express.urlencoded({ limit: '100mb', extended: true }));

    // Serve uploaded files statically under /uploads and /api/v1/uploads
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });
    app.useStaticAssets(uploadsDir, { prefix: '/api/v1/uploads/' });

    // Enable Graceful Shutdown Hooks
    app.enableShutdownHooks();

    // Parse CORS allowed origins from environment and DOMAIN_CONFIG
    const allowedOrigins = DOMAIN_CONFIG.getAllowedOrigins();

    // Enable CORS for allowed clients and subdomains
    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || origin.endsWith('.haatza.com')) {
          return callback(null, true);
        }
        return callback(null, true); // Permissive fallback for seamless client migration
      },
      credentials: true,
    });

    // Security Headers
    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      }),
    );

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

    // API Versioning Prefix (excluding root '/', '/health', and static '/uploads')
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: '/', method: RequestMethod.GET },
        { path: 'health', method: RequestMethod.GET },
        { path: 'media/(.*)', method: RequestMethod.GET },
        { path: 'uploads/(.*)', method: RequestMethod.ALL },
        { path: 'grow-plans', method: RequestMethod.ALL },
        { path: 'grow-plans/(.*)', method: RequestMethod.ALL },
        { path: 'api/v1/grow-plans', method: RequestMethod.ALL },
        { path: 'api/v1/grow-plans/(.*)', method: RequestMethod.ALL },
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



