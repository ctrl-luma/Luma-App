import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Platform,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../context/ThemeContext';
import { useCart, CartItem } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { useAuth } from '../context/AuthContext';
import { useTerminal } from '../context/StripeTerminalContext';
import { stripeTerminalApi, ordersApi } from '../lib/api';
import { getDeviceId } from '../lib/device';
import { glass } from '../lib/colors';
import { shadows } from '../lib/shadows';
import { fonts } from '../lib/fonts';
import { PayoutsSetupBanner } from '../components/PayoutsSetupBanner';
import { SetupRequiredBanner } from '../components/SetupRequiredBanner';
import { StarBackground } from '../components/StarBackground';
import logger from '../lib/logger';
import { isValidEmailOrEmpty } from '../lib/validation';

type PaymentMethodType = 'tap_to_pay' | 'cash' | 'split';

// Apple TTPOi 5.4: Use region-correct copy
const TAP_TO_PAY_LABEL = Platform.OS === 'ios' ? 'Tap to Pay on iPhone' : 'Tap to Pay';

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
    resumedOrderId?: string;
    resumedOrder?: any;
  };
};

export function CheckoutScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'Checkout'>>();
  const glassColors = isDark ? glass.dark : glass.light;
  const { items, clearCart, incrementItem, decrementItem, removeItem, subtotal: cartSubtotal, orderNotes, setOrderNotes } = useCart();
  const { selectedCatalog } = useCatalog();
  const { isPaymentReady, connectLoading, connectStatus } = useAuth();
  const { deviceCompatibility, isInitialized: isTerminalInitialized, isWarming } = useTerminal();

  // Catalog data is automatically updated via socket events in CatalogContext

  const [customerEmail, setCustomerEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTipIndex, setSelectedTipIndex] = useState<number | null>(null);
  const [customTipAmount, setCustomTipAmount] = useState('');
  const [showCustomTipInput, setShowCustomTipInput] = useState(false);

  // Payment method selection
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('tap_to_pay');

  // Hold order modal
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdName, setHoldName] = useState('');
  const [isHolding, setIsHolding] = useState(false);

  // Order notes visibility
  const [showOrderNotes, setShowOrderNotes] = useState(orderNotes.length > 0);

  const { total: routeTotal, isQuickCharge, quickChargeDescription, resumedOrderId, resumedOrder } = route.params;
  const styles = createStyles(colors, glassColors, isDark);

  // Log route params for debugging
  console.log('CheckoutScreen: Route params', {
    isQuickCharge,
    resumedOrderId,
    hasResumedOrder: !!resumedOrder,
    resumedOrderStatus: resumedOrder?.status,
    resumedOrderItems: resumedOrder?.items?.length,
    cartItemCount: items.length,
  });

  // Initialize state from resumed order
  useEffect(() => {
    if (resumedOrder) {
      console.log('CheckoutScreen: Initializing from resumed order', {
        customerEmail: resumedOrder.customerEmail,
        notes: resumedOrder.notes,
        paymentMethod: resumedOrder.paymentMethod,
        tipAmount: resumedOrder.tipAmount,
      });

      // Set customer email
      if (resumedOrder.customerEmail) {
        setCustomerEmail(resumedOrder.customerEmail);
      }

      // Set order notes
      if (resumedOrder.notes) {
        setOrderNotes(resumedOrder.notes);
        setShowOrderNotes(true);
      }

      // Set payment method
      if (resumedOrder.paymentMethod) {
        setPaymentMethod(resumedOrder.paymentMethod as PaymentMethodType);
      }

      // Note: Tip is already handled via the tipAmount/grandTotal calculation
      // We don't need to set selectedTipIndex since we use the stored tipAmount directly
    }
  }, [resumedOrder]);

  // Use cart subtotal for regular checkout (items can be modified), route total for quick charge
  // For resumed orders, use the order's subtotal
  const subtotal = resumedOrder
    ? resumedOrder.subtotal
    : isQuickCharge
      ? routeTotal
      : cartSubtotal;

  // Navigate back if cart becomes empty (not for quick charge or resumed orders)
  useEffect(() => {
    console.log('CheckoutScreen: Empty cart check', { isQuickCharge, hasResumedOrder: !!resumedOrder, itemCount: items.length });
    if (!isQuickCharge && !resumedOrder && items.length === 0) {
      console.log('CheckoutScreen: Cart empty, going back');
      navigation.goBack();
    }
  }, [items.length, isQuickCharge, resumedOrder, navigation]);

  // Track whether we're allowing navigation (set to true after user confirms in dialog)
  const allowNavigationRef = useRef(false);

  // Intercept back navigation for resumed orders (hardware back button, swipe gesture)
  useEffect(() => {
    if (!resumedOrder || !resumedOrderId) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      // If navigation was allowed programmatically, let it happen
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        return;
      }

      // Prevent default navigation
      e.preventDefault();

      // Show confirmation dialog
      Alert.alert(
        'What would you like to do?',
        'This order needs to be held or deleted.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete Order',
            style: 'destructive',
            onPress: async () => {
              try {
                await ordersApi.cancel(resumedOrderId);
                allowNavigationRef.current = true;
                navigation.dispatch(e.data.action);
              } catch (error: any) {
                logger.error('Delete order error:', error);
                Alert.alert('Error', error.error || error.message || 'Failed to delete order');
              }
            },
          },
          {
            text: 'Hold Order',
            onPress: async () => {
              try {
                await ordersApi.hold(resumedOrderId, resumedOrder.holdName);
                allowNavigationRef.current = true;
                navigation.dispatch(e.data.action);
              } catch (error: any) {
                logger.error('Re-hold order error:', error);
                Alert.alert('Error', error.error || error.message || 'Failed to hold order');
              }
            },
          },
        ]
      );
    });

    return unsubscribe;
  }, [resumedOrder, resumedOrderId, navigation]);

  // Show setup required banner when charges aren't enabled
  const showSetupBanner = !connectLoading && connectStatus && !connectStatus.chargesEnabled;

  // Show payouts banner when charges are enabled but payouts aren't (user can still accept payments)
  const showPayoutsBanner = !connectLoading && isPaymentReady && connectStatus && !connectStatus.payoutsEnabled;

  // Use catalog settings for tip, email, and tax
  const showTipScreen = selectedCatalog?.showTipScreen ?? true;
  const promptForEmail = selectedCatalog?.promptForEmail ?? true;
  const tipPercentages = selectedCatalog?.tipPercentages ?? [15, 18, 20, 25];
  const allowCustomTip = selectedCatalog?.allowCustomTip ?? true;
  const taxRate = selectedCatalog?.taxRate ?? 0;

  // Calculate tax amount (based on subtotal) - use resumed order's tax if available
  const taxAmount = useMemo(() => {
    if (resumedOrder) return resumedOrder.taxAmount;
    if (taxRate <= 0) return 0;
    return Math.round(subtotal * (taxRate / 100));
  }, [subtotal, taxRate, resumedOrder]);

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

  // Calculate tip and grand total (subtotal + tax + tip) - use resumed order values if available
  const { tipAmount, grandTotal } = useMemo(() => {
    // For resumed orders, use the stored values
    if (resumedOrder) {
      return {
        tipAmount: resumedOrder.tipAmount,
        grandTotal: resumedOrder.totalAmount,
      };
    }

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

  // Handle hold order
  const handleHoldOrder = async () => {
    if (isQuickCharge) return; // Can't hold quick charges

    logger.log('Hold order: Starting hold process');
    setIsHolding(true);
    try {
      const deviceId = await getDeviceId();
      logger.log('Hold order: Got device ID:', deviceId);

      // Build order items with notes
      const orderItems = items.map((item) => ({
        productId: item.product.productId,
        categoryId: item.product.categoryId || undefined,
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.price,
        notes: item.notes,
      }));

      logger.log('Hold order: Creating order with', { itemCount: orderItems.length, holdName: holdName.trim() });

      // Create order first
      const order = await ordersApi.create({
        catalogId: selectedCatalog?.id,
        items: orderItems,
        subtotal: subtotal,
        taxAmount: taxAmount,
        tipAmount: tipAmount,
        totalAmount: grandTotal,
        customerEmail: customerEmail.trim() || undefined,
        deviceId,
        notes: orderNotes || undefined,
        holdName: holdName.trim() || undefined,
      });

      logger.log('Hold order: Order created', { orderId: order.id, orderNumber: order.orderNumber, status: order.status });

      // Hold the order
      logger.log('Hold order: Calling hold API for order', order.id);
      const heldOrder = await ordersApi.hold(order.id, holdName.trim() || undefined);

      logger.log('Hold order: Hold API returned', { orderId: heldOrder.id, status: heldOrder.status });

      // Verify the order was actually held
      if (heldOrder.status !== 'held') {
        logger.error('Hold order: Status mismatch!', { expected: 'held', actual: heldOrder.status });
        throw new Error(`Order hold failed - status is ${heldOrder.status}`);
      }

      logger.log('Order held successfully:', { orderId: heldOrder.id, status: heldOrder.status });

      // Close modal first
      setShowHoldModal(false);

      // Clear cart before navigating
      clearCart();

      // Close checkout screen and go back to menu
      navigation.goBack();

      // Show confirmation
      Alert.alert(
        'Order Held',
        `Order "${holdName.trim() || `#${order.orderNumber}`}" has been saved. You can resume it from the History tab.`
      );
    } catch (error: any) {
      logger.error('Hold order error:', error);
      logger.error('Hold order error details:', {
        message: error.message,
        error: error.error,
        statusCode: error.statusCode,
        code: error.code,
      });
      Alert.alert('Error', error.error || error.message || 'Failed to hold order');
    } finally {
      setIsHolding(false);
    }
  };

  // Handle closing checkout - the beforeRemove listener handles resumed order confirmation
  const handleClose = () => {
    navigation.goBack();
  };

  // Handle email change and clear error
  const handleEmailChange = (text: string) => {
    setCustomerEmail(text);
    if (emailError) {
      setEmailError(null);
    }
  };

  // Main payment handler - shows first-use modal if needed
  const handlePayment = async () => {
    // Validate email if provided
    if (customerEmail.trim() && !isValidEmailOrEmpty(customerEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    // Check if payment setup is complete
    if (connectStatus && !connectStatus.chargesEnabled) {
      Alert.alert(
        'Payment Setup Required',
        'You need to complete your payment setup before accepting payments.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Complete Setup', onPress: () => navigation.navigate('StripeOnboarding') },
        ]
      );
      return;
    }

    // Check if terminal is warming up
    if (isWarming) {
      Alert.alert(
        'Preparing Terminal',
        'Please wait while Tap to Pay is being prepared...',
        [{ text: 'OK' }]
      );
      return;
    }

    // Proceed with payment
    setIsProcessing(true);

    try {
      // Include email for receipt if provided
      const receiptEmail = customerEmail.trim() || undefined;

      // Build description based on checkout type
      const description = isQuickCharge
        ? `${quickChargeDescription || 'Quick Charge'}${tipAmount > 0 ? ` (includes $${(tipAmount / 100).toFixed(2)} tip)` : ''}`
        : resumedOrder
          ? `${resumedOrder.holdName || 'Resumed Order'} - ${resumedOrder.items?.length || 0} items${tipAmount > 0 ? ` (includes $${(tipAmount / 100).toFixed(2)} tip)` : ''}`
          : `Order - ${items.length} items${tipAmount > 0 ? ` (includes $${(tipAmount / 100).toFixed(2)} tip)` : ''}`;

      // 1. Get or create order in database
      let order;
      if (resumedOrder) {
        // Use existing resumed order
        console.log('CheckoutScreen: Using resumed order', { orderId: resumedOrder.id });
        order = resumedOrder;
      } else {
        // Create new order
        const orderItems = isQuickCharge
          ? undefined
          : items.map((item) => ({
              productId: item.product.productId,
              categoryId: item.product.categoryId || undefined,
              name: item.product.name,
              quantity: item.quantity,
              unitPrice: item.product.price,
              notes: item.notes, // Include per-item notes
            }));

        // Get device ID for order tracking
        const deviceId = await getDeviceId();

        console.log('CheckoutScreen: Creating new order');
        order = await ordersApi.create({
          catalogId: selectedCatalog?.id,
          items: orderItems,
          subtotal: subtotal,
          taxAmount: taxAmount,
          tipAmount: tipAmount,
          totalAmount: grandTotal,
          paymentMethod: paymentMethod === 'split' ? 'card' : paymentMethod,
          customerEmail: receiptEmail,
          isQuickCharge: isQuickCharge || false,
          description: isQuickCharge ? quickChargeDescription : undefined,
          deviceId,
          notes: orderNotes || undefined, // Include order-level notes
        });
        console.log('CheckoutScreen: Order created', { orderId: order.id });
      }

      // Handle cash payment - navigate to cash screen
      if (paymentMethod === 'cash') {
        navigation.navigate('CashPayment', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalAmount: grandTotal,
          customerEmail: receiptEmail,
        });
        setIsProcessing(false);
        return;
      }

      // Handle split payment - navigate to split screen
      if (paymentMethod === 'split') {
        navigation.navigate('SplitPayment', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalAmount: grandTotal,
          customerEmail: receiptEmail,
        });
        setIsProcessing(false);
        return;
      }

      // Check device compatibility (Apple TTPOi 1.1, 1.3)
      // If not compatible, show payment failed screen with option to enter card manually
      if (Platform.OS === 'ios' && !deviceCompatibility.isCompatible) {
        setIsProcessing(false);
        navigation.navigate('PaymentResult', {
          success: false,
          amount: grandTotal,
          paymentIntentId: '', // Will create new one for manual card entry
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerEmail: receiptEmail,
          errorMessage: deviceCompatibility.errorMessage || `This device does not support ${TAP_TO_PAY_LABEL}.`,
        });
        return;
      }

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
      logger.error('Payment error:', error);
      Alert.alert(
        'Payment Error',
        error.message || 'Failed to initiate payment. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <StarBackground colors={colors} isDark={isDark}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
          >
            <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {resumedOrder ? 'Resume Order' : 'Checkout'}
        </Text>
        {!isQuickCharge && !resumedOrder && items.length > 0 ? (
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

      {/* Setup Required Banner (charges not enabled) */}
      {showSetupBanner && <SetupRequiredBanner />}

      {/* Payouts Setup Banner (can accept payments but no payouts yet) */}
      {showPayoutsBanner && <PayoutsSetupBanner />}

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.content}>
        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            {isQuickCharge
              ? 'Quick Charge'
              : resumedOrder?.holdName
                ? `Order: ${resumedOrder.holdName}`
                : 'Order Summary'}
          </Text>

          {isQuickCharge ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.summaryValue}>${(subtotal / 100).toFixed(2)}</Text>
            </View>
          ) : resumedOrder ? (
            <>
              {/* Resumed order items (read-only) */}
              {resumedOrder.items?.map((item: any) => (
                <View key={item.id} style={styles.itemRow}>
                  {/* Thumbnail */}
                  <View style={styles.itemThumbnail}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                    ) : (
                      <View style={styles.itemImagePlaceholder}>
                        <Ionicons name="cube-outline" size={14} color={colors.textMuted} />
                      </View>
                    )}
                  </View>

                  {/* Item name and notes */}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.notes ? (
                      <Text style={styles.itemNotes} numberOfLines={1}>
                        {item.notes}
                      </Text>
                    ) : (
                      <Text style={styles.itemUnitPrice}>
                        ${(item.unitPrice / 100).toFixed(2)} each
                      </Text>
                    )}
                  </View>

                  {/* Quantity (read-only for resumed orders) */}
                  <View style={styles.quantityControls}>
                    <Text style={styles.quantityText}>x{item.quantity}</Text>
                  </View>

                  {/* Line total */}
                  <Text style={styles.itemPrice} numberOfLines={1} adjustsFontSizeToFit>
                    ${((item.unitPrice * item.quantity) / 100).toFixed(2)}
                  </Text>
                </View>
              ))}

              {/* Subtotal for resumed order */}
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>
                  Subtotal ({resumedOrder.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0} items)
                </Text>
                <Text style={styles.subtotalValue}>${(subtotal / 100).toFixed(2)}</Text>
              </View>
            </>
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
                      onPress={() => removeItem(item.cartKey)}
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
                    key={item.cartKey}
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

                      {/* Item name, notes, and price */}
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.product.name}
                        </Text>
                        {item.notes ? (
                          <Text style={styles.itemNotes} numberOfLines={1}>
                            {item.notes}
                          </Text>
                        ) : (
                          <Text style={styles.itemUnitPrice}>
                            ${(item.product.price / 100).toFixed(2)} each
                          </Text>
                        )}
                      </View>

                      {/* Quantity controls */}
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => decrementItem(item.cartKey)}
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
                          onPress={() => incrementItem(item.cartKey)}
                        >
                          <Ionicons name="add" size={16} color={colors.text} />
                        </TouchableOpacity>
                      </View>

                      {/* Line total */}
                      <Text style={styles.itemPrice} numberOfLines={1} adjustsFontSizeToFit>
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

        {/* Tip Selection - hide for resumed orders since tip is already set */}
        {showTipScreen && !resumedOrder && (
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
          <View style={[styles.emailSection, emailError && styles.emailSectionError]}>
            <Text style={styles.inputLabel}>Customer Email (Optional)</Text>
            <TextInput
              style={[styles.input, emailError && styles.inputError]}
              placeholder="email@example.com"
              placeholderTextColor={colors.inputPlaceholder}
              value={customerEmail}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {emailError ? (
              <Text style={styles.inputErrorText}>{emailError}</Text>
            ) : (
              <Text style={styles.inputHint}>
                Receipt will be sent to this email
              </Text>
            )}
          </View>
        )}

        {/* Order Notes Section */}
        {!isQuickCharge && (
          <View style={styles.orderNotesSection}>
            <TouchableOpacity
              style={styles.orderNotesHeader}
              onPress={() => setShowOrderNotes(!showOrderNotes)}
            >
              <View style={styles.orderNotesHeaderLeft}>
                <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.orderNotesTitle}>Order Notes</Text>
              </View>
              <Ionicons
                name={showOrderNotes ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            {showOrderNotes && (
              <TextInput
                style={styles.orderNotesInput}
                placeholder="Add special instructions for this order..."
                placeholderTextColor={colors.textMuted}
                value={orderNotes}
                onChangeText={setOrderNotes}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            )}
          </View>
        )}

        {/* Payment Method Selector */}
        {!isQuickCharge && (
          <View style={styles.paymentMethodSection}>
            <Text style={styles.paymentMethodTitle}>Payment Method</Text>
            <View style={styles.paymentMethodOptions}>
              <TouchableOpacity
                style={[
                  styles.paymentMethodButton,
                  paymentMethod === 'tap_to_pay' && styles.paymentMethodButtonSelected,
                ]}
                onPress={() => setPaymentMethod('tap_to_pay')}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={20}
                  color={paymentMethod === 'tap_to_pay' ? '#fff' : colors.text}
                />
                <Text
                  style={[
                    styles.paymentMethodButtonText,
                    paymentMethod === 'tap_to_pay' && styles.paymentMethodButtonTextSelected,
                  ]}
                >
                  Tap to Pay
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.paymentMethodButton,
                  paymentMethod === 'cash' && styles.paymentMethodButtonSelected,
                ]}
                onPress={() => setPaymentMethod('cash')}
              >
                <Ionicons
                  name="cash-outline"
                  size={20}
                  color={paymentMethod === 'cash' ? '#fff' : colors.text}
                />
                <Text
                  style={[
                    styles.paymentMethodButtonText,
                    paymentMethod === 'cash' && styles.paymentMethodButtonTextSelected,
                  ]}
                >
                  Cash
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.paymentMethodButton,
                  paymentMethod === 'split' && styles.paymentMethodButtonSelected,
                ]}
                onPress={() => setPaymentMethod('split')}
              >
                <Ionicons
                  name="git-branch-outline"
                  size={20}
                  color={paymentMethod === 'split' ? '#fff' : colors.text}
                />
                <Text
                  style={[
                    styles.paymentMethodButtonText,
                    paymentMethod === 'split' && styles.paymentMethodButtonTextSelected,
                  ]}
                >
                  Split
                </Text>
              </TouchableOpacity>
            </View>
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
          <Text style={styles.paymentValue} numberOfLines={1} adjustsFontSizeToFit>
            ${(grandTotal / 100).toFixed(2)}
          </Text>
        </View>
      </ScrollView>

      {/* Footer with Pay Button and Hold Button */}
      <View style={styles.footer}>
        {/* Hold Order Button (not for quick charge or resumed orders) */}
        {!isQuickCharge && !resumedOrder && (
          <TouchableOpacity
            style={styles.holdButton}
            onPress={() => setShowHoldModal(true)}
            disabled={isProcessing}
          >
            <Ionicons name="pause-circle-outline" size={20} color={colors.text} />
            <Text style={styles.holdButtonText}>Hold Order</Text>
          </TouchableOpacity>
        )}

        {/* Pay Button */}
        <TouchableOpacity
          onPress={handlePayment}
          disabled={isProcessing}
          activeOpacity={0.9}
          style={[
            styles.payButton,
            paymentMethod === 'cash' && styles.payButtonCash,
            paymentMethod === 'split' && styles.payButtonSplit,
            paymentMethod === 'tap_to_pay' && { backgroundColor: isDark ? '#fff' : '#09090b' },
            isProcessing && styles.payButtonDisabled,
          ]}
        >
          {isProcessing ? (
            <ActivityIndicator color={paymentMethod === 'tap_to_pay' ? (isDark ? '#09090b' : '#fff') : '#fff'} />
          ) : (
            <>
              {paymentMethod === 'tap_to_pay' ? (
                <>
                  {/* Apple TTPOi 5.5: Contactless payment icon (wave symbol) */}
                  <View style={styles.tapToPayIcon}>
                    <Ionicons name="wifi" size={22} color={isDark ? '#09090b' : '#fff'} style={styles.tapToPayIconRotated} />
                  </View>
                  {/* Apple TTPOi 5.4: Region-correct copy */}
                  <Text style={[styles.payButtonText, { color: isDark ? '#09090b' : '#fff' }]}>{TAP_TO_PAY_LABEL}</Text>
                </>
              ) : paymentMethod === 'cash' ? (
                <>
                  <Ionicons name="cash-outline" size={22} color="#fff" />
                  <Text style={styles.payButtonText}>Pay with Cash</Text>
                </>
              ) : (
                <>
                  <Ionicons name="git-branch-outline" size={22} color="#fff" />
                  <Text style={styles.payButtonText}>Split Payment</Text>
                </>
              )}
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Hold Order Modal */}
      <Modal
        visible={showHoldModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHoldModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowHoldModal(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Hold Order</Text>
            <Text style={styles.modalSubtitle}>
              Give this order a name so you can find it later
            </Text>
            <TextInput
              style={styles.holdNameInput}
              placeholder="e.g., Table 5, John's order"
              placeholderTextColor={colors.textMuted}
              value={holdName}
              onChangeText={setHoldName}
              autoFocus
              maxLength={50}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowHoldModal(false);
                  setHoldName('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, isHolding && styles.modalConfirmButtonDisabled]}
                onPress={handleHoldOrder}
                disabled={isHolding}
              >
                {isHolding ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="pause-circle" size={18} color="#fff" />
                    <Text style={styles.modalConfirmButtonText}>Hold Order</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      </SafeAreaView>
    </StarBackground>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark, isDark: boolean) => {
  const headerBackground = isDark ? '#09090b' : colors.background;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: headerBackground,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
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
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      minWidth: 75,
      maxWidth: 100,
      textAlign: 'right',
      flexShrink: 0,
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
    inputError: {
      borderColor: colors.error,
      borderWidth: 1.5,
    },
    inputErrorText: {
      fontSize: 13,
      color: colors.error,
      marginTop: 8,
    },
    emailSectionError: {
      borderColor: colors.error,
    },
    paymentAmount: {
      alignItems: 'center',
      paddingVertical: 24,
      marginTop: 8,
      paddingHorizontal: 20,
      width: '100%',
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
      width: '100%',
      textAlign: 'center',
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
    tapToPayIcon: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tapToPayIconRotated: {
      transform: [{ rotate: '90deg' }],
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
    // Item notes style
    itemNotes: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: colors.primary,
      fontStyle: 'italic',
    },
    // Order notes section styles
    orderNotesSection: {
      marginBottom: 16,
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: glassColors.border,
      overflow: 'hidden',
    },
    orderNotesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    orderNotesHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    orderNotesTitle: {
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.text,
    },
    orderNotesInput: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.text,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    // Payment method selector styles
    paymentMethodSection: {
      marginBottom: 16,
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      padding: 16,
      ...shadows.sm,
    },
    paymentMethodTitle: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    paymentMethodOptions: {
      flexDirection: 'row',
      gap: 10,
    },
    paymentMethodButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: glassColors.background,
      borderWidth: 1,
      borderColor: glassColors.border,
    },
    paymentMethodButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    paymentMethodButtonText: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.text,
    },
    paymentMethodButtonTextSelected: {
      color: '#fff',
    },
    // Hold button styles
    holdButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: glassColors.backgroundElevated,
      borderWidth: 1,
      borderColor: glassColors.border,
      marginBottom: 12,
    },
    holdButtonText: {
      fontSize: 16,
      fontFamily: fonts.medium,
      color: colors.text,
    },
    // Pay button variants
    payButtonCash: {
      backgroundColor: colors.success,
    },
    payButtonSplit: {
      backgroundColor: colors.primary,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 24,
      padding: 24,
      ...shadows.lg,
    },
    modalTitle: {
      fontSize: 22,
      fontFamily: fonts.bold,
      color: colors.text,
      marginBottom: 8,
    },
    modalSubtitle: {
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    holdNameInput: {
      backgroundColor: glassColors.background,
      borderWidth: 1,
      borderColor: glassColors.border,
      borderRadius: 14,
      paddingHorizontal: 18,
      paddingVertical: 14,
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.text,
      marginBottom: 20,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    modalCancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    modalCancelButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    modalConfirmButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    modalConfirmButtonDisabled: {
      opacity: 0.6,
    },
    modalConfirmButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: '#fff',
    },
  });
};
