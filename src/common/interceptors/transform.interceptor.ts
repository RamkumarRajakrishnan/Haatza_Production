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
        // If response is already formatted with unified schema (success, statusCode, data, error) or check-user format, pass through
        if (
          data &&
          typeof data === 'object' &&
          ('statusCode' in data || 'error' in data || 'exists' in data || request.url?.includes('check-user') || request.url?.includes('checkUser'))
        ) {
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
