import { apiClient } from './client';

export interface PaymentMethod {
  brand: string | null;
  last4: string;
}

export interface Refund {
  id: string;
  amount: number;
  status: string;
  reason: string | null;
  created: number;
}

export interface Transaction {
  id: string;
  amount: number;
  amountRefunded: number;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded' | 'partially_refunded';
  description: string | null;
  customerName: string | null;
  customerEmail: string | null;
  paymentMethod: PaymentMethod | null;
  created: number; // Unix timestamp
  receiptUrl: string | null;
}

export interface TransactionDetail extends Transaction {
  refunds: Refund[];
}

export interface TransactionsListParams {
  limit?: number;
  starting_after?: string;
  status?: string;
  catalog_id?: string;
  device_id?: string;
}

export interface TransactionsListResponse {
  data: Transaction[];
  hasMore: boolean;
}

export interface RefundParams {
  amount?: number; // Optional for partial refund (in cents)
}

export const transactionsApi = {
  /**
   * List transactions for the organization
   * Optionally filter by device_id to show only transactions from a specific device
   */
  list: (params?: TransactionsListParams) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.starting_after) searchParams.append('starting_after', params.starting_after);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.catalog_id) searchParams.append('catalog_id', params.catalog_id);
    if (params?.device_id) searchParams.append('device_id', params.device_id);

    const query = searchParams.toString();
    return apiClient.get<TransactionsListResponse>(
      `/stripe/connect/transactions${query ? `?${query}` : ''}`
    );
  },

  /**
   * Get a single transaction with full details
   */
  get: (id: string) =>
    apiClient.get<TransactionDetail>(`/stripe/connect/transactions/${id}`),

  /**
   * Issue a refund for a transaction
   */
  refund: (id: string, params?: RefundParams) =>
    apiClient.post<{ success: boolean }>(`/stripe/connect/transactions/${id}/refund`, params || {}),
};
