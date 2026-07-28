import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';

// Expand libuv threadpool for high bcrypt concurrency
process.env.UV_THREADPOOL_SIZE = '64';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable Graceful Shutdown Hooks
  app.enableShutdownHooks();

  // Enable CORS for frontend clients
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

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // API Version
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
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

