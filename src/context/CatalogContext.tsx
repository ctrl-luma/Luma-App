import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Catalog, catalogsApi } from '../lib/api';
import { useAuth } from './AuthContext';
import { useSocketEvent, SocketEvents } from './SocketContext';

interface CatalogContextType {
  selectedCatalog: Catalog | null;
  catalogs: Catalog[];
  isLoading: boolean;
  setSelectedCatalog: (catalog: Catalog) => Promise<void>;
  clearCatalog: () => Promise<void>;
  refreshCatalogs: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

const CATALOG_STORAGE_KEY = 'selected_catalog';

interface CatalogProviderProps {
  children: ReactNode;
}

export function CatalogProvider({ children }: CatalogProviderProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedCatalog, setSelectedCatalogState] = useState<Catalog | null>(null);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  // Load cached catalog and stop loading immediately if we have cached data
  const loadCachedCatalogAndFinish = useCallback(async () => {
    try {
      const savedCatalogJson = await AsyncStorage.getItem(CATALOG_STORAGE_KEY);
      if (savedCatalogJson) {
        const savedCatalog = JSON.parse(savedCatalogJson) as Catalog;
        setSelectedCatalogState(savedCatalog);
        // We have cached data, stop loading immediately
        setIsLoading(false);
        return true;
      }
    } catch (error) {
      console.error('Failed to load cached catalog:', error);
    }
    return false;
  }, []);

  // Fetch catalogs from API and validate/update selection
  const fetchAndValidateCatalogs = useCallback(async (hadCachedData: boolean) => {
    try {
      const fetchedCatalogs = await catalogsApi.list();
      setCatalogs(fetchedCatalogs);

      // Get current selected catalog (might have been loaded from cache)
      const savedCatalogJson = await AsyncStorage.getItem(CATALOG_STORAGE_KEY);
      const savedCatalog = savedCatalogJson ? JSON.parse(savedCatalogJson) as Catalog : null;

      if (savedCatalog) {
        // Verify saved catalog still exists in the list
        const stillExists = fetchedCatalogs.find(c => c.id === savedCatalog.id);
        if (stillExists) {
          // Use the fresh data from API in case name/details changed
          setSelectedCatalogState(stillExists);
          await AsyncStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(stillExists));
        } else if (fetchedCatalogs.length > 0) {
          // Saved catalog no longer exists, default to first
          setSelectedCatalogState(fetchedCatalogs[0]);
          await AsyncStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(fetchedCatalogs[0]));
        } else {
          // No catalogs available, clear selection
          setSelectedCatalogState(null);
          await AsyncStorage.removeItem(CATALOG_STORAGE_KEY);
        }
      } else if (fetchedCatalogs.length > 0) {
        // No saved catalog, auto-select the first one
        setSelectedCatalogState(fetchedCatalogs[0]);
        await AsyncStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(fetchedCatalogs[0]));
      }
    } catch (error) {
      console.error('Failed to fetch catalogs:', error);
      // Keep using cached catalog if API fails
    } finally {
      // Only set loading false here if we didn't have cached data
      if (!hadCachedData) {
        setIsLoading(false);
      }
      setHasFetched(true);
    }
  }, []);

  // Load cached catalog immediately when authenticated, then validate with API
  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasFetched) {
      // First load from cache (instant), then fetch from API in background
      loadCachedCatalogAndFinish().then((hadCachedData) => {
        fetchAndValidateCatalogs(hadCachedData);
      });
    } else if (!authLoading && !isAuthenticated) {
      // Not authenticated, stop loading
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated, hasFetched, loadCachedCatalogAndFinish, fetchAndValidateCatalogs]);

  // Reset when user logs out
  useEffect(() => {
    if (!isAuthenticated && hasFetched) {
      setSelectedCatalogState(null);
      setCatalogs([]);
      setHasFetched(false);
      setIsLoading(true);
    }
  }, [isAuthenticated, hasFetched]);

  const setSelectedCatalog = useCallback(async (catalog: Catalog) => {
    setSelectedCatalogState(catalog);
    try {
      await AsyncStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
    } catch (error) {
      console.error('Failed to save catalog:', error);
    }
  }, []);

  const clearCatalog = useCallback(async () => {
    setSelectedCatalogState(null);
    try {
      await AsyncStorage.removeItem(CATALOG_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear catalog:', error);
    }
  }, []);

  const refreshCatalogs = useCallback(async () => {
    try {
      const fetchedCatalogs = await catalogsApi.list();
      setCatalogs(fetchedCatalogs);

      // Update selected catalog if it was updated
      if (selectedCatalog) {
        const updated = fetchedCatalogs.find(c => c.id === selectedCatalog.id);
        if (updated) {
          setSelectedCatalogState(updated);
          await AsyncStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(updated));
        }
      }
    } catch (error) {
      console.error('Failed to refresh catalogs:', error);
    }
  }, [selectedCatalog]);

  // Listen for socket events to refresh catalogs in real-time
  const handleCatalogUpdate = useCallback(() => {
    if (isAuthenticated) {
      refreshCatalogs();
    }
  }, [isAuthenticated, refreshCatalogs]);

  useSocketEvent(SocketEvents.CATALOG_UPDATED, handleCatalogUpdate);
  useSocketEvent(SocketEvents.CATALOG_CREATED, handleCatalogUpdate);
  useSocketEvent(SocketEvents.CATALOG_DELETED, handleCatalogUpdate);
  useSocketEvent(SocketEvents.PRODUCT_UPDATED, handleCatalogUpdate);
  useSocketEvent(SocketEvents.PRODUCT_CREATED, handleCatalogUpdate);
  useSocketEvent(SocketEvents.PRODUCT_DELETED, handleCatalogUpdate);

  return (
    <CatalogContext.Provider
      value={{
        selectedCatalog,
        catalogs,
        isLoading,
        setSelectedCatalog,
        clearCatalog,
        refreshCatalogs,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogContextType {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
}
