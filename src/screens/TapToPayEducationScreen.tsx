/**
 * Tap to Pay Education Screen
 * Apple TTPOi Requirements:
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../context/ThemeContext';
import { glass } from '../lib/colors';
import { shadows } from '../lib/shadows';
import { config } from '../lib/config';

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

  const [currentSlide, setCurrentSlide] = useState(0);
  const styles = createStyles(colors, glassColors);

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentSlide(slideIndex);
  };

  const goToSlide = (index: number) => {
    scrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const handleNext = () => {
    if (currentSlide < EDUCATION_SLIDES.length - 1) {
      goToSlide(currentSlide + 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSkip = () => {
    navigation.goBack();
  };

  const openStripeHelp = () => {
    Linking.openURL('https://support.stripe.com/');
  };

  const openVendorPortal = () => {
    Linking.openURL(config.vendorDashboardUrl);
  };

  const currentSlideData = EDUCATION_SLIDES[currentSlide];
  const isLastSlide = currentSlide === EDUCATION_SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleSkip}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Learn About Tap to Pay</Text>
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
        style={styles.slidesContainer}
      >
        {EDUCATION_SLIDES.map((slide, index) => (
          <View key={slide.id} style={styles.slide}>
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
          </View>
        ))}
      </ScrollView>

      {/* Pagination */}
      <View style={styles.pagination}>
        {EDUCATION_SLIDES.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.paginationDot,
              currentSlide === index && styles.paginationDotActive,
            ]}
            onPress={() => goToSlide(index)}
          />
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={handleNext} activeOpacity={0.9}>
          <LinearGradient
            colors={[colors.primary, colors.primary700]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.nextButton}
          >
            <Text style={styles.nextButtonText}>
              {isLastSlide ? 'Got It' : 'Next'}
            </Text>
            {!isLastSlide && (
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark) =>
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
      paddingHorizontal: 32,
      paddingTop: 40,
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
  });
