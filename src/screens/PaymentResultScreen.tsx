import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  TextInput,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { fonts } from '../lib/fonts';
import { stripeTerminalApi } from '../lib/api';

type RouteParams = {
  PaymentResult: {
    success: boolean;
    amount: number;
    paymentIntentId: string;
    orderId?: string;
    orderNumber?: string;
    customerEmail?: string;
    errorMessage?: string;
  };
};

export function PaymentResultScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'PaymentResult'>>();
  const { clearCart } = useCart();
  const { width: screenWidth } = useWindowDimensions();

  const { success, amount, paymentIntentId, orderId, orderNumber, customerEmail, errorMessage } = route.params;

  // Dynamic font sizes based on screen width (accounting for 24px padding on each side)
  const amountText = `$${(amount / 100).toFixed(2)}`;
  const availableWidth = screenWidth - 48;
  const amountFontSize = Math.min(56, availableWidth / (amountText.length * 0.55));
  const titleFontSize = Math.min(26, availableWidth / 11);

  // Receipt state
  const [receiptEmail, setReceiptEmail] = useState(customerEmail || '');
  const [receiptSent, setReceiptSent] = useState(false);
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);

  // Auto-send receipt if customer email was provided during checkout
  useEffect(() => {
    if (success && customerEmail && paymentIntentId && !receiptSent) {
      const autoSendReceipt = async () => {
        try {
          await stripeTerminalApi.sendReceipt(paymentIntentId, customerEmail.trim());
          setReceiptSent(true);
          console.log('[PaymentResult] Auto-sent receipt to:', customerEmail);
        } catch (error) {
          console.error('[PaymentResult] Failed to auto-send receipt:', error);
          // Don't show error to user - they can manually send later
        }
      };
      autoSendReceipt();
    }
  }, [success, customerEmail, paymentIntentId, receiptSent]);

  // Animations
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current; // Start at 1 to avoid layout shift
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Confetti animations (for success)
  const confetti = useRef(
    Array.from({ length: 20 }, () => ({
      x: useRef(new Animated.Value(0)).current,
      y: useRef(new Animated.Value(0)).current,
      rotate: useRef(new Animated.Value(0)).current,
      opacity: useRef(new Animated.Value(0)).current,
    }))
  ).current;

  useEffect(() => {
    // Icon scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.3,
        duration: 400,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      delay: 200,
      useNativeDriver: true,
    }).start();

    // Success animations
    if (success) {
      // Single pulse on load
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.08,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // Confetti animation
      confetti.forEach((particle, index) => {
        const delay = index * 50;
        const duration = 2000 + Math.random() * 1000;
        const startX = Math.random() * 300 - 150;
        const endX = startX + (Math.random() * 100 - 50);
        const endY = 600 + Math.random() * 200;

        Animated.parallel([
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(particle.opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            // Fade out near the end of the fall
            Animated.delay(duration - 500),
            Animated.timing(particle.opacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(particle.x, {
              toValue: endX,
              duration,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(particle.y, {
              toValue: endY,
              duration,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(particle.rotate, {
              toValue: 360 * 3, // 3 rotations instead of infinite loop
              duration,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });

      clearCart();
    }
  }, []);

  const handleNewSale = () => {
    // Reset navigation to Menu tab
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      })
    );
  };

  const handleTryAgain = () => {
    navigation.goBack();
  };

  const handleSendReceipt = async () => {
    if (!receiptEmail.trim()) {
      Alert.alert('Email Required', 'Please enter an email address to send the receipt.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(receiptEmail.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setSendingReceipt(true);
    try {
      await stripeTerminalApi.sendReceipt(paymentIntentId, receiptEmail.trim());
      setReceiptSent(true);
      setShowEmailInput(false);
      Alert.alert('Receipt Sent', `A receipt has been sent to ${receiptEmail.trim()}`);
    } catch (error: any) {
      console.error('Error sending receipt:', error);
      Alert.alert('Error', error.message || 'Failed to send receipt. Please try again.');
    } finally {
      setSendingReceipt(false);
    }
  };

  const styles = createStyles(colors, success);

  const confettiColors = [colors.primary, colors.success, '#FFD700', '#FF6B6B', '#4ECDC4'];

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      {success && (
        <View style={styles.backgroundGradients}>
          <View style={[styles.gradientOrb, styles.gradientOrb1]} />
          <View style={[styles.gradientOrb, styles.gradientOrb2]} />
        </View>
      )}

      {/* Confetti */}
      {success && (
        <View style={styles.confettiContainer}>
          {confetti.map((particle, index) => (
            <Animated.View
              key={index}
              style={[
                styles.confetti,
                {
                  backgroundColor: confettiColors[index % confettiColors.length],
                  opacity: particle.opacity,
                  transform: [
                    { translateX: particle.x },
                    { translateY: particle.y },
                    {
                      rotate: particle.rotate.interpolate({
                        inputRange: [0, 360],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      )}

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Success/Failure Icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [
                  { scale: success ? Animated.multiply(scaleAnim, bounceAnim) : scaleAnim }
                ],
              },
            ]}
          >
            <View style={[styles.iconGlow, { backgroundColor: success ? colors.success : colors.error }]} />
            <Ionicons
              name={success ? 'checkmark-circle' : 'close-circle'}
              size={100}
              color={success ? colors.success : colors.error}
            />
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', width: '100%' }}>
            <Text style={[styles.title, { fontSize: titleFontSize }]}>
              {success ? 'Payment Successful!' : 'Payment Failed'}
            </Text>

            {success ? (
              <>
                <View style={styles.amountContainer}>
                  <Text style={styles.amountLabel}>Amount Charged</Text>
                  <Text style={[styles.amount, { fontSize: amountFontSize }]}>
                    {amountText}
                  </Text>
                </View>
                {orderNumber && (
                  <Text style={styles.orderNumber}>Order #{orderNumber}</Text>
                )}
                <View style={styles.successBadge}>
                  <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                  <Text style={styles.successBadgeText}>
                    {receiptSent ? 'Receipt sent' : 'Transaction completed'}
                  </Text>
                </View>

                {/* Receipt Section */}
                {!receiptSent && !showEmailInput && (
                  <TouchableOpacity
                    style={styles.receiptButton}
                    onPress={() => setShowEmailInput(true)}
                  >
                    <Ionicons name="mail-outline" size={20} color={colors.primary} />
                    <Text style={styles.receiptButtonText}>Send Receipt</Text>
                  </TouchableOpacity>
                )}

                {showEmailInput && (
                  <View style={styles.emailInputContainer}>
                    <TextInput
                      style={styles.emailInput}
                      placeholder="Enter email address"
                      placeholderTextColor={colors.textMuted}
                      value={receiptEmail}
                      onChangeText={setReceiptEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={[styles.sendButton, sendingReceipt && styles.sendButtonDisabled]}
                      onPress={handleSendReceipt}
                      disabled={sendingReceipt}
                    >
                      {sendingReceipt ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="send" size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {receiptSent && customerEmail && (
                  <View style={styles.receiptSentContainer}>
                    <Text
                      style={styles.receiptSentText}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      Sent to {customerEmail}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  {errorMessage || 'The payment could not be processed. Please try again.'}
                </Text>
              </View>
            )}
          </Animated.View>
        </View>

        {/* Actions */}
        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          {success ? (
            <TouchableOpacity style={styles.primaryButton} onPress={handleNewSale}>
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.primaryButtonText}>New Sale</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={handleTryAgain}>
                <Ionicons name="refresh" size={24} color="#fff" />
                <Text style={styles.primaryButtonText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleNewSale}>
                <Text style={styles.secondaryButtonText}>Cancel Order</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: any, success: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    backgroundGradients: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    gradientOrb: {
      position: 'absolute',
      borderRadius: 9999,
      opacity: 0.06,
    },
    gradientOrb1: {
      width: 500,
      height: 500,
      backgroundColor: colors.success,
      top: -250,
      right: -150,
    },
    gradientOrb2: {
      width: 450,
      height: 450,
      backgroundColor: colors.primary,
      bottom: -200,
      left: -150,
    },
    confettiContainer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'flex-start',
      pointerEvents: 'none',
      overflow: 'hidden',
    },
    confetti: {
      position: 'absolute',
      width: 10,
      height: 10,
      borderRadius: 2,
      top: 200,
    },
    safeArea: {
      flex: 1,
      overflow: 'hidden',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      overflow: 'hidden',
    },
    iconContainer: {
      position: 'relative',
      marginBottom: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconGlow: {
      position: 'absolute',
      width: 160,
      height: 160,
      borderRadius: 80,
      opacity: 0.08,
    },
    title: {
      fontWeight: '700',
      fontFamily: fonts.bold,
      color: colors.text,
      marginBottom: 24,
      textAlign: 'center',
    },
    amountContainer: {
      alignItems: 'center',
      marginBottom: 24,
      alignSelf: 'stretch',
    },
    amountLabel: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    amount: {
      fontWeight: '700',
      fontFamily: fonts.bold,
      color: colors.success,
      textAlign: 'center',
    },
    orderNumber: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.textMuted,
      marginBottom: 16,
    },
    successBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.successBg,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: colors.success + '30',
    },
    successBadgeText: {
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.success,
    },
    receiptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 20,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: colors.primary + '30',
      backgroundColor: colors.primary + '10',
    },
    receiptButtonText: {
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.primary,
    },
    emailInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 20,
      gap: 12,
      alignSelf: 'stretch',
    },
    emailInput: {
      flex: 1,
      minWidth: 0,
      height: 48,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 16,
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sendButton: {
      width: 48,
      height: 48,
      minWidth: 48,
      flexShrink: 0,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.7,
    },
    receiptSentContainer: {
      alignSelf: 'stretch',
      alignItems: 'center',
      marginTop: 12,
      paddingHorizontal: 20,
    },
    receiptSentText: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textMuted,
      textAlign: 'center',
    },
    errorContainer: {
      backgroundColor: colors.errorBg,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.error + '30',
      marginTop: 8,
    },
    errorText: {
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.error,
      textAlign: 'center',
      lineHeight: 22,
    },
    footer: {
      padding: 20,
      paddingBottom: 36,
      gap: 12,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: 9999,
      gap: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
      fontFamily: fonts.semiBold,
    },
    secondaryButton: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '500',
      fontFamily: fonts.medium,
      color: colors.textSecondary,
    },
  });
