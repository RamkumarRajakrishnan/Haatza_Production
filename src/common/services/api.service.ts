import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { API_ROUTES } from '../constants/api-routes.constant';

export interface ApiRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  token?: string;
  timeoutMs?: number;
}

@Injectable()
export class ApiService {
  private readonly logger = new Logger(ApiService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('API_BASE_URL') ||
      this.configService.get<string>('BASE_DOMAIN') ||
      this.configService.get<string>('APP_URL') ||
      'https://haatza-production-807150947524.asia-south1.run.app';
  }

  /**
   * Returns complete URL given a relative path or key from API_ROUTES catalog.
   */
  public getFullUrl(pathOrRoute: string): string {
    if (pathOrRoute.startsWith('http://') || pathOrRoute.startsWith('https://')) {
      return pathOrRoute;
    }
    const cleanPath = pathOrRoute.startsWith('/') ? pathOrRoute : `/${pathOrRoute}`;
    return `${this.baseUrl.replace(/\/$/, '')}${cleanPath}`;
  }

  /**
   * Centralized HTTP GET call helper
   */
  async get<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const fullUrl = this.buildUrlWithParams(this.getFullUrl(endpoint), options.params);
    return this.executeRequest<T>(fullUrl, {
      method: 'GET',
      headers: this.buildHeaders(options),
      timeoutMs: options.timeoutMs,
    });
  }

  /**
   * Centralized HTTP POST call helper
   */
  async post<T = any>(endpoint: string, body?: any, options: ApiRequestOptions = {}): Promise<T> {
    const fullUrl = this.getFullUrl(endpoint);
    return this.executeRequest<T>(fullUrl, {
      method: 'POST',
      headers: this.buildHeaders(options),
      body: JSON.stringify(body || {}),
      timeoutMs: options.timeoutMs,
    });
  }

  /**
   * Centralized HTTP PUT call helper
   */
  async put<T = any>(endpoint: string, body?: any, options: ApiRequestOptions = {}): Promise<T> {
    const fullUrl = this.getFullUrl(endpoint);
    return this.executeRequest<T>(fullUrl, {
      method: 'PUT',
      headers: this.buildHeaders(options),
      body: JSON.stringify(body || {}),
      timeoutMs: options.timeoutMs,
    });
  }

  /**
   * Centralized HTTP DELETE call helper
   */
  async delete<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const fullUrl = this.buildUrlWithParams(this.getFullUrl(endpoint), options.params);
    return this.executeRequest<T>(fullUrl, {
      method: 'DELETE',
      headers: this.buildHeaders(options),
      timeoutMs: options.timeoutMs,
    });
  }

  private buildHeaders(options: ApiRequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }
    return headers;
  }

  private buildUrlWithParams(url: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return url;
    }
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    return `${url}?${searchParams.toString()}`;
  }

  private async executeRequest<T>(
    url: string,
    init: RequestInit & { timeoutMs?: number },
  ): Promise<T> {
    const timeoutMs = init.timeoutMs || 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      this.logger.log(`[API SERVICE OUTBOUND] ${init.method} ${url}`);
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        this.logger.error(`API Request to ${url} failed with status ${response.status}: ${JSON.stringify(data)}`);
        throw new HttpException(
          data || `Upstream HTTP ${response.status} Error`,
          response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return data as T;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.logger.error(`API Request to ${url} timed out after ${timeoutMs}ms`);
        throw new HttpException('Upstream service request timeout', HttpStatus.GATEWAY_TIMEOUT);
      }
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`API Request to ${url} threw exception: ${error?.message}`);
      throw new HttpException(
        error?.message || 'Internal API communication error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
