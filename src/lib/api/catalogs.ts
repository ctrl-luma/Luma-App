import { apiClient } from './client';

export type CatalogLayoutType = 'grid' | 'list' | 'large-grid' | 'compact';

export interface Catalog {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  date: string | null;
  productCount: number;
  isActive: boolean;
  showTipScreen: boolean;
  promptForEmail: boolean;
  tipPercentages: number[];
  allowCustomTip: boolean;
  taxRate: number;
  layoutType: CatalogLayoutType;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCatalogData {
  name?: string;
  description?: string | null;
  location?: string | null;
  date?: string | null;
  isActive?: boolean;
  showTipScreen?: boolean;
  promptForEmail?: boolean;
  tipPercentages?: number[];
  allowCustomTip?: boolean;
  layoutType?: CatalogLayoutType;
}

export const catalogsApi = {
  /**
   * List all catalogs for the organization
   */
  list: () => apiClient.get<Catalog[]>('/catalogs'),

  /**
   * Get a single catalog by ID
   */
  get: (id: string) => apiClient.get<Catalog>(`/catalogs/${id}`),

  /**
   * Update a catalog
   */
  update: (id: string, data: UpdateCatalogData) => apiClient.put<Catalog>(`/catalogs/${id}`, data),
};
