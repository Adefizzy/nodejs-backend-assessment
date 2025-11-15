/**
 * Validates and processes payment transactions
 */

const parseInstruction = require('./parse-instruction');

// Status codes
const STATUS_CODES = {
  SUCCESS: 'AP00',
  PENDING: 'AP01',
  CURRENCY_MISMATCH: 'CU01',
  UNSUPPORTED_CURRENCY: 'CU02',
  INSUFFICIENT_FUNDS: 'AC01',
  SAME_ACCOUNT: 'AC02',
  ACCOUNT_NOT_FOUND: 'AC03',
  INVALID_AMOUNT: 'AM01',
  MALFORMED_INSTRUCTION: 'SY01',
  UNPARSEABLE_INSTRUCTION: 'SY03',
};

const SUPPORTED_CURRENCIES = ['NGN', 'USD', 'GBP', 'GHS'];

/**
 * Checks if a date is in the future
 */
function isFutureDate(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date > today;
}

/**
 * Finds account by ID
 */
function findAccount(accounts, accountId) {
  if (!accounts || !Array.isArray(accounts)) return null;
  return accounts.find((acc) => acc.id === accountId) || null;
}

/**
 * Creates account response object
 */
function createAccountResponse(account, balanceBefore) {
  return {
    id: account.id,
    balance: account.balance,
    balance_before: balanceBefore,
    currency: account.currency.toUpperCase(),
  };
}

/**
 * Gets accounts in the order they appear in the request
 */
function getAccountsInOrder(accounts, debitAccountId, creditAccountId) {
  const result = [];

  // Maintain order from request
  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    if (acc.id === debitAccountId || acc.id === creditAccountId) {
      result.push(acc);
    }
  }

  return result;
}

/**
 * Main transaction processor
 */
function processTransaction(serviceData) {
  const { accounts, instruction } = serviceData;

  // Parse the instruction
  const parsed = parseInstruction(instruction);

  // Check if instruction is completely unparseable
  if (
    parsed.type === null &&
    parsed.amount === null &&
    parsed.currency === null &&
    parsed.debit_account === null &&
    parsed.credit_account === null
  ) {
    return {
      type: null,
      amount: null,
      currency: null,
      debit_account: null,
      credit_account: null,
      execute_by: null,
      status: 'failed',
      status_reason: 'Malformed instruction: unable to parse keywords',
      status_code: STATUS_CODES.UNPARSEABLE_INSTRUCTION,
      accounts: [],
    };
  }

  const {
    type,
    amount,
    currency,
    debit_account: debitAccountId,
    credit_account: creditAccountId,
    execute_by: executeBy,
  } = parsed;

  // Validate amount
  if (amount === null || amount <= 0) {
    const accountResponses = getAccountsInOrder(accounts, debitAccountId, creditAccountId).map(
      (acc) => createAccountResponse(acc, acc.balance)
    );

    return {
      type,
      amount: null,
      currency,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: executeBy,
      status: 'failed',
      status_reason: 'Invalid amount. Amount must be a positive integer',
      status_code: STATUS_CODES.INVALID_AMOUNT,
      accounts: accountResponses,
    };
  }

  // Validate currency
  if (!currency || SUPPORTED_CURRENCIES.indexOf(currency) < 0) {
    const accountResponses = getAccountsInOrder(accounts, debitAccountId, creditAccountId).map(
      (acc) => createAccountResponse(acc, acc.balance)
    );

    return {
      type,
      amount,
      currency,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: executeBy,
      status: 'failed',
      status_reason: 'Unsupported currency. Only NGN, USD, GBP, and GHS are supported',
      status_code: STATUS_CODES.UNSUPPORTED_CURRENCY,
      accounts: accountResponses,
    };
  }

  // Validate accounts exist
  const debitAccount = findAccount(accounts, debitAccountId);
  const creditAccount = findAccount(accounts, creditAccountId);

  if (!debitAccount || !creditAccount) {
    const accountResponses = getAccountsInOrder(accounts, debitAccountId, creditAccountId).map(
      (acc) => createAccountResponse(acc, acc.balance)
    );

    return {
      type,
      amount,
      currency,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: executeBy,
      status: 'failed',
      status_reason: 'Account not found',
      status_code: STATUS_CODES.ACCOUNT_NOT_FOUND,
      accounts: accountResponses,
    };
  }

  // Validate same account
  if (debitAccountId === creditAccountId) {
    const accountResponses = [createAccountResponse(debitAccount, debitAccount.balance)];

    return {
      type,
      amount,
      currency,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: executeBy,
      status: 'failed',
      status_reason: 'Debit and credit accounts cannot be the same',
      status_code: STATUS_CODES.SAME_ACCOUNT,
      accounts: accountResponses,
    };
  }

  // Validate currency mismatch
  const debitCurrency = debitAccount.currency.toUpperCase();
  const creditCurrency = creditAccount.currency.toUpperCase();

  if (debitCurrency !== currency || creditCurrency !== currency) {
    const accountResponses = getAccountsInOrder(accounts, debitAccountId, creditAccountId).map(
      (acc) => createAccountResponse(acc, acc.balance)
    );

    return {
      type,
      amount,
      currency,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: executeBy,
      status: 'failed',
      status_reason: 'Currency mismatch between accounts',
      status_code: STATUS_CODES.CURRENCY_MISMATCH,
      accounts: accountResponses,
    };
  }

  // Check if transaction should be pending (future date)
  const isPending = executeBy && isFutureDate(executeBy);

  if (isPending) {
    const accountResponses = getAccountsInOrder(accounts, debitAccountId, creditAccountId).map(
      (acc) => createAccountResponse(acc, acc.balance)
    );

    return {
      type,
      amount,
      currency,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: executeBy,
      status: 'pending',
      status_reason: 'Transaction scheduled for future execution',
      status_code: STATUS_CODES.PENDING,
      accounts: accountResponses,
    };
  }

  // Validate sufficient funds
  if (debitAccount.balance < amount) {
    const accountResponses = getAccountsInOrder(accounts, debitAccountId, creditAccountId).map(
      (acc) => createAccountResponse(acc, acc.balance)
    );

    return {
      type,
      amount,
      currency,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: executeBy,
      status: 'failed',
      status_reason: 'Insufficient funds',
      status_code: STATUS_CODES.INSUFFICIENT_FUNDS,
      accounts: accountResponses,
    };
  }

  // Execute transaction
  const debitBalanceBefore = debitAccount.balance;
  const creditBalanceBefore = creditAccount.balance;

  debitAccount.balance -= amount;
  creditAccount.balance += amount;

  // Create response with accounts in request order
  const accountResponses = getAccountsInOrder(accounts, debitAccountId, creditAccountId).map(
    (acc) => {
      if (acc.id === debitAccountId) {
        return createAccountResponse(acc, debitBalanceBefore);
      }
      if (acc.id === creditAccountId) {
        return createAccountResponse(acc, creditBalanceBefore);
      }
      return createAccountResponse(acc, acc.balance);
    }
  );

  return {
    type,
    amount,
    currency,
    debit_account: debitAccountId,
    credit_account: creditAccountId,
    execute_by: executeBy,
    status: 'successful',
    status_reason: 'Transaction executed successfully',
    status_code: STATUS_CODES.SUCCESS,
    accounts: accountResponses,
  };
}

module.exports = processTransaction;

