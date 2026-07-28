import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

// Expand libuv threadpool for high bcrypt concurrency
process.env.UV_THREADPOOL_SIZE = '64';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
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
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy does not allow access from origin ${origin}`));
      }
    },
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

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API Version
  app.setGlobalPrefix('api/v1');

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

  logger.log(`🚀 Application is running on port ${port}`);

  logger.log(`🚀 Application is running on http://localhost:${port}/api/v1`);
}

// Process-level unhandled error handlers
process.on('unhandledRejection', (reason: unknown) => {
  new Logger('UnhandledRejection').error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  new Logger('UncaughtException').error('Uncaught Exception:', error.stack);
  process.exit(1);
});

void bootstrap();

