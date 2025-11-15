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