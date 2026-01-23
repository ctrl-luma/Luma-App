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
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CardField, useConfirmPayment, CardFieldInput, initStripe } from '@stripe/stripe-react-native';
import { config } from '../lib/config';

import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { fonts } from '../lib/fonts';
import { glass } from '../lib/colors';
import { shadows } from '../lib/shadows';
import { stripeTerminalApi, ordersApi } from '../lib/api';
import logger from '../lib/logger';
import { isValidEmail } from '../lib/validation';

type RouteParams = {
  PaymentResult: {
    success: boolean;
    amount: number;
    paymentIntentId: string;
    orderId?: string;
    orderNumber?: string;
    customerEmail?: string;
    errorMessage?: string;
    skipToCardEntry?: boolean; // Go directly to card entry page
  };
};

export function PaymentResultScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'PaymentResult'>>();
  const glassColors = isDark ? glass.dark : glass.light;
  const { clearCart } = useCart();
  const { width: screenWidth } = useWindowDimensions();

  const { success, amount, paymentIntentId, orderId, orderNumber, customerEmail, errorMessage, skipToCardEntry } = route.params;

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

  // Manual card entry state - fallback when Tap to Pay fails
  const [showCardEntry, setShowCardEntry] = useState(false);
  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details | null>(null);
  const [processingCard, setProcessingCard] = useState(false);

  // Stripe hook for confirming card payments
  const { confirmPayment } = useConfirmPayment();

  // Auto-send receipt if customer email was provided during checkout
  useEffect(() => {
    if (success && customerEmail && paymentIntentId && !receiptSent) {
      const autoSendReceipt = async () => {
        try {
          await stripeTerminalApi.sendReceipt(paymentIntentId, customerEmail.trim());
          setReceiptSent(true);
          logger.log('[PaymentResult] Auto-sent receipt to:', customerEmail);
        } catch (error) {
          logger.error('[PaymentResult] Failed to auto-send receipt:', error);
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

  // Handle manual card payment - fallback when Tap to Pay fails
  // Note: Manual card entry has higher Stripe fees (2.9% + 30¢) vs Tap to Pay (2.7% + 5¢)
  const handleManualCardPayment = async () => {
    if (!cardDetails?.complete) {
      Alert.alert('Card Required', 'Please enter your card details.');
      return;
    }

    setProcessingCard(true);

    try {
      // Create a new payment intent for card payment (direct charge on connected account)
      const paymentIntent = await stripeTerminalApi.createPaymentIntent({
        amount: amount / 100, // API expects dollars
        description: `Order ${orderNumber || 'Payment'}`,
        metadata: {
          orderId: orderId || '',
          orderNumber: orderNumber || '',
        },
        receiptEmail: customerEmail || undefined,
        captureMethod: 'automatic',
        paymentMethodType: 'card',
      });

      // Link to existing order if we have one
      // Mark as 'card' (manual entry) since this is the fallback flow
      if (orderId) {
        await ordersApi.linkPaymentIntent(orderId, paymentIntent.id, 'card');
      }

      // Initialize Stripe with the connected account ID for direct charges
      // This ensures the payment is processed on the vendor's connected account
      await initStripe({
        publishableKey: config.stripePublishableKey,
        merchantIdentifier: 'merchant.com.lumapos',
        stripeAccountId: paymentIntent.stripeAccountId,
      });

      // Confirm payment with card details
      const { error, paymentIntent: confirmedIntent } = await confirmPayment(paymentIntent.clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: {
          billingDetails: {
            email: customerEmail || undefined,
          },
        },
      });

      if (error) {
        logger.error('[ManualCard] Payment failed:', error);
        Alert.alert('Payment Failed', error.message || 'Your payment could not be processed.');
        return;
      }

      if (confirmedIntent?.status === 'Succeeded') {
        // Success! Reset navigation to show fresh success screen
        clearCart();
        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [
              { name: 'MainTabs' },
              {
                name: 'PaymentResult',
                params: {
                  success: true,
                  amount,
                  paymentIntentId: paymentIntent.id,
                  orderId,
                  orderNumber,
                  customerEmail,
                },
              },
            ],
          })
        );
      } else {
        Alert.alert('Payment Incomplete', 'The payment was not completed. Please try again.');
      }
    } catch (error: any) {
      logger.error('[ManualCard] Payment error:', error);
      Alert.alert('Payment Error', error.message || 'Failed to process payment. Please try again.');
    } finally {
      setProcessingCard(false);
    }
  };

  const handleSendReceipt = async () => {
    if (!receiptEmail.trim()) {
      Alert.alert('Email Required', 'Please enter an email address to send the receipt.');
      return;
    }

    // Basic email validation
    if (!isValidEmail(receiptEmail)) {
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
      logger.error('Error sending receipt:', error);
      Alert.alert('Error', error.message || 'Failed to send receipt. Please try again.');
    } finally {
      setSendingReceipt(false);
    }
  };

  const styles = createStyles(colors, glassColors, success);

  const confettiColors = [colors.primary, colors.success, '#FFD700', '#FF6B6B', '#4ECDC4'];

  // Clean card entry page - shown when user needs to enter card manually
  if (showCardEntry) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.cardPageHeader}>
              <TouchableOpacity
                style={styles.cardPageBackButton}
                onPress={() => setShowCardEntry(false)}
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.cardPageTitle}>Card Payment</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.cardPageContent}>
              {/* Amount Display */}
              <View style={styles.cardPageAmountContainer}>
                <Text style={styles.cardPageAmountLabel}>Amount to Pay</Text>
                <Text style={styles.cardPageAmount}>${(amount / 100).toFixed(2)}</Text>
                {orderNumber && (
                  <Text style={styles.cardPageOrderNumber}>Order #{orderNumber}</Text>
                )}
              </View>

              {/* Fee Warning */}
              <View style={styles.feeWarningContainer}>
                <Ionicons name="information-circle" size={16} color={colors.warning} />
                <Text style={styles.feeWarningText}>
                  Manual card entry costs 0.2% + 15¢ more per transaction than Tap to Pay, plus standard tiered processing fees apply.
                </Text>
              </View>

              {/* Card Field */}
              <View style={styles.cardPageFormContainer}>
                <CardField
                  postalCodeEnabled={false}
                  placeholders={{
                    number: '4242 4242 4242 4242',
                    expiration: 'MM/YY',
                    cvc: 'CVC',
                  }}
                  cardStyle={{
                    backgroundColor: isDark ? '#1f2937' : '#f9fafb',
                    textColor: isDark ? '#ffffff' : '#111827',
                    placeholderColor: isDark ? '#6b7280' : '#9ca3af',
                    borderColor: isDark ? '#374151' : '#e5e7eb',
                    borderWidth: 1,
                    borderRadius: 12,
                    fontSize: 20,
                    cursorColor: colors.primary,
                    textErrorColor: colors.error,
                  }}
                  style={styles.cardField}
                  onCardChange={(details) => setCardDetails(details)}
                />

                <View style={styles.cardSecurityNote}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                  <Text style={styles.cardSecurityText}>
                    Card info is encrypted and sent directly to Stripe
                  </Text>
                </View>
              </View>

              {/* Pay Button - moved inside content area */}
              <TouchableOpacity
                onPress={handleManualCardPayment}
                disabled={!cardDetails?.complete || processingCard}
                activeOpacity={0.9}
                style={[
                  styles.cardPagePayButton,
                  { backgroundColor: isDark ? '#fff' : '#09090b' },
                  (!cardDetails?.complete || processingCard) && styles.cardPagePayButtonDisabled,
                ]}
              >
                {processingCard ? (
                  <ActivityIndicator size="small" color={isDark ? '#09090b' : '#fff'} />
                ) : (
                  <>
                    <Ionicons name="lock-closed" size={20} color={isDark ? '#09090b' : '#fff'} />
                    <Text style={[styles.cardPagePayButtonText, { color: isDark ? '#09090b' : '#fff' }]}>
                      Pay ${(amount / 100).toFixed(2)}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
              <>
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>
                    {errorMessage || 'The payment could not be processed. Please try again.'}
                  </Text>
                </View>

                {/* Manual Card Entry Option */}
                <View style={styles.fallbackContainer}>
                  <View style={styles.fallbackHeader}>
                    <Ionicons name="card-outline" size={20} color={colors.primary} />
                    <Text style={styles.fallbackTitle}>Alternative Payment</Text>
                  </View>
                  <Text style={styles.fallbackDescription}>
                    Enter the card details manually instead.
                  </Text>
                  <TouchableOpacity
                    style={styles.fallbackButton}
                    onPress={() => setShowCardEntry(true)}
                  >
                    <Ionicons name="keypad-outline" size={18} color={colors.primary} />
                    <Text style={styles.fallbackButtonText}>Enter Card Manually</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </View>

        {/* Actions */}
        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          {success ? (
            <TouchableOpacity onPress={handleNewSale} activeOpacity={0.9}>
              <LinearGradient
                colors={[colors.success, '#16a34a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButton}
              >
                <Ionicons name="add-circle" size={24} color="#fff" />
                <Text style={styles.primaryButtonText}>New Sale</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={handleTryAgain}
                activeOpacity={0.9}
                style={[styles.primaryButton, { backgroundColor: isDark ? '#fff' : '#09090b' }]}
              >
                <Ionicons name="refresh" size={24} color={isDark ? '#09090b' : '#fff'} />
                <Text style={[styles.primaryButtonText, { color: isDark ? '#09090b' : '#fff' }]}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleNewSale}>
                <Text style={styles.secondaryButtonText}>Cancel Order</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark, success: boolean) => {
  return StyleSheet.create({
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
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.text,
      borderWidth: 1,
      borderColor: glassColors.border,
    },
    sendButton: {
      width: 48,
      height: 48,
      minWidth: 48,
      flexShrink: 0,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.md,
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
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.error + '30',
      marginTop: 8,
      ...shadows.sm,
    },
    errorText: {
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.error,
      textAlign: 'center',
      lineHeight: 22,
    },
    // Fallback Payment Link styles - Apple TTPOi Regional Requirement (UK, IE, CAN)
    fallbackContainer: {
      marginTop: 20,
      padding: 20,
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      alignSelf: 'stretch',
    },
    fallbackHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    fallbackTitle: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    fallbackDescription: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 16,
    },
    fallbackButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.primary + '15',
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    fallbackButtonDisabled: {
      opacity: 0.6,
    },
    fallbackButtonText: {
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.primary,
    },
    // Manual Card Entry styles
    cardEntryContainer: {
      marginTop: 20,
      padding: 20,
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primary + '30',
      alignSelf: 'stretch',
    },
    cardEntryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    cardEntryTitle: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.primary,
    },
    cardEntryAmount: {
      fontSize: 32,
      fontFamily: fonts.bold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    cardField: {
      height: 50,
      marginBottom: 12,
    },
    cardSecurityNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 16,
    },
    cardSecurityText: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: colors.textMuted,
    },
    cardPayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: colors.primary,
      ...shadows.md,
    },
    cardPayButtonDisabled: {
      opacity: 0.5,
    },
    cardPayButtonText: {
      fontSize: 17,
      fontFamily: fonts.semiBold,
      color: '#fff',
    },
    cardCancelButton: {
      alignItems: 'center',
      paddingVertical: 14,
      marginTop: 12,
    },
    cardCancelText: {
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.textMuted,
    },
    // Clean card payment page styles
    cardPageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: glassColors.borderSubtle,
    },
    cardPageBackButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: glassColors.backgroundElevated,
    },
    cardPageTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    cardPageContent: {
      paddingHorizontal: 24,
      paddingTop: 32,
    },
    cardPageAmountContainer: {
      alignItems: 'center',
      marginBottom: 32,
    },
    cardPageAmountLabel: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    cardPageAmount: {
      fontSize: 48,
      fontFamily: fonts.bold,
      color: colors.text,
    },
    cardPageOrderNumber: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.textMuted,
      marginTop: 8,
    },
    feeWarningContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: colors.warningBg || colors.warning + '15',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.warning + '30',
      marginBottom: 20,
    },
    feeWarningText: {
      flex: 1,
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.warning,
      lineHeight: 18,
    },
    cardPageFormContainer: {
      marginBottom: 24,
    },
    cardField: {
      height: 60,
      marginBottom: 16,
    },
    cardPagePayButtonContainer: {
      marginTop: 8,
    },
    cardPagePayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 18,
      borderRadius: 9999,
      ...shadows.lg,
      shadowColor: colors.primary,
    },
    cardPagePayButtonDisabled: {
      opacity: 0.5,
    },
    cardPagePayButtonText: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: '#fff',
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
      paddingVertical: 18,
      borderRadius: 9999,
      gap: 12,
      ...shadows.lg,
      shadowColor: success ? colors.success : colors.primary,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 18,
      fontFamily: fonts.semiBold,
    },
    secondaryButton: {
      alignItems: 'center',
      paddingVertical: 16,
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: glassColors.border,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
    },
  });
};
