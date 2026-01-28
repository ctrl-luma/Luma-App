import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

import { useTheme } from '../context/ThemeContext';
import { useTerminal } from '../context/StripeTerminalContext';
import { stripeTerminalApi } from '../lib/api';
import { config } from '../lib/config';
import { fonts } from '../lib/fonts';
import { glass } from '../lib/colors';
import { shadows } from '../lib/shadows';
import { StarBackground } from '../components/StarBackground';


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
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'PaymentProcessing'>>();
  const glassColors = isDark ? glass.dark : glass.light;
  const { initializeTerminal, connectReader, processPayment: terminalProcessPayment, cancelPayment } = useTerminal();

  const { paymentIntentId, amount, orderId, orderNumber, customerEmail } = route.params;
  const [isCancelling, setIsCancelling] = useState(false);
  const [statusText, setStatusText] = useState('Preparing payment...');
  const [isSimulating, setIsSimulating] = useState(false);
  const isCancelledRef = React.useRef(false);

  useEffect(() => {
    processPayment();
  }, []);

  const processPayment = async () => {
    try {
      if (Platform.OS === 'web') {
        setStatusText('Tap to Pay unavailable on web');
        return;
      }

      setStatusText('Initializing...');

      try {
        await initializeTerminal();
      } catch (initErr: any) {
        throw new Error(`Initialization failed: ${initErr.message}`);
      }

      setStatusText('Connecting...');

      try {
        await connectReader();
      } catch (connectErr: any) {
        throw new Error(`Connection failed: ${connectErr.message}`);
      }

      setStatusText('Starting payment...');

      const result = await terminalProcessPayment(paymentIntentId);

      if (result.status === 'succeeded') {
        navigation.replace('PaymentResult', {
          success: true,
          amount,
          paymentIntentId,
          orderId,
          orderNumber,
          customerEmail,
        });
      } else {
        throw new Error(`Payment status: ${result.status}`);
      }
    } catch (error: any) {
      // If user cancelled, don't show error screen - they already navigated away
      if (isCancelledRef.current) {
        return;
      }

      let errorMessage = error.message || 'Payment failed';

      // Transform SDK error messages to be more user-friendly
      if (errorMessage.toLowerCase().includes('command was canceled') ||
          errorMessage.toLowerCase().includes('command was cancelled')) {
        errorMessage = 'The transaction was canceled.';
      }

      navigation.replace('PaymentResult', {
        success: false,
        amount,
        paymentIntentId,
        orderId,
        orderNumber,
        customerEmail,
        errorMessage,
      });
    }
  };

  const handleCancel = async () => {
    isCancelledRef.current = true;
    setIsCancelling(true);

    // Navigate immediately for better UX - don't wait for cleanup
    navigation.goBack();

    // Cleanup in background (fire and forget)
    cancelPayment().catch(() => {});
    stripeTerminalApi.cancelPaymentIntent(paymentIntentId).catch(() => {});
  };

  const handleDevSkip = async () => {
    setIsSimulating(true);
    setStatusText('Simulating payment...');

    try {
      const result = await stripeTerminalApi.simulatePayment(paymentIntentId);

      if (result.status === 'succeeded') {
        navigation.replace('PaymentResult', {
          success: true,
          amount,
          paymentIntentId: result.id,
          orderId,
          orderNumber,
          customerEmail,
        });
      } else {
        throw new Error(`Payment simulation failed: ${result.status}`);
      }
    } catch (error: any) {
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

  const styles = createStyles(colors, glassColors);

  return (
    <StarBackground colors={colors} isDark={isDark}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Amount Display */}
          <Text style={styles.amount}>${(amount / 100).toFixed(2)}</Text>

          {/* Loading indicator */}
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>

          {/* Status */}
          <Text style={styles.statusText}>{statusText}</Text>

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
    </StarBackground>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark) => {
  return StyleSheet.create({
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
      fontFamily: fonts.bold,
      color: colors.text,
      marginBottom: 48,
      fontVariant: ['tabular-nums'],
    },
    loaderContainer: {
      marginBottom: 24,
    },
    statusText: {
      fontSize: 16,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    devButton: {
      marginTop: 40,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: glassColors.border,
      ...shadows.sm,
    },
    devButtonDisabled: {
      opacity: 0.6,
    },
    devButtonText: {
      fontSize: 14,
      fontFamily: fonts.medium,
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
      borderRadius: 16,
      backgroundColor: glassColors.backgroundElevated,
      borderWidth: 1,
      borderColor: glassColors.border,
      ...shadows.sm,
    },
    cancelButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.textSecondary,
    },
  });
};
