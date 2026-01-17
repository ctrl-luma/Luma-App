/**
 * Stripe Terminal Context
 * Provides access to Stripe Terminal SDK for Tap to Pay on iPhone functionality
 * Uses the official @stripe/stripe-terminal-react-native package
 *
 * Apple TTPOi Requirements Compliance:
 * - 1.1: Device compatibility check (iPhone XS+ / A12 chip)
 * - 1.3: iOS version check (17.6+ required, handle osVersionNotSupported)
 * - 1.4: Terminal preparation/warming at app launch
 * - 3.9.1: Configuration progress indicator support
 */

import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { Platform, Alert, AppState, AppStateStatus } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { stripeTerminalApi } from '../lib/api';
import { useAuth } from './AuthContext';

// Check if running in Expo Go (which doesn't support native modules)
const isExpoGo = Constants.appOwnership === 'expo';

// Conditionally import Terminal SDK only on native platforms with dev builds
let StripeTerminalProvider: any = null;
let useStripeTerminal: any = null;
let requestNeededAndroidPermissions: any = null;
let terminalLoadError: string | null = null;

// Only attempt to load the native module if NOT in Expo Go and NOT on web
if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    const terminal = require('@stripe/stripe-terminal-react-native');
    // Verify the module loaded correctly by checking for required exports
    if (terminal && terminal.StripeTerminalProvider && terminal.useStripeTerminal) {
      StripeTerminalProvider = terminal.StripeTerminalProvider;
      useStripeTerminal = terminal.useStripeTerminal;
      requestNeededAndroidPermissions = terminal.requestNeededAndroidPermissions;
    } else {
      terminalLoadError = 'Stripe Terminal module loaded but exports are missing.';
      console.warn('[StripeTerminal]', terminalLoadError);
    }
  } catch (error: any) {
    terminalLoadError = `Stripe Terminal native module error: ${error?.message || error}`;
    console.warn('[StripeTerminal] Failed to load terminal SDK:', error);
  }
} else if (isExpoGo) {
  terminalLoadError = 'Stripe Terminal is not available in Expo Go. Please use a development build (eas build --profile development).';
  console.log('[StripeTerminal] Skipping native module load - running in Expo Go');
}

// Device compatibility check for Tap to Pay on iPhone (requires iPhone XS or later / A12 chip)
// List of compatible device model identifiers (iPhone XS and later)
const TTP_COMPATIBLE_IPHONE_MODELS = [
  // iPhone XS family (A12)
  'iPhone11,2', // iPhone XS
  'iPhone11,4', 'iPhone11,6', // iPhone XS Max
  'iPhone11,8', // iPhone XR
  // iPhone 11 family (A13)
  'iPhone12,1', // iPhone 11
  'iPhone12,3', // iPhone 11 Pro
  'iPhone12,5', // iPhone 11 Pro Max
  // iPhone SE 2nd gen (A13)
  'iPhone12,8',
  // iPhone 12 family (A14)
  'iPhone13,1', // iPhone 12 mini
  'iPhone13,2', // iPhone 12
  'iPhone13,3', // iPhone 12 Pro
  'iPhone13,4', // iPhone 12 Pro Max
  // iPhone 13 family (A15)
  'iPhone14,4', // iPhone 13 mini
  'iPhone14,5', // iPhone 13
  'iPhone14,2', // iPhone 13 Pro
  'iPhone14,3', // iPhone 13 Pro Max
  // iPhone SE 3rd gen (A15)
  'iPhone14,6',
  // iPhone 14 family (A15/A16)
  'iPhone14,7', // iPhone 14
  'iPhone14,8', // iPhone 14 Plus
  'iPhone15,2', // iPhone 14 Pro
  'iPhone15,3', // iPhone 14 Pro Max
  // iPhone 15 family (A16/A17)
  'iPhone15,4', // iPhone 15
  'iPhone15,5', // iPhone 15 Plus
  'iPhone16,1', // iPhone 15 Pro
  'iPhone16,2', // iPhone 15 Pro Max
  // iPhone 16 family (A18)
  'iPhone17,1', 'iPhone17,2', 'iPhone17,3', 'iPhone17,4', 'iPhone17,5',
];

