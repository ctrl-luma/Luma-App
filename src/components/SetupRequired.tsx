import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { openVendorDashboard } from '../lib/auth-handoff';
import { glass } from '../lib/colors';
import { fonts } from '../lib/fonts';
import { shadows } from '../lib/shadows';

export type SetupType = 'no-catalogs' | 'no-payment-account';

interface SetupRequiredProps {
  type: SetupType;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Payment account setup - simple version
function PaymentSetupRequired({ colors }: { colors: any }) {
  const styles = createSimpleStyles(colors);

  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.iconContainer}>
        <Ionicons name="card-outline" size={64} color={colors.textMuted} />
      </View>
      <Text style={styles.title}>Payment Setup Required</Text>
      <Text style={styles.message}>
        Set up your payment account in the Vendor Portal to accept payments.
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={() => openVendorDashboard('/connect')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Set Up Payments"
        accessibilityHint="Opens the Vendor Portal to set up your payment account"
      >
        <Ionicons name="card" size={18} color="#fff" />
        <Text style={styles.buttonText}>Set Up Payments</Text>
        <Ionicons name="open-outline" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// Star component for Apple-style sparkle effect
function Star({ style, size = 8, color = 'rgba(255,255,255,0.8)' }: { style?: any; size?: number; color?: string }) {
  return (
    <View style={[{ position: 'absolute' }, style]}>
      <View style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: size / 2,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: size * 1.5,
      }} />
    </View>
  );
}

// Four-point star for larger sparkles
function FourPointStar({ style, size = 16, color = 'rgba(255,255,255,0.9)' }: { style?: any; size?: number; color?: string }) {
  return (
    <View style={[{ position: 'absolute', width: size, height: size }, style]}>
      {/* Vertical line */}
      <View style={{
        position: 'absolute',
        left: size / 2 - 1,
        top: 0,
        width: 2,
        height: size,
        backgroundColor: color,
        borderRadius: 1,
      }} />
      {/* Horizontal line */}
      <View style={{
        position: 'absolute',
        top: size / 2 - 1,
        left: 0,
        width: size,
        height: 2,
        backgroundColor: color,
        borderRadius: 1,
      }} />
      {/* Center glow */}
      <View style={{
        position: 'absolute',
        left: size / 2 - 2,
        top: size / 2 - 2,
        width: 4,
        height: 4,
        backgroundColor: color,
        borderRadius: 2,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: size / 2,
      }} />
    </View>
  );
}

// No catalogs - full welcome experience
function NoCatalogsWelcome({ colors, glassColors, isDark }: { colors: any; glassColors: typeof glass.dark; isDark: boolean }) {
  const navigation = useNavigation<any>();
  const { organization } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle sparkle animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const styles = createWelcomeStyles(colors, glassColors, isDark);

  const handleQuickCharge = () => {
    navigation.navigate('QuickCharge');
  };

  const handleOpenVendorPortal = () => {
    openVendorDashboard('/products');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Header - Dark with Apple-style stars */}
        <Animated.View
        style={[
          styles.headerContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <View style={[styles.headerBackground, { backgroundColor: isDark ? '#09090b' : colors.background }]}>
          {/* Subtle gradient overlay */}
          <LinearGradient
            colors={isDark
              ? ['transparent', 'rgba(99, 102, 241, 0.08)', 'rgba(139, 92, 246, 0.05)', 'transparent']
              : ['transparent', 'rgba(99, 102, 241, 0.05)', 'rgba(139, 92, 246, 0.03)', 'transparent']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Star field - Group 1 (fades in/out) */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: sparkleAnim }]}>
            <FourPointStar style={{ top: 25, left: 25 }} size={14} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(99,102,241,0.4)'} />
            <Star style={{ top: 50, left: 80 }} size={4} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(99,102,241,0.3)'} />
            <Star style={{ top: 35, right: 60 }} size={6} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(139,92,246,0.35)'} />
            <FourPointStar style={{ top: 70, right: 30 }} size={12} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(99,102,241,0.3)'} />
            <Star style={{ top: 90, left: 50 }} size={3} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(139,92,246,0.25)'} />
            <Star style={{ top: 40, left: SCREEN_WIDTH * 0.45 }} size={5} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(99,102,241,0.3)'} />
            <Star style={{ top: 110, right: 90 }} size={4} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(139,92,246,0.25)'} />
          </Animated.View>

          {/* Star field - Group 2 (opposite fade) */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, sparkleAnim) }]}>
            <Star style={{ top: 30, left: 55 }} size={5} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(99,102,241,0.3)'} />
            <FourPointStar style={{ top: 55, right: 45 }} size={16} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(139,92,246,0.35)'} />
            <Star style={{ top: 80, left: 35 }} size={4} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(99,102,241,0.25)'} />
            <Star style={{ top: 45, left: SCREEN_WIDTH * 0.55 }} size={6} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(139,92,246,0.3)'} />
            <FourPointStar style={{ top: 20, right: 100 }} size={10} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.25)'} />
            <Star style={{ top: 100, right: 50 }} size={3} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(139,92,246,0.25)'} />
            <Star style={{ top: 65, left: 100 }} size={5} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(99,102,241,0.3)'} />
          </Animated.View>

          {/* Welcome Content */}
          <View style={styles.headerContent}>
            <View style={[styles.headerIconContainer, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.1)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.15)'
            }]}>
              <Ionicons name="storefront" size={44} color={isDark ? 'rgba(255,255,255,0.95)' : colors.primary} />
            </View>
            <Text style={[styles.headerTitle, { color: isDark ? '#fff' : colors.text }]}>
              {organization?.name ? `Welcome, ${organization.name}!` : 'Welcome to Luma!'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: isDark ? 'rgba(255,255,255,0.55)' : colors.textSecondary }]}>
              Let's get your menu set up so you can start selling
            </Text>
          </View>

          {/* Create Menu Card - Primary Action */}
          <Animated.View
            style={[
              styles.cardContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              }
            ]}
          >
            <TouchableOpacity
              style={[styles.primaryCard, { backgroundColor: glassColors.backgroundElevated, borderColor: glassColors.border }]}
              onPress={handleOpenVendorPortal}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Create Your Menu"
              accessibilityHint="Opens the Vendor Portal to create your product menu"
            >
              <View style={styles.cardHeader}>
                <View style={[styles.primaryIconContainer, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="grid" size={28} color={colors.primary} />
                </View>
                <View style={[styles.cardBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.cardBadgeText}>GET STARTED</Text>
                </View>
              </View>

              <Text style={[styles.primaryCardTitle, { color: colors.text }]}>Create Your Menu</Text>
              <Text style={[styles.primaryCardDescription, { color: colors.textSecondary }]}>
                Set up your products with photos, prices, and categories. Your menu will sync instantly to this app.
              </Text>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>Add products with photos & prices</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>Organize into categories</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>Configure tips & tax settings</Text>
                </View>
              </View>

              <View style={[styles.primaryCardButton, { backgroundColor: isDark ? '#fff' : '#09090b' }]}>
                <Text style={[styles.primaryCardButtonText, { color: isDark ? '#09090b' : '#fff' }]}>Open Vendor Portal</Text>
                <Ionicons name="arrow-forward" size={18} color={isDark ? '#09090b' : '#fff'} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Quick Charge Option - Secondary */}
          <Animated.View
            style={[
              styles.quickChargeContainer,
              { opacity: fadeAnim }
            ]}
          >
            <View style={[styles.quickChargeCard, { backgroundColor: glassColors.backgroundSubtle, borderColor: glassColors.border }]}>
              <View style={styles.quickChargeContent}>
                <View style={[styles.quickChargeIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="flash" size={20} color={colors.primary} />
                </View>
                <View style={styles.quickChargeText}>
                  <Text style={[styles.quickChargeTitle, { color: colors.text }]}>Need to charge now?</Text>
                  <Text style={[styles.quickChargeSubtitle, { color: colors.textMuted }]}>
                    Use Quick Charge for custom amounts — no menu needed
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.quickChargeButton, { borderColor: colors.primary }]}
                onPress={handleQuickCharge}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Go to Quick Charge"
              >
                <Text style={[styles.quickChargeButtonText, { color: colors.primary }]}>Quick Charge</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Refresh Hint */}
          <Animated.View style={[styles.refreshHint, { opacity: fadeAnim }]}>
            <Ionicons name="refresh" size={14} color={colors.textMuted} />
            <Text style={[styles.refreshHintText, { color: colors.textMuted }]}>
              Pull down to refresh after creating your menu
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
      </ScrollView>
    </View>
  );
}

