/**
 * Stripe Terminal Context
 * Provides access to Stripe Terminal SDK for Tap to Pay functionality
 * Uses the official @stripe/stripe-terminal-react-native package
 */

import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { stripeTerminalApi } from '../lib/api';

// Conditionally import Terminal SDK only on native platforms
let StripeTerminalProvider: any = null;
let useStripeTerminal: any = null;
let requestNeededAndroidPermissions: any = null;

if (Platform.OS !== 'web') {
  try {
    const terminal = require('@stripe/stripe-terminal-react-native');
    StripeTerminalProvider = terminal.StripeTerminalProvider;
    useStripeTerminal = terminal.useStripeTerminal;
    requestNeededAndroidPermissions = terminal.requestNeededAndroidPermissions;
  } catch (error) {
    console.warn('[StripeTerminal] Failed to load terminal SDK:', error);
  }
}

// Types
interface StripeTerminalContextValue {
  isInitialized: boolean;
  isConnected: boolean;
  isProcessing: boolean;
  error: string | null;
  initializeTerminal: () => Promise<void>;
  connectReader: () => Promise<boolean>;
  processPayment: (paymentIntentId: string) => Promise<{ status: string; paymentIntent: any }>;
  cancelPayment: () => Promise<void>;
}

const StripeTerminalContext = createContext<StripeTerminalContextValue | undefined>(undefined);

