# Luma-App - Mobile POS Application

## Project Overview

Luma-App is a React Native/Expo mobile application for a point-of-sale (POS) system designed for mobile bars, food trucks, and events. The app allows staff to:
- Select product catalogs/menus configured via the vendor portal
- Browse products organized by categories
- Build customer orders with a cart system
- Accept contactless payments via Stripe Tap to Pay
- View transaction history and issue refunds

## Architecture

### Technology Stack
- **Framework**: React Native with Expo SDK 54
- **Language**: TypeScript (strict mode)
- **Navigation**: React Navigation (native-stack + bottom-tabs)
- **State Management**: React Context (auth) + TanStack React Query v5 (data)
- **Storage**: AsyncStorage (tokens/cache), expo-secure-store available
- **Payments**: Stripe React Native + Stripe Terminal React Native
- **Styling**: React Native StyleSheet with dark theme

### Project Structure
```
/src
  /context
    - AuthContext.tsx       # Global auth state and actions
  /lib
    /api
      - client.ts           # HTTP client with token refresh
      - auth.ts             # Auth service (login, logout, refresh, etc.)
      - index.ts            # API exports
    - colors.ts             # Design system colors
    - config.ts             # Environment configuration
  /screens
    - LoginScreen.tsx       # Email/password login
    - ForgotPasswordScreen.tsx
    - ResetPasswordScreen.tsx
    - HomeScreen.tsx        # Dashboard with stats
    - ChargeScreen.tsx      # Amount entry (payment not connected)
    - SettingsScreen.tsx    # Account settings, logout
  /hooks
    - useProfile.ts         # Profile query/mutation hooks
    - index.ts
  /providers
    - QueryProvider.tsx     # TanStack Query setup
```

### Related Repositories

#### Luma-Vendor (../Luma-Vendor)
Next.js web portal for vendors to manage their business:
- **Tech**: Next.js 16, React 19, TanStack Query, Tailwind CSS, Zustand
- **Features**: Catalog/product/category management, orders/transactions, Stripe Connect, analytics, billing

