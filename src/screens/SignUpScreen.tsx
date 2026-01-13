import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/Input';
import { authService } from '../lib/api';
import { iapService, SUBSCRIPTION_SKUS, SubscriptionProduct } from '../lib/iap';
import { colors as appColors, glass } from '../lib/colors';
import { fonts } from '../lib/fonts';
import { shadows } from '../lib/shadows';
import { config } from '../lib/config';

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
      '1 custom catalog',
      'Daily payout summary',
      '1 User',
    ],
    notIncluded: [
      'Event mode',
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
  const glassColors = isDark ? glass.dark : glass.light;
  const navigation = useNavigation<any>();
  const { signIn } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
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
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [iapProduct, setIapProduct] = useState<SubscriptionProduct | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showBusinessTypePicker, setShowBusinessTypePicker] = useState(false);

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
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [currentStep]);

  // Initialize IAP and fetch products
  useEffect(() => {
    const initIAP = async () => {
      try {
        await iapService.initialize();
        const products = await iapService.getProducts();
        if (products.length > 0) {
          setIapProduct(products[0]);
          console.log('[SignUp] IAP product loaded:', products[0].productId);
        }
      } catch (error) {
        console.error('[SignUp] Failed to initialize IAP:', error);
      }
    };
    initIAP();

    return () => {
      // Cleanup IAP on unmount
      iapService.cleanup();
    };
  }, []);

  const styles = createStyles(colors, glassColors, isDark);

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

  // Format phone number
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  // Validate email format
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
      console.error('Error checking email:', error);
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
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
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
      setCurrentStep('plan');
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
    } else {
      navigation.goBack();
    }
  };

  // Create account via API
  const createAccount = async (tier: 'starter' | 'pro', purchaseReceipt?: string): Promise<boolean> => {
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
      ...(purchaseReceipt && { iapReceipt: purchaseReceipt }),
    };

    const response = await fetch(`${config.apiUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signupData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create account');
    }

    return true;
  };

  // Handle Pro plan purchase with IAP
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
      await iapService.purchaseSubscription(iapProduct.productId, async (result) => {
        setIsPurchasing(false);

        if (result.success) {
          console.log('[SignUp] IAP purchase successful:', result.transactionId);

          // Now create the account with the purchase receipt
          setIsLoading(true);
          try {
            await createAccount('pro', result.receipt);
            setCurrentStep('confirmation');

            // Auto sign in after 2 seconds
            setTimeout(async () => {
              try {
                await signIn(formData.email.trim().toLowerCase(), formData.password);
              } catch (error) {
                console.error('Auto sign-in failed:', error);
                navigation.replace('Login');
              }
            }, 2000);
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to create account after purchase. Please contact support.');
          } finally {
            setIsLoading(false);
          }
        } else {
          if (result.error !== 'Purchase cancelled') {
            Alert.alert('Purchase Failed', result.error || 'Unable to complete purchase. Please try again.');
          }
        }
      });
    } catch (error: any) {
      setIsPurchasing(false);
      console.error('[SignUp] IAP purchase error:', error);
      Alert.alert('Error', 'Unable to start purchase. Please try again.');
    }
  };

  // Handle sign up
  const handleSignUp = async () => {
    setIsLoading(true);
    try {
      if (formData.selectedPlan === 'pro') {
        setIsLoading(false);
        // Start IAP purchase flow
        await handleProPurchase();
        return;
      }

      // Starter plan - create account directly
      await createAccount('starter');

      // Move to confirmation step
      setCurrentStep('confirmation');

      // Auto sign in after 2 seconds
      setTimeout(async () => {
        try {
          await signIn(formData.email.trim().toLowerCase(), formData.password);
        } catch (error) {
          console.error('Auto sign-in failed:', error);
          navigation.replace('Login');
        }
      }, 2000);

    } catch (error: any) {
      console.error('Sign up error:', error);
      Alert.alert('Error', error.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Render account step
  const renderAccountStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Create your account</Text>
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
            error={errors.email}
            rightIcon={isCheckingEmail ? (
              <ActivityIndicator size="small" color={colors.primary} />
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
            autoComplete="password-new"
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
            secureTextEntry={!showConfirmPassword}
            autoComplete="password-new"
            error={errors.confirmPassword}
            rightIcon={
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={appColors.gray400}
                />
              </TouchableOpacity>
            }
          />
          {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
        </View>
      </View>
    </View>
  );

  // Render business step
  const renderBusinessStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Tell us about your business</Text>
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
            ]}
            onPress={() => setShowBusinessTypePicker(true)}
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
          <Input
            icon="call-outline"
            value={formatPhoneNumber(formData.phone)}
            onChangeText={(value) => updateField('phone', value.replace(/\D/g, ''))}
            placeholder="(555) 123-4567"
            keyboardType="phone-pad"
            autoComplete="tel"
          />
        </View>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => updateField('acceptTerms', !formData.acceptTerms)}
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
            <Text style={styles.link}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.link}>Privacy Policy</Text>
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
      <Text style={styles.stepTitle}>Choose your plan</Text>
      <Text style={styles.stepSubtitle}>
        Start free or unlock all features with Pro
      </Text>

      <View style={styles.plansContainer}>
        {/* Starter Plan */}
        <TouchableOpacity
          style={[
            styles.planCard,
            formData.selectedPlan === 'starter' && styles.planCardSelected,
          ]}
          onPress={() => updateField('selectedPlan', 'starter')}
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
          ]}
          onPress={() => updateField('selectedPlan', 'pro')}
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
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={80} color={colors.success} />
      </View>

      <Text style={styles.confirmationTitle}>Welcome to Luma!</Text>
      <Text style={styles.confirmationSubtitle}>
        Your account has been created successfully
      </Text>

      <View style={styles.confirmationChecklist}>
        <View style={styles.checklistItem}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.checklistText}>Account created</Text>
        </View>
        <View style={styles.checklistItem}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.checklistText}>
            {formData.selectedPlan === 'pro' ? 'Pro plan activated' : 'Starter plan activated'}
          </Text>
        </View>
        <View style={styles.checklistItem}>
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.checklistText}>Signing you in...</Text>
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

  return (
    <LinearGradient
      colors={['#030712', '#0c1a2d', '#030712']}
      locations={[0, 0.5, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {currentStep !== 'confirmation' ? (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButton} />
          )}
          <Text style={styles.stepLabel}>{getStepLabel()}</Text>
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
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {currentStep === 'account' && renderAccountStep()}
            {currentStep === 'business' && renderBusinessStep()}
            {currentStep === 'plan' && renderPlanStep()}
            {currentStep === 'confirmation' && renderConfirmationStep()}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Footer with button */}
        {currentStep !== 'confirmation' && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.nextButton, (isLoading || isPurchasing) && styles.buttonDisabled]}
              onPress={handleNext}
              disabled={isLoading || isCheckingEmail || isPurchasing}
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
      </SafeAreaView>
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
      paddingVertical: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepLabel: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
    },
    progressContainer: {
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    progressTrack: {
      height: 4,
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
    stepTitle: {
      fontSize: 28,
      fontFamily: fonts.bold,
      color: colors.text,
      marginBottom: 8,
    },
    stepSubtitle: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginBottom: 32,
      lineHeight: 24,
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
    row: {
      flexDirection: 'row',
    },
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: glassColors.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: glassColors.border,
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 12,
    },
    selectButtonError: {
      borderColor: colors.error,
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
      alignItems: 'flex-start',
      gap: 12,
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
      backgroundColor: glassColors.backgroundElevated,
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
    successIcon: {
      marginBottom: 24,
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
      padding: 20,
      width: '100%',
      gap: 16,
    },
    checklistItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    checklistText: {
      fontSize: 16,
      fontFamily: fonts.medium,
      color: colors.text,
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
  });
