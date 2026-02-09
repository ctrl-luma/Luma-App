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
 * Returns the max phone input length (formatted) for a given country code.
 * Uses google-libphonenumber (transitive dep via react-native-phone-number-input)
 * to dynamically determine the correct length for any country.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const libphone = require('google-libphonenumber');
const phoneUtil = libphone.PhoneNumberUtil.getInstance();
const PhoneNumberType = libphone.PhoneNumberType;
const AsYouTypeFormatter = libphone.AsYouTypeFormatter;

const phoneMaxLengthCache: Record<string, number> = {};

export function getPhoneMaxLength(countryCode: string): number {
  if (phoneMaxLengthCache[countryCode]) {
    return phoneMaxLengthCache[countryCode];
  }
  try {
    // Get an example mobile number for the country — mobile numbers are typically the longest
    const example = phoneUtil.getExampleNumberForType(countryCode, PhoneNumberType.MOBILE);
    if (example) {
      const nationalNumber = example.getNationalNumber();
      if (nationalNumber) {
        // Format the example number to get the formatted length (includes spaces, dashes, parens)
        // maxLength on TextInput applies to formatted text, not raw digits
        const formatter = new AsYouTypeFormatter(countryCode);
        const digits = nationalNumber.toString();
        let formatted = '';
        for (const digit of digits) {
          formatted = formatter.inputDigit(digit);
        }
        // Add 4 chars buffer for countries with variable-length numbers
        const length = formatted.length + 4;
        phoneMaxLengthCache[countryCode] = length;
        return length;
      }
    }
  } catch {
    // Fall through to default
  }
  return 20;
}
