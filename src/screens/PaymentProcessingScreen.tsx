import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { stripeTerminalApi } from '../lib/api';
import { stripeTerminalService } from '../lib/stripe-terminal';
import { config } from '../lib/config';

type RouteParams = {
  PaymentProcessing: {
    paymentIntentId: string;
    clientSecret: string;
    amount: number;
    orderId?: string;
    orderNumber?: string;
    customerEmail?: string;
  };
};

export function PaymentProcessingScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'PaymentProcessing'>>();

  const { paymentIntentId, amount, orderId, orderNumber, customerEmail } = route.params;
  const [isCancelling, setIsCancelling] = useState(false);
  const [statusText, setStatusText] = useState('Preparing...');
  const [isReady, setIsReady] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation for the icon
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
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

    // Ring expand animation
    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    ring.start();
    processPayment();

    return () => {
      pulse.stop();
      ring.stop();
    };
  }, []);

  const processPayment = async () => {
    try {
      if (Platform.OS === 'web') {
        setStatusText('Tap to Pay unavailable on web');
        setIsReady(true);
        return;
      }

      setStatusText('Preparing...');
      await stripeTerminalService.initialize();

      setStatusText('Connecting...');
      const readers = await stripeTerminalService.discoverReaders();

      if (readers.length === 0) {
        throw new Error('No readers found');
      }

      await stripeTerminalService.connectReader(readers[0]);
      setStatusText('Ready');
      setIsReady(true);

      const paymentIntent = await stripeTerminalService.processPayment(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        navigation.replace('PaymentResult', {
          success: true,
          amount,
          paymentIntentId,
          orderId,
          orderNumber,
          customerEmail,
        });
      } else {
        throw new Error(`Payment failed: ${paymentIntent.status}`);
      }
    } catch (error: any) {
      console.error('[PaymentProcessing] Error:', error);
      navigation.replace('PaymentResult', {
        success: false,
        amount,
        paymentIntentId,
        orderId,
        orderNumber,
        customerEmail,
        errorMessage: error.message || 'Payment failed',
      });
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await stripeTerminalService.cancelCollectPayment();
      await stripeTerminalApi.cancelPaymentIntent(paymentIntentId);
    } catch (e) {
      // Ignore
    }
    navigation.goBack();
  };

  const [isSimulating, setIsSimulating] = useState(false);

  const handleDevSkip = async () => {
    setIsSimulating(true);
    setStatusText('Simulating payment...');

    try {
      // Call the simulate API to create a real test payment in Stripe
      const result = await stripeTerminalApi.simulatePayment(paymentIntentId);

      if (result.status === 'succeeded') {
        navigation.replace('PaymentResult', {
          success: true,
          amount,
          paymentIntentId: result.id, // Use the new payment intent ID
          orderId,
          orderNumber,
          customerEmail,
        });
      } else {
        throw new Error(`Payment simulation failed: ${result.status}`);
      }
    } catch (error: any) {
      console.error('[PaymentProcessing] Simulation error:', error);
      navigation.replace('PaymentResult', {
        success: false,
        amount,
        paymentIntentId,
        orderId,
        orderNumber,
        customerEmail,
        errorMessage: error.message || 'Payment simulation failed',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const styles = createStyles(colors);

  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });

  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.15, 0],
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Amount Display */}
          <Text style={styles.amount}>${(amount / 100).toFixed(2)}</Text>

          {/* NFC Icon with animation */}
          <View style={styles.iconWrapper}>
            <Animated.View
              style={[
                styles.ring,
                {
                  transform: [{ scale: ringScale }],
                  opacity: ringOpacity,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.iconContainer,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Ionicons name="wifi" size={40} color={colors.primary} style={styles.nfcIcon} />
            </Animated.View>
          </View>

          {/* Status */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, isReady && styles.statusDotReady]} />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>

          {/* Instruction */}
          <Text style={styles.instruction}>
            Tap card or device to pay
          </Text>

          {/* Dev Skip Button */}
          {(config.isDev || Platform.OS === 'web') && (
            <TouchableOpacity
              style={[styles.devButton, isSimulating && styles.devButtonDisabled]}
              onPress={handleDevSkip}
              disabled={isSimulating}
            >
              <Text style={styles.devButtonText}>
                {isSimulating
                  ? 'Processing...'
                  : Platform.OS === 'web'
                  ? 'Simulate Payment'
                  : 'Simulate (Dev)'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cancel Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={isCancelling}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>
              {isCancelling ? 'Cancelling...' : 'Cancel'}
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
    safeArea: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    amount: {
      fontSize: 56,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 60,
      fontVariant: ['tabular-nums'],
    },
    iconWrapper: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 40,
      width: 120,
      height: 120,
    },
    ring: {
      position: 'absolute',
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    iconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    nfcIcon: {
      transform: [{ rotate: '90deg' }],
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.textMuted,
    },
    statusDotReady: {
      backgroundColor: colors.success || '#22C55E',
    },
    statusText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    instruction: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: 'center',
    },
    devButton: {
      marginTop: 40,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    devButtonDisabled: {
      opacity: 0.6,
    },
    devButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    footer: {
      padding: 20,
      paddingBottom: 36,
    },
    cancelButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