#### Luma-API (../Luma-API)
Hono-based backend API:
- **Tech**: Hono, PostgreSQL, Redis, BullMQ, Stripe, AWS Cognito, Socket.io
- **Key Routes**:
  - `POST /auth/login` - User authentication
  - `POST /auth/refresh` - Token refresh
  - `GET /auth/profile` - User profile + organization
  - `GET /catalogs` - List catalogs for organization
  - `GET /catalogs/:id/products` - List products in catalog
  - `GET /categories` - List categories
  - `POST /stripe/terminal/connection-token` - Get Stripe Terminal connection token
  - `POST /stripe/terminal/payment-intent` - Create payment intent for terminal
  - `GET /transactions` - List transactions
  - `POST /transactions/:id/refund` - Refund transaction

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
  createdAt: string;
  updatedAt: string;
}
```

### Product
```typescript
interface Product {
  id: string;
  catalogId: string;
  name: string;
  description: string | null;
  price: number;           // In cents
  imageId: string | null;
  imageUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
```

### Category
```typescript
interface Category {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}
```

### Transaction
```typescript
interface Transaction {
  id: string;
  amount: number;
  amountRefunded: number;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded' | 'partially_refunded';
  description: string | null;
  customerName: string | null;
  customerEmail: string | null;
  paymentMethod: {
    brand: string | null;
    last4: string;
  } | null;
  created: number;         // Unix timestamp
  receiptUrl: string | null;
}
```

## Current State

### Implemented Features
- [x] User authentication (login/logout)
- [x] Password reset flow
- [x] Token refresh with request queuing
- [x] Protected route navigation
- [x] Home screen with greeting and basic stats
- [x] Charge screen with amount keypad (UI only)
- [x] Settings screen with account info and logout
- [x] Dark theme throughout

### Not Yet Implemented
- [ ] Catalog selection
- [ ] Product browsing and display
- [ ] Category filtering
- [ ] Shopping cart
- [ ] Checkout flow
- [ ] Stripe Terminal integration
- [ ] Tap to Pay payments
- [ ] Transaction history
- [ ] Refund capability
- [ ] Real-time updates (Socket.io)
- [ ] Secure token storage (currently using AsyncStorage)

## API Configuration

Base URL configured in `/src/lib/config.ts`:
- Production: `https://api.lumapos.co`
- Configurable via `EXPO_PUBLIC_API_URL` environment variable

## Design System

Colors defined in `/src/lib/colors.ts`:
- Primary: `#2563EB` (blue)
- Background: `#0A0A0F` (near black)
- Card: `#111118`
- Border: `#1E1E2A`
- Text: White with gray variants for secondary text

---

## Feature Implementation Roadmap

### Phase 1: Catalog & Product Display

#### 1.1 API Integration Layer
- [ ] Create `/src/lib/api/catalogs.ts` with catalog API functions
- [ ] Create `/src/lib/api/products.ts` with product API functions
- [ ] Create `/src/lib/api/categories.ts` with category API functions
- [ ] Add TypeScript interfaces for all data models

#### 1.2 Catalog Selection Screen
- [ ] Create `/src/screens/CatalogSelectScreen.tsx`
- [ ] Display list of active catalogs with name, location, date
- [ ] Show product count per catalog
- [ ] Store selected catalog in context/state
- [ ] Add to navigation flow after login

#### 1.3 Product Browsing Screen
- [ ] Create `/src/screens/MenuScreen.tsx` (or ProductsScreen)
- [ ] Fetch products for selected catalog
- [ ] Display products grouped by category
- [ ] Show product image, name, price
- [ ] Implement search/filter functionality
- [ ] Add horizontal category tabs for quick filtering

### Phase 2: Cart & Checkout

#### 2.1 Cart State Management
- [ ] Create `/src/context/CartContext.tsx`
- [ ] Implement add/remove/update quantity functions
- [ ] Calculate subtotal, tax, total
- [ ] Persist cart across navigation

#### 2.2 Add to Cart Functionality
- [ ] Add "+" button or tap action on product cards
- [ ] Show quantity selector for items already in cart
- [ ] Display cart badge/indicator in navigation
- [ ] Implement quick-add animation feedback

#### 2.3 Cart Screen
- [ ] Create `/src/screens/CartScreen.tsx`
- [ ] List cart items with quantity controls
- [ ] Show itemized pricing
- [ ] Allow item removal
- [ ] Display order total prominently
- [ ] "Proceed to Checkout" button

#### 2.4 Checkout Flow
- [ ] Create `/src/screens/CheckoutScreen.tsx`
- [ ] Order summary display
- [ ] Payment method selection (Tap to Pay primary)
- [ ] Optional: Add customer email for receipt
- [ ] Create PaymentIntent via API

### Phase 3: Stripe Terminal Integration

#### 3.1 Terminal Setup
- [ ] Create `/src/lib/api/stripe-terminal.ts`
- [ ] Implement connection token fetching
- [ ] Create `/src/context/StripeTerminalContext.tsx`
- [ ] Initialize Stripe Terminal SDK on app start
- [ ] Handle terminal discovery and connection

#### 3.2 Tap to Pay Implementation
- [ ] Request location permissions for NFC
- [ ] Implement payment collection flow
- [ ] Handle payment states (processing, success, failure)
- [ ] Display appropriate UI during tap
- [ ] Show success/failure result screens

#### 3.3 Payment Confirmation
- [ ] Create `/src/screens/PaymentSuccessScreen.tsx`
- [ ] Show transaction details
- [ ] Offer to email receipt
- [ ] "New Sale" button to return to menu
- [ ] Handle payment failures with retry option

### Phase 4: Transaction Management

#### 4.1 Transaction History
- [ ] Create `/src/lib/api/transactions.ts`
- [ ] Create `/src/screens/TransactionsScreen.tsx`
- [ ] List transactions with status, amount, date
- [ ] Implement pagination/infinite scroll
- [ ] Filter by status (succeeded, refunded, etc.)

#### 4.2 Transaction Details
- [ ] Create `/src/screens/TransactionDetailScreen.tsx`
- [ ] Show full transaction info
- [ ] Display payment method details
- [ ] Show refund history if applicable
- [ ] Link to Stripe receipt

#### 4.3 Refund Capability
- [ ] Add refund button on transaction detail
- [ ] Implement partial refund option
- [ ] Confirmation dialog before refunding
- [ ] Handle refund success/failure

### Phase 5: Polish & Enhancements

#### 5.1 Real-time Updates
- [ ] Integrate Socket.io client
- [ ] Subscribe to order/catalog updates
- [ ] Update UI when products change
- [ ] Show notifications for new orders (if needed)

#### 5.2 Security Improvements
- [ ] Migrate tokens from AsyncStorage to expo-secure-store
- [ ] Implement biometric authentication option
- [ ] Add session timeout handling

#### 5.3 Offline Support
- [ ] Cache catalog/products locally
- [ ] Queue transactions when offline
- [ ] Sync when connection restored
- [ ] Show offline indicator

#### 5.4 Settings Enhancements
- [ ] Tap to Pay settings/configuration
- [ ] Terminal reader selection
- [ ] Receipt email preferences
- [ ] App version and updates

### Navigation Structure (Proposed)

```
Root
├── Auth Stack (unauthenticated)
│   ├── Login
│   ├── ForgotPassword
│   └── ResetPassword
│
└── Main Stack (authenticated)
    ├── CatalogSelect (initial if no catalog selected)
    │
    └── Tab Navigator
        ├── Menu Tab
        │   ├── MenuScreen (products grid)
        │   ├── ProductDetail (optional)
        │   └── Cart (modal or screen)
        │
        ├── Transactions Tab
        │   ├── TransactionsList
        │   └── TransactionDetail
        │
        └── Settings Tab
            └── SettingsScreen

    └── Modal Stack
        ├── Checkout
        ├── PaymentProcessing
        └── PaymentResult
```

## Development Commands

```bash
# Start development server
npm run dev

# Run on specific platform
npm run android
npm run ios
npm run web

# Build Android development build
npm run build:android
```

## Environment Variables

Create `.env` file based on `.env.example`:
```
EXPO_PUBLIC_API_URL=https://api.lumapos.co
```

## Notes for Development

1. **Stripe Terminal**: Requires a development build (not Expo Go) for native module access
2. **Tap to Pay**: Only works on physical devices with NFC capability
3. **Authentication**: Uses AWS Cognito via the API; tokens stored locally
4. **Price Display**: All prices from API are in cents; divide by 100 for display
5. **Images**: Product images served from S3 via CloudFront CDN
