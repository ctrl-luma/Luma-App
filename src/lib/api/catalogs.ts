import { apiClient } from './client';

export interface Catalog {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  date: string | null;
  productCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
};
