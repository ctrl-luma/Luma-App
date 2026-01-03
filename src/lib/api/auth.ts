import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './client';
import { organizationsService } from './organizations';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  organizationId: string;
  role: string;
  cognitoUsername?: string;
  emailAlerts?: boolean;
  marketingEmails?: boolean;
  weeklyReports?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  settings?: {
    tips?: {
      enabled: boolean;
      percentages: number[];
      allowCustom: boolean;
    };
    receipts?: {
      autoEmailReceipt: boolean;
      promptForEmail: boolean;
    };
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  organization: Organization;
  tokens: AuthTokens;
}

class AuthService {
  private static readonly ACCESS_TOKEN_KEY = 'accessToken';
  private static readonly REFRESH_TOKEN_KEY = 'refreshToken';
  private static readonly USER_KEY = 'user';
  private static readonly ORGANIZATION_KEY = 'organization';

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);

    // Extract Cognito username from the access token
    if (response.tokens.accessToken) {
      try {
        const tokenParts = response.tokens.accessToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          const cognitoUsername = payload['cognito:username'] || payload.username;
          if (cognitoUsername) {
            response.user.cognitoUsername = cognitoUsername;
          }
        }
      } catch (error) {
        // Ignore token parsing errors
      }
    }

    await this.saveAuthData(response);

    return response;
  }

  async logout(): Promise<void> {
    const refreshToken = await this.getRefreshToken();

    // Clear auth data immediately for instant logout
    await this.clearAuthData();

    // If we have a refresh token, try to invalidate it on the server
    if (refreshToken) {
      try {
        await apiClient.post('/auth/logout', { refreshToken });
      } catch (error) {
        // Silently handle error - user is already logged out locally
      }
    }
  }

  async refreshTokens(): Promise<AuthTokens | null> {
    const refreshToken = await this.getRefreshToken();
    const accessToken = await this.getAccessToken();

    if (!refreshToken) {
      return null;
    }

    let cognitoUsername: string | undefined;

    // First try to get stored Cognito username from user object
    const user = await this.getUser();
    if (user?.cognitoUsername) {
      cognitoUsername = user.cognitoUsername;
    } else if (accessToken) {
      // Try to extract Cognito username from the access token
      try {
        const tokenParts = accessToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          cognitoUsername = payload['cognito:username'] || payload.username || payload.email;
        }
      } catch (error) {
        // Ignore token parsing errors
      }
    }

    try {
      const tokens = await apiClient.post<AuthTokens>('/auth/refresh', {
        refreshToken,
        username: cognitoUsername,
      });

      await this.saveTokens(tokens);

      return tokens;
    } catch (error: any) {
      await this.clearAuthData();
      throw error;
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/reset-password', {
      token,
      password: newPassword,
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  }

  async getProfile(): Promise<{ user: User; organization: Organization }> {
    // Fetch user data from /auth/me
    const user = await apiClient.get<User>('/auth/me');

    // Fetch organization data using user's organizationId
    const organization = await organizationsService.getById(user.organizationId);

    return { user, organization };
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }

  async getAccessToken(): Promise<string | null> {
    return AsyncStorage.getItem(AuthService.ACCESS_TOKEN_KEY);
  }

  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(AuthService.REFRESH_TOKEN_KEY);
  }

  async getUser(): Promise<User | null> {
    const userStr = await AsyncStorage.getItem(AuthService.USER_KEY);
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  async getOrganization(): Promise<Organization | null> {
    const orgStr = await AsyncStorage.getItem(AuthService.ORGANIZATION_KEY);
    if (!orgStr) return null;

    try {
      return JSON.parse(orgStr);
    } catch {
      return null;
    }
  }

  async saveUser(user: User): Promise<void> {
    await AsyncStorage.setItem(AuthService.USER_KEY, JSON.stringify(user));
  }

  async saveOrganization(organization: Organization): Promise<void> {
    await AsyncStorage.setItem(AuthService.ORGANIZATION_KEY, JSON.stringify(organization));
  }

  private async saveAuthData(response: LoginResponse): Promise<void> {
    await Promise.all([
      this.saveTokens(response.tokens),
      this.saveUser(response.user),
      this.saveOrganization(response.organization),
    ]);
  }

  private async saveTokens(tokens: AuthTokens): Promise<void> {
    await Promise.all([
      AsyncStorage.setItem(AuthService.ACCESS_TOKEN_KEY, tokens.accessToken),
      AsyncStorage.setItem(AuthService.REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
  }

  private async clearAuthData(): Promise<void> {
    await AsyncStorage.multiRemove([
      AuthService.ACCESS_TOKEN_KEY,
      AuthService.REFRESH_TOKEN_KEY,
      AuthService.USER_KEY,
      AuthService.ORGANIZATION_KEY,
    ]);
  }
}

export const authService = new AuthService();
