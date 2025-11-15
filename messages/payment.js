const PaymentMessages = {
  INVALID_AMOUNT: 'Invalid amount. Amount must be a positive integer',
  CURRENCY_MISMATCH: 'Currency mismatch between accounts',
  UNSUPPORTED_CURRENCY: 'Unsupported currency. Only NGN, USD, GBP, and GHS are supported',
  INSUFFICIENT_FUNDS: 'Insufficient funds',
  SAME_ACCOUNT_ERROR: 'Debit and credit accounts cannot be the same',
  ACCOUNT_NOT_FOUND: 'Account not found',
  MALFORMED_INSTRUCTION: 'Malformed instruction: unable to parse keywords',
  TRANSACTION_SUCCESSFUL: 'Transaction executed successfully',
  TRANSACTION_PENDING: 'Transaction scheduled for future execution',
  INVALID_REQUEST_ACCOUNTS: 'Invalid request: accounts must be an array',
  INVALID_REQUEST_INSTRUCTION: 'Invalid request: instruction must be a string',
};

module.exports = PaymentMessages;
