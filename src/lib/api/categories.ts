import { apiClient } from './client';

export interface Category {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export const categoriesApi = {
  /**
   * List all categories for the organization
   */
  list: () => apiClient.get<Category[]>('/categories'),

  /**
   * Get a single category by ID
   */
  get: (id: string) => apiClient.get<Category>(`/categories/${id}`),
};
