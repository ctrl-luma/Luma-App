import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { QueryProvider } from './src/providers/QueryProvider';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { CatalogProvider, useCatalog } from './src/context/CatalogContext';
import { CartProvider } from './src/context/CartContext';

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

// Payment flow screens
import { CheckoutScreen } from './src/screens/CheckoutScreen';
import { PaymentProcessingScreen } from './src/screens/PaymentProcessingScreen';
import { PaymentResultScreen } from './src/screens/PaymentResultScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MenuStack = createNativeStackNavigator();
const HistoryStack = createNativeStackNavigator();

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
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '800' },
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
  return (
    <QueryProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <CatalogProvider>
              <CartProvider>
                <AppNavigator />
              </CartProvider>
            </CatalogProvider>
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
