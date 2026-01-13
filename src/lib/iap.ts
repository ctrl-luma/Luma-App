/**
 * In-App Purchase Service
 * Handles subscriptions for iOS (StoreKit) and Android (Google Play Billing)
 * Uses react-native-iap for cross-platform support
 */

import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  getAvailablePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type SubscriptionPurchase,
  type ProductPurchase,
  type PurchaseError,
  type Subscription,
} from 'react-native-iap';
import { config } from './config';

// Product IDs - must match App Store Connect and Google Play Console
export const SUBSCRIPTION_SKUS = Platform.select({
  ios: ['lumaproplan'],
  android: ['lumaproplan'],
  default: [],
});

// Subscription product details
export interface SubscriptionProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice: string;
  currency: string;
  introductoryPrice?: string;
  introductoryPricePaymentMode?: string;
  introductoryPriceNumberOfPeriods?: number;
  introductoryPriceSubscriptionPeriod?: string;
  subscriptionPeriodNumberIOS?: string;
  subscriptionPeriodUnitIOS?: string;
  freeTrialPeriodAndroid?: string;
}

// Purchase result
export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  productId?: string;
  receipt?: string;
  error?: string;
}

// Subscription status
export interface SubscriptionStatus {
  isActive: boolean;
  productId?: string;
  expiresAt?: Date;
  isTrialPeriod?: boolean;
  autoRenewing?: boolean;
}

class IAPService {
  private isInitialized = false;
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;
  private onPurchaseComplete: ((result: PurchaseResult) => void) | null = null;

