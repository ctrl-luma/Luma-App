export { apiClient } from './client';
export type { ApiError } from './client';

export { authService } from './auth';
export type {
  User,
  Organization,
  AuthTokens,
  LoginCredentials,
  LoginResponse,
} from './auth';

export { catalogsApi } from './catalogs';
export type { Catalog, CatalogLayoutType, UpdateCatalogData } from './catalogs';

export { productsApi } from './products';
export type { Product } from './products';

export { categoriesApi } from './categories';
export type { Category } from './categories';

export { transactionsApi } from './transactions';
export type {
  Transaction,
  TransactionDetail,
  TransactionsListParams,
  TransactionsListResponse,
  PaymentMethod,
  Refund,
  RefundParams,
} from './transactions';

export { stripeTerminalApi } from './stripe-terminal';
export type {
  ConnectionToken,
  CreatePaymentIntentParams,
  PaymentIntent,
} from './stripe-terminal';

export { organizationsService } from './organizations';

export { ordersApi } from './orders';
export type {
  Order,
  OrderItem,
  CreateOrderParams,
  OrdersListResponse,
} from './orders';

export { stripeConnectApi } from './stripe-connect';
export type { ConnectStatus } from './stripe-connect';
