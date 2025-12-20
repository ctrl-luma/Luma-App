import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { stripeTerminalApi } from '../lib/api';
import { stripeTerminalService } from '../lib/stripe-terminal';
import { fonts } from '../lib/fonts';
import { config } from '../lib/config';

type RouteParams = {
  PaymentProcessing: {
    paymentIntentId: string;
    clientSecret: string;
    amount: number;
  };
};

export function PaymentProcessingScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'PaymentProcessing'>>();

  const { paymentIntentId, amount } = route.params;
  const [isCancelling, setIsCancelling] = useState(false);
  const [statusText, setStatusText] = useState('Initializing...');
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const wave1Anim = useRef(new Animated.Value(0)).current;
  const wave2Anim = useRef(new Animated.Value(0)).current;
  const wave3Anim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation for icon
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Rotating NFC symbol animation
    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotate.start();

    // Wave animations with delays
    const createWaveAnim = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const wave1 = createWaveAnim(wave1Anim, 0);
    const wave2 = createWaveAnim(wave2Anim, 400);
    const wave3 = createWaveAnim(wave3Anim, 800);

    wave1.start();
    wave2.start();
    wave3.start();

    // Process payment with Stripe Terminal
    processPayment();

    return () => {
      pulse.stop();
      rotate.stop();
      wave1.stop();
      wave2.stop();
      wave3.stop();
    };
  }, []);

  const processPayment = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      // Initialize Terminal SDK
      setStatusText('Initializing Stripe Terminal...');
      await stripeTerminalService.initialize();

      // Discover readers
      setStatusText('Discovering readers...');
      const readers = await stripeTerminalService.discoverReaders();

      if (readers.length === 0) {
        throw new Error('No Tap to Pay readers found on this device');
      }

      // Connect to the first reader (phone's built-in NFC)
      setStatusText('Connecting to reader...');
      await stripeTerminalService.connectReader(readers[0]);

      // Collect payment method (shows Tap to Pay UI)
      setStatusText('Waiting for card...');
      const paymentIntent = await stripeTerminalService.processPayment(paymentIntentId);

      // Check payment status
      if (paymentIntent.status === 'succeeded') {
        // Success - navigate to result screen
        navigation.replace('PaymentResult', {
          success: true,
          amount,
          paymentIntentId,
        });
      } else {
        throw new Error(`Payment failed with status: ${paymentIntent.status}`);
      }
    } catch (error: any) {
      console.error('[PaymentProcessing] Payment failed:', error);
      setError(error.message || 'Payment processing failed');
      setIsProcessing(false);

      // Navigate to failure result
      navigation.replace('PaymentResult', {
        success: false,
        amount,
        paymentIntentId,
        errorMessage: error.message || 'Payment processing failed',
      });
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      // Cancel Terminal collection if in progress
      await stripeTerminalService.cancelCollectPayment();

      // Cancel payment intent on the backend
      await stripeTerminalApi.cancelPaymentIntent(paymentIntentId);

      navigation.goBack();
    } catch (error) {
      console.error('Failed to cancel payment:', error);
      navigation.goBack();
    }
  };

  const handleDevSkip = () => {
    // Dev mode: skip payment and go straight to success
    navigation.replace('PaymentResult', {
      success: true,
      amount,
      paymentIntentId,
    });
  };

  const styles = createStyles(colors);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getWaveStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0],
    }),
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, 1.5],
        }),
      },
    ],
  });

  return (
    <View style={styles.container}>
      {/* Background Gradients */}
      <View style={styles.backgroundGradients}>
        <View style={[styles.gradientOrb, styles.gradientOrb1]} />
        <View style={[styles.gradientOrb, styles.gradientOrb2]} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Animated NFC Icon with glow */}
          <View style={styles.iconWrapper}>
            <Animated.View
              style={[
                styles.iconGlow,
                { transform: [{ rotate: spin }] },
              ]}
            />
            <Animated.View
              style={[
                styles.iconContainer,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Ionicons name="phone-portrait-outline" size={48} color={colors.primary} />
            </Animated.View>
          </View>

          <Text style={styles.title}>Tap to Pay</Text>
          <Text style={styles.subtitle}>
            Hold customer's card or phone near the top of your device
          </Text>

          {/* Amount */}
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amount}>${(amount / 100).toFixed(2)}</Text>
          </View>

          {/* Animated NFC Waves */}
          <View style={styles.wavesContainer}>
            <Animated.View style={[styles.wave, styles.wave1, getWaveStyle(wave1Anim)]} />
            <Animated.View style={[styles.wave, styles.wave2, getWaveStyle(wave2Anim)]} />
            <Animated.View style={[styles.wave, styles.wave3, getWaveStyle(wave3Anim)]} />
            <View style={styles.nfcSymbol}>
              <Ionicons name="wifi" size={32} color={colors.primary} style={{ transform: [{ rotate: '90deg' }] }} />
            </View>
          </View>

          {/* Status Text */}
          <View style={styles.statusContainer}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>

          {/* Dev Mode Skip Button */}
          {config.isDev && (
            <TouchableOpacity
              style={styles.devSkipButton}
              onPress={handleDevSkip}
            >
              <Ionicons name="flash" size={20} color="#F59E0B" />
              <Text style={styles.devSkipButtonText}>Skip Payment (Dev)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cancel Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={isCancelling}
          >
            <Ionicons name="close-circle-outline" size={20} color={colors.error} />
            <Text style={styles.cancelButtonText}>
              {isCancelling ? 'Cancelling...' : 'Cancel Payment'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    backgroundGradients: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    gradientOrb: {
      position: 'absolute',
      borderRadius: 9999,
      opacity: 0.15,
    },
    gradientOrb1: {
      width: 400,
      height: 400,
      backgroundColor: colors.primary,
      top: -100,
      right: -100,
    },
    gradientOrb2: {
      width: 300,
      height: 300,
      backgroundColor: colors.primary,
      bottom: -80,
      left: -80,
    },
    safeArea: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    iconWrapper: {
      position: 'relative',
      marginBottom: 40,
    },
    iconGlow: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: colors.primary,
      opacity: 0.1,
      top: -10,
      left: -10,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary + '20',
      borderWidth: 2,
      borderColor: colors.primary + '40',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      fontFamily: fonts.bold,
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 40,
      lineHeight: 22,
      paddingHorizontal: 20,
    },
    amountContainer: {
      alignItems: 'center',
      marginBottom: 48,
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
      fontSize: 56,
      fontWeight: '700',
      fontFamily: fonts.bold,
      color: colors.primary,
    },
    wavesContainer: {
      position: 'relative',
      width: 220,
      height: 220,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 32,
    },
    wave: {
      position: 'absolute',
      borderWidth: 3,
      borderColor: colors.primary,
      borderRadius: 9999,
    },
    wave1: {
      width: 100,
      height: 100,
    },
    wave2: {
      width: 150,
      height: 150,
    },
    wave3: {
      width: 200,
      height: 200,
    },
    nfcSymbol: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    statusText: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
    },
    devSkipButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#F59E0B' + '20',
      borderWidth: 2,
      borderColor: '#F59E0B',
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 9999,
      marginTop: 32,
    },
    devSkipButtonText: {
      fontSize: 15,
      fontWeight: '600',
      fontFamily: fonts.semiBold,
      color: '#F59E0B',
    },
    footer: {
      padding: 20,
      paddingBottom: 36,
    },
    cancelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      fontFamily: fonts.semiBold,
      color: colors.error,
    },
  });
