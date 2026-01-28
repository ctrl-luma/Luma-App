import { useEffect, useRef } from 'react';
import { Image } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { useDevice } from '../context/DeviceContext';
import { productsApi, categoriesApi, transactionsApi } from '../lib/api';
import { billingService } from '../lib/api/billing';
import logger from '../lib/logger';

/**
 * Prefetches data for Settings, Menu, and Transactions screens on app load.
 * Runs once — subsequent updates come via Socket.IO query invalidation.
 */
export function DataPrefetcher() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedCatalog } = useCatalog();
  const { deviceId } = useDevice();
  const hasPrefetched = useRef(false);

  useEffect(() => {
    if (hasPrefetched.current) return;
    if (!selectedCatalog?.id || !deviceId) return;

    hasPrefetched.current = true;
    logger.log('[DataPrefetcher] Prefetching data');

    // Settings: prefetch avatar image
    if (user?.avatarUrl) {
      Image.prefetch(user.avatarUrl).catch(() => {});
    }

    // Settings: subscription info
    queryClient.prefetchQuery({
      queryKey: ['subscription-info'],
      queryFn: () => billingService.getSubscriptionInfo(),
    });

    // Menu: products and categories
    queryClient.prefetchQuery({
      queryKey: ['products', selectedCatalog.id],
      queryFn: () => productsApi.list(selectedCatalog.id),
    });

    queryClient.prefetchQuery({
      queryKey: ['categories', selectedCatalog.id],
      queryFn: () => categoriesApi.list(selectedCatalog.id),
    });

    // Transactions: first page
    queryClient.prefetchInfiniteQuery({
      queryKey: ['transactions', selectedCatalog.id, deviceId],
      queryFn: () =>
        transactionsApi.list({
          limit: 25,
          catalog_id: selectedCatalog.id,
          device_id: deviceId,
        }),
      initialPageParam: undefined as string | undefined,
    });
  }, [selectedCatalog?.id, deviceId, queryClient]);

  return null;
}
