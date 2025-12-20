import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Catalog, catalogsApi } from '../lib/api';
import { useAuth } from './AuthContext';

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

  // Fetch catalogs and auto-select first one if no saved selection
  const loadCatalogsAndSelection = useCallback(async () => {
    try {
      // Load saved catalog from storage
      const savedCatalogJson = await AsyncStorage.getItem(CATALOG_STORAGE_KEY);
      const savedCatalog = savedCatalogJson ? JSON.parse(savedCatalogJson) as Catalog : null;

      // Fetch available catalogs from API
      const fetchedCatalogs = await catalogsApi.list();
      setCatalogs(fetchedCatalogs);

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
        }
      } else if (fetchedCatalogs.length > 0) {
        // No saved catalog, auto-select the first one
        setSelectedCatalogState(fetchedCatalogs[0]);
        await AsyncStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(fetchedCatalogs[0]));
      }
    } catch (error) {
      console.error('Failed to load catalogs:', error);
      // Try to use saved catalog even if API fails
      try {
        const savedCatalogJson = await AsyncStorage.getItem(CATALOG_STORAGE_KEY);
        if (savedCatalogJson) {
          setSelectedCatalogState(JSON.parse(savedCatalogJson));
        }
      } catch (storageError) {
        console.error('Failed to load saved catalog:', storageError);
      }
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, []);

  // Only fetch catalogs when authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasFetched) {
      loadCatalogsAndSelection();
    } else if (!authLoading && !isAuthenticated) {
      // Not authenticated, stop loading
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated, hasFetched, loadCatalogsAndSelection]);

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
    } catch (error) {
      console.error('Failed to refresh catalogs:', error);
    }
  }, []);

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
