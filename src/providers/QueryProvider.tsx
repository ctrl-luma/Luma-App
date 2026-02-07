import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState, AppStateStatus } from 'react-native';
import { focusManager } from '@tanstack/react-query';

// Refetch on app focus (when user returns to the app)
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    handleFocus(state === 'active');
  });

  return () => {
    subscription.remove();
  };
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Socket.IO events handle real-time invalidation, so data stays fresh
            // until explicitly invalidated. Only refetch on reconnect as a safety net.
            staleTime: Infinity,
            // Cache persists for 30 minutes
            gcTime: 30 * 60 * 1000,
            // Skip auto-refetch on focus — sockets keep data current
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            // Refetch on reconnect as safety net (catches anything missed while offline)
            refetchOnReconnect: true,
            // Retry failed requests once
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
