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

import { initStripe } from '@stripe/stripe-react-native';
import { useTheme } from '../context/ThemeContext';
import { useTerminal } from '../context/StripeTerminalContext';
import { stripeTerminalApi } from '../lib/api';
import { fonts } from '../lib/fonts';
import { glass } from '../lib/colors';
import { shadows } from '../lib/shadows';
import { StarBackground } from '../components/StarBackground';
import { config } from '../lib/config';


type RouteParams = {
  PaymentProcessing: {
    paymentIntentId: string;
    clientSecret: string;
    stripeAccountId: string;
    amount: number;
    orderId?: string;
    orderNumber?: string;
    customerEmail?: string;
    preorderId?: string;
  };
};

export function PaymentProcessingScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'PaymentProcessing'>>();
  const glassColors = isDark ? glass.dark : glass.light;
  const { initializeTerminal, connectReader, processPayment: terminalProcessPayment, cancelPayment } = useTerminal();

  const { paymentIntentId, clientSecret, stripeAccountId, amount, orderId, orderNumber, customerEmail, preorderId } = route.params;
  const [isCancelling, setIsCancelling] = useState(false);
  const [statusText, setStatusText] = useState('Preparing payment...');
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
        // If the error is already user-friendly (e.g. merchant blocked), pass it through directly
        if (connectErr.message?.includes('contact support')) {
          throw connectErr;
        }
        throw new Error(`Connection failed: ${connectErr.message}`);
      }

      // Initialize Stripe SDK with connected account for Terminal PI retrieval
      // This ensures retrievePaymentIntent finds the PI on the connected account
      await initStripe({
        publishableKey: config.stripePublishableKey,
        merchantIdentifier: 'merchant.com.lumapos',
        stripeAccountId,
      });

      setStatusText('Starting payment...');

      const result = await terminalProcessPayment(clientSecret);

      if (result.status === 'succeeded') {
        navigation.replace('PaymentResult', {
          success: true,
          amount,
          paymentIntentId,
          orderId,
          orderNumber,
          customerEmail,
          preorderId,
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
        preorderId,
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

  const styles = createStyles(colors, glassColors);

  return (
    <StarBackground colors={colors} isDark={isDark}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Amount Display */}
          <Text style={styles.amount} maxFontSizeMultiplier={1.2}>${(amount / 100).toFixed(2)}</Text>

          {/* Loading indicator */}
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>

          {/* Status */}
          <Text style={styles.statusText} maxFontSizeMultiplier={1.5}>{statusText}</Text>

        </View>

        {/* Cancel Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={isCancelling}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText} maxFontSizeMultiplier={1.3}>
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
