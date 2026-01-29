/**
 * Tap to Pay Education Screen
 * Apple TTPOi Requirements:
 * - 3.5: Clear action to trigger T&C acceptance (Enable button)
 * - 3.9.1: Configuration progress indicator
 *
 * iOS: Shows enable screen, then Apple's native ProximityReaderDiscovery education UI.
 * Android: Auto-enables and navigates back (no education required by Google).
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { useTapToPayEducation } from '../hooks/useTapToPayEducation';

import { useTheme } from '../context/ThemeContext';
import { useTerminal, ConfigurationStage } from '../context/StripeTerminalContext';
import { glass } from '../lib/colors';
import { shadows, glow } from '../lib/shadows';
import { spacing, radius } from '../lib/spacing';
import logger from '../lib/logger';

// Apple TTPOi 5.4: Region-correct copy
const TAP_TO_PAY_NAME = Platform.OS === 'ios' ? 'Tap to Pay on iPhone' : 'Tap to Pay';

// Configuration stage messages for progress indicator (Apple TTPOi 3.9.1)
const STAGE_MESSAGES: Record<ConfigurationStage, string> = {
  idle: 'Preparing...',
  checking_compatibility: 'Checking device compatibility...',
  initializing: 'Initializing payment terminal...',
  fetching_location: 'Fetching location...',
  discovering_reader: 'Discovering reader...',
  connecting_reader: 'Connecting to reader...',
  ready: 'Ready to accept payments!',
  error: 'Setup failed',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Star components for loading state
function Star({ style, size = 8, color = 'rgba(255,255,255,0.8)' }: { style?: any; size?: number; color?: string }) {
  return (
    <View style={[{ position: 'absolute' }, style]}>
      <View style={{
        width: size, height: size, backgroundColor: color,
        borderRadius: size / 2, shadowColor: color,
        shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: size * 1.5,
      }} />
    </View>
  );
}

function FourPointStar({ style, size = 16, color = 'rgba(255,255,255,0.9)' }: { style?: any; size?: number; color?: string }) {
  return (
    <View style={[{ position: 'absolute', width: size, height: size }, style]}>
      <View style={{ position: 'absolute', left: size / 2 - 1, top: 0, width: 2, height: size, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', top: size / 2 - 1, left: 0, width: size, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: size / 2 - 2, top: size / 2 - 2, width: 4, height: 4, backgroundColor: color, borderRadius: 2, shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: size / 2 }} />
    </View>
  );
}

function GlowingStar({ size = 32, color, glowColor, pulseAnim }: { size?: number; color: string; glowColor: string; pulseAnim: Animated.Value }) {
  return (
    <Animated.View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center', opacity: pulseAnim, transform: [{ scale: pulseAnim }] }}>
      <View style={{ position: 'absolute', width: size * 1.5, height: size * 1.5, borderRadius: size, backgroundColor: glowColor, shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: size }} />
      <View style={{ position: 'absolute', width: 3, height: size, backgroundColor: color, borderRadius: 1.5, shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8 }} />
      <View style={{ position: 'absolute', width: size, height: 3, backgroundColor: color, borderRadius: 1.5, shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8 }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10 }} />
    </Animated.View>
  );
}

function FullScreenStarLoader() {
  const { colors, isDark } = useTheme();
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.7)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(sparkleAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(sparkleAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0.7, duration: 1200, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.timing(rotateAnim, { toValue: 1, duration: 8000, useNativeDriver: true })).start();
  }, []);

  const rotation = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const starColor = isDark ? '#fff' : colors.primary;
  const glowColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(99,102,241,0.2)';

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden' as const, backgroundColor: isDark ? '#09090b' : colors.background, opacity: fadeAnim }]}>
      <LinearGradient
        colors={isDark
          ? ['transparent', 'rgba(99, 102, 241, 0.08)', 'rgba(139, 92, 246, 0.05)', 'transparent']
          : ['transparent', 'rgba(99, 102, 241, 0.05)', 'rgba(139, 92, 246, 0.03)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: sparkleAnim }]}>
        <FourPointStar style={{ top: 40, left: 30 }} size={14} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(99,102,241,0.4)'} />
        <Star style={{ top: 80, left: 70 }} size={4} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(99,102,241,0.3)'} />
        <Star style={{ top: 60, right: 50 }} size={6} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(139,92,246,0.35)'} />
        <FourPointStar style={{ top: 100, right: 35 }} size={12} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(99,102,241,0.3)'} />
        <Star style={{ top: 130, left: 45 }} size={3} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(139,92,246,0.25)'} />
        <Star style={{ top: 70, left: SCREEN_WIDTH * 0.45 }} size={5} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(99,102,241,0.3)'} />
        <Star style={{ top: 150, right: 80 }} size={4} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(139,92,246,0.25)'} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, sparkleAnim) }]}>
        <Star style={{ top: 50, left: 50 }} size={5} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(99,102,241,0.3)'} />
        <FourPointStar style={{ top: 85, right: 40 }} size={16} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(139,92,246,0.35)'} />
        <Star style={{ top: 120, left: 30 }} size={4} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(99,102,241,0.25)'} />
        <Star style={{ top: 75, left: SCREEN_WIDTH * 0.55 }} size={6} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(139,92,246,0.3)'} />
        <FourPointStar style={{ top: 35, right: 90 }} size={10} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.25)'} />
        <Star style={{ top: 140, right: 55 }} size={3} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(139,92,246,0.25)'} />
        <Star style={{ top: 95, left: 90 }} size={5} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(99,102,241,0.3)'} />
      </Animated.View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <GlowingStar size={36} color={starColor} glowColor={glowColor} pulseAnim={pulseAnim} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}


export function TapToPayEducationScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const glassColors = isDark ? glass.dark : glass.light;

  // Auth context for user ID
  const { user } = useAuth();

  // Education tracking - mark as seen when user completes this screen
  const { markEducationSeen } = useTapToPayEducation(user?.id);

  // Terminal context for enabling Tap to Pay
  const {
    deviceCompatibility,
    configurationStage,
    configurationProgress,
    connectReader,
    initializeTerminal,
    isInitialized,
    isConnected,
    error: terminalError,
  } = useTerminal();

  // Platform-specific behavior:
  // - iOS 18+: Use ProximityReaderDiscovery for Apple's native education UI
  // - iOS 16-17: Use custom education slides
  // - Android: Skip education entirely (not required by Google)
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';

  // Check if ProximityReaderDiscovery is available (iOS 18+)
  const [proximityDiscoveryAvailable, setProximityDiscoveryAvailable] = useState<boolean | null>(null);
  const [appleEducationActive, setAppleEducationActive] = useState(false);
  const educationCompleteRef = useRef(false);

  useEffect(() => {
    if (isIOS) {
      // Dynamically import to avoid loading native module on Android/Expo Go
      import('../lib/native/ProximityReaderDiscovery')
        .then(module => module.isProximityReaderDiscoveryAvailable())
        .then((available) => {
          logger.log('[TapToPayEducation] ProximityReaderDiscovery available:', available);
          setProximityDiscoveryAvailable(available);
        })
        .catch((err) => {
          logger.log('[TapToPayEducation] ProximityReaderDiscovery check failed:', err);
          setProximityDiscoveryAvailable(false);
        });
    } else {
      setProximityDiscoveryAvailable(false);
    }
  }, [isIOS]);

  // iOS 18+: Use ProximityReaderDiscovery for Apple's native education UI
  const useAppleNativeEducation = isIOS && proximityDiscoveryAvailable === true;

  useEffect(() => {
    logger.log('[TapToPayEducation] State:', {
      isIOS, isAndroid, isConnected, isInitialized,
      proximityDiscoveryAvailable, appleEducationActive,
    });
  }, [isIOS, isAndroid, isConnected, isInitialized, proximityDiscoveryAvailable, appleEducationActive]);

  const [isEnabling, setIsEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [isConnectSetupError, setIsConnectSetupError] = useState(false);

  const styles = createStyles(colors, glassColors, isDark);

  const navigateBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Onboarding flow (came via replace) — go to main screen
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    }
  };

  // iOS 18+ already connected (T&C previously accepted): show Apple native education directly
  useEffect(() => {
    if (isIOS && isConnected && useAppleNativeEducation && !appleEducationActive) {
      logger.log('[TapToPayEducation] Already connected, showing Apple native education');
      showAppleNativeEducation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIOS, isConnected, useAppleNativeEducation]);

  // Android auto-enable on mount: Connect reader and navigate back immediately
  useEffect(() => {
    if (isAndroid) {
      // If already connected, just mark as seen and navigate back
      if (isConnected) {
        markEducationSeen();
        navigateBack();
        return;
      }
      // Otherwise, auto-enable
      if (!isEnabling) {
        handleAndroidAutoEnable();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAndroid, isConnected]);

  const handleAndroidAutoEnable = async () => {
    setIsEnabling(true);
    try {
      if (!isInitialized) {
        await initializeTerminal();
      }
      const connected = await connectReader();
      if (connected) {
        markEducationSeen();
        navigateBack();
      } else {
        setEnableError('Failed to enable Tap to Pay. Please try again.');
      }
    } catch (err: any) {
      logger.error('[TapToPayEducation] Android enable failed:', err);
      setEnableError(err.message || 'Failed to enable Tap to Pay');
    } finally {
      setIsEnabling(false);
    }
  };

  // iOS 18+: Show Apple's native education UI after T&C acceptance
  const showAppleNativeEducation = async () => {
    setAppleEducationActive(true);
    try {
      const { showProximityReaderDiscoveryEducation } = await import('../lib/native/ProximityReaderDiscovery');
      await showProximityReaderDiscoveryEducation();
    } catch (err: any) {
      logger.warn('[TapToPayEducation] Apple education dismissed or failed:', err);
    }
    // Mark complete so loading guard doesn't re-show, then navigate immediately
    educationCompleteRef.current = true;
    setAppleEducationActive(false);
    navigateBack();
    markEducationSeen();
  };

  // Check if device is not compatible
  const isDeviceIncompatible = !deviceCompatibility.isCompatible;

  // Handle enable button press - triggers T&C acceptance flow (Apple TTPOi 3.5)
  const handleEnable = async () => {
    // Check device compatibility first
    if (isDeviceIncompatible) {
      setEnableError(
        deviceCompatibility.errorMessage ||
        (Platform.OS === 'ios'
          ? `${TAP_TO_PAY_NAME} requires iPhone XS or later with iOS 16.4+.`
          : `${TAP_TO_PAY_NAME} requires an Android device with NFC capability.`)
      );
      return;
    }

    setIsEnabling(true);
    setEnableError(null);
    setIsConnectSetupError(false);

    try {
      // Initialize terminal if not already done
      if (!isInitialized) {
        await initializeTerminal();
      }

      // Connect reader - this triggers Apple's T&C acceptance screen
      const connected = await connectReader();

      if (connected) {
        // Show Apple's native education UI after T&C acceptance
        await showAppleNativeEducation();
        return;
      } else {
        setEnableError('Failed to connect. Please try again.');
      }
    } catch (err: any) {
      logger.error('[TapToPayEducation] Enable failed:', err);
      const errorMsg = err.message?.toLowerCase() || '';
      const errorCode = err.code?.toLowerCase() || '';

      // Check for ToS cancellation first (user declined Apple's Terms of Service)
      if (
        errorCode.includes('tosacceptancecanceled') ||
        errorMsg.includes('terms of service') ||
        errorMsg.includes('tos acceptance')
      ) {
        // User cancelled ToS - this is not a setup error, just needs retry
        setEnableError('You must accept the Terms of Service to use Tap to Pay. Please try again.');
      }
      // Check if this is a Stripe Connect setup error
      else if (
        errorMsg.includes('connection token') ||
        errorMsg.includes('tokenprovider') ||
        errorMsg.includes('payment processing is not set up') ||
        errorMsg.includes('stripe connect') ||
        errorMsg.includes('connected account') ||
        errorMsg.includes('no connected account')
      ) {
        setIsConnectSetupError(true);
        setEnableError('You need to set up payment processing before enabling Tap to Pay.');
      } else {
        setEnableError(err.message || 'Failed to enable Tap to Pay');
      }
    } finally {
      setIsEnabling(false);
    }
  };

  // Navigate to Stripe onboarding
  const handleGoToPaymentSetup = () => {
    navigation.navigate('StripeOnboarding');
  };

  const handleClose = () => {
    markEducationSeen();
    navigateBack();
  };

  // Determine button text based on current state
  const getButtonText = () => {
    if (isEnabling) return 'Enabling...';
    if (isConnected) return 'Continue';
    return `Enable ${TAP_TO_PAY_NAME}`;
  };

  const handleButtonPress = () => {
    if (isConnected) {
      // Already enabled, show Apple education
      showAppleNativeEducation();
    } else {
      handleEnable();
    }
  };

  // Android: Show simple enabling/success UI (no education slides needed)
  if (isAndroid) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Setting Up Tap to Pay</Text>
          <View style={styles.skipButton} />
        </View>
        <View style={styles.androidCenterContent}>
          {isEnabling ? (
            <>
              <View style={styles.progressIconContainer}>
                <View style={styles.progressRing}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              </View>
              <Text style={styles.slideTitle}>Enabling Tap to Pay</Text>
              <Text style={styles.slideDescription}>
                Please wait while we set up contactless payments...
              </Text>
            </>
          ) : enableError ? (
            <>
              <View style={[styles.iconContainer, { marginBottom: 24 }]}>
                <LinearGradient
                  colors={[colors.error, colors.error]}
                  style={styles.iconGradient}
                >
                  <Ionicons name="alert-circle" size={64} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.slideTitle}>Setup Failed</Text>
              <Text style={styles.slideDescription}>{enableError}</Text>
              <TouchableOpacity
                onPress={handleAndroidAutoEnable}
                activeOpacity={0.9}
                style={{ marginTop: 32 }}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primary700]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.nextButton}
                >
                  <Text style={styles.nextButtonText}>Try Again</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={80} color={colors.success} />
              </View>
              <Text style={styles.slideTitle}>Ready to Go!</Text>
              <Text style={styles.slideDescription}>
                Tap to Pay is now enabled on your device.
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // iOS: Show starry loading while checking availability, Apple education is active,
  // or already connected and about to auto-launch Apple education via useEffect
  const pendingEducation = isIOS && isConnected && useAppleNativeEducation && !educationCompleteRef.current;
  if (proximityDiscoveryAvailable === null || appleEducationActive || pendingEducation) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <FullScreenStarLoader />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set Up Tap to Pay</Text>
        <View style={styles.skipButton} />
      </View>

      {/* Enable Screen */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.slideScrollContent}
        style={styles.slidesContainer}
      >
        {isEnabling ? (
          /* Configuration Progress State - Apple TTPOi 3.9.1 */
          <>
            <View style={styles.progressIconContainer}>
              <View style={styles.progressRing}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            </View>
            <Text style={styles.progressPercent}>{Math.round(configurationProgress)}%</Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${configurationProgress}%` }]}>
                <LinearGradient
                  colors={[colors.primary, colors.primary500]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            </View>
            <Text style={styles.slideTitle}>Setting Up</Text>
            <Text style={styles.stageText}>
              {STAGE_MESSAGES[configurationStage] || 'Please wait...'}
            </Text>
            {configurationStage === 'connecting_reader' && (
              <Text style={styles.hintText}>
                You may be prompted to accept Terms & Conditions
              </Text>
            )}
          </>
        ) : (
          /* Initial Enable State */
          <>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={[colors.primary, colors.primary700]}
                style={styles.iconGradient}
              >
                <Ionicons name="wifi" size={64} color="#fff" style={styles.nfcIcon} />
              </LinearGradient>
            </View>
            <Text style={styles.slideTitle}>Enable {TAP_TO_PAY_NAME}</Text>
            <Text style={styles.slideDescription}>
              Turn your device into a payment terminal. Accept contactless cards and digital wallets instantly.
            </Text>

            {/* Features list */}
            <View style={styles.tipsContainer}>
              {[
                { icon: 'shield-checkmark', text: 'Secure & encrypted payments' },
                { icon: 'card', text: 'All major cards & wallets' },
                { icon: 'flash', text: 'No extra hardware needed' },
              ].map((feature, index) => (
                <View key={index} style={styles.tipRow}>
                  <View style={styles.featureIconBg}>
                    <Ionicons name={feature.icon as any} size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.tipText}>{feature.text}</Text>
                </View>
              ))}
            </View>

            {/* Error message */}
            {(enableError || terminalError) && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={styles.errorText}>{enableError || terminalError}</Text>
                {isConnectSetupError && (
                  <TouchableOpacity
                    style={styles.setupPaymentsButton}
                    onPress={handleGoToPaymentSetup}
                  >
                    <Ionicons name="card-outline" size={18} color="#fff" />
                    <Text style={styles.setupPaymentsButtonText}>Set Up Payments</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleButtonPress}
          activeOpacity={0.9}
          disabled={isEnabling}
        >
          <LinearGradient
            colors={isEnabling ? [colors.gray600, colors.gray700] : [colors.primary, colors.primary700]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.nextButton}
          >
            {isEnabling ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>{getButtonText()}</Text>
                {!isConnected && (
                  <Ionicons name="flash" size={20} color="#fff" />
                )}
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: glassColors.backgroundSubtle,
      borderBottomWidth: 1,
      borderBottomColor: glassColors.borderSubtle,
    },
    closeButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: glassColors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    skipButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    slidesContainer: {
      flex: 1,
    },
    slideScrollContent: {
      paddingHorizontal: 32,
      paddingTop: 40,
      paddingBottom: 40,
      alignItems: 'center',
    },
    iconContainer: {
      marginBottom: 32,
    },
    iconGradient: {
      width: 120,
      height: 120,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.lg,
    },
    slideTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    slideDescription: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    tipsContainer: {
      width: '100%',
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      ...shadows.sm,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
      gap: 12,
    },
    tipText: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
    },
    footer: {
      padding: 20,
      paddingBottom: 32,
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      borderRadius: 20,
      gap: 8,
      ...shadows.md,
    },
    nextButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
    },
    // Enable slide - Progress state styles
    progressIconContainer: {
      marginBottom: spacing.lg,
    },
    progressRing: {
      width: 100,
      height: 100,
      borderRadius: 50,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      borderWidth: 3,
      borderColor: colors.primary + '30',
    },
    progressPercent: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: spacing.md,
    },
    progressBarContainer: {
      width: '80%',
      height: 6,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: spacing.xl,
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
      overflow: 'hidden',
    },
    stageText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    hintText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.md,
      fontStyle: 'italic',
    },
    // Enable slide - Success state styles
    successIconContainer: {
      marginBottom: spacing.lg,
      ...glow(colors.success, 'subtle'),
    },
    // Enable slide - Initial state styles
    featureIconBg: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    nfcIcon: {
      transform: [{ rotate: '90deg' }],
    },
    // Error styles
    errorContainer: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: colors.error + '15',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.error + '30',
    },
    errorText: {
      fontSize: 14,
      color: colors.error,
      textAlign: 'center',
    },
    setupPaymentsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
    },
    setupPaymentsButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
    // Android-specific centered content layout
    androidCenterContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
  });
