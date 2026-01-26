/**
 * Tap to Pay Education Screen
 * Apple TTPOi Requirements:
 * - 3.5: Clear action to trigger T&C acceptance (Enable button)
 * - 3.9.1: Configuration progress indicator
 * - 4.1: Provide easily accessible help documentation
 * - 4.2: Link to Stripe's help resources
 * - 4.3: Educate on keeping phone screen facing up during payment
 * - 4.4: Educate on moving device closer for weak signal
 * - 4.5: Educate that consumer may need to try again
 * - 4.6: PIN entry education for Ireland
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Linking,
  Platform,
  ActivityIndicator,
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
import { config } from '../lib/config';
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

// Education slides
interface EducationSlide {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  tips?: string[];
}

const EDUCATION_SLIDES: EducationSlide[] = [
  {
    id: 'intro',
    title: Platform.OS === 'ios' ? 'Tap to Pay on iPhone' : 'Tap to Pay',
    description: 'Accept contactless payments using your device. No additional hardware needed.',
    icon: 'phone-portrait-outline',
    tips: [
      'Works with contactless credit and debit cards',
      'Apple Pay, Google Pay, and other digital wallets',
      'Fast, secure, and convenient',
    ],
  },
  {
    id: 'position',
    title: 'Keep Screen Facing Up',
    description: 'Hold your device with the screen facing upward when accepting payment.',
    icon: 'tablet-portrait-outline',
    tips: [
      'Place device on a flat surface or hold steady',
      'Customer taps their card on the top part of your phone',
      'Keep screen visible to both you and the customer',
    ],
  },
  {
    id: 'signal',
    title: 'Move Closer if Needed',
    description: 'If the payment doesn\'t work immediately, ask the customer to move their card closer.',
    icon: 'scan-outline',
    tips: [
      'Cards should be within 1-2 inches of the device',
      'Remove thick phone cases if having issues',
      'Metal card holders may interfere with the signal',
    ],
  },
  {
    id: 'retry',
    title: 'Try Again if Needed',
    description: 'Sometimes the card needs to be repositioned. Ask the customer to try tapping again.',
    icon: 'refresh-outline',
    tips: [
      'Wait for the "Ready" screen before tapping',
      'Hold the card steady for 1-2 seconds',
      'Try a different angle or position',
    ],
  },
  {
    id: 'pin',
    title: 'PIN Entry (Some Regions)',
    description: 'For transactions in Ireland and some other regions, customers may need to enter their PIN.',
    icon: 'keypad-outline',
    tips: [
      'Hand the device to the customer for PIN entry',
      'Ensure privacy while they enter their PIN',
      'The screen will show a secure keypad',
      'VoiceOver accessibility is available on the PIN screen',
    ],
  },
  {
    // Apple TTPOi 4.7: Fallback Payment Method education (UK, IE, CAN)
    id: 'fallback',
    title: 'Alternative Payment',
    description: 'Some cards cannot complete contactless transactions. If this happens, you can enter the card details manually.',
    icon: 'card-outline',
    tips: [
      'Ask if customer has another contactless card or digital wallet',
      'Use manual card entry if contactless fails',
      'Enter the card number, expiration, and CVV',
      'Manual entry works with any credit or debit card',
    ],
  },
  {
    id: 'help',
    title: 'Need Help?',
    description: 'Access support resources anytime from the Settings menu.',
    icon: 'help-circle-outline',
    tips: [
      'Visit the Tap to Pay settings for more options',
      'Contact Stripe support for payment issues',
      'Check your internet connection if having problems',
    ],
  },
  {
    id: 'portal',
    title: 'Manage Your Business',
    description: 'Control your menus, view analytics, and manage payouts from the Vendor Portal.',
    icon: 'grid-outline',
    tips: [
      'Create and customize product menus',
      'View sales analytics and reports',
      'Manage payouts and billing',
      'Add team members and set permissions',
    ],
  },
];

export function TapToPayEducationScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const glassColors = isDark ? glass.dark : glass.light;
  const scrollViewRef = useRef<ScrollView>(null);

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

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isEnabling, setIsEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [isConnectSetupError, setIsConnectSetupError] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  const styles = createStyles(colors, glassColors, isDark);

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
        setIsEnabled(true);
        // Auto-advance to next slide after brief success display
        setTimeout(() => {
          goToSlide(1);
        }, 1000);
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

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentSlide(slideIndex);
  };

  const goToSlide = (index: number) => {
    scrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const handleNext = () => {
    // On enable slide, trigger enable flow
    if (currentSlide === 0 && !isEnabled && !isConnected) {
      handleEnable();
      return;
    }

    if (currentSlide < EDUCATION_SLIDES.length) {
      goToSlide(currentSlide + 1);
    } else {
      // User completed education - mark as seen so it doesn't show again
      markEducationSeen();
      navigation.goBack();
    }
  };

  const handleSkip = () => {
    // User skipped education - still mark as seen so it doesn't show again
    markEducationSeen();
    navigation.goBack();
  };

  // Total slides = 1 (enable) + education slides
  const totalSlides = EDUCATION_SLIDES.length + 1;
  const isOnEnableSlide = currentSlide === 0;
  const isLastSlide = currentSlide === totalSlides - 1;

  const openStripeHelp = () => {
    Linking.openURL('https://support.stripe.com/');
  };

  const openVendorPortal = () => {
    Linking.openURL(config.vendorDashboardUrl);
  };

  // Determine button text based on current state
  const getButtonText = () => {
    if (isOnEnableSlide) {
      if (isEnabling) return 'Enabling...';
      if (isEnabled || isConnected) return 'Continue';
      return `Enable ${TAP_TO_PAY_NAME}`;
    }
    return isLastSlide ? 'Got It' : 'Next';
  };

  // Determine if we should disable scrolling on enable slide until enabled
  const canScrollPastEnable = isEnabled || isConnected;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleSkip}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isOnEnableSlide ? 'Set Up Tap to Pay' : 'Learn About Tap to Pay'}
        </Text>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        scrollEnabled={canScrollPastEnable || currentSlide > 0}
        style={styles.slidesContainer}
      >
        {/* Enable Slide (First) */}
        <View style={styles.slide}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.slideScrollContent}
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
            ) : isEnabled || isConnected ? (
              /* Success State */
              <>
                <View style={styles.successIconContainer}>
                  <Ionicons name="checkmark-circle" size={80} color={colors.success} />
                </View>
                <Text style={styles.slideTitle}>You're All Set!</Text>
                <Text style={styles.slideDescription}>
                  {TAP_TO_PAY_NAME} is now enabled. Let's show you how it works.
                </Text>
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
        </View>

        {/* Education Slides */}
        {EDUCATION_SLIDES.map((slide) => (
          <View key={slide.id} style={styles.slide}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.slideScrollContent}
            >
              {/* Icon */}
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={[colors.primary, colors.primary700]}
                  style={styles.iconGradient}
                >
                  <Ionicons name={slide.icon} size={64} color="#fff" />
                </LinearGradient>
              </View>

              {/* Content */}
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideDescription}>{slide.description}</Text>

              {/* Tips */}
              {slide.tips && (
                <View style={styles.tipsContainer}>
                  {slide.tips.map((tip, tipIndex) => (
                    <View key={tipIndex} style={styles.tipRow}>
                      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                      <Text style={styles.tipText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Help link on help slide */}
              {slide.id === 'help' && (
                <TouchableOpacity style={styles.helpLink} onPress={openStripeHelp}>
                  <Ionicons name="open-outline" size={18} color={colors.primary} />
                  <Text style={styles.helpLinkText}>Visit Stripe Help Center</Text>
                </TouchableOpacity>
              )}

              {/* Vendor Portal link on portal slide */}
              {slide.id === 'portal' && (
                <TouchableOpacity style={styles.portalLink} onPress={openVendorPortal}>
                  <Ionicons name="laptop-outline" size={20} color="#fff" />
                  <Text style={styles.portalLinkText}>Open Vendor Portal</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* Pagination */}
      <View style={styles.pagination}>
        {Array.from({ length: totalSlides }).map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.paginationDot,
              currentSlide === index && styles.paginationDotActive,
            ]}
            onPress={() => (index === 0 || canScrollPastEnable) && goToSlide(index)}
            disabled={index > 0 && !canScrollPastEnable}
          />
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleNext}
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
                {!isLastSlide && !isOnEnableSlide && (
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                )}
                {isOnEnableSlide && !isEnabled && !isConnected && (
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
    skipButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    slidesContainer: {
      flex: 1,
    },
    slide: {
      width: SCREEN_WIDTH,
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
    helpLink: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 24,
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    helpLinkText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    portalLink: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 24,
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 24,
      backgroundColor: colors.primary,
      borderRadius: 16,
      ...shadows.md,
    },
    portalLinkText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 20,
      gap: 8,
    },
    paginationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: glassColors.border,
    },
    paginationDotActive: {
      width: 24,
      backgroundColor: colors.primary,
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
  });
