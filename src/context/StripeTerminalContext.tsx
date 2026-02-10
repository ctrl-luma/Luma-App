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
import Constants from 'expo-constants';

// Conditionally import expo-device (safe for Expo Go)
let Device: typeof import('expo-device') | null = null;
try {
  Device = require('expo-device');
} catch {
  Device = null;
}
import { stripeTerminalApi } from '../lib/api';
import { useAuth } from './AuthContext';
import logger from '../lib/logger';

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
      logger.warn('[StripeTerminal]', terminalLoadError);
    }
  } catch (error: any) {
    terminalLoadError = `Stripe Terminal native module error: ${error?.message || error}`;
    logger.warn('[StripeTerminal] Failed to load terminal SDK:', error);
  }
} else if (isExpoGo) {
  terminalLoadError = 'Stripe Terminal is not available in Expo Go. Please use a development build (eas build --profile development).';
  logger.log('[StripeTerminal] Skipping native module load - running in Expo Go');
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
  readerUpdateProgress: number | null; // 0-100 when updating, null otherwise
  termsAcceptance: TermsAcceptanceStatus;
  initializeTerminal: () => Promise<void>;
  connectReader: () => Promise<boolean>;
  processPayment: (clientSecret: string) => Promise<{ status: string; paymentIntent: any }>;
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
      deviceModel: Device?.modelId || null,
      errorMessage: null,
    };
  }

  const osVersion = Device?.osVersion || null;
  const modelId = Device?.modelId || null;

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
  const [readerUpdateProgress, setReaderUpdateProgress] = useState<number | null>(null);
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
    connectedReader: sdkConnectedReader,
  } = useStripeTerminal({
    onUpdateDiscoveredReaders: (readers: any[]) => {
      logger.log('[StripeTerminal] Discovered readers via callback:', readers.length);
      if (readers.length > 0) {
        logger.log('[StripeTerminal] Reader details:', JSON.stringify(readers[0], null, 2));
      }
      discoveredReadersRef.current = readers;
    },
    onDidChangeConnectionStatus: (status: string) => {
      logger.log('[StripeTerminal] Connection status changed:', status);
      setIsConnected(status === 'connected');
    },
    onDidStartInstallingUpdate: (update: any) => {
      logger.log('[StripeTerminal] Started installing update:', update);
      setReaderUpdateProgress(0);
      setConfigurationStage('connecting_reader');
    },
    onDidReportReaderSoftwareUpdateProgress: (progress: number) => {
      // Progress is 0.0 to 1.0, convert to percentage
      const percentage = Math.round(progress * 100);
      logger.log('[StripeTerminal] Reader update progress:', percentage + '%');
      setReaderUpdateProgress(percentage);
      setConfigurationProgress(percentage);
    },
    onDidFinishInstallingUpdate: (update: any, error: any) => {
      logger.log('[StripeTerminal] Finished installing update:', update, error);
      setReaderUpdateProgress(null);
      if (!error) {
        setConfigurationProgress(100);
      }
    },
  });

  // Sync isConnected with SDK's connectedReader state
  // This catches auto-reconnects that don't fire onDidChangeConnectionStatus
  useEffect(() => {
    const sdkHasReader = !!sdkConnectedReader;
    if (sdkHasReader !== isConnected) {
      logger.log('[StripeTerminal] Syncing isConnected from SDK connectedReader:', sdkHasReader);
      setIsConnected(sdkHasReader);
    }
  }, [sdkConnectedReader, isConnected]);

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
        logger.warn('[StripeTerminal] Permission request failed:', err);
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
    logger.log('[StripeTerminal] ========== WARMING TERMINAL ==========');

    // Check device compatibility first
    const compatibility = checkDeviceCompatibilitySync();
    setDeviceCompatibility(compatibility);

    if (!compatibility.isCompatible && Platform.OS === 'ios') {
      logger.log('[StripeTerminal] Device not compatible for TTP:', compatibility.errorMessage);
      setError(compatibility.errorMessage);
      setConfigurationStage('error');
      return;
    }

    if (isInitialized) {
      logger.log('[StripeTerminal] Already initialized, skipping warm');
      return;
    }

    setIsWarming(true);
    setConfigurationStage('checking_compatibility');
    setConfigurationProgress(10);

    try {
      // Step 1: Initialize the SDK
      setConfigurationStage('initializing');
      setConfigurationProgress(30);
      logger.log('[StripeTerminal] Warming: Initializing SDK...');

      const initResult = await initialize();

      if (initResult.error) {
        // Handle osVersionNotSupported error (Apple TTPOi 1.3)
        if (initResult.error.code === 'osVersionNotSupported' ||
            initResult.error.message?.includes('osVersionNotSupported') ||
            initResult.error.message?.includes('OS version')) {
          logger.error('[StripeTerminal] iOS version not supported for TTP');
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
      logger.log('[StripeTerminal] Warming: Fetching location...');

      try {
        const { locationId: locId } = await stripeTerminalApi.getLocation();
        setLocationId(locId);
        logger.log('[StripeTerminal] Warming: Location cached:', locId);
      } catch (locErr: any) {
        logger.warn('[StripeTerminal] Warming: Location fetch failed (non-fatal):', locErr.message);
        // Don't fail warming for location errors - we can fetch later
      }

      setConfigurationStage('ready');
      setConfigurationProgress(100);
      logger.log('[StripeTerminal] ========== WARMING COMPLETE ==========');

    } catch (err: any) {
      logger.error('[StripeTerminal] Warming failed:', err.message);
      setError(err.message || 'Failed to warm terminal');
      setConfigurationStage('error');
    } finally {
      setIsWarming(false);
    }
  }, [initialize, isInitialized]);

  // Track if we've already attempted auto-connect on Android
  const hasAutoConnectedRef = useRef(false);

  // Auto-warm terminal on mount and when app comes to foreground (Apple TTPOi 1.4)
  // Only warm if Stripe Connect is set up (chargesEnabled)
  useEffect(() => {
    // Skip warming if Stripe Connect isn't set up yet
    if (!chargesEnabled) {
      logger.log('[StripeTerminal] Skipping auto-warm - Stripe Connect not set up (chargesEnabled=false)');
      return;
    }

    // Initial warm on mount
    if (!hasWarmedRef.current && deviceCompatibility.isCompatible) {
      logger.log('[StripeTerminal] Auto-warming on mount...');
      hasWarmedRef.current = true;
      warmTerminal().catch(err => {
        logger.error('[StripeTerminal] Auto-warm failed:', err);
      });
    }

    // Listen for app state changes to re-warm when coming to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        logger.log('[StripeTerminal] App came to foreground, checking terminal state...');
        // Re-warm if not initialized (connection may have been lost)
        if (!isInitialized && chargesEnabled) {
          warmTerminal().catch(err => {
            logger.error('[StripeTerminal] Re-warm on foreground failed:', err);
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
      logger.log('[StripeTerminal] Skipping location fetch - Stripe Connect not set up');
      return;
    }

    const fetchLocation = async () => {
      try {
        logger.log('[StripeTerminal] Fetching terminal location...');
        const { locationId: locId } = await stripeTerminalApi.getLocation();
        logger.log('[StripeTerminal] Got location:', locId);
        setLocationId(locId);
      } catch (err: any) {
        logger.warn('[StripeTerminal] Failed to fetch location:', err.message);
        // Don't fail - location will be fetched again when needed
      }
    };
    fetchLocation();
  }, [chargesEnabled]);

  const initializeTerminal = useCallback(async () => {
    logger.log('[StripeTerminal] ========== INITIALIZE START ==========');
    logger.log('[StripeTerminal] isInitialized:', isInitialized);

    if (isInitialized) {
      logger.log('[StripeTerminal] Already initialized, skipping');
      return;
    }

    try {
      logger.log('[StripeTerminal] Calling initialize()...');
      setError(null);

      const initResult = await initialize();
      logger.log('[StripeTerminal] Initialize result:', JSON.stringify(initResult, null, 2));

      if (initResult.error) {
        logger.error('[StripeTerminal] Initialize error:', initResult.error);
        const errMsg = `Init error: ${initResult.error.message || initResult.error.code || 'Unknown'}`;
        setError(errMsg);
        throw new Error(errMsg);
      }

      setIsInitialized(true);
      logger.log('[StripeTerminal] ========== INITIALIZE SUCCESS ==========');
    } catch (err: any) {
      logger.error('[StripeTerminal] ========== INITIALIZE FAILED ==========');
      logger.error('[StripeTerminal] Error:', err);
      logger.error('[StripeTerminal] Message:', err.message);
      setError(err.message || 'Failed to initialize terminal');
      throw err;
    }
  }, [initialize, isInitialized]);

  const connectReader = useCallback(async (): Promise<boolean> => {
    logger.log('[StripeTerminal] ========== CONNECT READER START ==========');
    logger.log('[StripeTerminal] Platform:', Platform.OS);
    logger.log('[StripeTerminal] Already connected:', isConnected);
    setError(null);

    // If already connected, skip discovery and connection
    if (isConnected) {
      logger.log('[StripeTerminal] Reader already connected, reusing connection');
      setConfigurationStage('ready');
      setConfigurationProgress(100);
      return true;
    }

    // Reset progress for this connect flow
    setConfigurationProgress(0);
    setConfigurationStage('fetching_location');

    // Ensure we have a location ID (required for Tap to Pay)
    let currentLocationId = locationId;
    logger.log('[StripeTerminal] Cached locationId:', currentLocationId);

    if (!currentLocationId) {
      logger.log('[StripeTerminal] No cached location, fetching from API...');
      try {
        const locationResponse = await stripeTerminalApi.getLocation();
        logger.log('[StripeTerminal] Location API response:', JSON.stringify(locationResponse));
        currentLocationId = locationResponse.locationId;
        setLocationId(currentLocationId);
        logger.log('[StripeTerminal] Got location:', currentLocationId);
      } catch (locErr: any) {
        logger.error('[StripeTerminal] Location fetch error:', locErr);
        logger.error('[StripeTerminal] Location error details:', JSON.stringify(locErr, null, 2));
        const errMsg = `Location error: ${locErr.message || locErr.error || 'Unknown error'}`;
        setError(errMsg);
        throw new Error(errMsg);
      }
    }

    // Discover Tap to Pay readers
    setConfigurationProgress(30);
    setConfigurationStage('discovering_reader');
    const useSimulator = false; // Set to true to test without real NFC hardware
    logger.log('[StripeTerminal] Discovering Tap to Pay reader...');
    logger.log('[StripeTerminal] Discovery params: { discoveryMethod: "tapToPay", simulated:', useSimulator, '}');

    // Clear previous discovered readers
    logger.log('[StripeTerminal] Clearing previous discovered readers...');
    discoveredReadersRef.current = [];

    // Start discovery - readers come via onUpdateDiscoveredReaders callback
    logger.log('[StripeTerminal] Calling discoverReaders()...');
    const discoverResult = await discoverReaders({
      discoveryMethod: 'tapToPay',
      simulated: useSimulator,
    });

    logger.log('[StripeTerminal] discoverReaders() returned');
    logger.log('[StripeTerminal] Discovery result:', JSON.stringify(discoverResult, null, 2));
    logger.log('[StripeTerminal] discoveredReadersRef.current:', discoveredReadersRef.current.length);
    logger.log('[StripeTerminal] hookDiscoveredReaders:', hookDiscoveredReaders?.length || 0);

    if (discoverResult.error) {
      logger.error('[StripeTerminal] Discovery error:', discoverResult.error);
      const errMsg = `Discovery: ${discoverResult.error.message || discoverResult.error.code || 'Unknown error'}`;
      setError(errMsg);
      setIsConnected(false);
      throw new Error(errMsg);
    }

    // Check if readers are already available from ref (callback may have fired during await)
    if (discoveredReadersRef.current.length > 0) {
      logger.log('[StripeTerminal] Readers already available in ref:', discoveredReadersRef.current.length);
    }

    // Wait for readers to be discovered via callback
    // Poll for up to 5 seconds for readers to appear
    let readers: any[] = discoveredReadersRef.current;
    if (readers.length === 0) {
      logger.log('[StripeTerminal] No readers in ref yet, polling...');
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        // Check ref first (updated by callback), then hook state
        readers = discoveredReadersRef.current.length > 0
          ? discoveredReadersRef.current
          : (hookDiscoveredReaders || []);
        logger.log('[StripeTerminal] Poll attempt', i + 1, '- ref:', discoveredReadersRef.current.length, '- hook:', hookDiscoveredReaders?.length || 0);
        if (readers.length > 0) {
          logger.log('[StripeTerminal] Found readers after polling!');
          break;
        }
      }
    }

    logger.log('[StripeTerminal] Final readers found:', readers.length);

    if (readers.length > 0) {
      logger.log('[StripeTerminal] Reader to connect:', JSON.stringify(readers[0], null, 2));
    }

    if (readers.length === 0) {
      logger.error('[StripeTerminal] No readers found after polling');
      const errMsg = 'No readers found. Ensure NFC is enabled and device supports Tap to Pay.';
      setError(errMsg);
      setIsConnected(false);
      throw new Error(errMsg);
    }

    // Connect to the Tap to Pay reader with the location ID
    setConfigurationProgress(60);
    setConfigurationStage('connecting_reader');
    // Retry logic for "No such location" error (can happen with newly created locations)
    const MAX_CONNECT_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;

    for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {
      logger.log('[StripeTerminal] ========== CONNECTING TO READER ==========');
      logger.log('[StripeTerminal] Reader:', readers[0].serialNumber || readers[0].id || 'unknown');
      logger.log('[StripeTerminal] Location ID:', currentLocationId);
      logger.log('[StripeTerminal] Attempt:', attempt, 'of', MAX_CONNECT_RETRIES);

      try {
        logger.log('[StripeTerminal] Calling sdkConnectReader()...');
        const connectResult = await sdkConnectReader({
          reader: readers[0],
          locationId: currentLocationId,
        }, 'tapToPay');

        logger.log('[StripeTerminal] sdkConnectReader() returned');
        logger.log('[StripeTerminal] Connect result:', JSON.stringify(connectResult, null, 2));

        if (connectResult.error) {
          logger.error('[StripeTerminal] Connect error:', connectResult.error);
          logger.error('[StripeTerminal] Error code:', connectResult.error.code);
          logger.error('[StripeTerminal] Error message:', connectResult.error.message);

          // Check if this is a "No such location" error - can happen with newly created locations
          const isLocationNotFoundError = connectResult.error.message?.includes('No such location');

          if (isLocationNotFoundError && attempt < MAX_CONNECT_RETRIES) {
            logger.log(`[StripeTerminal] Location not found, retrying in ${RETRY_DELAY_MS}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            continue; // Retry
          }

          // User-friendly error messages for known error codes
          const isMerchantBlocked = connectResult.error.code === 'TapToPayReaderMerchantBlocked';
          const errMsg = isMerchantBlocked
            ? 'Your account has been blocked from Tap to Pay. Please contact support.'
            : `Connect: ${connectResult.error.message || connectResult.error.code || 'Unknown error'}`;
          setError(errMsg);
          setIsConnected(false);
          throw new Error(errMsg);
        }

        logger.log('[StripeTerminal] ========== CONNECTED SUCCESSFULLY ==========');
        logger.log('[StripeTerminal] Connected reader:', connectResult.reader?.serialNumber || 'tap-to-pay');
        setConfigurationProgress(100);
        setConfigurationStage('ready');

        // Apple TTPOi Requirement: Check T&C acceptance status from the reader (not cached locally)
        // The SDK retrieves this status from Apple each time
        const connectedReader = connectResult.reader;
        logger.log('[StripeTerminal] Reader accountOnboarded:', connectedReader?.accountOnboarded);
        logger.log('[StripeTerminal] Full reader object:', JSON.stringify(connectedReader, null, 2));

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
          logger.log('[StripeTerminal] T&C acceptance status:', isOnboarded ? 'Accepted' : 'Not yet accepted');
        }

        setIsConnected(true);
        return true;
      } catch (connectErr: any) {
        logger.error('[StripeTerminal] ========== CONNECTION EXCEPTION ==========');
        logger.error('[StripeTerminal] Exception:', connectErr);
        logger.error('[StripeTerminal] Message:', connectErr.message);
        logger.error('[StripeTerminal] Code:', connectErr.code);

        // Check if this is a "No such location" error - retry if we haven't exhausted attempts
        const isLocationNotFoundError = connectErr.message?.includes('No such location');
        if (isLocationNotFoundError && attempt < MAX_CONNECT_RETRIES) {
          logger.log(`[StripeTerminal] Location not found (exception), retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue; // Retry
        }

        throw connectErr;
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error('Failed to connect after all retries');
  }, [discoverReaders, sdkConnectReader, locationId, hookDiscoveredReaders, isConnected]);

  // Android: Auto-connect reader after terminal is initialized
  useEffect(() => {
    if (
      Platform.OS === 'android' &&
      isInitialized &&
      !isConnected &&
      !hasAutoConnectedRef.current &&
      chargesEnabled
    ) {
      logger.log('[StripeTerminal] Android auto-connect: Terminal initialized, auto-connecting reader...');
      hasAutoConnectedRef.current = true;
      connectReader().catch(err => {
        logger.warn('[StripeTerminal] Android auto-connect failed (non-fatal):', err.message);
        hasAutoConnectedRef.current = false;
      });
    }
  }, [isInitialized, isConnected, chargesEnabled, connectReader]);

  const processPayment = useCallback(async (clientSecret: string) => {
    logger.log('[StripeTerminal] ========== PROCESS PAYMENT START ==========');
    logger.log('[StripeTerminal] Client secret provided:', clientSecret ? 'yes' : 'no');

    try {
      setIsProcessing(true);
      setError(null);

      // Step 1: Retrieve the payment intent using client secret
      // NOTE: The Terminal SDK's retrievePaymentIntent requires the client_secret, NOT the PI ID
      logger.log('[StripeTerminal] Step 1: Retrieving payment intent...');
      const { paymentIntent, error: retrieveError } = await retrievePaymentIntent(clientSecret);

      if (retrieveError) {
        logger.error('[StripeTerminal] Retrieve error:', retrieveError);
        throw new Error(retrieveError.message || 'Failed to retrieve payment intent');
      }

      logger.log('[StripeTerminal] Payment intent retrieved successfully');
      logger.log('[StripeTerminal] Amount:', paymentIntent?.amount);
      logger.log('[StripeTerminal] Status:', paymentIntent?.status);

      // Step 2: Collect payment method (shows Tap to Pay UI)
      logger.log('[StripeTerminal] Step 2: Collecting payment method (Tap to Pay UI)...');
      const { paymentIntent: collectedIntent, error: collectError } = await collectPaymentMethod({
        paymentIntent,
      });

      if (collectError) {
        logger.error('[StripeTerminal] Collect error:', collectError);
        throw new Error(collectError.message || 'Failed to collect payment method');
      }

      logger.log('[StripeTerminal] Payment method collected successfully');

      // Step 3: Confirm the payment
      logger.log('[StripeTerminal] Step 3: Confirming payment...');
      const { paymentIntent: confirmedIntent, error: confirmError } = await confirmPaymentIntent({
        paymentIntent: collectedIntent,
      });

      if (confirmError) {
        logger.error('[StripeTerminal] Confirm error:', confirmError);
        throw new Error(confirmError.message || 'Failed to confirm payment');
      }

      logger.log('[StripeTerminal] ========== PAYMENT SUCCESS ==========');
      logger.log('[StripeTerminal] Final status:', confirmedIntent?.status);

      return {
        status: confirmedIntent?.status || 'unknown',
        paymentIntent: confirmedIntent,
      };
    } catch (err: any) {
      logger.error('[StripeTerminal] ========== PAYMENT FAILED ==========');
      logger.error('[StripeTerminal] Error:', err.message);
      setError(err.message || 'Payment failed');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [retrievePaymentIntent, collectPaymentMethod, confirmPaymentIntent]);

  const cancelPayment = useCallback(async () => {
    try {
      logger.log('[StripeTerminal] Cancelling payment...');
      await cancelCollectPaymentMethod();
      logger.log('[StripeTerminal] Payment cancelled');
    } catch (err: any) {
      logger.warn('[StripeTerminal] Cancel failed:', err);
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
    readerUpdateProgress,
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
  logger.log('[StripeTerminal] Fetching connection token...');
  try {
    const { secret } = await stripeTerminalApi.getConnectionToken();
    logger.log('[StripeTerminal] Connection token received');
    return secret;
  } catch (error: any) {
    logger.error('[StripeTerminal] Failed to get connection token:', error);

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
      readerUpdateProgress: null,
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
