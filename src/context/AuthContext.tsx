import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, User, Organization } from '../lib/api';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    organization: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const loadStoredAuth = useCallback(async () => {
    try {
      const isAuthenticated = await authService.isAuthenticated();

      if (isAuthenticated) {
        // Try to get cached user/org first
        let user = await authService.getUser();
        let organization = await authService.getOrganization();

        // If we have tokens but no cached data, fetch from API
        if (!user || !organization) {
          try {
            const profile = await authService.getProfile();
            user = profile.user;
            organization = profile.organization;

            // Cache the data
            await authService.saveUser(user);
            await authService.saveOrganization(organization);
          } catch (error) {
            // Token might be expired, try refresh
            try {
              await authService.refreshTokens();
              const profile = await authService.getProfile();
              user = profile.user;
              organization = profile.organization;

              await authService.saveUser(user);
              await authService.saveOrganization(organization);
            } catch (refreshError) {
              // Refresh failed, user needs to login again
              await authService.logout();
              setState({ user: null, organization: null, isLoading: false, isAuthenticated: false });
              return;
            }
          }
        }

        setState({
          user,
          organization,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to load auth:', error);
      setState({ user: null, organization: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  const signIn = async (email: string, password: string) => {
    const response = await authService.login({ email, password });

    setState({
      user: response.user,
      organization: response.organization,
      isLoading: false,
      isAuthenticated: true,
    });
  };

  const signOut = async () => {
    await authService.logout();
    setState({ user: null, organization: null, isLoading: false, isAuthenticated: false });
  };

  const refreshAuth = async () => {
    await loadStoredAuth();
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
