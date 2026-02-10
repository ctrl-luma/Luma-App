import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  Linking,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PhoneInput from 'react-native-phone-number-input';

import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/Input';
import { authService } from '../lib/api';
import { iapService, SUBSCRIPTION_SKUS, SubscriptionProduct } from '../lib/iap';
import { storeCredentials } from '../lib/biometricAuth';
import { colors as appColors, glass } from '../lib/colors';
import { fonts } from '../lib/fonts';
import { shadows } from '../lib/shadows';
import { config } from '../lib/config';
import logger from '../lib/logger';
import { isValidEmail } from '../lib/validation';

// Types
type Step = 'account' | 'business' | 'plan' | 'confirmation';
type PlanType = 'starter' | 'pro';

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  businessName: string;
  businessType: string;
  phone: string;
  selectedPlan: PlanType;
  acceptTerms: boolean;
}

interface FormErrors {
  [key: string]: string;
}

// Business type options
const BUSINESS_TYPES = [
  'Event Vendor',
  'Festival Organizer',
  'Food Truck',
  'Mobile Bar',
  'Pop-up Shop',
  'Restaurant',
  'Other',
];

// Plan configurations
const PLANS = {
  starter: {
    name: 'Starter',
    price: 'Free',
    priceSubtext: 'No monthly fee',
    transactionFee: '2.9% + $0.18',
    features: [
      'Tap to Pay on iPhone & Android',
      'Simple menu builder',
      '1 custom menu',
      'Daily payout summary',
      '1 User',
    ],
    notIncluded: [
      'Events & ticketing',
      'Online ordering & preorders',
      'Tip reports & tracking',
      'Revenue splits',
      'Additional staff accounts',
    ],
  },
  pro: {
    name: 'Pro',
    price: '$29.99',
    priceSubtext: '/month',
    transactionFee: '2.8% + $0.16',
    features: [
      'Everything in Starter',
      'Unlimited custom catalogs',
      'Unlimited events & locations',
      'Unlimited users & devices',
      'Staff account management',
      'Revenue splits',
      'Tip reports & tracking',
      'Tip pooling & tip-out rules',
      'Analytics dashboard',
      'Export to CSV/PDF',
    ],
  },
};

