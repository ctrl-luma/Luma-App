/**
 * Shared validation utilities
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates an email address format
 * @param email - The email to validate
 * @returns true if the email is valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates an email, allowing empty strings
 * @param email - The email to validate (empty is considered valid)
 * @returns true if the email is valid or empty, false otherwise
 */
export function isValidEmailOrEmpty(email: string): boolean {
  if (!email.trim()) return true;
  return isValidEmail(email);
}

/**
 * Returns the maximum national phone number length for a given country code.
 * Uses ITU E.164 national number lengths for common countries.
 */
const PHONE_MAX_LENGTHS: Record<string, number> = {
  US: 10, CA: 10, MX: 10,
  GB: 10, DE: 11, FR: 9, IT: 10, ES: 9, NL: 9, BE: 9, AT: 11, CH: 9, IE: 9, PT: 9,
  AU: 9, NZ: 9, JP: 10, KR: 10, CN: 11, IN: 10, PH: 10, SG: 8, HK: 8,
  BR: 11, AR: 10, CO: 10, CL: 9, PE: 9,
  ZA: 9, NG: 10, KE: 9, EG: 10,
  AE: 9, SA: 9, IL: 9,
};

export function getPhoneMaxLength(countryCode: string): number {
  return PHONE_MAX_LENGTHS[countryCode] || 15;
}
