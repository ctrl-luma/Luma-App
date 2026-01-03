import React, { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
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

// Auth screens
import { LoginScreen } from './src/screens/LoginScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';

// Main screens
import { CatalogSelectScreen } from './src/screens/CatalogSelectScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { CartScreen } from './src/screens/CartScreen';
import { ChargeScreen } from './src/screens/ChargeScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { TransactionDetailScreen } from './src/screens/TransactionDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TapToPaySettingsScreen } from './src/screens/TapToPaySettingsScreen';

// Payment flow screens
import { CheckoutScreen } from './src/screens/CheckoutScreen';
import { PaymentProcessingScreen } from './src/screens/PaymentProcessingScreen';
import { PaymentResultScreen } from './src/screens/PaymentResultScreen';

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

// Menu tab stack (Menu + Cart)
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
      <MenuStack.Screen name="Cart" component={CartScreen} />
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

// Main tab navigator
function TabNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 56,
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
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
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={26} color={color} />;
        },
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
    <QueryProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <SocketProvider>
              <SocketEventHandlers />
              <CatalogProvider>
                <CartProvider>
                  <AppNavigator />
                </CartProvider>
              </CatalogProvider>
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
