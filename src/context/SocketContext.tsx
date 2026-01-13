import React, { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import { config } from '../lib/config';
import { authService } from '../lib/api';
import { useAuth } from './AuthContext';

// Callback for handling session kicked via socket
let onSocketSessionKickedCallback: ((data: any) => void) | null = null;

export function setOnSocketSessionKicked(callback: (data: any) => void) {
  onSocketSessionKickedCallback = callback;
}

// Track if we're currently refreshing tokens to avoid multiple refreshes
let isRefreshingForSocket = false;

// Socket event types
export const SocketEvents = {
  // User/Profile events
  USER_UPDATED: 'user:updated',
  ORGANIZATION_UPDATED: 'organization:updated',
  // Session events
  SESSION_KICKED: 'session:kicked', // Emitted when user logs in on another device
  // Catalog events
  CATALOG_UPDATED: 'catalog:updated',
  CATALOG_CREATED: 'catalog:created',
  CATALOG_DELETED: 'catalog:deleted',
  // Product events
  PRODUCT_UPDATED: 'product:updated',
  PRODUCT_CREATED: 'product:created',
  PRODUCT_DELETED: 'product:deleted',
  // Category events
  CATEGORY_UPDATED: 'category:updated',
  CATEGORY_CREATED: 'category:created',
  CATEGORY_DELETED: 'category:deleted',
  // Transaction events
  TRANSACTION_CREATED: 'transaction:created',
  TRANSACTION_UPDATED: 'transaction:updated',
} as const;

type SocketEventName = typeof SocketEvents[keyof typeof SocketEvents];
type EventCallback = (data: any) => void;

interface SocketContextType {
  isConnected: boolean;
  subscribe: (event: SocketEventName, callback: EventCallback) => () => void;
  emit: (event: string, data: any) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Set<EventCallback>>>(new Map());
  const [isConnected, setIsConnected] = React.useState(false);

  // Verify session is still valid (called on reconnect/app foreground)
  const verifySession = useCallback(async () => {
    try {
      console.log('[Socket] Verifying session is still valid...');
      const storedVersion = await authService.getSessionVersion();
      if (!storedVersion) {
        console.log('[Socket] No stored session version, skipping check');
        return;
      }

      // Call API to check current session version
      const { user } = await authService.getProfile();

      // If we get here, the token is still valid
      // The API interceptor will handle 401s and kick us out if needed
      console.log('[Socket] Session verified for:', user.email);
    } catch (error: any) {
      console.log('[Socket] Session verification failed:', error.message);
      // If it's a 401 or session error, trigger the kicked callback
      if (error.message?.includes('session') || error.response?.status === 401) {
        console.log('[Socket] Session invalid, triggering kick...');
        if (onSocketSessionKickedCallback) {
          onSocketSessionKickedCallback({ reason: 'Session expired or logged in elsewhere' });
        }
      }
    }
  }, []);

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) {
      console.log('[Socket] Already connected, skipping');
      return;
    }

    try {
      const token = await authService.getAccessToken();
      if (!token) {
        console.log('[Socket] No token available for socket connection');
        return;
      }

      const socketUrl = config.apiUrl.replace('/api', '').replace('http://', 'ws://').replace('https://', 'wss://');
      console.log('[Socket] Connecting to:', socketUrl);
      console.log('[Socket] Using token:', token.substring(0, 20) + '...');

      socketRef.current = io(socketUrl, {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socketRef.current.on('connect', () => {
        console.log('[Socket] Connected successfully:', socketRef.current?.id);
        setIsConnected(true);
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
        setIsConnected(false);
      });

      // Listen for session kicked event (user logged in on another device)
      socketRef.current.on(SocketEvents.SESSION_KICKED, (data: any) => {
        console.log('[Socket] Received SESSION_KICKED event:', data);
        if (onSocketSessionKickedCallback) {
          onSocketSessionKickedCallback(data);
        }
      });

      // Log reconnection attempts
      socketRef.current.io.on('reconnect_attempt', (attempt) => {
        console.log(`[Socket] Reconnection attempt ${attempt}...`);
      });

      socketRef.current.io.on('reconnect', async (attempt) => {
        console.log(`[Socket] Reconnected after ${attempt} attempts`);
        // Verify session is still valid after reconnect
        await verifySession();
      });

      socketRef.current.io.on('reconnect_error', (error) => {
        console.error('[Socket] Reconnection error:', error.message);
      });

      socketRef.current.io.on('reconnect_failed', () => {
        console.error('[Socket] Reconnection failed after all attempts');
      });

      socketRef.current.on('connect_error', async (error) => {
        console.error('[Socket] Connection error:', error.message);
        setIsConnected(false);

        // If the error is "Invalid token", try to refresh and reconnect
        if (error.message === 'Invalid token' && !isRefreshingForSocket) {
          console.log('[Socket] Invalid token error - attempting token refresh...');
          isRefreshingForSocket = true;

          try {
            const newTokens = await authService.refreshTokens();
            if (newTokens) {
              console.log('[Socket] Token refreshed successfully, reconnecting...');
              // Disconnect current socket and reconnect with new token
              socketRef.current?.disconnect();
              socketRef.current = null;
              isRefreshingForSocket = false;
              // Reconnect will happen with fresh token
              connect();
            } else {
              console.log('[Socket] Token refresh returned null - user may need to re-login');
              isRefreshingForSocket = false;
            }
          } catch (refreshError) {
            console.error('[Socket] Token refresh failed:', refreshError);
            isRefreshingForSocket = false;
            // Token refresh failed - user will be logged out by authService
          }
        }
      });

      // Set up listeners for all registered events
      listenersRef.current.forEach((callbacks, event) => {
        callbacks.forEach((callback) => {
          socketRef.current?.on(event, callback);
        });
      });
    } catch (error) {
      console.error('[Socket] Failed to connect socket:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[Socket] Disconnecting socket');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Connect/disconnect based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, connect, disconnect]);

  // Handle app state changes (reconnect when app comes to foreground)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log('[Socket] App state changed to:', nextAppState);
      if (nextAppState === 'active' && isAuthenticated) {
        // Always verify session when coming back to foreground
        await verifySession();

        if (!socketRef.current?.connected) {
          console.log('[Socket] App became active, reconnecting...');
          connect();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated, connect, verifySession]);

  const subscribe = useCallback((event: SocketEventName, callback: EventCallback) => {
    // Add to listeners map
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);

    // If socket is connected, add listener immediately
    if (socketRef.current?.connected) {
      socketRef.current.on(event, callback);
    }

    // Return unsubscribe function
    return () => {
      listenersRef.current.get(event)?.delete(callback);
      socketRef.current?.off(event, callback);
    };
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return (
    <SocketContext.Provider value={{ isConnected, subscribe, emit }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextType {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

// Hook to subscribe to socket events with automatic cleanup
export function useSocketEvent(event: SocketEventName, callback: EventCallback) {
  const { subscribe } = useSocket();

  useEffect(() => {
    const unsubscribe = subscribe(event, callback);
    return unsubscribe;
  }, [event, callback, subscribe]);
}
