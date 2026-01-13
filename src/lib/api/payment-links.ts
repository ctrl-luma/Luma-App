/**
 * Payment Links API
 * Apple TTPOi Regional Requirement: Fallback Payment Method for UK, IE, CAN
 *
 * Provides an alternative payment method when Tap to Pay cannot complete a transaction
 * (e.g., card requires offline PIN, card not supported for contactless)
 */

import { apiClient } from './client';

export interface CreatePaymentLinkParams {
  amount: number; // In cents
  currency?: string;
  description?: string;
  orderId?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface PaymentLink {
  id: string;
  url: string;
  amount: number;
  currency: string;
  status: 'active' | 'completed' | 'expired';
  expiresAt: string;
  qrCodeDataUrl?: string; // Base64 QR code image
}

export interface PaymentLinkStatus {
  id: string;
  status: 'active' | 'completed' | 'expired';
  paid: boolean;
  paymentIntentId?: string;
}

export const paymentLinksApi = {
  /**
   * Create a payment link for fallback payment
   * Used when Tap to Pay fails (e.g., card requires PIN)
   */
  create: (params: CreatePaymentLinkParams) =>
    apiClient.post<PaymentLink>('/stripe/payment-links', params),

  /**
   * Get the status of a payment link
   * Poll this to check if customer completed payment
   */
  getStatus: (paymentLinkId: string) =>
    apiClient.get<PaymentLinkStatus>(`/stripe/payment-links/${paymentLinkId}/status`),

  /**
   * Cancel/expire a payment link
   */
  cancel: (paymentLinkId: string) =>
    apiClient.post<{ success: boolean }>(`/stripe/payment-links/${paymentLinkId}/cancel`, {}),
};
