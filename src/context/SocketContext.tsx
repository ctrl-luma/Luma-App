import React, { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import { config } from '../lib/config';
import { authService } from '../lib/api';
import { useAuth } from './AuthContext';

// Socket event types
export const SocketEvents = {
  // User/Profile events
  USER_UPDATED: 'user:updated',
  ORGANIZATION_UPDATED: 'organization:updated',
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

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) return;

    try {
      const token = await authService.getAccessToken();
      if (!token) {
        console.log('No token available for socket connection');
        return;
      }

      const socketUrl = config.apiUrl.replace('/api', '').replace('http://', 'ws://').replace('https://', 'wss://');

      socketRef.current = io(socketUrl, {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socketRef.current.on('connect', () => {
        console.log('Socket connected');
        setIsConnected(true);
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
        setIsConnected(false);
      });

      // Set up listeners for all registered events
      listenersRef.current.forEach((callbacks, event) => {
        callbacks.forEach((callback) => {
          socketRef.current?.on(event, callback);
        });
      });
    } catch (error) {
      console.error('Failed to connect socket:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
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
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated) {
        if (!socketRef.current?.connected) {
          connect();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated, connect]);

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
