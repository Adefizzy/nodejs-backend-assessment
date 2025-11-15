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


/**
 * Parses account ID from instruction
 */
function parseAccountId(instruction, accountKeywordIndex) {
  // accountKeywordIndex is the start of "account" in the original string
  const accountKeyword = 'account';
  const accountKeywordLength = accountKeyword.length;

  // Find the position after "ACCOUNT"
  let afterAccountIndex = accountKeywordIndex + accountKeywordLength;
  
  // Skip any whitespace after "ACCOUNT"
  while (afterAccountIndex < instruction.length && instruction[afterAccountIndex] === ' ') {
    afterAccountIndex += 1;
  }

  if (afterAccountIndex >= instruction.length) return null;

  // Find the next keyword or end of string
  // Look for " FOR " or " ON " (with spaces) in case-insensitive way
  const instructionLower = normalizeString(instruction);
  let nextKeywordIndex = instruction.length;

  // Check for " FOR " keyword
  const forIndex = instructionLower.indexOf(' for ', afterAccountIndex);
  if (forIndex >= 0 && forIndex < nextKeywordIndex) {
    nextKeywordIndex = forIndex;
  }

  // Check for " ON " keyword
  const onIndex = instructionLower.indexOf(' on ', afterAccountIndex);
  if (onIndex >= 0 && onIndex < nextKeywordIndex) {
    nextKeywordIndex = onIndex;
  }

  const accountId = extractBetween(instruction, afterAccountIndex, nextKeywordIndex);
  return accountId || null;
}

/**
 * Parses execution date from instruction
 */
function parseExecuteBy(instruction) {
  const onKeywordIndex = findKeywordIndex(instruction, 'on');
  if (onKeywordIndex < 0) return null;

  let afterOnIndex = onKeywordIndex + 2; // "on" is 2 characters
  
  // Skip any whitespace after "on"
  while (afterOnIndex < instruction.length && instruction[afterOnIndex] === ' ') {
    afterOnIndex += 1;
  }

  if (afterOnIndex >= instruction.length) return null;

  // Extract date (should be YYYY-MM-DD format, 10 characters)
  const dateStr = extractBetween(instruction, afterOnIndex, afterOnIndex + 10);
  if (!dateStr || dateStr.length !== 10) return null;

  // Validate date format (basic check - YYYY-MM-DD)
  if (dateStr.indexOf('-') !== 4 || dateStr.lastIndexOf('-') !== 7) {
    return null;
  }

  // Check if it's a valid date
  const dateParts = dateStr.split('-');
  if (dateParts.length !== 3) return null;

  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10);
  const day = parseInt(dateParts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1) return null;

  // Validate day is valid for the specific month
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  // Check for leap year (divisible by 4, but not by 100 unless also divisible by 400)
  let maxDays = daysInMonth[month - 1];
  if (month === 2) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    maxDays = isLeapYear ? 29 : 28;
  }

  if (day > maxDays) return null;

  return dateStr;
}

