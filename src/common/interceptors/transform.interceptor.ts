import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface UnifiedResponseEnvelope<T> {
  success: boolean;
  statusCode: number;
  data: T | null;
  error: { code: string; message: string; details?: any } | null;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, UnifiedResponseEnvelope<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers['x-request-id'];

    return next.handle().pipe(
      map((data) => {
        const url = (request.url || request.originalUrl || '').toLowerCase();

        // Pass through unmodified if response already has success & data envelope, or is check-user / register
        if (
          data &&
          typeof data === 'object' &&
          (('success' in data && 'data' in data) ||
            'exists' in data ||
            'buyer' in data ||
            url.includes('check-user') ||
            url.includes('checkuser') ||
            url.includes('register'))
        ) {
          if ('statusCode' in data) {
            delete (data as any).statusCode;
          }
          if ('error' in data && (data as any).error === null) {
            delete (data as any).error;
          }
          return data;
        }

        let message = 'Operation successful';
        let responseData = data;

        if (data && typeof data === 'object' && 'message' in data && Object.keys(data).length === 1) {
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
