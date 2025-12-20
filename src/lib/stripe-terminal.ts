/**
 * Stripe Terminal Service for Tap to Pay
 * Handles Terminal SDK initialization, reader discovery, and payment collection
 * Note: Only works on native platforms (iOS/Android), not on web
 */

import { Platform } from 'react-native';
import { stripeTerminalApi } from './api';

// Conditionally import Terminal SDK only on native platforms
let StripeTerminal: any = null;
let createStripeTerminal: any = null;

if (Platform.OS !== 'web') {
  const terminal = require('@stripe/stripe-terminal-react-native');
  StripeTerminal = terminal.StripeTerminal;
  createStripeTerminal = terminal.createStripeTerminal;
}

// Type definitions for Terminal SDK
type Reader = any;
type PaymentIntent = any;

class StripeTerminalService {
  private terminal: StripeTerminal | null = null;
  private isInitialized = false;
  private discoveredReaders: Reader[] = [];

  /**
   * Initialize the Stripe Terminal SDK
   * Must be called before any other Terminal operations
   */
  async initialize(): Promise<void> {
    // Web platform check
    if (Platform.OS === 'web') {
      throw new Error('Stripe Terminal is not supported on web. Please use a native build or the dev skip button.');
    }

    if (this.isInitialized) {
      console.log('[StripeTerminal] Already initialized');
      return;
    }

    try {
      console.log('[StripeTerminal] Initializing...');

      // Create terminal instance
      this.terminal = await createStripeTerminal({
        onUpdateDiscoveredReaders: (readers) => {
          console.log('[StripeTerminal] Discovered readers:', readers.length);
          this.discoveredReaders = readers;
        },
        onDidRequestConnectionToken: async () => {
          console.log('[StripeTerminal] Requesting connection token...');
          try {
            const { secret } = await stripeTerminalApi.getConnectionToken();
            return secret;
          } catch (error) {
            console.error('[StripeTerminal] Failed to get connection token:', error);
            throw error;
          }
        },
      });

      this.isInitialized = true;
      console.log('[StripeTerminal] Initialized successfully');
    } catch (error) {
      console.error('[StripeTerminal] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Discover local mobile readers (for Tap to Pay on iPhone/Android)
   * Returns the built-in reader for Tap to Pay
   */
  async discoverReaders(): Promise<Reader[]> {
    if (!this.terminal) {
      throw new Error('Terminal not initialized. Call initialize() first.');
    }

    try {
      console.log('[StripeTerminal] Discovering readers...');

      // Discover local mobile readers (for Tap to Pay)
      const { discoveredReaders } = await this.terminal.discoverReaders({
        discoveryMethod: 'localMobile',
        simulated: false,
      });

      console.log('[StripeTerminal] Found readers:', discoveredReaders.length);
      this.discoveredReaders = discoveredReaders;
      return discoveredReaders;
    } catch (error) {
      console.error('[StripeTerminal] Reader discovery failed:', error);
      throw error;
    }
  }

  /**
   * Connect to a reader
   * For Tap to Pay, this connects to the phone's built-in NFC reader
   */
  async connectReader(reader?: Reader): Promise<Reader> {
    if (!this.terminal) {
      throw new Error('Terminal not initialized. Call initialize() first.');
    }

    try {
      // If no reader provided, discover and use the first one
      let readerToConnect = reader;
      if (!readerToConnect) {
        const readers = await this.discoverReaders();
        if (readers.length === 0) {
          throw new Error('No readers found');
        }
        readerToConnect = readers[0];
      }

      console.log('[StripeTerminal] Connecting to reader:', readerToConnect.serialNumber);

      const { reader: connectedReader } = await this.terminal.connectLocalMobileReader({
        reader: readerToConnect,
        locationId: readerToConnect.locationId || undefined,
      });

      console.log('[StripeTerminal] Connected to reader:', connectedReader.serialNumber);
      return connectedReader;
    } catch (error) {
      console.error('[StripeTerminal] Reader connection failed:', error);
      throw error;
    }
  }

  /**
   * Collect payment using the connected reader
   * Shows the "Tap to Pay" interface to the customer
   */
  async collectPayment(paymentIntentId: string): Promise<PaymentIntent> {
    if (!this.terminal) {
      throw new Error('Terminal not initialized. Call initialize() first.');
    }

    try {
      console.log('[StripeTerminal] Retrieving payment intent:', paymentIntentId);

      // Retrieve the payment intent
      const { paymentIntent } = await this.terminal.retrievePaymentIntent(paymentIntentId);

      console.log('[StripeTerminal] Collecting payment method...');

      // Collect payment method (shows Tap to Pay UI)
      const { paymentIntent: collectedPaymentIntent } = await this.terminal.collectPaymentMethod({
        paymentIntent,
      });

      console.log('[StripeTerminal] Payment method collected');
      return collectedPaymentIntent;
    } catch (error) {
      console.error('[StripeTerminal] Payment collection failed:', error);
      throw error;
    }
  }

  /**
   * Confirm the payment intent after collecting payment method
   * This completes the payment transaction
   */
  async confirmPayment(paymentIntent: PaymentIntent): Promise<PaymentIntent> {
    if (!this.terminal) {
      throw new Error('Terminal not initialized. Call initialize() first.');
    }

    try {
      console.log('[StripeTerminal] Confirming payment...');

      const { paymentIntent: confirmedPaymentIntent } = await this.terminal.confirmPaymentIntent({
        paymentIntent,
      });

      console.log('[StripeTerminal] Payment confirmed:', confirmedPaymentIntent.status);
      return confirmedPaymentIntent;
    } catch (error) {
      console.error('[StripeTerminal] Payment confirmation failed:', error);
      throw error;
    }
  }

  /**
   * Complete payment flow: collect + confirm
   * This is the main method to use for processing a payment
   */
  async processPayment(paymentIntentId: string): Promise<PaymentIntent> {
    try {
      // Collect payment method
      const collectedPaymentIntent = await this.collectPayment(paymentIntentId);

      // Confirm payment
      const confirmedPaymentIntent = await this.confirmPayment(collectedPaymentIntent);

      return confirmedPaymentIntent;
    } catch (error) {
      console.error('[StripeTerminal] Payment processing failed:', error);
      throw error;
    }
  }

  /**
   * Cancel the current payment collection
   */
  async cancelCollectPayment(): Promise<void> {
    if (!this.terminal) {
      throw new Error('Terminal not initialized. Call initialize() first.');
    }

    try {
      console.log('[StripeTerminal] Canceling payment collection...');
      await this.terminal.cancelCollectPaymentMethod();
      console.log('[StripeTerminal] Payment collection canceled');
    } catch (error) {
      console.error('[StripeTerminal] Cancel failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the current reader
   */
  async disconnectReader(): Promise<void> {
    if (!this.terminal) {
      return;
    }

    try {
      console.log('[StripeTerminal] Disconnecting reader...');
      await this.terminal.disconnectReader();
      console.log('[StripeTerminal] Reader disconnected');
    } catch (error) {
      console.error('[StripeTerminal] Disconnect failed:', error);
      // Don't throw - disconnection errors are not critical
    }
  }

  /**
   * Clear cached credentials and reset the terminal
   */
  async clearCachedCredentials(): Promise<void> {
    if (!this.terminal) {
      return;
    }

    try {
      console.log('[StripeTerminal] Clearing cached credentials...');
      await this.terminal.clearCachedCredentials();
      this.isInitialized = false;
      this.terminal = null;
      console.log('[StripeTerminal] Credentials cleared');
    } catch (error) {
      console.error('[StripeTerminal] Clear credentials failed:', error);
      throw error;
    }
  }

  /**
   * Get the current reader connection status
   */
  getConnectionStatus(): boolean {
    return this.isInitialized && this.terminal !== null;
  }

  /**
   * Get discovered readers
   */
  getDiscoveredReaders(): Reader[] {
    return this.discoveredReaders;
  }
}

// Export singleton instance
export const stripeTerminalService = new StripeTerminalService();
