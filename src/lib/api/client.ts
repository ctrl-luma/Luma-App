import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config';

export type ApiError = {
  error: string;
  statusCode?: number;
  details?: any;
};

interface RequestQueueItem {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  request: () => Promise<any>;
}

class ApiClient {
  private baseURL: string;
  private defaultHeaders: HeadersInit;
  private refreshPromise: Promise<any> | null = null;
  private requestQueue: RequestQueueItem[] = [];
  private isRefreshing = false;

  constructor() {
    this.baseURL = config.apiUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private async getAuthToken(): Promise<string | null> {
    return AsyncStorage.getItem('accessToken');
  }

  private async processRequestQueue() {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    for (const queueItem of queue) {
      try {
        const result = await queueItem.request();
        queueItem.resolve(result);
      } catch (error) {
        queueItem.reject(error);
      }
    }
  }

  private async handleTokenRefresh(): Promise<boolean> {
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push({
          resolve: () => resolve(true),
          reject,
          request: async () => true
        });
      });
    }

    this.isRefreshing = true;

    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        try {
          // Dynamic import to avoid circular dependency
          const { authService } = await import('./auth');
          const refreshToken = await AsyncStorage.getItem('refreshToken');

          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          const tokens = await authService.refreshTokens();

          if (tokens) {
            this.isRefreshing = false;
            this.refreshPromise = null;
            this.processRequestQueue();
            return true;
          } else {
            throw new Error('Failed to refresh tokens');
          }
        } catch (error) {
          this.isRefreshing = false;
          this.refreshPromise = null;
          this.requestQueue = [];
          throw error;
        }
      })();
    }

    return this.refreshPromise;
  }

  private async handleResponse<T>(
    response: Response,
    endpoint: string,
    retryCount: number = 0,
    method?: string,
    data?: any,
    options?: RequestInit
  ): Promise<T> {
    if (!response.ok) {
      const error: ApiError = {
        error: 'Request failed',
        statusCode: response.status,
      };

      try {
        const data = await response.json();
        error.error = data.error || data.message || 'Request failed';
        error.details = data;
      } catch {
        error.error = `Request failed with status ${response.status}`;
      }

      // Don't attempt refresh for auth endpoints
      const authEndpoints = ['/auth/login', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];
      const isAuthEndpoint = authEndpoints.some(auth => endpoint.includes(auth));

      // If we get a 401 and haven't retried yet, try to refresh the token
      if (response.status === 401 && retryCount === 0 && !isAuthEndpoint) {
        try {
          const refreshed = await this.handleTokenRefresh();
          if (refreshed) {
            // Retry the original request with same method and data
            return this.retryRequest<T>(endpoint, retryCount + 1, method, data, options);
          }
        } catch (refreshError) {
          // Refresh failed, throw the original error
        }
      }

      throw error;
    }

    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  }

  private async retryRequest<T>(
    endpoint: string,
    retryCount: number,
    method: string = 'GET',
    data?: any,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      method,
      headers: await this.getHeaders(options?.headers),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response, endpoint, retryCount, method, data, options);
  }

  private async getHeaders(customHeaders?: HeadersInit): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      ...this.defaultHeaders as Record<string, string>,
      ...customHeaders as Record<string, string>,
    };

    const token = await this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async makeRequest<T>(method: string, endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    if (this.isRefreshing && endpoint !== '/auth/refresh') {
      return new Promise((resolve, reject) => {
        this.requestQueue.push({
          resolve,
          reject,
          request: () => this.makeRequest(method, endpoint, data, options)
        });
      });
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      method,
      headers: await this.getHeaders(options?.headers),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response, endpoint, 0, method, data, options);
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.makeRequest<T>('GET', endpoint, undefined, options);
  }

  async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.makeRequest<T>('POST', endpoint, data, options);
  }

  async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.makeRequest<T>('PUT', endpoint, data, options);
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.makeRequest<T>('DELETE', endpoint, undefined, options);
  }

  async patch<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.makeRequest<T>('PATCH', endpoint, data, options);
  }
}

export const apiClient = new ApiClient();