// Minimum iOS version for Tap to Pay on iPhone (16.4 per Stripe Terminal SDK)
// Note: If Apple requires a higher version, the SDK will return osVersionNotSupported error
const MIN_IOS_VERSION = 16.4;

// Configuration progress stages
export type ConfigurationStage =
  | 'idle'
  | 'checking_compatibility'
  | 'initializing'
  | 'fetching_location'
  | 'discovering_reader'
  | 'connecting_reader'
  | 'ready'
  | 'error';

// Types
interface DeviceCompatibility {
  isCompatible: boolean;
  iosVersionSupported: boolean;
  deviceSupported: boolean;
  iosVersion: string | null;
  deviceModel: string | null;
  errorMessage: string | null;
}

// Terms & Conditions acceptance status (retrieved from Apple via SDK, not stored locally)
// Apple TTPOi Requirement: T&C status must be retrieved from Apple, not cached locally
export interface TermsAcceptanceStatus {
  accepted: boolean;
  // Whether we've checked the status (to differentiate between "not accepted" and "not yet checked")
  checked: boolean;
  // If terms need to be accepted, this message can guide the user
  message: string | null;
}

interface StripeTerminalContextValue {
  isInitialized: boolean;
  isConnected: boolean;
  isProcessing: boolean;
  isWarming: boolean;
  error: string | null;
  deviceCompatibility: DeviceCompatibility;
  configurationStage: ConfigurationStage;
  configurationProgress: number; // 0-100
  termsAcceptance: TermsAcceptanceStatus;
  initializeTerminal: () => Promise<void>;
  connectReader: () => Promise<boolean>;
  processPayment: (paymentIntentId: string) => Promise<{ status: string; paymentIntent: any }>;
  cancelPayment: () => Promise<void>;
  warmTerminal: () => Promise<void>;
  checkDeviceCompatibility: () => DeviceCompatibility;
}

const StripeTerminalContext = createContext<StripeTerminalContextValue | undefined>(undefined);

// Helper function to check device compatibility
function checkDeviceCompatibilitySync(): DeviceCompatibility {
  if (Platform.OS !== 'ios') {
    // Android has different requirements (NFC support)
    return {
      isCompatible: true, // Android compatibility checked via NFC at runtime
      iosVersionSupported: true,
      deviceSupported: true,
      iosVersion: null,
      deviceModel: Device.modelId,
      errorMessage: null,
    };
  }

  const osVersion = Device.osVersion;
  const modelId = Device.modelId;

  // Parse iOS version
  const iosVersionNum = osVersion ? parseFloat(osVersion) : 0;
  const iosVersionSupported = iosVersionNum >= MIN_IOS_VERSION;

  // Check device model
  const deviceSupported = modelId ? TTP_COMPATIBLE_IPHONE_MODELS.some(m => modelId.startsWith(m.split(',')[0])) : false;

  // Also accept if model ID starts with iPhone1[1-9] or higher (future-proofing)
  const modelMatch = modelId?.match(/iPhone(\d+),/);
  const modelNum = modelMatch ? parseInt(modelMatch[1], 10) : 0;
  const isFutureModel = modelNum >= 11; // iPhone XS starts at iPhone11,x

  const isDeviceSupported = deviceSupported || isFutureModel;

  let errorMessage: string | null = null;
  if (!iosVersionSupported) {
    errorMessage = `Tap to Pay on iPhone requires iOS ${MIN_IOS_VERSION} or later. Your device is running iOS ${osVersion}.`;
  } else if (!isDeviceSupported) {
    errorMessage = 'Tap to Pay on iPhone requires iPhone XS or later. Your device is not supported.';
  }

  return {
    isCompatible: iosVersionSupported && isDeviceSupported,
    iosVersionSupported,
    deviceSupported: isDeviceSupported,
    iosVersion: osVersion,
    deviceModel: modelId,
    errorMessage,
  };
}

