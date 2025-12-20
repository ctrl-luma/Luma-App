import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { stripeTerminalApi } from '../lib/api';

type RouteParams = {
  Checkout: { total: number };
};

export function CheckoutScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'Checkout'>>();
  const { items, clearCart } = useCart();

  const [customerEmail, setCustomerEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { total } = route.params;
  const styles = createStyles(colors);

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      // Create payment intent
      const paymentIntent = await stripeTerminalApi.createPaymentIntent({
        amount: total / 100, // Convert cents to dollars for API
        description: `Order - ${items.length} items`,
        metadata: {
          items: JSON.stringify(items.map((i) => ({ id: i.product.id, qty: i.quantity }))),
        },
      });

      // Navigate to payment processing screen
      navigation.navigate('PaymentProcessing', {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.clientSecret,
        amount: total,
      });
    } catch (error: any) {
      console.error('Payment error:', error);
      Alert.alert(
        'Payment Error',
        error.message || 'Failed to initiate payment. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{items.length} items</Text>
            <Text style={styles.summaryValue}>${(total / 100).toFixed(2)}</Text>
          </View>
        </View>

        {/* Customer Email (Optional) */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Customer Email (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            placeholderTextColor={colors.inputPlaceholder}
            value={customerEmail}
            onChangeText={setCustomerEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.inputHint}>
            Receipt will be sent to this email if provided
          </Text>
        </View>

        {/* Payment Amount Display */}
        <View style={styles.paymentAmount}>
          <Text style={styles.paymentLabel}>Total to Charge</Text>
          <Text style={styles.paymentValue}>${(total / 100).toFixed(2)}</Text>
        </View>
      </View>

      {/* Pay Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="card-outline" size={22} color="#fff" />
              <Text style={styles.payButtonText}>Tap to Pay</Text>
            </>
          )}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 20,
      marginBottom: 24,
    },
    summaryTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 16,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: 16,
      color: colors.text,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    inputSection: {
      marginBottom: 32,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.inputText,
    },
    inputHint: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 8,
    },
    paymentAmount: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    paymentLabel: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    paymentValue: {
      fontSize: 56,
      fontWeight: '700',
      color: colors.text,
    },
    footer: {
      padding: 20,
      paddingBottom: 36,
    },
    payButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: 9999,
      gap: 10,
    },
    payButtonDisabled: {
      opacity: 0.7,
    },
    payButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
    },
  });
