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

    const url = (request.url || '').toLowerCase();

    let formattedMessage =
      typeof message === 'object' && message !== null
        ? (message as Record<string, unknown>).message || message
        : message;

    if (Array.isArray(formattedMessage)) {
      formattedMessage = formattedMessage.join(', ');
    }

    const isCartOrWishlistOrOrders =
      url.includes('cart') ||
      url.includes('wishlist') ||
      url.includes('order') ||
      url.includes('getorders') ||
      url.includes('createorders');

    if (isCartOrWishlistOrOrders) {
      let finalMessage = formattedMessage;
      let finalStatus = 'error';

      if (typeof message === 'object' && message !== null) {
        const msgObj = message as Record<string, any>;
        if (msgObj.message) {
          finalMessage = Array.isArray(msgObj.message)
            ? msgObj.message.join(', ')
            : msgObj.message;
        }
        if (msgObj.status) {
          finalStatus = msgObj.status;
        }
      }

      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        finalMessage = url.includes('wishlist')
          ? 'Unable to fetch wishlist'
          : 'Unable to fetch cart';
      }

      return response.status(status).json({
        status: finalStatus,
        message: finalMessage,
      });
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
      errorDetails: status === 500 ? errorMessageDetails : undefined,
      message: formattedMessage,
    });
  }
}
