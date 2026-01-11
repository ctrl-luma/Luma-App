import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { authService, User, Organization, stripeConnectApi, ConnectStatus } from '../lib/api';
import { setOnSessionKicked } from '../lib/api/client';
import { setOnSocketSessionKicked } from './SocketContext';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  connectStatus: ConnectStatus | null;
  isPaymentReady: boolean;
  connectLoading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  refreshConnectStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    organization: null,
    isLoading: true,
    isAuthenticated: false,
    connectStatus: null,
    isPaymentReady: false,
    connectLoading: true,
  });

  // Track if we're already showing a session kicked alert
  const sessionKickedAlertShown = useRef(false);

  // Handle session kicked (user logged in on another device)
  const handleSessionKicked = useCallback(async () => {
    // Prevent showing multiple alerts
    if (sessionKickedAlertShown.current) {
      return;
    }
    sessionKickedAlertShown.current = true;

    console.log('[AuthContext] Session kicked - signing out user');

    // Clear auth data immediately
    try {
      await authService.logout();
    } catch (error) {
      console.error('[AuthContext] Error during session kicked logout:', error);
    }

    // Update state
    setState({
      user: null,
      organization: null,
      isLoading: false,
      isAuthenticated: false,
      connectStatus: null,
      isPaymentReady: false,
      connectLoading: false,
    });

    // Show alert to user
    Alert.alert(
      'Session Ended',
      'You have been signed out because your account was signed in on another device.',
      [{ text: 'OK', onPress: () => { sessionKickedAlertShown.current = false; } }]
    );
  }, []);

  // Set up the session kicked callbacks for both API client and socket
  useEffect(() => {
    setOnSessionKicked(handleSessionKicked);
    setOnSocketSessionKicked(handleSessionKicked);
  }, [handleSessionKicked]);

  // Load cached user/org and stop loading immediately if we have cached data
  const loadCachedAuth = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[AuthContext] loadCachedAuth: checking authentication...');
      const isAuthenticated = await authService.isAuthenticated();
      console.log('[AuthContext] loadCachedAuth: isAuthenticated =', isAuthenticated);

      if (!isAuthenticated) {
        console.log('[AuthContext] loadCachedAuth: no token, setting isLoading=false');
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      // Try to get cached user/org
      const user = await authService.getUser();
      const organization = await authService.getOrganization();
      console.log('[AuthContext] loadCachedAuth: cached user =', user?.email, ', org =', organization?.name);

      if (user && organization) {
        // We have cached data, show it immediately
        console.log('[AuthContext] loadCachedAuth: using cached data');
        setState(prev => ({
          ...prev,
          user,
          organization,
          isLoading: false,
          isAuthenticated: true,
        }));
        return true;
      }

      // Token exists but no cached data - keep isLoading true, refreshProfileFromAPI will handle it
      console.log('[AuthContext] loadCachedAuth: token exists but no cached data');
      return false;
    } catch (error) {
      console.error('[AuthContext] loadCachedAuth: error', error);
      setState(prev => ({ ...prev, isLoading: false }));
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
        setState(prev => ({
          ...prev,
          user: profile.user,
          organization: profile.organization,
          isLoading: false,
          isAuthenticated: true,
        }));
      } catch (error: any) {
        console.error('Failed to fetch profile:', error);
        // If it's a 401, the API client already tried to refresh and failed
        // In that case, or any auth error, log the user out
        if (error?.statusCode === 401) {
          await authService.logout();
          setState({
            user: null,
            organization: null,
            isLoading: false,
            isAuthenticated: false,
            connectStatus: null,
            isPaymentReady: false,
            connectLoading: false,
          });
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

    setState(prev => ({
      ...prev,
      user: response.user,
      organization: response.organization,
      isLoading: false,
      isAuthenticated: true,
      connectLoading: true, // Reset to loading state for connect status
    }));
  };

  const signOut = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with local logout even if API fails
    }
    setState({
      user: null,
      organization: null,
      isLoading: false,
      isAuthenticated: false,
      connectStatus: null,
      isPaymentReady: false,
      connectLoading: false,
    });
  };

  const refreshAuth = async () => {
    await refreshProfileFromAPI(true);
  };

  // Fetch Stripe Connect status
  const refreshConnectStatus = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, connectLoading: true }));
      const status = await stripeConnectApi.getStatus();
      const isReady = status.chargesEnabled && status.payoutsEnabled;
      setState(prev => ({
        ...prev,
        connectStatus: status,
        isPaymentReady: isReady,
        connectLoading: false,
      }));
    } catch (error) {
      console.error('Failed to fetch Connect status:', error);
      setState(prev => ({
        ...prev,
        connectStatus: null,
        isPaymentReady: false,
        connectLoading: false,
      }));
    }
  }, []);

  // Fetch Connect status when authenticated
  useEffect(() => {
    if (state.isAuthenticated && !state.isLoading) {
      refreshConnectStatus();
    }
  }, [state.isAuthenticated, state.isLoading, refreshConnectStatus]);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, refreshAuth, refreshConnectStatus }}>
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
