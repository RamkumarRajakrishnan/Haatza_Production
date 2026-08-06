import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ResponseEnvelope<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers['x-request-id'];

    return next.handle().pipe(
      map((data) => {
        // Exclude meta wrapper for check-user API to strictly preserve fixed response schema
        if (request.url?.includes('check-user') || request.url?.includes('checkUser')) {
          return data;
        }

        let message = 'Operation successful';
        let responseData = data;

        if (data && typeof data === 'object' && 'message' in data && 'data' in data) {
          message = data.message;
          responseData = data.data;
        } else if (data && typeof data === 'object' && 'message' in data && Object.keys(data).length === 1) {
          message = data.message;
          responseData = null;
        }

        return {
          success: true,
          message,
          data: responseData,
          meta: {
            timestamp: new Date().toISOString(),
            requestId,
          },
        };
      }),
    );
  }
}
