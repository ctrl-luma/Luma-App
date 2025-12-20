import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { stripeTerminalApi } from '../lib/api';

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

  // Animation for the card icon
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // In a real app, you would use Stripe Terminal SDK here to:
    // 1. Connect to the reader (phone's NFC)
    // 2. Collect payment method
    // 3. Confirm payment

    // For now, simulate a successful payment after 3 seconds
    const timer = setTimeout(() => {
      navigation.replace('PaymentResult', {
        success: true,
        amount,
        paymentIntentId,
      });
    }, 3000);

    return () => {
      pulse.stop();
      clearTimeout(timer);
    };
  }, []);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await stripeTerminalApi.cancelPaymentIntent(paymentIntentId);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to cancel payment:', error);
      navigation.goBack();
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Animated Card Icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Ionicons name="card" size={64} color={colors.primary} />
        </Animated.View>

        <Text style={styles.title}>Ready for Payment</Text>
        <Text style={styles.subtitle}>
          Hold the customer's card near the back of your device
        </Text>

        <Text style={styles.amount}>${(amount / 100).toFixed(2)}</Text>

        {/* NFC Waves Animation */}
        <View style={styles.wavesContainer}>
          <View style={[styles.wave, styles.wave1]} />
          <View style={[styles.wave, styles.wave2]} />
          <View style={[styles.wave, styles.wave3]} />
        </View>
      </View>

      {/* Cancel Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={isCancelling}
        >
          <Text style={styles.cancelButtonText}>
            {isCancelling ? 'Cancelling...' : 'Cancel'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 32,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 24,
    },
    amount: {
      fontSize: 48,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 48,
    },
    wavesContainer: {
      position: 'relative',
      width: 200,
      height: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wave: {
      position: 'absolute',
      borderWidth: 2,
      borderColor: colors.primary + '30',
      borderRadius: 100,
    },
    wave1: {
      width: 80,
      height: 80,
    },
    wave2: {
      width: 120,
      height: 120,
    },
    wave3: {
      width: 160,
      height: 160,
    },
    footer: {
      padding: 20,
      paddingBottom: 36,
    },
    cancelButton: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.error,
    },
  });
