import React, { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import { config } from '../lib/config';
import { authService } from '../lib/api';
import { triggerSessionKicked } from '../lib/session-callbacks';
import { useAuth } from './AuthContext';
import logger from '../lib/logger';

// Socket event types
export const SocketEvents = {
  // User/Profile events
  USER_UPDATED: 'user:updated',
  ORGANIZATION_UPDATED: 'organization:updated',
  // Session events
  SESSION_KICKED: 'session:kicked', // Emitted when user logs in on another device
  // Subscription events
  SUBSCRIPTION_UPDATED: 'subscription:updated',
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
  // Order events (from webhook handlers)
  ORDER_COMPLETED: 'order:completed',
  ORDER_FAILED: 'order:failed',
  PAYMENT_RECEIVED: 'payment:received',
  ORDER_REFUNDED: 'order:refunded',
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
  const isRefreshingRef = useRef(false);
  const [isConnected, setIsConnected] = React.useState(false);

  // Verify session is still valid (called on reconnect/app foreground)
  const verifySession = useCallback(async () => {
    try {
      logger.log('[Socket] Verifying session is still valid...');
      const storedVersion = await authService.getSessionVersion();
      if (!storedVersion) {
        logger.log('[Socket] No stored session version, skipping check');
        return;
      }

      // Call API to check current session version
      const { user } = await authService.getProfile();

      // If we get here, the token is still valid
      // The API interceptor will handle 401s and kick us out if needed
      logger.log('[Socket] Session verified for:', user.email);
    } catch (error: any) {
      logger.log('[Socket] Session verification failed:', error.message);
      // If it's a 401 or session error, trigger the kicked callback
      if (error.message?.includes('session') || error.response?.status === 401) {
        logger.log('[Socket] Session invalid, triggering kick...');
        if (triggerSessionKicked) {
          triggerSessionKicked({ reason: 'Session expired or logged in elsewhere' });
        }
      }
    }
  }, []);

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) {
      logger.log('[Socket] Already connected, skipping');
      return;
    }

    // Clean up existing socket if it exists but isn't connected
    // This prevents duplicate sockets when reconnecting
    if (socketRef.current) {
      logger.log('[Socket] Cleaning up existing disconnected socket');
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    try {
      const token = await authService.getAccessToken();
      if (!token) {
        logger.log('[Socket] No token available for socket connection');
        return;
      }

      const socketUrl = config.apiUrl.replace('/api', '').replace('http://', 'ws://').replace('https://', 'wss://');
      logger.log('[Socket] Connecting to:', socketUrl);
      logger.log('[Socket] Using token:', token.substring(0, 20) + '...');

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
        logger.log('[Socket] Connected successfully:', socketRef.current?.id);
        setIsConnected(true);
      });

      socketRef.current.on('disconnect', (reason) => {
        logger.log('[Socket] Disconnected:', reason);
        setIsConnected(false);
      });

      // Listen for session kicked event (user logged in on another device)
      socketRef.current.on(SocketEvents.SESSION_KICKED, (data: any) => {
        logger.log('[Socket] Received SESSION_KICKED event:', data);
        if (triggerSessionKicked) {
          triggerSessionKicked(data);
        }
      });

      // Log reconnection attempts
      socketRef.current.io.on('reconnect_attempt', (attempt) => {
        logger.log(`[Socket] Reconnection attempt ${attempt}...`);
      });

      socketRef.current.io.on('reconnect', async (attempt) => {
        logger.log(`[Socket] Reconnected after ${attempt} attempts`);
        // Verify session is still valid after reconnect
        await verifySession();
      });

      socketRef.current.io.on('reconnect_error', (error) => {
        logger.error('[Socket] Reconnection error:', error.message);
      });

      socketRef.current.io.on('reconnect_failed', () => {
        logger.error('[Socket] Reconnection failed after all attempts');
      });

      socketRef.current.on('connect_error', async (error) => {
        logger.error('[Socket] Connection error:', error.message);
        setIsConnected(false);

        // If the error is "Invalid token", wait for ApiClient to refresh then reconnect
        // The ApiClient handles token refresh centrally - we just need to retry connection
        if (error.message === 'Invalid token' && !isRefreshingRef.current) {
          logger.log('[Socket] Invalid token error - waiting for token refresh...');
          isRefreshingRef.current = true;

          // Wait for ApiClient's token refresh to complete, then reconnect
          setTimeout(async () => {
            try {
              let token = await authService.getAccessToken();

              // If no token after waiting, try refreshing ourselves as fallback
              if (!token) {
                logger.log('[Socket] No token found, attempting fallback refresh...');
                const newTokens = await authService.refreshTokens();
                if (newTokens) {
                  token = await authService.getAccessToken();
                }
              }

              if (token) {
                logger.log('[Socket] Got fresh token, reconnecting...');
                socketRef.current?.disconnect();
                socketRef.current = null;
                isRefreshingRef.current = false;
                connect();
              } else {
                logger.log('[Socket] No token available - user may need to re-login');
                isRefreshingRef.current = false;
              }
            } catch (err) {
              logger.error('[Socket] Error getting token:', err);
              isRefreshingRef.current = false;
            }
          }, 3000); // Wait 3 seconds for ApiClient to complete refresh
        }
      });

      // Set up listeners for all registered events
      listenersRef.current.forEach((callbacks, event) => {
        callbacks.forEach((callback) => {
          socketRef.current?.on(event, callback);
        });
      });
    } catch (error) {
      logger.error('[Socket] Failed to connect socket:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      logger.log('[Socket] Disconnecting socket');
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
    // Clear all registered listeners when disconnecting
    listenersRef.current.clear();
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
      logger.log('[Socket] App state changed to:', nextAppState);
      if (nextAppState === 'active' && isAuthenticated) {
        // Always verify session when coming back to foreground
        await verifySession();

        if (!socketRef.current?.connected) {
          logger.log('[Socket] App became active, reconnecting...');
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
