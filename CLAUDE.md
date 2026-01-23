# Luma-App - Mobile POS Application

> **For full ecosystem context, see the root [CLAUDE.md](../CLAUDE.md)**

## Project Overview

Luma-App is a React Native/Expo mobile application for a point-of-sale (POS) system designed for mobile bars, food trucks, and events. The app enables staff to process contactless payments via Stripe Tap to Pay on iPhone/Android.

**Tech Stack:**
- **Framework:** React Native 0.81.5 with Expo SDK 54
- **Language:** TypeScript 5.9 (strict mode)
- **Navigation:** React Navigation v7 (native-stack + bottom-tabs)
- **State:** React Context + TanStack Query v5
- **Payments:** Stripe React Native + Stripe Terminal (Tap to Pay)
- **Real-time:** Socket.IO client
- **Storage:** AsyncStorage (tokens/cache)

---

## Apple Tap to Pay Compliance (CRITICAL)

This app implements Tap to Pay on iPhone and must comply with Apple's TTPOi requirements (v1.5, March 2025).

### Device Requirements
- **iPhone:** XS or later, iOS 16.4+
- **Android:** NFC-capable device, Android 8.0 (SDK 26)+

### Required Entitlements
1. **Development Entitlement:** Request via Apple Developer portal for testing
2. **Publishing Entitlement:** Required before App Store submission

### UX Requirements (Apple Mandated)

**Onboarding (Section 2.1-2.3):**
- Must educate merchants on Tap to Pay before first use
- Show supported card types and device compatibility
- Explain how contactless payments work

**Checkout Flow (Section 3.1-3.5):**
- Clear total amount display before payment
- Payment sheet must show amount being charged
- Success/failure feedback required
- Receipt offering required after successful payment

**Error Handling (Section 4.1-4.3):**
- Clear error messages for failed transactions
- Retry option for transient failures
- Guidance for persistent issues

### Marketing Requirements (Section 5.1-5.3)
- Use official Apple Tap to Pay branding assets
- Follow trademark guidelines
- Include required disclaimers

---

## Directory Structure

```
Luma-App/
├── src/
│   ├── screens/                    # All app screens
│   │   ├── LoginScreen.tsx         # Email/password login
│   │   ├── ForgotPasswordScreen.tsx
│   │   ├── ResetPasswordScreen.tsx
│   │   ├── CatalogSelectScreen.tsx # Catalog selection
│   │   ├── MenuScreen.tsx          # Product grid with categories
│   │   ├── CartScreen.tsx          # Shopping cart
│   │   ├── CheckoutScreen.tsx      # Order summary + tip
│   │   ├── PaymentProcessingScreen.tsx  # Tap to Pay UI
│   │   ├── PaymentResultScreen.tsx # Success/failure + receipt
│   │   ├── ChargeScreen.tsx        # Quick charge (amount only)
│   │   ├── TransactionsScreen.tsx  # Transaction history
│   │   ├── TransactionDetailScreen.tsx  # Transaction details + refund
│   │   ├── SettingsScreen.tsx      # Account settings
│   │   └── TapToPaySettingsScreen.tsx   # Terminal settings
│   ├── context/                    # State management
│   │   ├── AuthContext.tsx         # Auth state + tokens
│   │   ├── CartContext.tsx         # Shopping cart state
│   │   ├── CatalogContext.tsx      # Selected catalog
│   │   ├── ThemeContext.tsx        # Theme preferences
│   │   └── SocketContext.tsx       # Socket.IO connection
│   ├── lib/
│   │   ├── api/                    # API clients
│   │   │   ├── client.ts           # HTTP client with refresh
│   │   │   ├── auth.ts             # Auth service
│   │   │   ├── catalogs.ts         # Catalog API
│   │   │   ├── products.ts         # Products API
│   │   │   ├── orders.ts           # Orders API
│   │   │   ├── transactions.ts     # Transactions API
│   │   │   └── stripe-terminal.ts  # Terminal API
│   │   ├── colors.ts               # Design system colors
│   │   └── config.ts               # Environment config
│   ├── components/                 # Reusable UI components
│   ├── hooks/                      # Custom hooks
│   └── providers/                  # Provider wrappers
├── app.config.ts                   # Expo configuration
├── eas.json                        # EAS Build configuration
└── App.tsx                         # Root component
```

