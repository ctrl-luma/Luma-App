import { apiClient } from './client';

export interface Product {
  id: string;
  catalogId: string;
  name: string;
  description: string | null;
  price: number; // In cents
  imageId: string | null;
  imageUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const productsApi = {
  /**
   * List all products in a catalog
   */
  list: (catalogId: string) =>
    apiClient.get<Product[]>(`/catalogs/${catalogId}/products`),

  /**
   * Get a single product by ID
   */
  get: (catalogId: string, productId: string) =>
    apiClient.get<Product>(`/catalogs/${catalogId}/products/${productId}`),
};
