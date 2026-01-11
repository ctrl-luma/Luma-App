import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
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
      const errorMessage = error.message || 'Payment failed';

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
    setIsCancelling(true);
    try {
      await cancelPayment();
      await stripeTerminalApi.cancelPaymentIntent(paymentIntentId);
    } catch (e) {
      // Ignore
    }
    navigation.goBack();
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
    <View style={styles.container}>
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
    </View>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark) => {
  return StyleSheet.create({
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