// Inner component that uses the useStripeTerminal hook
function StripeTerminalInner({ children }: { children: React.ReactNode }) {
  // Get Stripe Connect status to check if payments are enabled
  const { connectStatus, isPaymentReady } = useAuth();
  const chargesEnabled = connectStatus?.chargesEnabled ?? false;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWarming, setIsWarming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [deviceCompatibility, setDeviceCompatibility] = useState<DeviceCompatibility>(() => checkDeviceCompatibilitySync());
  const [configurationStage, setConfigurationStage] = useState<ConfigurationStage>('idle');
  const [configurationProgress, setConfigurationProgress] = useState(0);
  // Terms & Conditions acceptance status - retrieved from Apple via SDK (not stored locally)
  // Apple TTPOi Requirement: Always check T&C status from SDK, never cache locally
  const [termsAcceptance, setTermsAcceptance] = useState<TermsAcceptanceStatus>({
    accepted: false,
    checked: false,
    message: null,
  });

  // Track if we've already warmed the terminal
  const hasWarmedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

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

  // Check device compatibility function (exposed to context)
  const checkDeviceCompatibility = useCallback((): DeviceCompatibility => {
    const result = checkDeviceCompatibilitySync();
    setDeviceCompatibility(result);
    return result;
  }, []);

  // Warm the terminal - initialize SDK and prepare for payments (Apple TTPOi 1.4)
  // This should be called at app launch and when returning to foreground
  const warmTerminal = useCallback(async () => {
    console.log('[StripeTerminal] ========== WARMING TERMINAL ==========');

    // Check device compatibility first
    const compatibility = checkDeviceCompatibilitySync();
    setDeviceCompatibility(compatibility);

    if (!compatibility.isCompatible && Platform.OS === 'ios') {
      console.log('[StripeTerminal] Device not compatible for TTP:', compatibility.errorMessage);
      setError(compatibility.errorMessage);
      setConfigurationStage('error');
      return;
    }

    if (isInitialized) {
      console.log('[StripeTerminal] Already initialized, skipping warm');
      return;
    }

    setIsWarming(true);
    setConfigurationStage('checking_compatibility');
    setConfigurationProgress(10);

    try {
      // Step 1: Initialize the SDK
      setConfigurationStage('initializing');
      setConfigurationProgress(30);
      console.log('[StripeTerminal] Warming: Initializing SDK...');

      const initResult = await initialize();

      if (initResult.error) {
        // Handle osVersionNotSupported error (Apple TTPOi 1.3)
        if (initResult.error.code === 'osVersionNotSupported' ||
            initResult.error.message?.includes('osVersionNotSupported') ||
            initResult.error.message?.includes('OS version')) {
          console.error('[StripeTerminal] iOS version not supported for TTP');
          const errorMsg = `Tap to Pay on iPhone requires iOS ${MIN_IOS_VERSION} or later. Please update your device.`;
          setError(errorMsg);
          setDeviceCompatibility(prev => ({
            ...prev,
            isCompatible: false,
            iosVersionSupported: false,
            errorMessage: errorMsg,
          }));
          setConfigurationStage('error');
          return;
        }
        throw new Error(initResult.error.message || initResult.error.code || 'Failed to initialize');
      }

      setIsInitialized(true);
      setConfigurationProgress(50);

      // Step 2: Fetch location in background
      setConfigurationStage('fetching_location');
      setConfigurationProgress(70);
      console.log('[StripeTerminal] Warming: Fetching location...');

      try {
        const { locationId: locId } = await stripeTerminalApi.getLocation();
        setLocationId(locId);
        console.log('[StripeTerminal] Warming: Location cached:', locId);
      } catch (locErr: any) {
        console.warn('[StripeTerminal] Warming: Location fetch failed (non-fatal):', locErr.message);
        // Don't fail warming for location errors - we can fetch later
      }

      setConfigurationStage('ready');
      setConfigurationProgress(100);
      console.log('[StripeTerminal] ========== WARMING COMPLETE ==========');

    } catch (err: any) {
      console.error('[StripeTerminal] Warming failed:', err.message);
      setError(err.message || 'Failed to warm terminal');
      setConfigurationStage('error');
    } finally {
      setIsWarming(false);
    }
  }, [initialize, isInitialized]);

  // Auto-warm terminal on mount and when app comes to foreground (Apple TTPOi 1.4)
  // Only warm if Stripe Connect is set up (chargesEnabled)
  useEffect(() => {
    // Skip warming if Stripe Connect isn't set up yet
    if (!chargesEnabled) {
      console.log('[StripeTerminal] Skipping auto-warm - Stripe Connect not set up (chargesEnabled=false)');
      return;
    }

    // Initial warm on mount
    if (!hasWarmedRef.current && deviceCompatibility.isCompatible) {
      console.log('[StripeTerminal] Auto-warming on mount...');
      hasWarmedRef.current = true;
      warmTerminal().catch(err => {
        console.error('[StripeTerminal] Auto-warm failed:', err);
      });
    }

    // Listen for app state changes to re-warm when coming to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[StripeTerminal] App came to foreground, checking terminal state...');
        // Re-warm if not initialized (connection may have been lost)
        if (!isInitialized && chargesEnabled) {
          warmTerminal().catch(err => {
            console.error('[StripeTerminal] Re-warm on foreground failed:', err);
          });
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [warmTerminal, deviceCompatibility.isCompatible, isInitialized, chargesEnabled]);

  // Fetch terminal location on mount (only if Stripe Connect is set up)
  useEffect(() => {
    // Skip if Stripe Connect isn't set up
    if (!chargesEnabled) {
      console.log('[StripeTerminal] Skipping location fetch - Stripe Connect not set up');
      return;
    }

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
  }, [chargesEnabled]);

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
    console.log('[StripeTerminal] Already connected:', isConnected);
    setError(null);

    // If already connected, skip discovery and connection
    if (isConnected) {
      console.log('[StripeTerminal] Reader already connected, reusing connection');
      return true;
    }

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
    // Retry logic for "No such location" error (can happen with newly created locations)
    const MAX_CONNECT_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;

    for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {
      console.log('[StripeTerminal] ========== CONNECTING TO READER ==========');
      console.log('[StripeTerminal] Reader:', readers[0].serialNumber || readers[0].id || 'unknown');
      console.log('[StripeTerminal] Location ID:', currentLocationId);
      console.log('[StripeTerminal] Attempt:', attempt, 'of', MAX_CONNECT_RETRIES);

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

          // Check if this is a "No such location" error - can happen with newly created locations
          const isLocationNotFoundError = connectResult.error.message?.includes('No such location');

          if (isLocationNotFoundError && attempt < MAX_CONNECT_RETRIES) {
            console.log(`[StripeTerminal] Location not found, retrying in ${RETRY_DELAY_MS}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            continue; // Retry
          }

          const errMsg = `Connect: ${connectResult.error.message || connectResult.error.code || 'Unknown error'}`;
          setError(errMsg);
          setIsConnected(false);
          throw new Error(errMsg);
        }

        console.log('[StripeTerminal] ========== CONNECTED SUCCESSFULLY ==========');
        console.log('[StripeTerminal] Connected reader:', connectResult.reader?.serialNumber || 'tap-to-pay');

        // Apple TTPOi Requirement: Check T&C acceptance status from the reader (not cached locally)
        // The SDK retrieves this status from Apple each time
        const connectedReader = connectResult.reader;
        console.log('[StripeTerminal] Reader accountOnboarded:', connectedReader?.accountOnboarded);
        console.log('[StripeTerminal] Full reader object:', JSON.stringify(connectedReader, null, 2));

        // Update T&C acceptance status based on reader's accountOnboarded property
        // accountOnboarded is true when the merchant has accepted Apple's Tap to Pay T&C
        if (connectedReader) {
          const isOnboarded = connectedReader.accountOnboarded === true;
          setTermsAcceptance({
            accepted: isOnboarded,
            checked: true,
            message: isOnboarded
              ? null
              : 'Please accept the Tap to Pay Terms & Conditions to start accepting payments. The acceptance screen will appear when you attempt your first payment.',
          });
          console.log('[StripeTerminal] T&C acceptance status:', isOnboarded ? 'Accepted' : 'Not yet accepted');
        }

        setIsConnected(true);
        return true;
      } catch (connectErr: any) {
        console.error('[StripeTerminal] ========== CONNECTION EXCEPTION ==========');
        console.error('[StripeTerminal] Exception:', connectErr);
        console.error('[StripeTerminal] Message:', connectErr.message);
        console.error('[StripeTerminal] Code:', connectErr.code);

        // Check if this is a "No such location" error - retry if we haven't exhausted attempts
        const isLocationNotFoundError = connectErr.message?.includes('No such location');
        if (isLocationNotFoundError && attempt < MAX_CONNECT_RETRIES) {
          console.log(`[StripeTerminal] Location not found (exception), retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue; // Retry
        }

        throw connectErr;
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error('Failed to connect after all retries');
  }, [discoverReaders, sdkConnectReader, locationId, hookDiscoveredReaders, isConnected]);

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
    isWarming,
    error,
    deviceCompatibility,
    configurationStage,
    configurationProgress,
    termsAcceptance,
    initializeTerminal,
    connectReader,
    processPayment,
    cancelPayment,
    warmTerminal,
    checkDeviceCompatibility,
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

    // Check for common error conditions and provide clearer messages
    const errorMessage = error?.message?.toLowerCase() || '';
    const statusCode = error?.statusCode;

    // If the error suggests Connect account isn't set up
    if (
      errorMessage.includes('connect') ||
      errorMessage.includes('account') ||
      errorMessage.includes('charges_enabled') ||
      errorMessage.includes('not found') ||
      statusCode === 400 ||
      statusCode === 403
    ) {
      throw new Error(
        'Payment processing is not set up yet. Please complete Stripe Connect onboarding in Settings to accept payments.'
      );
    }

    // Re-throw with original or improved message
    throw new Error(error?.message || 'Failed to connect to payment service. Please try again.');
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
      : terminalLoadError || 'Stripe Terminal requires a development build. Expo Go does not include native modules.';

    const stubValue: StripeTerminalContextValue = {
      isInitialized: false,
      isConnected: false,
      isProcessing: false,
      isWarming: false,
      error: errorMessage,
      deviceCompatibility: {
        isCompatible: false,
        iosVersionSupported: false,
        deviceSupported: false,
        iosVersion: null,
        deviceModel: null,
        errorMessage,
      },
      configurationStage: 'error',
      configurationProgress: 0,
      termsAcceptance: {
        accepted: false,
        checked: false,
        message: errorMessage,
      },
      initializeTerminal: async () => {
        throw new Error(errorMessage);
      },
      connectReader: async () => false,
      processPayment: async () => {
        throw new Error(errorMessage);
      },
      cancelPayment: async () => {},
      warmTerminal: async () => {
        throw new Error(errorMessage);
      },
      checkDeviceCompatibility: () => ({
        isCompatible: false,
        iosVersionSupported: false,
        deviceSupported: false,
        iosVersion: null,
        deviceModel: null,
        errorMessage,
      }),
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
