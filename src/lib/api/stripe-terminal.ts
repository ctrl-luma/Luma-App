import { apiClient } from './client';

export interface ConnectionToken {
  secret: string;
}

export interface CreatePaymentIntentParams {
  amount: number; // In dollars (will be converted to cents by API)
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
  receiptEmail?: string;
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

  /**
   * Send receipt email for a completed payment
   */
  sendReceipt: (paymentIntentId: string, email: string) =>
    apiClient.post<{ success: boolean; receiptUrl: string | null }>(
      `/stripe/terminal/payment-intent/${paymentIntentId}/send-receipt`,
      { email }
    ),

  /**
   * Get payment intent details (including receipt URL)
   */
  getPaymentIntent: (paymentIntentId: string) =>
    apiClient.get<PaymentIntent & { receiptUrl: string | null }>(
      `/stripe/terminal/payment-intent/${paymentIntentId}`
    ),

  /**
   * Simulate a terminal payment for testing (test mode only)
   * Creates a real test payment in Stripe without requiring NFC/card tap
   */
  simulatePayment: (paymentIntentId: string) =>
    apiClient.post<{
      id: string;
      status: string;
      amount: number;
      receiptUrl: string | null;
    }>(`/stripe/terminal/payment-intent/${paymentIntentId}/simulate`, {}),
};
