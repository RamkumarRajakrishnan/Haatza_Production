import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId =
      (request.headers['x-request-id'] as string) ||
      (request.headers['x-correlation-id'] as string) ||
      `req-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorMessageDetails =
      exception instanceof Error
        ? exception.message
        : typeof exception === 'string'
          ? exception
          : JSON.stringify(exception);

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : errorMessageDetails;

    this.logger.error({
      correlationId,
      path: request.url,
      method: request.method,
      statusCode: status,
      timestamp: new Date().toISOString(),
      errorName: exception instanceof Error ? exception.name : 'UnknownError',
      errorMessage: errorMessageDetails,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    response.setHeader('x-request-id', correlationId);

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
      errorDetails: status === 500 ? errorMessageDetails : undefined,
      message:
        typeof message === 'object' && message !== null
          ? (message as Record<string, unknown>).message || message
          : message,
    });
  }
}