  /**
   * Initialize the IAP connection
   * Must be called before any other IAP methods
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      console.log('[IAP] Already initialized');
      return true;
    }

    try {
      console.log('[IAP] Initializing connection...');
      const result = await initConnection();
      console.log('[IAP] Connection result:', result);

      // Set up purchase listeners
      this.setupPurchaseListeners();

      this.isInitialized = true;
      console.log('[IAP] Initialized successfully');
      return true;
    } catch (error: any) {
      console.error('[IAP] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Set up listeners for purchase events
   */
  private setupPurchaseListeners() {
    // Listen for successful purchases
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: SubscriptionPurchase | ProductPurchase) => {
        console.log('[IAP] Purchase updated:', purchase.productId);

        try {
          // Validate receipt with backend
          const validation = await this.validateReceipt(purchase);

          if (validation.valid) {
            // Finish the transaction
            await finishTransaction({ purchase, isConsumable: false });
            console.log('[IAP] Transaction finished successfully');

            if (this.onPurchaseComplete) {
              this.onPurchaseComplete({
                success: true,
                transactionId: purchase.transactionId,
                productId: purchase.productId,
                receipt: Platform.OS === 'ios'
                  ? (purchase as any).transactionReceipt
                  : (purchase as any).purchaseToken,
              });
            }
          } else {
            console.error('[IAP] Receipt validation failed');
            if (this.onPurchaseComplete) {
              this.onPurchaseComplete({
                success: false,
                error: 'Receipt validation failed',
              });
            }
          }
        } catch (error: any) {
          console.error('[IAP] Error processing purchase:', error);
          if (this.onPurchaseComplete) {
            this.onPurchaseComplete({
              success: false,
              error: error.message || 'Failed to process purchase',
            });
          }
        }
      }
    );

    // Listen for purchase errors
    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        console.error('[IAP] Purchase error:', error);

        if (this.onPurchaseComplete) {
          // User cancelled is not a real error
          if (error.code === 'E_USER_CANCELLED') {
            this.onPurchaseComplete({
              success: false,
              error: 'Purchase cancelled',
            });
          } else {
            this.onPurchaseComplete({
              success: false,
              error: error.message || 'Purchase failed',
            });
          }
        }
      }
    );
  }

  /**
   * Clean up IAP connection
   */
  async cleanup(): Promise<void> {
    console.log('[IAP] Cleaning up...');

    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
      this.purchaseUpdateSubscription = null;
    }

    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
      this.purchaseErrorSubscription = null;
    }

    try {
      await endConnection();
      this.isInitialized = false;
      console.log('[IAP] Cleanup complete');
    } catch (error) {
      console.error('[IAP] Error during cleanup:', error);
    }
  }

  /**
   * Get available subscription products
   */
  async getProducts(): Promise<SubscriptionProduct[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('[IAP] Fetching products:', SUBSCRIPTION_SKUS);
      const subscriptions = await getSubscriptions({ skus: SUBSCRIPTION_SKUS! });
      console.log('[IAP] Products fetched:', subscriptions.length);

      return subscriptions.map((sub: Subscription) => ({
        productId: sub.productId,
        title: sub.title,
        description: sub.description,
        price: sub.price,
        localizedPrice: sub.localizedPrice,
        currency: sub.currency,
        introductoryPrice: (sub as any).introductoryPrice,
        introductoryPricePaymentMode: (sub as any).introductoryPricePaymentModeIOS,
        introductoryPriceNumberOfPeriods: (sub as any).introductoryPriceNumberOfPeriodsIOS,
        introductoryPriceSubscriptionPeriod: (sub as any).introductoryPriceSubscriptionPeriodIOS,
        subscriptionPeriodNumberIOS: (sub as any).subscriptionPeriodNumberIOS,
        subscriptionPeriodUnitIOS: (sub as any).subscriptionPeriodUnitIOS,
        freeTrialPeriodAndroid: (sub as any).freeTrialPeriodAndroid,
      }));
    } catch (error: any) {
      console.error('[IAP] Error fetching products:', error);
      return [];
    }
  }

  /**
   * Purchase a subscription
   */
  async purchaseSubscription(
    productId: string,
    onComplete: (result: PurchaseResult) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.onPurchaseComplete = onComplete;

    try {
      console.log('[IAP] Requesting subscription:', productId);

      if (Platform.OS === 'ios') {
        await requestSubscription({ sku: productId });
      } else {
        // Android requires offer token for subscriptions
        const subscriptions = await getSubscriptions({ skus: [productId] });
        if (subscriptions.length > 0) {
          const subscription = subscriptions[0] as any;
          const offerToken = subscription.subscriptionOfferDetails?.[0]?.offerToken;

          await requestSubscription({
            sku: productId,
            ...(offerToken && {
              subscriptionOffers: [{ sku: productId, offerToken }],
            }),
          });
        } else {
          throw new Error('Subscription not found');
        }
      }
    } catch (error: any) {
      console.error('[IAP] Error purchasing subscription:', error);
      onComplete({
        success: false,
        error: error.message || 'Failed to purchase subscription',
      });
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<SubscriptionStatus> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('[IAP] Restoring purchases...');
      const purchases = await getAvailablePurchases();
      console.log('[IAP] Found purchases:', purchases.length);

      // Find active subscription
      for (const purchase of purchases) {
        if (SUBSCRIPTION_SKUS!.includes(purchase.productId)) {
          // Validate with backend
          const validation = await this.validateReceipt(purchase);

          if (validation.valid && validation.isActive) {
            return {
              isActive: true,
              productId: purchase.productId,
              expiresAt: validation.expiresAt,
              isTrialPeriod: validation.isTrialPeriod,
              autoRenewing: validation.autoRenewing,
            };
          }
        }
      }

      return { isActive: false };
    } catch (error: any) {
      console.error('[IAP] Error restoring purchases:', error);
      return { isActive: false };
    }
  }

  /**
   * Validate receipt with backend
   */
  private async validateReceipt(
    purchase: SubscriptionPurchase | ProductPurchase
  ): Promise<{
    valid: boolean;
    isActive?: boolean;
    expiresAt?: Date;
    isTrialPeriod?: boolean;
    autoRenewing?: boolean;
  }> {
    try {
      const receipt = Platform.OS === 'ios'
        ? (purchase as any).transactionReceipt
        : (purchase as any).purchaseToken;

      const response = await fetch(`${config.apiUrl}/billing/validate-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: Platform.OS,
          productId: purchase.productId,
          receipt,
          transactionId: purchase.transactionId,
        }),
      });

      if (!response.ok) {
        console.error('[IAP] Receipt validation failed:', response.status);
        return { valid: false };
      }

      const data = await response.json();
      return {
        valid: data.valid,
        isActive: data.isActive,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        isTrialPeriod: data.isTrialPeriod,
        autoRenewing: data.autoRenewing,
      };
    } catch (error) {
      console.error('[IAP] Error validating receipt:', error);
      return { valid: false };
    }
  }

  /**
   * Check current subscription status
   */
  async checkSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      // First check with backend
      const response = await fetch(`${config.apiUrl}/billing/subscription-status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          isActive: data.isActive,
          productId: data.productId,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          isTrialPeriod: data.isTrialPeriod,
          autoRenewing: data.autoRenewing,
        };
      }

      // Fallback to restore purchases
      return await this.restorePurchases();
    } catch (error) {
      console.error('[IAP] Error checking subscription status:', error);
      return { isActive: false };
    }
  }
}

export const iapService = new IAPService();
