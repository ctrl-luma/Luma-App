import { apiClient } from './client';

// Note: layoutType is now on Catalog, not Category (per-catalog layout)

export interface Category {
  id: string;
  catalogId: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export const categoriesApi = {
  /**
   * List all categories for a specific catalog
   */
  list: (catalogId: string) => apiClient.get<Category[]>(`/catalogs/${catalogId}/categories`),

  /**
   * Get a single category by ID
   */
  get: (catalogId: string, id: string) => apiClient.get<Category>(`/catalogs/${catalogId}/categories/${id}`),
};
