import { apiClient } from './client';

export interface OrderItem {
  productId: string;
  catalogProductId?: string;
  categoryId?: string;
  name: string;
  quantity: number;
  unitPrice: number; // in cents
}

export interface Order {
  id: string;
  orderNumber: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'card' | 'cash' | 'tap_to_pay' | null;
  subtotal: number; // in cents
  taxAmount: number;
  tipAmount: number;
  totalAmount: number;
  stripePaymentIntentId: string | null;
  customerEmail: string | null;
  customerId: string | null;
  catalogId: string | null;
  items?: Array<{
    id: string;
    productId: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderParams {
  catalogId?: string;
  items?: OrderItem[];
  subtotal: number; // in cents
  taxAmount?: number;
  tipAmount?: number;
  totalAmount: number; // in cents
  paymentMethod?: 'card' | 'cash' | 'tap_to_pay';
  customerEmail?: string;
  stripePaymentIntentId?: string;
  isQuickCharge?: boolean;
  description?: string;
}

export interface OrdersListResponse {
  orders: Order[];
  total: number;
}

export const ordersApi = {
  /**
   * Create a new order
   * Call this BEFORE creating a Stripe PaymentIntent
   */
  create: (params: CreateOrderParams) =>
    apiClient.post<Order>('/orders', params),

  /**
   * Link a Stripe PaymentIntent to an existing order
   * Optionally update the payment method (e.g., when falling back to manual card entry)
   */
  linkPaymentIntent: (orderId: string, stripePaymentIntentId: string, paymentMethod?: 'card' | 'cash' | 'tap_to_pay') =>
    apiClient.patch<Order>(`/orders/${orderId}/payment-intent`, {
      stripePaymentIntentId,
      ...(paymentMethod && { paymentMethod }),
    }),

  /**
   * Get order by ID
   */
  get: (orderId: string) =>
    apiClient.get<Order>(`/orders/${orderId}`),

  /**
   * List orders for the organization
   */
  list: (params?: { limit?: number; offset?: number; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.status) searchParams.append('status', params.status);

    const query = searchParams.toString();
    return apiClient.get<OrdersListResponse>(`/orders${query ? `?${query}` : ''}`);
  },
};
