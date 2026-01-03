import { apiClient } from './client';

export interface Customer {
  id: string;
  email: string;
  name: string | null;
}

export interface CustomerSearchResult {
  customers: Customer[];
}

export const customersApi = {
  /**
   * Search customers by email (for autocomplete)
   */
  search: (query: string, limit = 10) =>
    apiClient.get<CustomerSearchResult>(`/customers/search?q=${encodeURIComponent(query)}&limit=${limit}`),

  /**
   * Create or update a customer
   */
  upsert: (data: { email: string; name?: string; phone?: string }) =>
    apiClient.post<Customer & { isNew: boolean }>('/customers', data),

  /**
   * Record an order for a customer (updates stats)
   */
  recordOrder: (customerId: string, orderTotal: number) =>
    apiClient.post<{ success: boolean }>(`/customers/${customerId}/record-order`, { orderTotal }),
};