// Inner component that uses the useStripeTerminal hook
function StripeTerminalInner({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  // Use ref to store discovered readers (avoids closure issues with state)
  const discoveredReadersRef = useRef<any[]>([]);

  // Use the official hook - discoveredReaders is provided by the hook
  const {
    initialize,
    discoverReaders,
    discoveredReaders: hookDiscoveredReaders,
    connectReader: sdkConnectReader,
    retrievePaymentIntent,
    collectPaymentMethod,
    confirmPaymentIntent,
    cancelCollectPaymentMethod,
  } = useStripeTerminal({
    onUpdateDiscoveredReaders: (readers: any[]) => {
      console.log('[StripeTerminal] Discovered readers via callback:', readers.length);
      if (readers.length > 0) {
        console.log('[StripeTerminal] Reader details:', JSON.stringify(readers[0], null, 2));
      }
      discoveredReadersRef.current = readers;
    },
    onDidChangeConnectionStatus: (status: string) => {
      console.log('[StripeTerminal] Connection status changed:', status);
      setIsConnected(status === 'connected');
    },
  });

  // Request Android permissions on mount
  useEffect(() => {
    if (Platform.OS === 'android' && requestNeededAndroidPermissions) {
      requestNeededAndroidPermissions({
        accessFineLocation: {
          title: 'Location Permission',
          message: 'Stripe Terminal requires location access for payments.',
          buttonPositive: 'Allow',
        },
      }).catch((err: any) => {
        console.warn('[StripeTerminal] Permission request failed:', err);
      });
    }
  }, []);

  // Fetch terminal location on mount
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        console.log('[StripeTerminal] Fetching terminal location...');
        const { locationId: locId } = await stripeTerminalApi.getLocation();
        console.log('[StripeTerminal] Got location:', locId);
        setLocationId(locId);
      } catch (err: any) {
        console.warn('[StripeTerminal] Failed to fetch location:', err.message);
        // Don't fail - location will be fetched again when needed
      }
    };
    fetchLocation();
  }, []);

  const initializeTerminal = useCallback(async () => {
    console.log('[StripeTerminal] ========== INITIALIZE START ==========');
    console.log('[StripeTerminal] isInitialized:', isInitialized);

    if (isInitialized) {
      console.log('[StripeTerminal] Already initialized, skipping');
      return;
    }

    try {
      console.log('[StripeTerminal] Calling initialize()...');
      setError(null);

      const initResult = await initialize();
      console.log('[StripeTerminal] Initialize result:', JSON.stringify(initResult, null, 2));

      if (initResult.error) {
        console.error('[StripeTerminal] Initialize error:', initResult.error);
        const errMsg = `Init error: ${initResult.error.message || initResult.error.code || 'Unknown'}`;
        setError(errMsg);
        throw new Error(errMsg);
      }

      setIsInitialized(true);
      console.log('[StripeTerminal] ========== INITIALIZE SUCCESS ==========');
    } catch (err: any) {
      console.error('[StripeTerminal] ========== INITIALIZE FAILED ==========');
      console.error('[StripeTerminal] Error:', err);
      console.error('[StripeTerminal] Message:', err.message);
      setError(err.message || 'Failed to initialize terminal');
      throw err;
    }
  }, [initialize, isInitialized]);

  const connectReader = useCallback(async (): Promise<boolean> => {
    console.log('[StripeTerminal] ========== CONNECT READER START ==========');
    console.log('[StripeTerminal] Platform:', Platform.OS);
    setError(null);

    // Ensure we have a location ID (required for Tap to Pay)
    let currentLocationId = locationId;
    console.log('[StripeTerminal] Cached locationId:', currentLocationId);

    if (!currentLocationId) {
      console.log('[StripeTerminal] No cached location, fetching from API...');
      try {
        const locationResponse = await stripeTerminalApi.getLocation();
        console.log('[StripeTerminal] Location API response:', JSON.stringify(locationResponse));
        currentLocationId = locationResponse.locationId;
        setLocationId(currentLocationId);
        console.log('[StripeTerminal] Got location:', currentLocationId);
      } catch (locErr: any) {
        console.error('[StripeTerminal] Location fetch error:', locErr);
        console.error('[StripeTerminal] Location error details:', JSON.stringify(locErr, null, 2));
        const errMsg = `Location error: ${locErr.message || locErr.error || 'Unknown error'}`;
        setError(errMsg);
        throw new Error(errMsg);
      }
    }

    // Discover Tap to Pay readers
    const useSimulator = false; // Set to true to test without real NFC hardware
    console.log('[StripeTerminal] Discovering Tap to Pay reader...');
    console.log('[StripeTerminal] Discovery params: { discoveryMethod: "tapToPay", simulated:', useSimulator, '}');

    // Clear previous discovered readers
    console.log('[StripeTerminal] Clearing previous discovered readers...');
    discoveredReadersRef.current = [];

    // Start discovery - readers come via onUpdateDiscoveredReaders callback
    console.log('[StripeTerminal] Calling discoverReaders()...');
    const discoverResult = await discoverReaders({
      discoveryMethod: 'tapToPay',
      simulated: useSimulator,
    });

    console.log('[StripeTerminal] discoverReaders() returned');
    console.log('[StripeTerminal] Discovery result:', JSON.stringify(discoverResult, null, 2));
    console.log('[StripeTerminal] discoveredReadersRef.current:', discoveredReadersRef.current.length);
    console.log('[StripeTerminal] hookDiscoveredReaders:', hookDiscoveredReaders?.length || 0);

    if (discoverResult.error) {
      console.error('[StripeTerminal] Discovery error:', discoverResult.error);
      const errMsg = `Discovery: ${discoverResult.error.message || discoverResult.error.code || 'Unknown error'}`;
      setError(errMsg);
      setIsConnected(false);
      throw new Error(errMsg);
    }

    // Check if readers are already available from ref (callback may have fired during await)
    if (discoveredReadersRef.current.length > 0) {
      console.log('[StripeTerminal] Readers already available in ref:', discoveredReadersRef.current.length);
    }

    // Wait for readers to be discovered via callback
    // Poll for up to 5 seconds for readers to appear
    let readers: any[] = discoveredReadersRef.current;
    if (readers.length === 0) {
      console.log('[StripeTerminal] No readers in ref yet, polling...');
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        // Check ref first (updated by callback), then hook state
        readers = discoveredReadersRef.current.length > 0
          ? discoveredReadersRef.current
          : (hookDiscoveredReaders || []);
        console.log('[StripeTerminal] Poll attempt', i + 1, '- ref:', discoveredReadersRef.current.length, '- hook:', hookDiscoveredReaders?.length || 0);
        if (readers.length > 0) {
          console.log('[StripeTerminal] Found readers after polling!');
          break;
        }
      }
    }

    console.log('[StripeTerminal] Final readers found:', readers.length);

    if (readers.length > 0) {
      console.log('[StripeTerminal] Reader to connect:', JSON.stringify(readers[0], null, 2));
    }

    if (readers.length === 0) {
      console.error('[StripeTerminal] No readers found after polling');
      const errMsg = 'No readers found. Ensure NFC is enabled and device supports Tap to Pay.';
      setError(errMsg);
      setIsConnected(false);
      throw new Error(errMsg);
    }

    // Connect to the Tap to Pay reader with the location ID
    console.log('[StripeTerminal] ========== CONNECTING TO READER ==========');
    console.log('[StripeTerminal] Reader:', readers[0].serialNumber || readers[0].id || 'unknown');
    console.log('[StripeTerminal] Location ID:', currentLocationId);

    try {
      console.log('[StripeTerminal] Calling sdkConnectReader()...');
      const connectResult = await sdkConnectReader({
        reader: readers[0],
        locationId: currentLocationId,
      }, 'tapToPay');

      console.log('[StripeTerminal] sdkConnectReader() returned');
      console.log('[StripeTerminal] Connect result:', JSON.stringify(connectResult, null, 2));

      if (connectResult.error) {
        console.error('[StripeTerminal] Connect error:', connectResult.error);
        console.error('[StripeTerminal] Error code:', connectResult.error.code);
        console.error('[StripeTerminal] Error message:', connectResult.error.message);
        const errMsg = `Connect: ${connectResult.error.message || connectResult.error.code || 'Unknown error'}`;
        setError(errMsg);
        setIsConnected(false);
        throw new Error(errMsg);
      }

      console.log('[StripeTerminal] ========== CONNECTED SUCCESSFULLY ==========');
      console.log('[StripeTerminal] Connected reader:', connectResult.reader?.serialNumber || 'tap-to-pay');
      setIsConnected(true);
      return true;
    } catch (connectErr: any) {
      console.error('[StripeTerminal] ========== CONNECTION EXCEPTION ==========');
      console.error('[StripeTerminal] Exception:', connectErr);
      console.error('[StripeTerminal] Message:', connectErr.message);
      console.error('[StripeTerminal] Code:', connectErr.code);
      throw connectErr;
    }
  }, [discoverReaders, sdkConnectReader, locationId, hookDiscoveredReaders]);

  const processPayment = useCallback(async (paymentIntentId: string) => {
    console.log('[StripeTerminal] ========== PROCESS PAYMENT START ==========');
    console.log('[StripeTerminal] PaymentIntent ID:', paymentIntentId);

    try {
      setIsProcessing(true);
      setError(null);

      // Step 1: Retrieve the payment intent
      console.log('[StripeTerminal] Step 1: Retrieving payment intent...');
      const { paymentIntent, error: retrieveError } = await retrievePaymentIntent(paymentIntentId);

      if (retrieveError) {
        console.error('[StripeTerminal] Retrieve error:', retrieveError);
        throw new Error(retrieveError.message || 'Failed to retrieve payment intent');
      }

      console.log('[StripeTerminal] Payment intent retrieved successfully');
      console.log('[StripeTerminal] Amount:', paymentIntent?.amount);
      console.log('[StripeTerminal] Status:', paymentIntent?.status);

      // Step 2: Collect payment method (shows Tap to Pay UI)
      console.log('[StripeTerminal] Step 2: Collecting payment method (Tap to Pay UI)...');
      const { paymentIntent: collectedIntent, error: collectError } = await collectPaymentMethod({
        paymentIntent,
      });

      if (collectError) {
        console.error('[StripeTerminal] Collect error:', collectError);
        throw new Error(collectError.message || 'Failed to collect payment method');
      }

      console.log('[StripeTerminal] Payment method collected successfully');

      // Step 3: Confirm the payment
      console.log('[StripeTerminal] Step 3: Confirming payment...');
      const { paymentIntent: confirmedIntent, error: confirmError } = await confirmPaymentIntent({
        paymentIntent: collectedIntent,
      });

      if (confirmError) {
        console.error('[StripeTerminal] Confirm error:', confirmError);
        throw new Error(confirmError.message || 'Failed to confirm payment');
      }

      console.log('[StripeTerminal] ========== PAYMENT SUCCESS ==========');
      console.log('[StripeTerminal] Final status:', confirmedIntent?.status);

      return {
        status: confirmedIntent?.status || 'unknown',
        paymentIntent: confirmedIntent,
      };
    } catch (err: any) {
      console.error('[StripeTerminal] ========== PAYMENT FAILED ==========');
      console.error('[StripeTerminal] Error:', err.message);
      setError(err.message || 'Payment failed');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [retrievePaymentIntent, collectPaymentMethod, confirmPaymentIntent]);

  const cancelPayment = useCallback(async () => {
    try {
      console.log('[StripeTerminal] Cancelling payment...');
      await cancelCollectPaymentMethod();
      console.log('[StripeTerminal] Payment cancelled');
    } catch (err: any) {
      console.warn('[StripeTerminal] Cancel failed:', err);
      // Don't throw - cancellation errors are not critical
    }
  }, [cancelCollectPaymentMethod]);

  const value: StripeTerminalContextValue = {
    isInitialized,
    isConnected,
    isProcessing,
    error,
    initializeTerminal,
    connectReader,
    processPayment,
    cancelPayment,
  };

  return (
    <StripeTerminalContext.Provider value={value}>
      {children}
    </StripeTerminalContext.Provider>
  );
}

// Token provider function for StripeTerminalProvider
async function fetchConnectionToken(): Promise<string> {
  console.log('[StripeTerminal] Fetching connection token...');
  try {
    const { secret } = await stripeTerminalApi.getConnectionToken();
    console.log('[StripeTerminal] Connection token received');
    return secret;
  } catch (error: any) {
    console.error('[StripeTerminal] Failed to get connection token:', error);
    throw error;
  }
}

// Main provider component
// Note: Stripe Tap to Pay UI automatically follows the system dark mode setting on Android
// For iOS, the SDK respects the app's UIUserInterfaceStyle
export function StripeTerminalContextProvider({ children }: { children: React.ReactNode }) {
  // On web or when native module isn't available (Expo Go), provide a stub context
  if (Platform.OS === 'web' || !StripeTerminalProvider) {
    const isWeb = Platform.OS === 'web';
    const errorMessage = isWeb
      ? 'Stripe Terminal is not available on web'
      : 'Stripe Terminal requires a development build. Expo Go does not include native modules.';

    const stubValue: StripeTerminalContextValue = {
      isInitialized: false,
      isConnected: false,
      isProcessing: false,
      error: errorMessage,
      initializeTerminal: async () => {
        throw new Error(errorMessage);
      },
      connectReader: async () => false,
      processPayment: async () => {
        throw new Error(errorMessage);
      },
      cancelPayment: async () => {},
    };

    return (
      <StripeTerminalContext.Provider value={stubValue}>
        {children}
      </StripeTerminalContext.Provider>
    );
  }

  // On native, wrap with the official provider with dark mode colors
  return (
    <StripeTerminalProvider
      tokenProvider={fetchConnectionToken}
      logLevel="verbose"
    >
      <StripeTerminalInner>{children}</StripeTerminalInner>
    </StripeTerminalProvider>
  );
}

// Hook to access terminal functionality
export function useTerminal() {
  const context = useContext(StripeTerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a StripeTerminalContextProvider');
  }
  return context;
}
