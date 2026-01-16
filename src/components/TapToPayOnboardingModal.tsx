/**
 * Tap to Pay Onboarding Modal
 * Apple TTPOi Requirements:
 * - 3.2: Full-screen modal awareness
 * - 3.3: Show to all eligible users at least once
 * - 3.5: Clear action to trigger T&C acceptance
 * - 3.9.1: Configuration progress indicator
 *
 * Shows on first login to enable Tap to Pay immediately.
 * Triggers T&C acceptance via connectReader(), then navigates to education.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../context/ThemeContext';
import { useTerminal, ConfigurationStage } from '../context/StripeTerminalContext';
import { glass, gradients } from '../lib/colors';
import { shadows, glow } from '../lib/shadows';
import { radius, spacing } from '../lib/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Apple TTPOi 5.4: Region-correct copy
const TAP_TO_PAY_NAME = Platform.OS === 'ios' ? 'Tap to Pay on iPhone' : 'Tap to Pay';

interface TapToPayOnboardingModalProps {
  visible: boolean;
  isLoading?: boolean;
  onComplete: () => void;
  onNavigateToEducation: () => void;
}

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

export function TapToPayOnboardingModal({
  visible,
  isLoading = false,
  onComplete,
  onNavigateToEducation,
}: TapToPayOnboardingModalProps) {
  const { colors, isDark } = useTheme();
  const {
    deviceCompatibility,
    configurationStage,
    configurationProgress,
    connectReader,
    initializeTerminal,
    isInitialized,
    termsAcceptance,
    error: terminalError,
  } = useTerminal();

  const [isEnabling, setIsEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [showDeviceError, setShowDeviceError] = useState(false);

  // Animations - start at 1 to prevent flash when transitioning from loading state
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const iconPulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const glassColors = isDark ? glass.dark : glass.light;

  // Entrance animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Start icon pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconPulseAnim, {
            toValue: 1.05,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(iconPulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visible]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: configurationProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [configurationProgress]);

  // Handle enable button press - triggers T&C acceptance flow
  const handleEnable = async () => {
    // Check device compatibility first
    if (!deviceCompatibility.isCompatible) {
      setShowDeviceError(true);
      return;
    }

    setIsEnabling(true);
    setError(null);

    try {
      // Initialize terminal if not already done
      if (!isInitialized) {
        await initializeTerminal();
      }

      // Connect reader - this triggers Apple's T&C acceptance screen
      const connected = await connectReader();

      if (connected) {
        setSetupComplete(true);
        // Brief delay to show success state, then navigate to education
        setTimeout(() => {
          onComplete();
          onNavigateToEducation();
        }, 1500);
      } else {
        setError('Failed to connect. Please try again.');
      }
    } catch (err: any) {
      console.error('[TapToPayOnboarding] Enable failed:', err);
      setError(err.message || 'Failed to enable Tap to Pay');
    } finally {
      setIsEnabling(false);
    }
  };

  const styles = createStyles(colors, glassColors, isDark);

  // Loading state - show solid background as splash while determining if onboarding is needed
  if (isLoading) {
    return (
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Modal>
    );
  }

  // Web platform - Tap to Pay not available
  if (Platform.OS === 'web') {
    return (
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          {/* Solid background to hide content behind modal */}
          <View style={StyleSheet.absoluteFill} />
          <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.card}>
              <View style={styles.topGradient}>
                <LinearGradient
                  colors={isDark ? gradients.glassDark : gradients.glassLight}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <View style={[styles.iconContainer, styles.iconMuted]}>
                <Ionicons name="desktop-outline" size={32} color={colors.textMuted} />
              </View>
              <Text style={styles.title}>Not Available on Web</Text>
              <Text style={styles.description}>
                Tap to Pay requires a physical device with NFC capability. Use the mobile app to accept contactless payments.
              </Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={onComplete} activeOpacity={0.8}>
                <Text style={styles.secondaryButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Solid black background to hide content behind modal during onboarding */}
        <View style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.card}>
            {/* Top gradient border */}
            <View style={styles.topGradient}>
              <LinearGradient
                colors={[colors.primary, colors.primary700]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </View>

            {/* Device Not Supported State - shown after user tries to enable */}
            {showDeviceError ? (
              <>
                <View style={[styles.iconContainer, styles.iconError]}>
                  <Ionicons name="phone-portrait-outline" size={32} color={colors.error} />
                </View>
                <Text style={styles.title}>Device Not Supported</Text>
                <Text style={styles.description}>
                  {deviceCompatibility.errorMessage || (Platform.OS === 'ios'
                    ? `${TAP_TO_PAY_NAME} requires iPhone XS or later with iOS 16.4+.`
                    : `${TAP_TO_PAY_NAME} requires an Android device with NFC capability.`)}
                </Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={onComplete} activeOpacity={0.8}>
                  <Text style={styles.secondaryButtonText}>Continue</Text>
                </TouchableOpacity>
              </>
            ) : setupComplete ? (
              /* Success State */
              <>
                <View style={[styles.iconContainer, styles.iconSuccess]}>
                  <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                </View>
                <Text style={styles.title}>You're All Set!</Text>
                <Text style={styles.description}>
                  {TAP_TO_PAY_NAME} is now enabled. Let's show you how it works.
                </Text>
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Opening tutorial...</Text>
                </View>
              </>
            ) : isEnabling ? (
              /* Configuration Progress State - Apple TTPOi 3.9.1 */
              <>
                <View style={styles.progressIconContainer}>
                  <View style={styles.progressRing}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                </View>

                <Text style={styles.progressPercent}>{Math.round(configurationProgress)}%</Text>

                {/* Progress bar */}
                <View style={styles.progressBarContainer}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.primary500]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                </View>

                <Text style={styles.title}>Setting Up</Text>
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
              /* Initial Awareness State */
              <>
                {/* Animated Icon */}
                <Animated.View style={[styles.iconContainer, { transform: [{ scale: iconPulseAnim }] }]}>
                  <LinearGradient
                    colors={[colors.primary, colors.primary700]}
                    style={styles.iconGradient}
                  >
                    <Ionicons name="wifi" size={28} color="#fff" style={styles.nfcIcon} />
                  </LinearGradient>
                </Animated.View>

                {/* Title */}
                <Text style={styles.title}>Enable {TAP_TO_PAY_NAME}</Text>

                {/* Description */}
                <Text style={styles.description}>
                  Turn your device into a payment terminal. Accept contactless cards and digital wallets instantly.
                </Text>

                {/* Features list */}
                <View style={styles.featuresList}>
                  {[
                    { icon: 'shield-checkmark', text: 'Secure & encrypted payments' },
                    { icon: 'card', text: 'All major cards & wallets' },
                    { icon: 'flash', text: 'No extra hardware needed' },
                  ].map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                      <View style={styles.featureIconBg}>
                        <Ionicons name={feature.icon as any} size={16} color={colors.primary} />
                      </View>
                      <Text style={styles.featureText}>{feature.text}</Text>
                    </View>
                  ))}
                </View>

                {/* Error message */}
                {(error || terminalError) && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={18} color={colors.error} />
                    <Text style={styles.errorText}>{error || terminalError}</Text>
                  </View>
                )}

                {/* Enable Button - Apple TTPOi 3.5: Clear action to trigger T&C acceptance */}
                <TouchableOpacity onPress={handleEnable} activeOpacity={0.9} style={styles.enableButtonWrapper}>
                  <LinearGradient
                    colors={[colors.primary, colors.primary700]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.enableButton}
                  >
                    <Ionicons name="flash" size={20} color="#fff" />
                    <Text style={styles.enableButtonText}>Get Started</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Skip option - minimal visibility but available */}
                <TouchableOpacity style={styles.skipLink} onPress={onComplete} activeOpacity={0.7}>
                  <Text style={styles.skipLinkText}>Set up later</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background, // Solid background to hide content during onboarding
    },
    container: {
      width: Math.min(SCREEN_WIDTH - 48, 380),
    },
    card: {
      backgroundColor: isDark ? colors.gray900 : '#ffffff',
      borderRadius: radius.xxl,
      padding: spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      overflow: 'hidden',
      ...shadows.xl,
    },
    topGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      overflow: 'hidden',
    },
    iconContainer: {
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    iconGradient: {
      width: 72,
      height: 72,
      borderRadius: radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.lg,
    },
    nfcIcon: {
      transform: [{ rotate: '90deg' }],
    },
    iconSuccess: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.success + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconError: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.error + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconMuted: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.textMuted + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
      letterSpacing: -0.3,
    },
    description: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.xs,
    },
    featuresList: {
      width: '100%',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    featureIconBg: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
      fontWeight: '500',
    },
    enableButtonWrapper: {
      width: '100%',
      ...glow(colors.primary, 'subtle'),
    },
    enableButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: 16,
      borderRadius: radius.lg,
    },
    enableButtonText: {
      fontSize: 17,
      fontWeight: '600',
      color: '#fff',
    },
    skipLink: {
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    skipLinkText: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '500',
    },
    secondaryButton: {
      paddingVertical: 14,
      paddingHorizontal: spacing.xl,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
      borderRadius: radius.lg,
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    // Progress state styles
    progressIconContainer: {
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    progressRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary + '10',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressPercent: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.md,
      letterSpacing: -0.5,
    },
    progressBarContainer: {
      width: '100%',
      height: 6,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      borderRadius: 3,
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
      overflow: 'hidden',
    },
    stageText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    hintText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    // Loading state
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    // Error state
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.error + '10',
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.lg,
      width: '100%',
      borderWidth: 1,
      borderColor: colors.error + '20',
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: colors.error,
      lineHeight: 18,
    },
  });
