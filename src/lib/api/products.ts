import { apiClient } from './client';

// Backend response structure (CatalogProduct)
export interface CatalogProduct {
  id: string; // catalog_product id
  catalogId: string;
  productId: string;
  categoryId: string | null;
  price: number; // In cents
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    description: string | null;
    imageId: string | null;
    imageUrl: string | null;
    createdAt: string;
    updatedAt: string;
  };
  category: {
    id: string;
    name: string;
  } | null;
}

// Flattened product structure for convenience
export interface Product {
  id: string; // catalog_product id
  productId: string; // actual product id
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

// Helper to flatten CatalogProduct to Product
export function flattenCatalogProduct(cp: CatalogProduct): Product {
  return {
    id: cp.id,
    productId: cp.productId,
    catalogId: cp.catalogId,
    name: cp.product.name,
    description: cp.product.description,
    price: cp.price,
    imageId: cp.product.imageId,
    imageUrl: cp.product.imageUrl,
    categoryId: cp.categoryId,
    categoryName: cp.category?.name || null,
    isActive: cp.isActive,
    sortOrder: cp.sortOrder,
    createdAt: cp.createdAt,
    updatedAt: cp.updatedAt,
  };
}

export const productsApi = {
  /**
   * List all products in a catalog (returns flattened structure)
   */
  list: async (catalogId: string): Promise<Product[]> => {
    const catalogProducts = await apiClient.get<CatalogProduct[]>(`/catalogs/${catalogId}/products`);
    return catalogProducts.map(flattenCatalogProduct);
  },

  /**
   * Get a single product by ID (returns flattened structure)
   */
  get: async (catalogId: string, catalogProductId: string): Promise<Product> => {
    const catalogProduct = await apiClient.get<CatalogProduct>(`/catalogs/${catalogId}/products/${catalogProductId}`);
    return flattenCatalogProduct(catalogProduct);
  },
};
