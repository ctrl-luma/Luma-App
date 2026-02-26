/**
 * Shared currency formatting utilities for Luma-App.
 *
 * Zero-decimal currencies (JPY, KRW, etc.) have no fractional units.
 * Intl.NumberFormat handles decimal places and symbols automatically.
 */

const ZERO_DECIMAL_CURRENCIES = [
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
  'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
];

function isZeroDecimal(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.includes(currency.toLowerCase());
}

/**
 * Format a base-unit monetary amount (e.g. dollars, yen) for display.
 *
 * @param amount - Amount in base currency unit (4.50 for $4.50, 1099 for ¥1099)
 * @param currency - 3-letter ISO currency code (default: 'usd')
 */
export function formatCurrency(amount: number, currency: string = 'usd'): string {
  const zd = isZeroDecimal(currency);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: zd ? 0 : 2,
    maximumFractionDigits: zd ? 0 : 2,
  }).format(amount);
}

/**
 * Format an amount in Stripe's smallest unit (cents for USD, yen for JPY).
 * Converts to base unit first, then formats.
 *
 * Use for: cart amounts, order totals, Stripe transaction amounts.
 */
export function formatCents(cents: number, currency: string = 'usd'): string {
  const zd = isZeroDecimal(currency);
  return formatCurrency(zd ? cents : cents / 100, currency);
}

/**
 * Get the currency symbol for a currency code.
 */
export function getCurrencySymbol(currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value || currency.toUpperCase();
}
