import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { preordersApi } from '../lib/api/preorders';
import { useSocketEvent, useSocket, SocketEvents } from './SocketContext';
import { useAuth } from './AuthContext';

interface PreorderCounts {
  pending: number;
  preparing: number;
  ready: number;
  total: number;
}

interface PreordersContextType {
  counts: PreorderCounts;
  isLoading: boolean;
  refreshCounts: () => Promise<void>;
}

const PreordersContext = createContext<PreordersContextType | undefined>(undefined);

interface PreordersProviderProps {
  children: ReactNode;
}

export function PreordersProvider({ children }: PreordersProviderProps) {
  const { isAuthenticated } = useAuth();
  const { isConnected } = useSocket();
  const wasConnectedRef = useRef(isConnected);

  const [counts, setCounts] = useState<PreorderCounts>({
    pending: 0,
    preparing: 0,
    ready: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const refreshCounts = useCallback(async () => {
    if (!isAuthenticated) return;

    console.log('[PreordersContext] Fetching preorder stats...');
    try {
      const stats = await preordersApi.getStats();
      console.log('[PreordersContext] Stats received from API:', JSON.stringify(stats, null, 2));
      const newCounts = {
        pending: stats.pending,
        preparing: stats.preparing,
        ready: stats.ready,
        total: stats.pending + stats.preparing + stats.ready,
      };
      console.log('[PreordersContext] Setting counts:', JSON.stringify(newCounts, null, 2));
      setCounts(newCounts);
    } catch (error) {
      console.error('[PreordersContext] Failed to fetch stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Initial fetch when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refreshCounts();
    } else {
      setCounts({ pending: 0, preparing: 0, ready: 0, total: 0 });
      setIsLoading(false);
    }
  }, [isAuthenticated, refreshCounts]);

  // Refetch when socket reconnects
  useEffect(() => {
    if (isConnected && !wasConnectedRef.current && isAuthenticated) {
      console.log('[PreordersContext] Socket reconnected, refreshing counts...');
      refreshCounts();
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, isAuthenticated, refreshCounts]);

  // Listen for preorder events
  useSocketEvent(SocketEvents.PREORDER_CREATED, useCallback((data: any) => {
    console.log('[PreordersContext] PREORDER_CREATED event received!', JSON.stringify(data, null, 2));
    refreshCounts();
  }, [refreshCounts]));

  useSocketEvent(SocketEvents.PREORDER_UPDATED, useCallback((data: any) => {
    console.log('[PreordersContext] PREORDER_UPDATED event received!', JSON.stringify(data, null, 2));
    refreshCounts();
  }, [refreshCounts]));

  useSocketEvent(SocketEvents.PREORDER_COMPLETED, useCallback((data: any) => {
    console.log('[PreordersContext] PREORDER_COMPLETED event received!', JSON.stringify(data, null, 2));
    refreshCounts();
  }, [refreshCounts]));

  useSocketEvent(SocketEvents.PREORDER_CANCELLED, useCallback((data: any) => {
    console.log('[PreordersContext] PREORDER_CANCELLED event received!', JSON.stringify(data, null, 2));
    refreshCounts();
  }, [refreshCounts]));

  return (
    <PreordersContext.Provider value={{ counts, isLoading, refreshCounts }}>
      {children}
    </PreordersContext.Provider>
  );
}

export function usePreorders(): PreordersContextType {
  const context = useContext(PreordersContext);
  if (!context) {
    throw new Error('usePreorders must be used within a PreordersProvider');
  }
  return context;
}
