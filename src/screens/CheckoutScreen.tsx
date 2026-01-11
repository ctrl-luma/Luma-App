import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../context/ThemeContext';
import { useCart, CartItem } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { useAuth } from '../context/AuthContext';
import { stripeTerminalApi, ordersApi } from '../lib/api';
import { glass } from '../lib/colors';
import { shadows } from '../lib/shadows';
import { PaymentsDisabledBanner } from '../components/PaymentsDisabledBanner';

interface TipOption {
  label: string;
  value: number;
  isCustom?: boolean;
}

type RouteParams = {
  Checkout: {
    total: number;
    isQuickCharge?: boolean;
    quickChargeDescription?: string;
  };
};

export function CheckoutScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'Checkout'>>();
  const glassColors = isDark ? glass.dark : glass.light;
  const { items, clearCart, incrementItem, decrementItem, removeItem, subtotal: cartSubtotal } = useCart();
  const { selectedCatalog, refreshCatalogs } = useCatalog();
  const { isPaymentReady, connectLoading } = useAuth();

  // Refresh catalog data when screen is focused to ensure latest settings
  useFocusEffect(
    useCallback(() => {
      refreshCatalogs();
    }, [refreshCatalogs])
  );

  const [customerEmail, setCustomerEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTipIndex, setSelectedTipIndex] = useState<number | null>(null);
  const [customTipAmount, setCustomTipAmount] = useState('');
  const [showCustomTipInput, setShowCustomTipInput] = useState(false);

  const { total: routeTotal, isQuickCharge, quickChargeDescription } = route.params;
  const styles = createStyles(colors, glassColors);

  // Use cart subtotal for regular checkout (items can be modified), route total for quick charge
  const subtotal = isQuickCharge ? routeTotal : cartSubtotal;

  // Navigate back if cart becomes empty (not for quick charge)
  useEffect(() => {
    if (!isQuickCharge && items.length === 0) {
      navigation.goBack();
    }
  }, [items.length, isQuickCharge, navigation]);

  // Check if payments are ready
  const paymentsDisabled = !connectLoading && !isPaymentReady;

  // Use catalog settings for tip, email, and tax
  const showTipScreen = selectedCatalog?.showTipScreen ?? true;
  const promptForEmail = selectedCatalog?.promptForEmail ?? true;
  const tipPercentages = selectedCatalog?.tipPercentages ?? [15, 18, 20, 25];
  const allowCustomTip = selectedCatalog?.allowCustomTip ?? true;
  const taxRate = selectedCatalog?.taxRate ?? 0;

  // Calculate tax amount (based on subtotal)
  const taxAmount = useMemo(() => {
    if (taxRate <= 0) return 0;
    return Math.round(subtotal * (taxRate / 100));
  }, [subtotal, taxRate]);

  // Build tip options
  const tipOptions: TipOption[] = useMemo(() => {
    const options: TipOption[] = tipPercentages.map((pct: number) => ({
      label: `${pct}%`,
      value: pct / 100,
    }));
    // Add custom tip option if allowed
    if (allowCustomTip) {
      options.push({ label: 'Custom', value: -1, isCustom: true });
    }
    // Always add no tip option
    options.push({ label: 'No Tip', value: 0 });
    return options;
  }, [tipPercentages, allowCustomTip]);

  // Calculate tip and grand total (subtotal + tax + tip)
  const { tipAmount, grandTotal } = useMemo(() => {
    const subtotalWithTax = subtotal + taxAmount;
    if (!showTipScreen || selectedTipIndex === null) {
      return { tipAmount: 0, grandTotal: subtotalWithTax };
    }
    const selectedOption = tipOptions[selectedTipIndex];
    if (selectedOption?.isCustom) {
      const customTip = parseInt(customTipAmount, 10) || 0;
      // Custom tip is entered in dollars, convert to cents
      const tipCents = customTip * 100;
      return { tipAmount: tipCents, grandTotal: subtotalWithTax + tipCents };
    }
    const tipPercentage = selectedOption?.value || 0;
    // Tip is calculated on subtotal (before tax)
    const tip = Math.round(subtotal * tipPercentage);
    return { tipAmount: tip, grandTotal: subtotalWithTax + tip };
  }, [subtotal, taxAmount, selectedTipIndex, showTipScreen, tipOptions, customTipAmount]);

  const handleTipSelect = (index: number) => {
    setSelectedTipIndex(index);
    const selectedOption = tipOptions[index];
    if (selectedOption?.isCustom) {
      setShowCustomTipInput(true);
    } else {
      setShowCustomTipInput(false);
      setCustomTipAmount('');
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      // Include email for receipt if provided
      const receiptEmail = customerEmail.trim() || undefined;

      // Build description based on checkout type
      const description = isQuickCharge
        ? `${quickChargeDescription || 'Quick Charge'}${tipAmount > 0 ? ` (includes $${(tipAmount / 100).toFixed(2)} tip)` : ''}`
        : `Order - ${items.length} items${tipAmount > 0 ? ` (includes $${(tipAmount / 100).toFixed(2)} tip)` : ''}`;

      // 1. Create order in database first
      const orderItems = isQuickCharge
        ? undefined
        : items.map((item) => ({
            productId: item.product.productId,
            categoryId: item.product.categoryId || undefined,
            name: item.product.name,
            quantity: item.quantity,
            unitPrice: item.product.price,
          }));

      const order = await ordersApi.create({
        catalogId: selectedCatalog?.id,
        items: orderItems,
        subtotal: subtotal,
        taxAmount: taxAmount,
        tipAmount: tipAmount,
        totalAmount: grandTotal,
        paymentMethod: 'tap_to_pay',
        customerEmail: receiptEmail,
        isQuickCharge: isQuickCharge || false,
        description: isQuickCharge ? quickChargeDescription : undefined,
      });

      // 2. Create payment intent with tip included
      const paymentIntent = await stripeTerminalApi.createPaymentIntent({
        amount: grandTotal / 100, // Convert cents to dollars for API
        description,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          catalogId: selectedCatalog?.id || '',
          isQuickCharge: isQuickCharge ? 'true' : 'false',
          subtotal: subtotal.toString(),
          taxAmount: taxAmount.toString(),
          tipAmount: tipAmount.toString(),
        },
        receiptEmail,
      });

      // 3. Link PaymentIntent to order
      await ordersApi.linkPaymentIntent(order.id, paymentIntent.id);

      // Navigate to payment processing screen
      navigation.navigate('PaymentProcessing', {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.clientSecret,
        amount: grandTotal,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerEmail: receiptEmail,
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
        {!isQuickCharge && items.length > 0 ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              clearCart();
              navigation.goBack();
            }}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {/* Payments Disabled Banner */}
      {paymentsDisabled && <PaymentsDisabledBanner />}

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.content}>
        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            {isQuickCharge ? 'Quick Charge' : 'Order Summary'}
          </Text>

          {isQuickCharge ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.summaryValue}>${(subtotal / 100).toFixed(2)}</Text>
            </View>
          ) : (
            <>
              {/* Itemized list with thumbnails and quantity controls */}
              {items.map((item) => {
                const renderRightActions = (
                  progress: Animated.AnimatedInterpolation<number>,
                  dragX: Animated.AnimatedInterpolation<number>
                ) => {
                  const scale = dragX.interpolate({
                    inputRange: [-60, -30, 0],
                    outputRange: [1, 0.9, 0.6],
                    extrapolate: 'clamp',
                  });
                  const opacity = dragX.interpolate({
                    inputRange: [-60, -30, 0],
                    outputRange: [1, 0.8, 0],
                    extrapolate: 'clamp',
                  });
                  return (
                    <TouchableOpacity
                      style={styles.deleteAction}
                      onPress={() => removeItem(item.product.id)}
                      activeOpacity={0.8}
                    >
                      <Animated.View
                        style={[
                          styles.deleteActionContent,
                          { transform: [{ scale }], opacity }
                        ]}
                      >
                        <Ionicons name="trash" size={20} color="#fff" />
                      </Animated.View>
                    </TouchableOpacity>
                  );
                };

                return (
                  <Swipeable
                    key={item.product.id}
                    renderRightActions={renderRightActions}
                    rightThreshold={40}
                    overshootRight={false}
                  >
                    <View style={styles.itemRow}>
                      {/* Thumbnail */}
                      <View style={styles.itemThumbnail}>
                        {item.product.imageUrl ? (
                          <Image source={{ uri: item.product.imageUrl }} style={styles.itemImage} />
                        ) : (
                          <View style={styles.itemImagePlaceholder}>
                            <Ionicons name="image-outline" size={14} color={colors.textMuted} />
                          </View>
                        )}
                      </View>

                      {/* Item name and price */}
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.product.name}
                        </Text>
                        <Text style={styles.itemUnitPrice}>
                          ${(item.product.price / 100).toFixed(2)} each
                        </Text>
                      </View>

                      {/* Quantity controls */}
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => decrementItem(item.product.id)}
                        >
                          <Ionicons
                            name={item.quantity === 1 ? 'trash-outline' : 'remove'}
                            size={16}
                            color={item.quantity === 1 ? colors.error : colors.text}
                          />
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => incrementItem(item.product.id)}
                        >
                          <Ionicons name="add" size={16} color={colors.text} />
                        </TouchableOpacity>
                      </View>

                      {/* Line total */}
                      <Text style={styles.itemPrice}>
                        ${((item.product.price * item.quantity) / 100).toFixed(2)}
                      </Text>
                    </View>
                  </Swipeable>
                );
              })}

              {/* Subtotal */}
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>
                  Subtotal ({items.reduce((sum, item) => sum + item.quantity, 0)} items)
                </Text>
                <Text style={styles.subtotalValue}>${(subtotal / 100).toFixed(2)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Tip Selection */}
        {showTipScreen && (
          <View style={styles.tipSection}>
            <Text style={styles.tipTitle}>Add a Tip</Text>
            <View style={styles.tipOptions}>
              {tipOptions.map((option, index) => {
                const isSelected = selectedTipIndex === index;
                const calculatedTip = option.value > 0 ? Math.round(subtotal * option.value) : 0;
                return (
                  <View key={index} style={styles.tipButton}>
                    <TouchableOpacity
                      style={[
                        styles.tipButtonInner,
                        isSelected && styles.tipButtonInnerSelected,
                      ]}
                      onPress={() => handleTipSelect(index)}
                    >
                      <Text
                        style={[
                          styles.tipButtonLabel,
                          isSelected && styles.tipButtonLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      {option.value > 0 && !option.isCustom && (
                        <Text
                          style={[
                            styles.tipButtonAmount,
                            isSelected && styles.tipButtonAmountSelected,
                          ]}
                        >
                          ${(calculatedTip / 100).toFixed(2)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {/* Custom Tip Input */}
            {showCustomTipInput && (
              <View style={styles.customTipContainer}>
                <Text style={styles.customTipLabel}>Enter custom tip amount:</Text>
                <View style={styles.customTipInputRow}>
                  <Text style={styles.customTipDollar}>$</Text>
                  <TextInput
                    style={styles.customTipInput}
                    placeholder="0"
                    placeholderTextColor={colors.inputPlaceholder}
                    value={customTipAmount}
                    onChangeText={setCustomTipAmount}
                    keyboardType="number-pad"
                    autoFocus
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* Customer Email (Optional) */}
        {promptForEmail && (
          <View style={styles.emailSection}>
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
              Receipt will be sent to this email
            </Text>
          </View>
        )}

        {/* Payment Amount Display */}
        <View style={styles.paymentAmount}>
          {(tipAmount > 0 || taxAmount > 0) && (
            <View style={styles.breakdownContainer}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Subtotal</Text>
                <Text style={styles.breakdownValue}>${(subtotal / 100).toFixed(2)}</Text>
              </View>
              {taxAmount > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Tax ({taxRate}%)</Text>
                  <Text style={styles.breakdownValue}>${(taxAmount / 100).toFixed(2)}</Text>
                </View>
              )}
              {tipAmount > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Tip</Text>
                  <Text style={styles.breakdownValue}>${(tipAmount / 100).toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.breakdownDivider} />
            </View>
          )}
          <Text style={styles.paymentLabel}>Total to Charge</Text>
          <Text style={styles.paymentValue}>${(grandTotal / 100).toFixed(2)}</Text>
        </View>
      </ScrollView>

      {/* Pay Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handlePayment}
          disabled={isProcessing || paymentsDisabled}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={
              paymentsDisabled
                ? [colors.gray600, colors.gray700]
                : [colors.primary, colors.primary700]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.payButton, (isProcessing || paymentsDisabled) && styles.payButtonDisabled]}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : paymentsDisabled ? (
              <>
                <Ionicons name="alert-circle-outline" size={22} color="#fff" />
                <Text style={styles.payButtonText}>Payments Not Set Up</Text>
              </>
            ) : (
              <>
                <Ionicons name="card-outline" size={22} color="#fff" />
                <Text style={styles.payButtonText}>Tap to Pay</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark) => {
  return StyleSheet.create({
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
      backgroundColor: glassColors.backgroundSubtle,
      borderBottomWidth: 1,
      borderBottomColor: glassColors.borderSubtle,
    },
    closeButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: glassColors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    clearButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderRadius: 12,
    },
    clearButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.error,
    },
    scrollContent: {
      flex: 1,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    summaryCard: {
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      padding: 20,
      marginBottom: 24,
      ...shadows.md,
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
    // Itemized receipt styles
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: glassColors.border,
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 12,
    },
    deleteAction: {
      backgroundColor: colors.error,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      borderRadius: 12,
      marginLeft: -8,
    },
    deleteActionContent: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemThumbnail: {
      width: 36,
      height: 36,
      borderRadius: 8,
      overflow: 'hidden',
      marginRight: 10,
    },
    itemImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    itemImagePlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: glassColors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemInfo: {
      flex: 1,
      marginRight: 8,
    },
    itemName: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 2,
    },
    itemUnitPrice: {
      fontSize: 12,
      color: colors.textMuted,
    },
    quantityControls: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: glassColors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: glassColors.border,
      marginRight: 10,
    },
    quantityButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quantityText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      minWidth: 20,
      textAlign: 'center',
    },
    itemPrice: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      minWidth: 55,
      textAlign: 'right',
    },
    subtotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 4,
    },
    subtotalLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    subtotalValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    inputSection: {
      marginBottom: 32,
    },
    emailSection: {
      marginTop: 8,
      marginBottom: 24,
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      padding: 20,
      ...shadows.sm,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 10,
    },
    input: {
      backgroundColor: glassColors.background,
      borderWidth: 1,
      borderColor: glassColors.border,
      borderRadius: 14,
      paddingHorizontal: 18,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
    },
    inputHint: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 8,
    },
    paymentAmount: {
      alignItems: 'center',
      paddingVertical: 24,
      marginTop: 8,
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
      paddingVertical: 18,
      borderRadius: 20,
      gap: 10,
      ...shadows.md,
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
    },
    payButtonDisabled: {
      opacity: 0.5,
      shadowOpacity: 0,
    },
    payButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
    },
    // Tip section styles
    tipSection: {
      marginBottom: 24,
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      padding: 20,
      ...shadows.sm,
    },
    tipTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    tipOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -6,
    },
    tipButton: {
      width: '33.33%',
      paddingHorizontal: 6,
      marginBottom: 12,
    },
    tipButtonInner: {
      backgroundColor: glassColors.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: glassColors.border,
      height: 95,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipButtonInnerSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tipButtonLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    tipButtonLabelSelected: {
      color: '#fff',
    },
    tipButtonAmount: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
    },
    tipButtonAmountSelected: {
      color: 'rgba(255, 255, 255, 0.8)',
    },
    // Custom tip styles
    customTipContainer: {
      marginTop: 10,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: glassColors.border,
    },
    customTipLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    customTipInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    customTipDollar: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginRight: 8,
    },
    customTipInput: {
      flex: 1,
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      backgroundColor: glassColors.background,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: glassColors.border,
    },
    // Breakdown styles
    breakdownContainer: {
      width: '100%',
      marginBottom: 16,
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    breakdownLabel: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    breakdownValue: {
      fontSize: 15,
      color: colors.text,
    },
    breakdownDivider: {
      height: 1,
      backgroundColor: glassColors.border,
      marginTop: 8,
      marginBottom: 8,
    },
  });
};
