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

  // Load cached user/org and stop loading immediately if we have cached data
  const loadCachedAuth = useCallback(async (): Promise<boolean> => {
    try {
      const isAuthenticated = await authService.isAuthenticated();

      if (!isAuthenticated) {
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      // Try to get cached user/org
      const user = await authService.getUser();
      const organization = await authService.getOrganization();

      if (user && organization) {
        // We have cached data, show it immediately
        setState({
          user,
          organization,
          isLoading: false,
          isAuthenticated: true,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to load cached auth:', error);
      return false;
    }
  }, []);

  // Fetch fresh profile data from API and update cache
  const refreshProfileFromAPI = useCallback(async (hadCachedData: boolean) => {
    try {
      const isAuthenticated = await authService.isAuthenticated();

      if (!isAuthenticated) {
        if (!hadCachedData) {
          setState(prev => ({ ...prev, isLoading: false }));
        }
        return;
      }

      try {
        const profile = await authService.getProfile();

        // Cache the fresh data
        await authService.saveUser(profile.user);
        await authService.saveOrganization(profile.organization);

        // Update state with fresh data
        setState({
          user: profile.user,
          organization: profile.organization,
          isLoading: false,
          isAuthenticated: true,
        });
      } catch (error: any) {
        console.error('Failed to fetch profile:', error);
        // If it's a 401, the API client already tried to refresh and failed
        // In that case, or any auth error, log the user out
        if (error?.statusCode === 401) {
          await authService.logout();
          setState({ user: null, organization: null, isLoading: false, isAuthenticated: false });
        } else {
          // For other errors (network, 404, 500, etc.), keep the user logged in with cached data
          // Just stop loading if we didn't have cached data
          if (!hadCachedData) {
            setState(prev => ({ ...prev, isLoading: false }));
          }
        }
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      // If we didn't have cached data, stop loading
      if (!hadCachedData) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, []);

  useEffect(() => {
    // Load cached data first (instant), then refresh from API in background
    loadCachedAuth().then((hadCachedData) => {
      refreshProfileFromAPI(hadCachedData);
    });
  }, [loadCachedAuth, refreshProfileFromAPI]);

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
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with local logout even if API fails
    }
    setState({ user: null, organization: null, isLoading: false, isAuthenticated: false });
  };

  const refreshAuth = async () => {
    await refreshProfileFromAPI(true);
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
