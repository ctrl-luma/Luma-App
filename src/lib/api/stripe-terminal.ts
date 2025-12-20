import { apiClient } from './client';

export interface ConnectionToken {
  secret: string;
}

export interface CreatePaymentIntentParams {
  amount: number; // In dollars (will be converted to cents by API)
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

export const stripeTerminalApi = {
  /**
   * Get a connection token for Stripe Terminal SDK
   */
  getConnectionToken: () =>
    apiClient.post<ConnectionToken>('/stripe/terminal/connection-token', {}),

  /**
   * Create a payment intent for terminal payment
   */
  createPaymentIntent: (params: CreatePaymentIntentParams) =>
    apiClient.post<PaymentIntent>('/stripe/terminal/payment-intent', params),

  /**
   * Capture a payment intent (if using manual capture)
   */
  capturePaymentIntent: (paymentIntentId: string) =>
    apiClient.post<PaymentIntent>(`/stripe/terminal/payment-intent/${paymentIntentId}/capture`, {}),

  /**
   * Cancel a payment intent
   */
  cancelPaymentIntent: (paymentIntentId: string) =>
    apiClient.post<{ success: boolean }>(`/stripe/terminal/payment-intent/${paymentIntentId}/cancel`, {}),
};
