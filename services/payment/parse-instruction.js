/**
 * Parses payment instruction string into structured data
 * Supports DEBIT and CREDIT formats without using regex
 */

const SUPPORTED_CURRENCIES = ['NGN', 'USD', 'GBP', 'GHS'];

/**
 * Normalizes a string by trimming and converting to lowercase
 */
function normalizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().toLowerCase();
}

/**
 * Finds the index of a keyword in the instruction (case-insensitive)
 */
function findKeywordIndex(instruction, keyword, startIndex = 0) {
  const normalized = normalizeString(instruction);
  const keywordLower = normalizeString(keyword);
  const index = normalized.indexOf(keywordLower, startIndex);
  return index >= 0 ? index : -1;
}


/**
 * Extracts text between two positions
 */
function extractBetween(instruction, startIndex, endIndex) {
  if (startIndex < 0 || endIndex < 0 || startIndex >= endIndex) return '';
  return instruction.substring(startIndex, endIndex).trim();
}


/**
 * Parses amount from instruction
 */
function parseAmount(instruction, amountStartIndex, amountEndIndex) {
  const amountStr = extractBetween(instruction, amountStartIndex, amountEndIndex);
  if (!amountStr) return null;

  // Check for negative sign
  if (amountStr.indexOf('-') >= 0) {
    return null; // Negative amounts are invalid
  }

  // Check for decimal point
  if (amountStr.indexOf('.') >= 0) {
    return null; // Decimals are not allowed
  }

  const amount = parseInt(amountStr, 10);
  if (isNaN(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

/**
 * Parses currency from instruction
 */
function parseCurrency(instruction, currencyStartIndex, currencyEndIndex) {
  const currencyStr = extractBetween(instruction, currencyStartIndex, currencyEndIndex);
  if (!currencyStr) return null;

  const currencyUpper = currencyStr.toUpperCase();
  if (SUPPORTED_CURRENCIES.indexOf(currencyUpper) >= 0) {
    return currencyUpper;
  }

  return null;
}

