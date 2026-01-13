import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet, Platform, Animated, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

import { QueryProvider } from './src/providers/QueryProvider';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { CatalogProvider, useCatalog } from './src/context/CatalogContext';
import { CartProvider } from './src/context/CartContext';
import { SocketProvider } from './src/context/SocketContext';
import { SocketEventHandlers } from './src/components/SocketEventHandlers';
import { StripeTerminalContextProvider } from './src/context/StripeTerminalContext';
import { NetworkStatus } from './src/components/NetworkStatus';

// Auth screens
import { LoginScreen } from './src/screens/LoginScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';

// Main screens
import { CatalogSelectScreen } from './src/screens/CatalogSelectScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { ChargeScreen } from './src/screens/ChargeScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { TransactionDetailScreen } from './src/screens/TransactionDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TapToPaySettingsScreen } from './src/screens/TapToPaySettingsScreen';

// Payment flow screens
import { CheckoutScreen } from './src/screens/CheckoutScreen';
import { PaymentProcessingScreen } from './src/screens/PaymentProcessingScreen';
import { PaymentResultScreen } from './src/screens/PaymentResultScreen';

// Education screens
import { TapToPayEducationScreen } from './src/screens/TapToPayEducationScreen';

// Onboarding components
import { TapToPayOnboardingModal } from './src/components/TapToPayOnboardingModal';
import { useTapToPayEducation } from './src/hooks/useTapToPayEducation';

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MenuStack = createNativeStackNavigator();
const HistoryStack = createNativeStackNavigator();

// Font family constants
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
};

// Menu tab stack
function MenuStackNavigator() {
  const { colors } = useTheme();

  return (
    <MenuStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <MenuStack.Screen name="MenuHome" component={MenuScreen} />
    </MenuStack.Navigator>
  );
}

// History tab stack (Transactions + Detail)
function HistoryStackNavigator() {
  const { colors } = useTheme();

  return (
    <HistoryStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <HistoryStack.Screen name="TransactionsList" component={TransactionsScreen} />
      <HistoryStack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
    </HistoryStack.Navigator>
  );
}

// Custom Tab Bar Icon - Clean iOS style with dot indicator
function TabIcon({
  route,
  focused,
  color
}: {
  route: string;
  focused: boolean;
  color: string;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.05 : 1,
        tension: 300,
        friction: 20,
        useNativeDriver: true,
      }),
      Animated.timing(dotOpacity, {
        toValue: focused ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, scaleAnim, dotOpacity]);

  let iconName: keyof typeof Ionicons.glyphMap;

  switch (route) {
    case 'Menu':
      iconName = focused ? 'grid' : 'grid-outline';
      break;
    case 'QuickCharge':
      iconName = focused ? 'flash' : 'flash-outline';
      break;
    case 'History':
      iconName = focused ? 'receipt' : 'receipt-outline';
      break;
    case 'Settings':
      iconName = focused ? 'cog' : 'cog-outline';
      break;
    default:
      iconName = 'ellipse';
  }

  return (
    <Animated.View
      style={[
        styles.tabIconWrapper,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Ionicons name={iconName} size={26} color={color} />
      <Animated.View
        style={[
          styles.tabDot,
          { opacity: dotOpacity, backgroundColor: color },
        ]}
      />
    </Animated.View>
  );
}

// Main tab navigator - Clean iOS style
function TabNavigator() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#111827' : '#ffffff',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarIcon: ({ focused, color }) => (
          <TabIcon route={route.name} focused={focused} color={color} />
        ),
      })}
    >
      <Tab.Screen
        name="Menu"
        component={MenuStackNavigator}
        options={{ tabBarLabel: 'Menu' }}
      />
      <Tab.Screen
        name="QuickCharge"
        component={ChargeScreen}
        options={{ tabBarLabel: 'Charge' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryStackNavigator}
        options={{ tabBarLabel: 'History' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

// Wrapper component for onboarding modal (needs to be inside NavigationContainer)
function TapToPayOnboardingWrapper() {
  const navigation = useNavigation<any>();

  // Tap to Pay onboarding state - Apple TTPOi 3.2, 3.3
  const {
    shouldShowEducationPrompt,
    markEducationSeen,
    isLoading: educationLoading,
  } = useTapToPayEducation();

  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  // Show onboarding modal after login if user hasn't completed education
  useEffect(() => {
    if (!educationLoading && shouldShowEducationPrompt) {
      // Small delay to let the main UI render first
      const timer = setTimeout(() => {
        setShowOnboardingModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [educationLoading, shouldShowEducationPrompt]);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboardingModal(false);
    markEducationSeen();
  }, [markEducationSeen]);

  const handleNavigateToEducation = useCallback(() => {
    // Navigate to education screen after T&C acceptance
    navigation.navigate('TapToPayEducation');
  }, [navigation]);

  return (
    <TapToPayOnboardingModal
      visible={showOnboardingModal}
      onComplete={handleOnboardingComplete}
      onNavigateToEducation={handleNavigateToEducation}
    />
  );
}

// Main authenticated navigator
function AuthenticatedNavigator() {
  const { colors } = useTheme();
  const { isLoading: catalogLoading } = useCatalog();

  if (catalogLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
    {/* Tap to Pay Onboarding Modal - Apple TTPOi 3.2, 3.3, 3.5 */}
    <TapToPayOnboardingWrapper />
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen
        name="CatalogSelect"
        component={CatalogSelectScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="TapToPaySettings"
        component={TapToPaySettingsScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="TapToPayEducation"
        component={TapToPayEducationScreen}
        options={{ presentation: 'modal' }}
      />

      {/* Payment flow modals */}
      <Stack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="PaymentProcessing"
        component={PaymentProcessingScreen}
        options={{
          presentation: 'fullScreenModal',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="PaymentResult"
        component={PaymentResultScreen}
        options={{
          presentation: 'fullScreenModal',
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
    </>
  );
}

// App navigator with auth check
function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, isDark } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: isDark,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.card,
          text: colors.text,
          border: colors.border,
          notification: colors.primary,
        },
        fonts: {
          regular: { fontFamily: fonts.regular, fontWeight: '400' },
          medium: { fontFamily: fonts.medium, fontWeight: '500' },
          bold: { fontFamily: fonts.bold, fontWeight: '700' },
          heavy: { fontFamily: fonts.extraBold, fontWeight: '800' },
        },
      }}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {isAuthenticated ? (
          <Stack.Screen name="Authenticated" component={AuthenticatedNavigator} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Root component with all providers
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  // Inject CSS to fix Chrome autofill background on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px rgba(31, 41, 55, 0.5) inset !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `;
      document.head.appendChild(style);
      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <QueryProvider>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <SocketProvider>
                <SocketEventHandlers />
                <StripeTerminalContextProvider>
                  <CatalogProvider>
                    <CartProvider>
                      <NetworkStatus />
                      <AppNavigator />
                    </CartProvider>
                  </CatalogProvider>
                </StripeTerminalContextProvider>
              </SocketProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 4,
  },
});