export function SetupRequired({ type }: SetupRequiredProps) {
  const { colors, isDark } = useTheme();
  const glassColors = isDark ? glass.dark : glass.light;

  if (type === 'no-payment-account') {
    return <PaymentSetupRequired colors={colors} />;
  }

  return <NoCatalogsWelcome colors={colors} glassColors={glassColors} isDark={isDark} />;
}

const createSimpleStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      backgroundColor: colors.background,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontFamily: fonts.bold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    message: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
    },
    buttonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: '#fff',
    },
  });

const createWelcomeStyles = (colors: any, glassColors: typeof glass.dark, isDark: boolean) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#09090b' : colors.background,
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    headerContainer: {
      marginBottom: 0,
    },
    headerBackground: {
      position: 'relative',
      overflow: 'hidden',
      flexGrow: 1,
      paddingBottom: 40,
    },
    headerContent: {
      paddingTop: 60,
      paddingBottom: 48,
      paddingHorizontal: 24,
      alignItems: 'center',
      zIndex: 10,
    },
    headerIconContainer: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      borderWidth: 1,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: fonts.bold,
      textAlign: 'center',
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 16,
      fontFamily: fonts.regular,
      textAlign: 'center',
    },
    cardContainer: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    primaryCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 24,
      ...shadows.md,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    primaryIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    cardBadgeText: {
      fontSize: 11,
      fontFamily: fonts.bold,
      color: '#fff',
      letterSpacing: 0.5,
    },
    primaryCardTitle: {
      fontSize: 24,
      fontFamily: fonts.bold,
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    primaryCardDescription: {
      fontSize: 15,
      fontFamily: fonts.regular,
      lineHeight: 22,
      marginBottom: 20,
    },
    featureList: {
      marginBottom: 24,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    featureText: {
      fontSize: 15,
      fontFamily: fonts.regular,
      marginLeft: 12,
    },
    primaryCardButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      gap: 10,
    },
    primaryCardButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
    },
    quickChargeContainer: {
      paddingHorizontal: 16,
      marginTop: 8,
      marginBottom: 16,
    },
    quickChargeCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
    },
    quickChargeContent: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    quickChargeIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    quickChargeText: {
      flex: 1,
    },
    quickChargeTitle: {
      fontSize: 15,
      fontFamily: fonts.semiBold,
      marginBottom: 2,
    },
    quickChargeSubtitle: {
      fontSize: 13,
      fontFamily: fonts.regular,
    },
    quickChargeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      paddingVertical: 12,
      borderRadius: 10,
      gap: 6,
    },
    quickChargeButtonText: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
    },
    refreshHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 24,
      paddingBottom: 16,
      gap: 6,
    },
    refreshHintText: {
      fontSize: 13,
      fontFamily: fonts.regular,
    },
  });
};