---

## Navigation Structure

```
Root Navigator
├── Auth Stack (unauthenticated)
│   ├── LoginScreen
│   ├── ForgotPasswordScreen
│   └── ResetPasswordScreen
│
└── Main Stack (authenticated)
    ├── CatalogSelectScreen (modal, shown if no catalog)
    │
    ├── MainTabs (Bottom Tab Navigator)
    │   ├── Menu Tab
    │   │   ├── MenuScreen (product grid)
    │   │   └── CartScreen
    │   ├── QuickCharge Tab
    │   │   └── ChargeScreen
    │   ├── History Tab
    │   │   ├── TransactionsScreen
    │   │   └── TransactionDetailScreen
    │   └── Settings Tab
    │       └── SettingsScreen
    │
    ├── TapToPaySettingsScreen
    │
    └── Payment Flow (modal stack)
        ├── CheckoutScreen
        ├── PaymentProcessingScreen
        └── PaymentResultScreen
```

---

## Data Models

### Catalog
```typescript
interface Catalog {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  date: string | null;
  productCount: number;
  isActive: boolean;
  showTipScreen: boolean;
  promptForEmail: boolean;
  tipPercentages: number[];      // e.g., [15, 18, 20, 25]
  allowCustomTip: boolean;
  taxRate: string;               // Decimal string
  layoutType: 'grid' | 'list' | 'large-grid' | 'compact';
}
```

### Product
```typescript
interface Product {
  id: string;
  catalogId: string;
  name: string;
  description: string | null;
  price: number;                 // In cents
  imageId: string | null;
  imageUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isActive: boolean;
  sortOrder: number;
}
```

### CartItem
```typescript
interface CartItem {
  product: Product;
  quantity: number;
}
```

### Order
```typescript
interface Order {
  id: string;
  orderNumber: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  subtotal: number;              // In cents
  taxAmount: number;
  tipAmount: number;
  totalAmount: number;
  customerEmail: string | null;
  items: OrderItem[];
  createdAt: string;
}
```

### Transaction
```typescript
interface Transaction {
  id: string;
  amount: number;                // In cents
  amountRefunded: number;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded' | 'partially_refunded';
  customerEmail: string | null;
  paymentMethod: {
    brand: string | null;
    last4: string;
  } | null;
  created: number;               // Unix timestamp
  receiptUrl: string | null;
}
```

---

## Stripe Terminal Integration

### Connection Flow
```typescript
// 1. Get connection token from API
const { secret } = await stripeTerminalApi.getConnectionToken();

// 2. Initialize Terminal SDK
await initStripeTerminal({
  fetchConnectionToken: async () => secret,
});

// 3. Discover local mobile reader
const { readers } = await discoverReaders({
  discoveryMethod: DiscoveryMethod.LocalMobile,
});

// 4. Connect to reader (phone's NFC)
await connectLocalMobileReader({ reader: readers[0] });
```

### Payment Flow
```typescript
// 1. Create PaymentIntent via API
const { clientSecret, paymentIntentId } = await stripeTerminalApi.createPaymentIntent({
  amount: totalAmount,           // In cents
  catalogId,
  items,
  tipAmount,
  customerEmail,
});

// 2. Retrieve PaymentIntent
const { paymentIntent } = await retrievePaymentIntent(clientSecret);

// 3. Collect payment (shows Tap to Pay UI)
const { paymentIntent: collected } = await collectPaymentMethod({ paymentIntent });

// 4. Confirm payment
const { paymentIntent: confirmed } = await confirmPaymentIntent({ paymentIntent: collected });

// 5. Send receipt (if email provided)
if (customerEmail) {
  await stripeTerminalApi.sendReceipt(paymentIntentId, customerEmail);
}
```

---

## API Endpoints Used

