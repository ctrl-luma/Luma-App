/**
 * Setup Payments Modal
 * Prompts users to complete Stripe Connect onboarding before Tap to Pay
 *
 * This modal is shown to new users who haven't set up their payment processing
 * account yet. Stripe Connect must be configured before Tap to Pay can work.
 *
 * This is a REQUIRED step - users cannot skip this.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../context/ThemeContext';
import { glass } from '../lib/colors';
import { shadows, glow } from '../lib/shadows';
import { radius, spacing } from '../lib/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SetupPaymentsModalProps {
  visible: boolean;
  isLoading?: boolean;
  onSetup: () => void;
}

export function SetupPaymentsModal({
  visible,
  isLoading = false,
  onSetup,
}: SetupPaymentsModalProps) {
  const { colors, isDark } = useTheme();

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const iconPulseAnim = useRef(new Animated.Value(1)).current;

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

  const styles = createStyles(colors, glassColors, isDark);

  // Loading state
  if (isLoading) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        accessibilityViewIsModal={true}
      >
        <View style={styles.overlay}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
            accessibilityLabel="Loading payment setup"
          />
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      accessibilityViewIsModal={true}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Solid background to hide content behind modal */}
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

            {/* Animated Icon */}
            <Animated.View
              style={[styles.iconContainer, { transform: [{ scale: iconPulseAnim }] }]}
              accessibilityLabel="Payment card icon"
            >
              <LinearGradient
                colors={[colors.primary, colors.primary700]}
                style={styles.iconGradient}
              >
                <Ionicons name="card" size={28} color="#fff" />
              </LinearGradient>
            </Animated.View>

            {/* Title */}
            <Text
              style={styles.title}
              accessibilityRole="header"
              accessibilityLabel="Set Up Payments"
            >
              Set Up Payments
            </Text>

            {/* Description */}
            <Text
              style={styles.description}
              accessibilityLabel="To start accepting payments, you'll need to set up your payment processing account with Stripe. This only takes a few minutes."
            >
              To start accepting payments, you'll need to set up your payment processing account with Stripe. This only takes a few minutes.
            </Text>

            {/* Features list */}
            <View
              style={styles.featuresList}
              accessibilityLabel="Payment setup features"
            >
              {[
                { icon: 'shield-checkmark', text: 'Secure payment processing' },
                { icon: 'cash', text: 'Direct deposits to your bank' },
                { icon: 'time', text: 'Takes about 5 minutes' },
              ].map((feature, index) => (
                <View
                  key={index}
                  style={styles.featureRow}
                  accessibilityLabel={feature.text}
                >
                  <View style={styles.featureIconBg}>
                    <Ionicons name={feature.icon as any} size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.featureText}>{feature.text}</Text>
                </View>
              ))}
            </View>

            {/* Required notice */}
            <View
              style={styles.requiredNotice}
              accessibilityLabel="Important: This step is required to accept payments"
            >
              <Ionicons name="information-circle" size={16} color={colors.textMuted} />
              <Text style={styles.requiredText}>
                This step is required to accept payments
              </Text>
            </View>

            {/* Setup Button */}
            <TouchableOpacity
              onPress={onSetup}
              activeOpacity={0.9}
              style={styles.setupButtonWrapper}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              accessibilityHint="Opens Stripe Connect to set up your payment processing account"
            >
              <LinearGradient
                colors={[colors.primary, colors.primary700]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.setupButton}
              >
                <Text style={styles.setupButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
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
      backgroundColor: colors.background,
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
      marginBottom: spacing.md,
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
    requiredNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.lg,
    },
    requiredText: {
      fontSize: 13,
      color: colors.textMuted,
    },
    setupButtonWrapper: {
      width: '100%',
      ...glow(colors.primary, 'subtle'),
    },
    setupButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: 16,
      borderRadius: radius.lg,
    },
    setupButtonText: {
      fontSize: 17,
      fontWeight: '600',
      color: '#fff',
    },
  });
