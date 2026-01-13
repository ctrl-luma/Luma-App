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
  Linking,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { useTheme } from '../context/ThemeContext';
import { useTerminal, ConfigurationStage } from '../context/StripeTerminalContext';
import { glass } from '../lib/colors';
import { shadows } from '../lib/shadows';

// Apple TTPOi 5.4: Region-correct copy
const TAP_TO_PAY_NAME = Platform.OS === 'ios' ? 'Tap to Pay on iPhone' : 'Tap to Pay';

interface TapToPayOnboardingModalProps {
  visible: boolean;
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

  const glassColors = isDark ? glass.dark : glass.light;
  const styles = createStyles(colors, glassColors, isDark);

  // Handle enable button press - triggers T&C acceptance flow
  const handleEnable = async () => {
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

  // Device not compatible - show different UI
  if (!deviceCompatibility.isCompatible && Platform.OS === 'ios') {
    return (
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
        <BlurView intensity={80} style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.card}>
              <View style={[styles.iconContainer, styles.iconError]}>
                <Ionicons name="phone-portrait-outline" size={40} color={colors.error} />
              </View>
              <Text style={styles.title}>Device Not Supported</Text>
              <Text style={styles.description}>
                {deviceCompatibility.errorMessage ||
                  `${TAP_TO_PAY_NAME} requires iPhone XS or later with iOS 16.4+.`}
              </Text>
              <TouchableOpacity style={styles.dismissButton} onPress={onComplete}>
                <Text style={styles.dismissButtonText}>Continue Without Tap to Pay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <BlurView intensity={80} style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.card}>
            {/* Success State */}
            {setupComplete ? (
              <>
                <View style={[styles.iconContainer, styles.iconSuccess]}>
                  <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                </View>
                <Text style={styles.title}>{TAP_TO_PAY_NAME} Enabled!</Text>
                <Text style={styles.description}>
                  You're all set to accept contactless payments.
                </Text>
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading tutorial...</Text>
                </View>
              </>
            ) : isEnabling ? (
              /* Configuration Progress State - Apple TTPOi 3.9.1 */
              <>
                <View style={styles.progressContainer}>
                  <View style={styles.progressCircle}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                  <Text style={styles.progressPercent}>{Math.round(configurationProgress)}%</Text>
                </View>
                {/* Progress bar */}
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${configurationProgress}%` }]} />
                </View>
                <Text style={styles.title}>Setting Up {TAP_TO_PAY_NAME}</Text>
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
                {/* Icon */}
                <View style={styles.iconContainer}>
                  <LinearGradient
                    colors={[colors.primary, colors.primary700]}
                    style={styles.iconGradient}
                  >
                    <View style={styles.iconInner}>
                      <Ionicons name="wifi" size={32} color="#fff" style={styles.wifiIcon} />
                    </View>
                  </LinearGradient>
                </View>

                {/* Title */}
                <Text style={styles.title}>Enable {TAP_TO_PAY_NAME}</Text>

                {/* Description */}
                <Text style={styles.description}>
                  Accept contactless payments directly on your device. No additional hardware needed.
                </Text>

                {/* Features list */}
                <View style={styles.featuresList}>
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={styles.featureText}>Quick and secure payments</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={styles.featureText}>Works with cards and digital wallets</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={styles.featureText}>No card reader required</Text>
                  </View>
                </View>

                {/* Error message */}
                {(error || terminalError) && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="warning-outline" size={18} color={colors.error} />
                    <Text style={styles.errorText}>{error || terminalError}</Text>
                  </View>
                )}

                {/* Apple Terms Link - Apple TTPOi 3.3 */}
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.termsLink}
                    onPress={() => Linking.openURL('https://www.apple.com/legal/privacy/en-ww/tap-to-pay/')}
                  >
                    <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.termsLinkText}>Apple Tap to Pay Privacy Policy</Text>
                  </TouchableOpacity>
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
                    <Text style={styles.enableButtonText}>Enable {TAP_TO_PAY_NAME}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Skip option - minimal visibility but available */}
                <TouchableOpacity style={styles.skipLink} onPress={onComplete}>
                  <Text style={styles.skipLinkText}>Set up later in Settings</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: '90%',
      maxWidth: 400,
    },
    card: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderRadius: 24,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      ...shadows.xl,
    },
    iconContainer: {
      marginBottom: 20,
    },
    iconGradient: {
      width: 80,
      height: 80,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.md,
    },
    iconInner: {
      width: 50,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconSuccess: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.success + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconError: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.error + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    wifiIcon: {
      transform: [{ rotate: '90deg' }],
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    description: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 20,
    },
    featuresList: {
      width: '100%',
      backgroundColor: isDark ? '#111827' : '#f3f4f6',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    featureText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    termsLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 20,
    },
    termsLinkText: {
      fontSize: 12,
      color: colors.textMuted,
      textDecorationLine: 'underline',
    },
    enableButtonWrapper: {
      width: '100%',
    },
    enableButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 16,
      borderRadius: 16,
      ...shadows.sm,
    },
    enableButtonText: {
      fontSize: 17,
      fontWeight: '600',
      color: '#fff',
    },
    skipLink: {
      marginTop: 16,
      paddingVertical: 8,
    },
    skipLinkText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    // Progress state styles
    progressContainer: {
      alignItems: 'center',
      marginBottom: 16,
    },
    progressCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    progressPercent: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
    progressBarContainer: {
      width: '100%',
      height: 6,
      backgroundColor: isDark ? '#374151' : '#e5e7eb',
      borderRadius: 3,
      marginBottom: 20,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    progressText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    stageText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 8,
    },
    hintText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    // Loading state
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 8,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    // Error state
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.error + '15',
      padding: 12,
      borderRadius: 12,
      marginBottom: 16,
      width: '100%',
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: colors.error,
    },
    // Dismiss button for incompatible devices
    dismissButton: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      backgroundColor: isDark ? '#111827' : '#f3f4f6',
      borderRadius: 16,
      marginTop: 8,
    },
    dismissButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