### Authentication
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/login` | User login |
| POST | `/auth/refresh` | Token refresh |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Get profile |
| POST | `/auth/forgot-password` | Request reset |
| POST | `/auth/reset-password` | Complete reset |

### Catalogs & Products
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/catalogs` | List catalogs |
| GET | `/catalogs/{id}` | Get catalog |
| GET | `/catalogs/{id}/products` | Get products |
| GET | `/catalogs/{id}/categories` | Get categories |

### Orders & Payments
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/orders` | Create order |
| GET | `/orders/{id}` | Get order |
| POST | `/stripe/terminal/connection-token` | Get Terminal token |
| POST | `/stripe/terminal/payment-intent` | Create PaymentIntent |
| POST | `/stripe/terminal/payment-intent/{id}/send-receipt` | Send receipt |
| POST | `/stripe/terminal/payment-intent/{id}/simulate` | Test simulation |

### Transactions
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/stripe/connect/transactions` | List transactions |
| POST | `/orders/{id}/refund` | Refund order |

---

## Socket.IO Events

```typescript
// Connect with auth
socket.auth = { token: accessToken };
socket.connect();

// Join organization room
socket.emit('join', `org:${organizationId}`);

// Listen for events
socket.on('ORDER_COMPLETED', (data) => {
  queryClient.invalidateQueries({ queryKey: ['transactions'] });
});

socket.on('CATALOG_UPDATED', (data) => {
  queryClient.invalidateQueries({ queryKey: ['catalogs'] });
});

socket.on('SESSION_KICKED', () => {
  // Another device logged in - force logout
  logout();
  Alert.alert('Session Ended', 'You have been logged out because another device signed in.');
});
```

---

## Design System

### Colors (`/src/lib/colors.ts`)
```typescript
export const colors = {
  primary: '#2563EB',            // Blue
  primaryLight: '#3B82F6',
  primaryDark: '#1D4ED8',

  background: '#0A0A0F',         // Near black
  card: '#111118',
  cardHover: '#1A1A24',
  border: '#1E1E2A',

  text: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',

  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
};
```

---

## Build Configuration

### EAS Build (`eas.json`)
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

### App Config (`app.config.ts`)
```typescript
export default {
  expo: {
    plugins: [
      ['expo-build-properties', {
        android: { minSdkVersion: 26 }  // Required for Stripe Terminal
      }],
      ['@stripe/stripe-react-native', {
        merchantIdentifier: 'merchant.com.lumapos',
        enableGooglePay: true,
      }],
    ],
  },
};
```

### Build Commands
```bash
# Development build (with dev client)
eas build --platform android --profile development
eas build --platform ios --profile development

# Preview APK (for internal testing)
eas build --platform android --profile preview

# Production builds
eas build --platform android --profile production
eas build --platform ios --profile production

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

---

## Environment Variables

```bash
# .env
EXPO_PUBLIC_API_URL=https://api.lumapos.co

# For local development
EXPO_PUBLIC_API_URL=http://localhost:3334
```

---

## Development

```bash
# Install dependencies
npm install

# Start Expo dev server
npm run dev
# or
npx expo start

# Run on specific platform
npm run android
npm run ios

# Clear cache and restart
npx expo start --clear

# Prebuild native directories
npx expo prebuild

# Clean prebuild
npx expo prebuild --clean
```

---

## Debugging

### Android Logs (PowerShell)

```powershell
# View React Native logs from connected Android device
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" logcat *:S ReactNative:V ReactNativeJS:V
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| minSdkVersion error | Ensure `expo-build-properties` plugin sets `minSdkVersion: 26` |
| Stripe Terminal not working | Must use development build, not Expo Go |
| NFC not detecting | Check device NFC is enabled, try different card angle |
| Token refresh loop | Clear AsyncStorage, re-login |
| Socket not connecting | Verify API URL, check auth token validity |

---

## Security Notes

- Tokens stored in AsyncStorage (consider migrating to expo-secure-store)
- All API calls use HTTPS in production
- Sensitive data not logged in production builds
- Payment data handled entirely by Stripe SDK (PCI compliant)

---

**Remember:** This is a financial application handling real payments. Test thoroughly in Stripe test mode before any production deployment. Ensure Apple TTPOi compliance for App Store approval.