export function SignUpScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const glassColors = isDark ? glass.dark : glass.light;
  const navigation = useNavigation<any>();
  const { signIn } = useAuth();
  const scrollViewRef = useRef<FlatList>(null);
  const phoneRef = useRef<PhoneInput>(null);
  const phoneE164 = useRef('');
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Form state
  const [currentStep, setCurrentStep] = useState<Step>('account');
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    businessName: '',
    businessType: '',
    phone: '',
    selectedPlan: 'starter',
    acceptTerms: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [iapProduct, setIapProduct] = useState<SubscriptionProduct | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showBusinessTypePicker, setShowBusinessTypePicker] = useState(false);
  const [phoneInputReady, setPhoneInputReady] = useState(false);

  // Combined loading state for disabling form fields
  const isFormDisabled = isLoading || isCheckingEmail || isCheckingPassword || isPurchasing;

  // Memoize PhoneInput props to prevent heavy re-renders on every keystroke
  const phoneOnChangeFormatted = useCallback((text: string) => {
    phoneE164.current = text;
    const digits = text.replace(/\D/g, '');
    const phone = digits.length === 11 && digits.startsWith('1')
      ? digits.slice(1)
      : digits;
    setFormData(prev => ({ ...prev, phone }));
  }, []);
  const phoneTextInputProps = useMemo(() => ({
    placeholderTextColor: appColors.gray500,
    selectionColor: colors.primary,
  }), [colors.primary]);
  const phoneDropdownImage = useMemo(() => (
    <Ionicons name="chevron-down" size={14} color={appColors.gray500} />
  ), []);
  const phoneCountryPickerProps = useMemo(() => ({
    withEmoji: false,
    withFilter: true,
    withFlag: true,
  }), []);

  // Steps configuration
  const steps: Step[] = ['account', 'business', 'plan', 'confirmation'];
  const currentStepIndex = steps.indexOf(currentStep);

  // Animate progress bar
  useEffect(() => {
    const progress = ((currentStepIndex + 1) / steps.length) * 100;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStepIndex, progressAnim, steps.length]);

  // Scroll to top when step changes
  useEffect(() => {
    scrollViewRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [currentStep]);

  // Lazy-mount PhoneInput after business step transition to avoid blocking JS thread
  useEffect(() => {
    if (currentStep === 'business' && !phoneInputReady) {
      const handle = InteractionManager.runAfterInteractions(() => {
        setPhoneInputReady(true);
      });
      return () => handle.cancel();
    }
  }, [currentStep, phoneInputReady]);

  // Initialize IAP and fetch products
  useEffect(() => {
    const initIAP = async () => {
      try {
        await iapService.initialize();
        const products = await iapService.getProducts();
        if (products.length > 0) {
          setIapProduct(products[0]);
          logger.log('[SignUp] IAP product loaded:', products[0].productId);
        }
      } catch (error) {
        logger.error('[SignUp] Failed to initialize IAP:', error);
      }
    };
    initIAP();

    return () => {
      // Cleanup IAP on unmount
      iapService.cleanup();
    };
  }, []);

  const styles = useMemo(() => createStyles(colors, glassColors, isDark), [colors, glassColors, isDark]);

  // Update form field
  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Check email availability
  const checkEmailAvailability = async (email: string): Promise<boolean> => {
    try {
      setIsCheckingEmail(true);
      const response = await fetch(`${config.apiUrl}/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      return !data.inUse;
    } catch (error) {
      logger.error('Error checking email:', error);
      return true; // Allow to proceed if check fails
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // Validate current step
  const validateStep = async (): Promise<boolean> => {
    const newErrors: FormErrors = {};

    if (currentStep === 'account') {
      if (!formData.email) {
        newErrors.email = 'Email is required';
      } else if (!isValidEmail(formData.email)) {
        newErrors.email = 'Please enter a valid email';
      } else {
        const isAvailable = await checkEmailAvailability(formData.email);
        if (!isAvailable) {
          newErrors.email = 'This email is already in use';
        }
      }

      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else {
        // Check password against server-side policy
        try {
          setIsCheckingPassword(true);
          const passwordResult = await authService.checkPassword(formData.password);
          if (!passwordResult.valid) {
            newErrors.password = passwordResult.errors.join('. ');
          }
        } catch (error) {
          logger.error('[SignUp] Password check error:', error);
          // Fall back to basic validation if API fails
          if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
          }
        } finally {
          setIsCheckingPassword(false);
        }
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    if (currentStep === 'business') {
      if (!formData.firstName.trim()) {
        newErrors.firstName = 'First name is required';
      }
      if (!formData.lastName.trim()) {
        newErrors.lastName = 'Last name is required';
      }
      if (!formData.businessName.trim()) {
        newErrors.businessName = 'Business name is required';
      }
      if (!formData.businessType) {
        newErrors.businessType = 'Please select a business type';
      }
      if (!formData.acceptTerms) {
        newErrors.acceptTerms = 'You must accept the terms and privacy policy';
      }
      if (formData.phone && phoneRef.current && !phoneRef.current.isValidNumber(phoneE164.current)) {
        newErrors.phone = 'Please enter a valid phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle next step
  const handleNext = async () => {
    Keyboard.dismiss();

    const isValid = await validateStep();
    if (!isValid) return;

    if (currentStep === 'account') {
      setCurrentStep('business');
    } else if (currentStep === 'business') {
      // Create the account BEFORE showing plan selection
      // This ensures we don't have orphaned payments if account creation fails
      setIsLoading(true);
      try {
        logger.log('[SignUp] Creating account before plan selection...');
        await createAccount('starter');
        logger.log('[SignUp] Account created successfully, proceeding to plan selection');
        setCurrentStep('plan');
      } catch (error: any) {
        logger.error('[SignUp] Account creation failed:', error);
        Alert.alert('Error', error.message || 'Failed to create account. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } else if (currentStep === 'plan') {
      await handleSignUp();
    }
  };

  // Handle back
  const handleBack = () => {
    if (currentStep === 'business') {
      setCurrentStep('account');
    } else if (currentStep === 'plan') {
      setCurrentStep('business');
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Login' as never);
    }
  };

  // Create account via API
  const createAccount = async (
    tier: 'starter' | 'pro',
    iapData?: { receipt: string; transactionId?: string; productId?: string }
  ): Promise<boolean> => {
    logger.log('[SignUp] ========== CREATE ACCOUNT ==========');
    logger.log('[SignUp] Tier:', tier);
    logger.log('[SignUp] Has IAP data:', !!iapData);

    if (iapData) {
      logger.log('[SignUp] IAP Platform:', Platform.OS);
      logger.log('[SignUp] IAP Product ID:', iapData.productId);
      logger.log('[SignUp] IAP Transaction ID:', iapData.transactionId);
      logger.log('[SignUp] IAP Receipt length:', iapData.receipt?.length || 0);
      logger.log('[SignUp] IAP Receipt preview:', iapData.receipt?.substring(0, 50) + '...');
    }

    const signupData = {
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      organizationName: formData.businessName.trim(),
      phone: formData.phone.replace(/\D/g, ''),
      acceptTerms: formData.acceptTerms,
      acceptPrivacy: formData.acceptTerms,
      subscriptionTier: tier,
      // Always send signup platform so subscription is tied to correct platform
      // Mobile signups -> 'apple'/'google', prevents them from being marked as 'stripe'
      signupPlatform: Platform.OS as 'ios' | 'android',
      // IAP data for mobile app purchases (Pro tier with completed purchase)
      ...(iapData && {
        iapPlatform: Platform.OS as 'ios' | 'android',
        iapReceipt: iapData.receipt,
        iapTransactionId: iapData.transactionId,
        iapProductId: iapData.productId,
      }),
    };

    logger.log('[SignUp] Sending signup request with data:', {
      email: signupData.email,
      tier: signupData.subscriptionTier,
      signupPlatform: signupData.signupPlatform,
      hasIapPlatform: !!signupData.iapPlatform,
      iapPlatform: signupData.iapPlatform,
      hasIapReceipt: !!signupData.iapReceipt,
      iapReceiptLength: signupData.iapReceipt?.length || 0,
      iapTransactionId: signupData.iapTransactionId,
      iapProductId: signupData.iapProductId,
    });

    const response = await fetch(`${config.apiUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signupData),
    });

    const data = await response.json();

    logger.log('[SignUp] Signup response status:', response.status);
    logger.log('[SignUp] Signup response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      logger.error('[SignUp] Signup failed:', data.message || data.error);
      throw new Error(data.message || 'Failed to create account');
    }

    logger.log('[SignUp] ========== ACCOUNT CREATED SUCCESSFULLY ==========');
    return true;
  };

  // Handle Pro plan purchase with IAP
  // Note: Account is already created at this point (as starter tier)
  // The Google webhook will update the subscription to pro when purchase is confirmed
  const handleProPurchase = async () => {
    if (!iapProduct) {
      Alert.alert(
        'Subscription Not Available',
        'Unable to load subscription details. Please try again or choose the Starter plan.',
        [
          { text: 'Try Again', onPress: () => handleSignUp() },
          { text: 'Use Starter', onPress: () => {
            updateField('selectedPlan', 'starter');
          }},
        ]
      );
      return;
    }

    setIsPurchasing(true);

    try {
      logger.log('[SignUp] ========== STARTING IAP PURCHASE ==========');
      logger.log('[SignUp] Product ID:', iapProduct.productId);
      logger.log('[SignUp] Account already created, webhook will update subscription');

      await iapService.purchaseSubscription(iapProduct.productId, async (result) => {
        setIsPurchasing(false);

        logger.log('[SignUp] IAP purchase callback received');
        logger.log('[SignUp] Result success:', result.success);
        logger.log('[SignUp] Result transactionId:', result.transactionId);
        logger.log('[SignUp] Result productId:', result.productId);

        if (result.success) {
          logger.log('[SignUp] ========== IAP PURCHASE SUCCESSFUL ==========');
          logger.log('[SignUp] Transaction ID:', result.transactionId);
          logger.log('[SignUp] Product ID:', result.productId);
          logger.log('[SignUp] Receipt/PurchaseToken:', result.receipt?.substring(0, 30) + '...');

          // Sign in first, then link the purchase token
          setIsLoading(true);
          try {
            const email = formData.email.trim().toLowerCase();
            await signIn(email, formData.password);

            // Store credentials for biometric login (replaces any previous account's credentials)
            await storeCredentials(email, formData.password);

            // Now link the IAP purchase so webhook can find the subscription
            // On Android, the receipt is the purchaseToken
            // On iOS, we use the transactionId
            const platform = Platform.OS === 'ios' ? 'ios' : 'android';
            logger.log('[SignUp] Linking IAP purchase to subscription...');

            try {
              await authService.linkIapPurchase({
                platform,
                purchaseToken: result.receipt || result.transactionId || '',
                transactionId: result.transactionId,
                productId: result.productId,
              });
              logger.log('[SignUp] IAP purchase linked successfully');
            } catch (linkError: any) {
              // Don't fail the signup if linking fails - webhook might still work
              logger.error('[SignUp] Failed to link IAP purchase (non-fatal):', linkError.message);
            }
          } catch (error: any) {
            setIsLoading(false);
            Alert.alert('Error', error.message || 'Failed to sign in. Please try logging in manually.');
          }
        } else {
          if (result.error !== 'Purchase cancelled') {
            Alert.alert('Purchase Failed', result.error || 'Unable to complete purchase. Please try again.');
          }
        }
      });
    } catch (error: any) {
      setIsPurchasing(false);
      logger.error('[SignUp] IAP purchase error:', error);
      Alert.alert('Error', 'Unable to start purchase. Please try again.');
    }
  };

  // Handle sign up (called from plan step)
  // Note: Account is already created at this point (created after business step)
  const handleSignUp = async () => {
    setIsLoading(true);
    try {
      if (formData.selectedPlan === 'pro') {
        setIsLoading(false);
        // Start IAP purchase flow - webhook will update subscription
        await handleProPurchase();
        return;
      }

      // Starter plan - account already created, just sign in
      logger.log('[SignUp] Starter plan selected, signing in...');
      const email = formData.email.trim().toLowerCase();
      await signIn(email, formData.password);

      // Store credentials for biometric login (replaces any previous account's credentials)
      await storeCredentials(email, formData.password);

    } catch (error: any) {
      logger.error('Sign up error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Render account step
  const renderAccountStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepTitleRow}>
        <View style={styles.stepTitleIcon}>
          <Ionicons name="person-add-outline" size={20} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Create your account</Text>
      </View>
      <Text style={styles.stepSubtitle}>
        Enter your email and create a password to get started
      </Text>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <Input
            icon="mail-outline"
            value={formData.email}
            onChangeText={(value) => updateField('email', value)}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!isFormDisabled}
            error={errors.email}
            rightIcon={isCheckingEmail ? (
              <View style={styles.inputSpinner}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : undefined}
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <Input
            icon="lock-closed-outline"
            value={formData.password}
            onChangeText={(value) => updateField('password', value)}
            placeholder="At least 8 characters"
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            editable={!isFormDisabled}
            error={errors.password}
            rightIcon={
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={appColors.gray400}
                />
              </TouchableOpacity>
            }
          />
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <Input
            icon="lock-closed-outline"
            value={formData.confirmPassword}
            onChangeText={(value) => updateField('confirmPassword', value)}
            placeholder="Re-enter your password"
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            editable={!isFormDisabled}
            error={errors.confirmPassword}
          />
          {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
        </View>
      </View>
    </View>
  );

  // Render business step
  const renderBusinessStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepTitleRow}>
        <View style={styles.stepTitleIcon}>
          <Ionicons name="storefront-outline" size={20} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Tell us about your business</Text>
      </View>
      <Text style={styles.stepSubtitle}>
        This information helps us customize your experience
      </Text>

      <View style={styles.form}>
        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>First Name</Text>
            <Input
              icon="person-outline"
              value={formData.firstName}
              onChangeText={(value) => updateField('firstName', value)}
              placeholder="John"
              autoCapitalize="words"
              autoComplete="given-name"
              editable={!isFormDisabled}
              error={errors.firstName}
            />
            {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
          </View>

          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Last Name</Text>
            <Input
              value={formData.lastName}
              onChangeText={(value) => updateField('lastName', value)}
              placeholder="Doe"
              autoCapitalize="words"
              autoComplete="family-name"
              editable={!isFormDisabled}
              error={errors.lastName}
            />
            {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Business Name</Text>
          <Input
            icon="storefront-outline"
            value={formData.businessName}
            onChangeText={(value) => updateField('businessName', value)}
            placeholder="The Rolling Bar Co."
            autoCapitalize="words"
            autoComplete="organization"
            editable={!isFormDisabled}
            error={errors.businessName}
          />
          {errors.businessName && <Text style={styles.errorText}>{errors.businessName}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Business Type</Text>
          <TouchableOpacity
            style={[
              styles.selectButton,
              errors.businessType && styles.selectButtonError,
              isFormDisabled && styles.selectButtonDisabled,
            ]}
            onPress={() => {
              Keyboard.dismiss();
              setShowBusinessTypePicker(true);
            }}
            disabled={isFormDisabled}
          >
            <Ionicons name="briefcase-outline" size={20} color={appColors.gray400} />
            <Text style={[
              styles.selectButtonText,
              !formData.businessType && styles.selectButtonPlaceholder,
            ]}>
              {formData.businessType || 'Select business type'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={appColors.gray400} />
          </TouchableOpacity>
          {errors.businessType && <Text style={styles.errorText}>{errors.businessType}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number (Optional)</Text>
          {phoneInputReady ? (
            <PhoneInput
              ref={phoneRef}
              defaultCode="US"
              layout="first"
              withDarkTheme={isDark}
              onChangeFormattedText={phoneOnChangeFormatted}
              placeholder="(555) 123-4567"
              textInputProps={phoneTextInputProps}
              renderDropdownImage={phoneDropdownImage}
              disabled={isFormDisabled}
              containerStyle={styles.phoneContainer}
              textContainerStyle={styles.phoneTextContainer}
              textInputStyle={styles.phoneInput}
              codeTextStyle={styles.phoneCode}
              flagButtonStyle={styles.phoneFlagButton}
              countryPickerButtonStyle={styles.phoneCountryButton}
              countryPickerProps={phoneCountryPickerProps}
            />
          ) : (
            <View style={styles.phoneContainer}>
              <View style={styles.phoneTextContainer}>
                <Text style={[styles.phoneInput, { lineHeight: 48, color: appColors.gray500 }]}>
                  (555) 123-4567
                </Text>
              </View>
            </View>
          )}
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.checkboxRow, isFormDisabled && styles.checkboxRowDisabled]}
          onPress={() => updateField('acceptTerms', !formData.acceptTerms)}
          activeOpacity={0.7}
          disabled={isFormDisabled}
        >
          <View style={[
            styles.checkbox,
            formData.acceptTerms && styles.checkboxChecked,
            errors.acceptTerms && styles.checkboxError,
          ]}>
            {formData.acceptTerms && (
              <Ionicons name="checkmark" size={14} color="#fff" />
            )}
          </View>
          <Text style={styles.checkboxLabel}>
            I agree to the{' '}
            <Text
              style={styles.link}
              onPress={(e) => {
                e.stopPropagation();
                Linking.openURL(`${config.websiteUrl}/terms`);
              }}
              suppressHighlighting
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={styles.link}
              onPress={(e) => {
                e.stopPropagation();
                Linking.openURL(`${config.websiteUrl}/privacy`);
              }}
              suppressHighlighting
            >
              Privacy Policy
            </Text>
          </Text>
        </TouchableOpacity>
        {errors.acceptTerms && <Text style={styles.errorText}>{errors.acceptTerms}</Text>}
      </View>

      {/* Business Type Picker Modal */}
      {showBusinessTypePicker && (
        <View style={styles.pickerOverlay}>
          <TouchableOpacity
            style={styles.pickerBackdrop}
            onPress={() => setShowBusinessTypePicker(false)}
          />
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Business Type</Text>
              <TouchableOpacity onPress={() => setShowBusinessTypePicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {BUSINESS_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.pickerOption,
                    formData.businessType === type && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    updateField('businessType', type);
                    setShowBusinessTypePicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    formData.businessType === type && styles.pickerOptionTextSelected,
                  ]}>
                    {type}
                  </Text>
                  {formData.businessType === type && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );

  // Render plan step
  const renderPlanStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepTitleRow}>
        <View style={styles.stepTitleIcon}>
          <Ionicons name="rocket-outline" size={20} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Choose your plan</Text>
      </View>
      <Text style={styles.stepSubtitle}>
        Start free or unlock all features with Pro
      </Text>

      <View style={styles.plansContainer}>
        {/* Starter Plan */}
        <TouchableOpacity
          style={[
            styles.planCard,
            formData.selectedPlan === 'starter' && styles.planCardSelected,
            isFormDisabled && styles.planCardDisabled,
          ]}
          onPress={() => updateField('selectedPlan', 'starter')}
          disabled={isFormDisabled}
        >
          <View style={styles.planHeader}>
            <Text style={styles.planName}>{PLANS.starter.name}</Text>
            <View style={styles.planPriceRow}>
              <Text style={styles.planPrice}>{PLANS.starter.price}</Text>
            </View>
            <Text style={styles.planPriceSubtext}>{PLANS.starter.priceSubtext}</Text>
          </View>

          <View style={styles.planFee}>
            <Text style={styles.planFeeLabel}>Transaction fee</Text>
            <Text style={styles.planFeeValue}>{PLANS.starter.transactionFee}</Text>
          </View>

          <View style={styles.planFeatures}>
            {PLANS.starter.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
            {PLANS.starter.notIncluded?.map((feature, index) => (
              <View key={`not-${index}`} style={styles.featureRow}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                <Text style={[styles.featureText, styles.featureTextMuted]}>{feature}</Text>
              </View>
            ))}
          </View>

          {formData.selectedPlan === 'starter' && (
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={styles.selectedBadgeText}>Selected</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Pro Plan */}
        <TouchableOpacity
          style={[
            styles.planCard,
            styles.planCardPro,
            formData.selectedPlan === 'pro' && styles.planCardSelected,
            isFormDisabled && styles.planCardDisabled,
          ]}
          onPress={() => updateField('selectedPlan', 'pro')}
          disabled={isFormDisabled}
        >
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>Most Popular</Text>
          </View>

          <View style={styles.planHeader}>
            <Text style={styles.planName}>{PLANS.pro.name}</Text>
            <View style={styles.planPriceRow}>
              <Text style={styles.planPrice}>
                {iapProduct?.localizedPrice || PLANS.pro.price}
              </Text>
            </View>
            <Text style={styles.planPriceSubtext}>{PLANS.pro.priceSubtext}</Text>
          </View>

          <View style={styles.planFee}>
            <Text style={styles.planFeeLabel}>Transaction fee</Text>
            <Text style={styles.planFeeValue}>{PLANS.pro.transactionFee}</Text>
          </View>

          <View style={styles.planFeatures}>
            {PLANS.pro.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {formData.selectedPlan === 'pro' && (
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={styles.selectedBadgeText}>Selected</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render confirmation step
  const renderConfirmationStep = () => (
    <View style={styles.confirmationContent}>
      {/* Success Icon with glow */}
      <View style={styles.successIconWrapper}>
        <View style={styles.successIconGlow} />
        <View style={styles.successIconOuter}>
          <LinearGradient
            colors={[colors.success, '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.successIconGradient}
          >
            <Ionicons name="checkmark" size={40} color="#fff" />
          </LinearGradient>
        </View>
      </View>

      <Text style={styles.confirmationTitle}>Welcome to Luma!</Text>
      <Text style={styles.confirmationSubtitle}>
        Your account has been created successfully
      </Text>

      <View style={styles.confirmationChecklist}>
        <View style={styles.checklistItem}>
          <View style={styles.checklistIconWrapper}>
            <Ionicons name="checkmark" size={14} color={colors.success} />
          </View>
          <Text style={styles.checklistText}>Account created</Text>
        </View>
        <View style={styles.checklistItem}>
          <View style={styles.checklistIconWrapper}>
            <Ionicons name="checkmark" size={14} color={colors.success} />
          </View>
          <Text style={styles.checklistText}>
            {formData.selectedPlan === 'pro' ? 'Pro plan activated' : 'Starter plan activated'}
          </Text>
        </View>
        <View style={styles.checklistItem}>
          <View style={[styles.checklistIconWrapper, styles.checklistIconLoading]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
          <Text style={styles.checklistText}>Signing you in...</Text>
        </View>
      </View>

      {/* Next Steps */}
      <View style={styles.nextStepsContainer}>
        <Text style={styles.nextStepsTitle}>Next Step</Text>
        <View style={styles.nextStepsCard}>
          <View style={styles.nextStepsIconContainer}>
            <Ionicons name="wallet-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.nextStepsContent}>
            <Text style={styles.nextStepsHeading}>Link Your Bank Account</Text>
            <Text style={styles.nextStepsDescription}>
              Visit the Vendor Portal to connect your bank account and start accepting payments.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </View>
      </View>
    </View>
  );

  // Get step title for header
  const getStepLabel = () => {
    switch (currentStep) {
      case 'account': return 'Step 1 of 3';
      case 'business': return 'Step 2 of 3';
      case 'plan': return 'Step 3 of 3';
      case 'confirmation': return 'Complete';
      default: return '';
    }
  };

  // Step indicator config
  const stepConfig = [
    { key: 'account', icon: 'mail-outline', label: 'Account' },
    { key: 'business', icon: 'briefcase-outline', label: 'Business' },
    { key: 'plan', icon: 'rocket-outline', label: 'Plan' },
  ];

  return (
    <LinearGradient
      colors={['#030712', '#0c1a2d', '#030712']}
      locations={[0, 0.5, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradient}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          {currentStep !== 'confirmation' ? (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <View style={styles.backButtonInner}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.backButton} />
          )}

          {/* Step Indicators */}
          {currentStep !== 'confirmation' ? (
            <View style={styles.stepIndicators}>
              {stepConfig.map((step, index) => {
                const isActive = steps.indexOf(currentStep) >= index;
                const isCurrent = currentStep === step.key;
                return (
                  <View key={step.key} style={styles.stepIndicatorWrapper}>
                    <View style={[
                      styles.stepIndicator,
                      isActive && styles.stepIndicatorActive,
                      isCurrent && styles.stepIndicatorCurrent,
                    ]}>
                      <Ionicons
                        name={step.icon as any}
                        size={16}
                        color={isActive ? '#fff' : colors.textMuted}
                      />
                    </View>
                    {index < stepConfig.length - 1 && (
                      <View style={[
                        styles.stepConnector,
                        isActive && styles.stepConnectorActive,
                      ]} />
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.stepLabel}>Complete</Text>
          )}

          <View style={styles.backButton} />
        </View>

        {/* Progress Bar */}
        {currentStep !== 'confirmation' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          </View>
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <FlatList
            ref={scrollViewRef}
            data={[]}
            renderItem={null}
            ListHeaderComponent={
              <>
                {currentStep === 'account' && renderAccountStep()}
                {currentStep === 'business' && renderBusinessStep()}
                {currentStep === 'plan' && renderPlanStep()}
                {currentStep === 'confirmation' && renderConfirmationStep()}
              </>
            }
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </KeyboardAvoidingView>

        {/* Footer with button */}
        {currentStep !== 'confirmation' && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.nextButton, (isLoading || isPurchasing) && styles.buttonDisabled]}
              onPress={handleNext}
              disabled={isLoading || isCheckingEmail || isCheckingPassword || isPurchasing}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, '#1d4ed8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.nextButtonGradient}
              >
                {isLoading || isPurchasing ? (
                  <View style={styles.buttonLoadingContent}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.nextButtonText}>
                      {isPurchasing ? 'Processing...' : 'Creating account...'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>
                      {currentStep === 'plan'
                        ? formData.selectedPlan === 'pro'
                          ? 'Subscribe to Pro'
                          : 'Create Account'
                        : 'Continue'}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {currentStep === 'account' && (
              <View style={styles.signInRow}>
                <Text style={styles.signInText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                  <Text style={styles.signInLink}>Sign in</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark, isDark: boolean) =>
  StyleSheet.create({
    gradient: {
      flex: 1,
    },
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonInner: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: glassColors.backgroundElevated,
      borderWidth: 1,
      borderColor: glassColors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepIndicators: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stepIndicatorWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stepIndicator: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: glassColors.backgroundElevated,
      borderWidth: 1,
      borderColor: glassColors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepIndicatorActive: {
      backgroundColor: colors.primary + '30',
      borderColor: colors.primary + '50',
    },
    stepIndicatorCurrent: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      ...shadows.sm,
      shadowColor: colors.primary,
      shadowOpacity: 0.4,
    },
    stepConnector: {
      width: 24,
      height: 2,
      backgroundColor: glassColors.border,
      marginHorizontal: 4,
    },
    stepConnectorActive: {
      backgroundColor: colors.primary + '50',
    },
    stepLabel: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: colors.textSecondary,
    },
    progressContainer: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    progressTrack: {
      height: 3,
      backgroundColor: glassColors.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
    },
    stepContent: {
      flex: 1,
    },
    stepTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    stepTitleIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepTitle: {
      fontSize: 24,
      fontFamily: fonts.bold,
      color: colors.text,
      flex: 1,
    },
    stepSubtitle: {
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginBottom: 28,
      lineHeight: 22,
      marginLeft: 52,
    },
    form: {
      gap: 20,
    },
    inputGroup: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: appColors.gray300,
      marginLeft: 4,
    },
    errorText: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.error,
      marginLeft: 4,
      marginTop: 4,
    },
    eyeButton: {
      position: 'absolute',
      right: 12,
      padding: 8,
    },
    inputSpinner: {
      position: 'absolute',
      right: 16,
      padding: 4,
    },
    row: {
      flexDirection: 'row',
    },
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(31, 41, 55, 0.5)',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.gray700,
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 12,
    },
    selectButtonError: {
      borderColor: colors.error,
    },
    selectButtonDisabled: {
      opacity: 0.5,
    },
    selectButtonText: {
      flex: 1,
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.text,
    },
    selectButtonPlaceholder: {
      color: appColors.gray500,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    checkboxRowDisabled: {
      opacity: 0.5,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: glassColors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkboxError: {
      borderColor: colors.error,
    },
    checkboxLabel: {
      flex: 1,
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    link: {
      color: colors.primary,
      fontFamily: fonts.medium,
    },
    // Picker styles
    pickerOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
    },
    pickerBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    pickerContent: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '60%',
    },
    pickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: glassColors.border,
    },
    pickerTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    pickerList: {
      paddingVertical: 8,
    },
    pickerOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    pickerOptionSelected: {
      backgroundColor: colors.primary + '15',
    },
    pickerOptionText: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.text,
    },
    pickerOptionTextSelected: {
      fontFamily: fonts.semiBold,
      color: colors.primary,
    },
    // Plan styles
    plansContainer: {
      gap: 16,
    },
    planCard: {
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: glassColors.border,
      padding: 20,
      ...shadows.sm,
    },
    planCardPro: {
      borderColor: colors.primary + '40',
    },
    planCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '08',
    },
    planCardDisabled: {
      opacity: 0.5,
    },
    popularBadge: {
      position: 'absolute',
      top: -12,
      right: 20,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    popularBadgeText: {
      fontSize: 12,
      fontFamily: fonts.semiBold,
      color: '#fff',
    },
    planHeader: {
      marginBottom: 16,
    },
    planName: {
      fontSize: 22,
      fontFamily: fonts.bold,
      color: colors.text,
      marginBottom: 8,
    },
    planPriceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    planPrice: {
      fontSize: 32,
      fontFamily: fonts.bold,
      color: colors.text,
    },
    planPriceOriginal: {
      fontSize: 18,
      fontFamily: fonts.regular,
      color: colors.textMuted,
      textDecorationLine: 'line-through',
    },
    planPriceSubtext: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginTop: 2,
    },
    trialBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    trialBadgeText: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.primary,
    },
    planFee: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: glassColors.background,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    planFeeLabel: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
    },
    planFeeValue: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    planFeatures: {
      gap: 10,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    featureText: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.text,
      flex: 1,
    },
    featureTextMuted: {
      color: colors.textMuted,
    },
    selectedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: glassColors.border,
    },
    selectedBadgeText: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: colors.primary,
    },
    // Confirmation styles
    confirmationContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    successIconWrapper: {
      position: 'relative',
      marginBottom: 28,
    },
    successIconGlow: {
      position: 'absolute',
      top: -10,
      left: -10,
      right: -10,
      bottom: -10,
      borderRadius: 50,
      backgroundColor: colors.success,
      opacity: 0.15,
    },
    successIconOuter: {
      width: 80,
      height: 80,
      borderRadius: 24,
      overflow: 'hidden',
      ...shadows.lg,
      shadowColor: colors.success,
      shadowOpacity: 0.4,
    },
    successIconGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmationTitle: {
      fontSize: 28,
      fontFamily: fonts.bold,
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    confirmationSubtitle: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginBottom: 32,
      textAlign: 'center',
    },
    confirmationChecklist: {
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      padding: 20,
      width: '100%',
      gap: 14,
    },
    checklistItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    checklistIconWrapper: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.success + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checklistIconLoading: {
      backgroundColor: colors.primary + '15',
    },
    checklistText: {
      fontSize: 16,
      fontFamily: fonts.medium,
      color: colors.text,
    },
    // Next Steps styles
    nextStepsContainer: {
      width: '100%',
      marginTop: 24,
    },
    nextStepsTitle: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    nextStepsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: glassColors.border,
      padding: 16,
      gap: 14,
    },
    nextStepsIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextStepsContent: {
      flex: 1,
    },
    nextStepsHeading: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: 4,
    },
    nextStepsDescription: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    // Footer styles
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
    },
    nextButton: {
      borderRadius: 20,
      overflow: 'hidden',
      ...shadows.md,
    },
    nextButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 18,
    },
    nextButtonText: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: '#fff',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonLoadingContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    signInRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 16,
    },
    signInText: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
    },
    signInLink: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: colors.primary,
    },
    // Phone input styles - matches Input component
    phoneContainer: {
      backgroundColor: 'rgba(31, 41, 55, 0.5)',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: appColors.gray700,
      width: '100%',
    },
    phoneTextContainer: {
      backgroundColor: 'transparent',
      borderRadius: 12,
      paddingVertical: 0,
      paddingHorizontal: 8,
    },
    phoneInput: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.text,
      height: 48,
    },
    phoneCode: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.text,
    },
    phoneFlagButton: {
      marginLeft: 12,
    },
    phoneCountryButton: {
      backgroundColor: 'transparent',
    },
  });
