/**
 * Validates and processes payment transactions
 */

const validator = require('@app-core/validator');
const { appLogger } = require('@app-core/logger');
const PaymentMessages = require('@app/messages/payment');
const parseInstruction = require('./parse-instruction');

// Validation spec
const spec = `root {
  accounts[] {
    id string
    balance number
    currency string
  }
  instruction string
}`;

// Parse spec once at module level
const parsedSpec = validator.parse(spec);

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
async function processTransaction(serviceData, options = {}) {
  let response;

  // Validate input FIRST (as per README guidelines)
  let data;
  try {
    data = validator.validate(serviceData, parsedSpec);
  } catch (error) {
    // Return proper error format for validation failures
    appLogger.warn({ error: error.message }, 'validation-error');
    return {
      type: null,
      amount: null,
      currency: null,
      debit_account: null,
      credit_account: null,
      execute_by: null,
      status: 'failed',
      status_reason: error.message || 'Invalid request format',
      status_code: STATUS_CODES.MALFORMED_INSTRUCTION,
      accounts: [],
    };
  }

  const { accounts, instruction } = data;

  appLogger.info({ instruction }, 'processing-transaction');

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
    appLogger.warn({ instruction }, 'unparseable-instruction');
    response = {
      type: null,
      amount: null,
      currency: null,
      debit_account: null,
      credit_account: null,
      execute_by: null,
      status: 'failed',
      status_reason: PaymentMessages.MALFORMED_INSTRUCTION,
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
  if (!response && (amount === null || amount <= 0)) {
    const accountResponses = getAccountsInOrder(accounts, debitAccountId, creditAccountId).map(
      (acc) => createAccountResponse(acc, acc.balance)
    );

    appLogger.warn({ amount }, 'invalid-amount');
    response = {
      type,
      amount: null,
      currency,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: executeBy,
      status: 'failed',
      status_reason: PaymentMessages.INVALID_AMOUNT,
      status_code: STATUS_CODES.INVALID_AMOUNT,
      accounts: accountResponses,
    };
  }

  // Validate currency
  if (!response && (!currency || SUPPORTED_CURRENCIES.indexOf(currency) < 0)) {
    const accountResponses = getAccountsInOrder(accounts, debitAccountId, creditAccountId).map(
      (acc) => createAccountResponse(acc, acc.balance)
    );

    appLogger.warn({ currency }, 'unsupported-currency');
    response = {
      type,
      amount,
      currency,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: executeBy,
      status: 'failed',
      status_reason: PaymentMessages.UNSUPPORTED_CURRENCY,
      status_code: STATUS_CODES.UNSUPPORTED_CURRENCY,
      accounts: accountResponses,
    };
  }

  // Validate accounts exist
  if (!response) {
    const debitAccount = findAccount(accounts, debitAccountId);
    const creditAccount = findAccount(accounts, creditAccountId);

    if (!debitAccount || !creditAccount) {
      const accountResponses = getAccountsInOrder(accounts, debitAccountId, creditAccountId).map(
        (acc) => createAccountResponse(acc, acc.balance)
      );

      appLogger.warn({ debitAccountId, creditAccountId }, 'account-not-found');
      response = {
        type,
        amount,
        currency,
        debit_account: debitAccountId,
        credit_account: creditAccountId,
        execute_by: executeBy,
        status: 'failed',
        status_reason: PaymentMessages.ACCOUNT_NOT_FOUND,
        status_code: STATUS_CODES.ACCOUNT_NOT_FOUND,
        accounts: accountResponses,
      };
    } else {
      // Validate same account
      if (debitAccountId === creditAccountId) {
        const accountResponses = [createAccountResponse(debitAccount, debitAccount.balance)];

        appLogger.warn({ debitAccountId, creditAccountId }, 'same-account-error');
        response = {
          type,
          amount,
          currency,
          debit_account: debitAccountId,
          credit_account: creditAccountId,
          execute_by: executeBy,
          status: 'failed',
          status_reason: PaymentMessages.SAME_ACCOUNT_ERROR,
          status_code: STATUS_CODES.SAME_ACCOUNT,
          accounts: accountResponses,
        };
      }

      // Validate currency mismatch
      if (!response) {
        const debitCurrency = debitAccount.currency.toUpperCase();
        const creditCurrency = creditAccount.currency.toUpperCase();

        if (debitCurrency !== currency || creditCurrency !== currency) {
          const accountResponses = getAccountsInOrder(
            accounts,
            debitAccountId,
            creditAccountId
          ).map((acc) => createAccountResponse(acc, acc.balance));

          appLogger.warn({ debitCurrency, creditCurrency, currency }, 'currency-mismatch');
          response = {
            type,
            amount,
            currency,
            debit_account: debitAccountId,
            credit_account: creditAccountId,
            execute_by: executeBy,
            status: 'failed',
            status_reason: PaymentMessages.CURRENCY_MISMATCH,
            status_code: STATUS_CODES.CURRENCY_MISMATCH,
            accounts: accountResponses,
          };
        }
      }

      // Check if transaction should be pending (future date)
      if (!response) {
        const isPending = executeBy && isFutureDate(executeBy);

        if (isPending) {
          const accountResponses = getAccountsInOrder(
            accounts,
            debitAccountId,
            creditAccountId
          ).map((acc) => createAccountResponse(acc, acc.balance));

          appLogger.info({ executeBy }, 'transaction-pending');
          response = {
            type,
            amount,
            currency,
            debit_account: debitAccountId,
            credit_account: creditAccountId,
            execute_by: executeBy,
            status: 'pending',
            status_reason: PaymentMessages.TRANSACTION_PENDING,
            status_code: STATUS_CODES.PENDING,
            accounts: accountResponses,
          };
        }
      }

      // Validate sufficient funds
      if (!response) {
        if (debitAccount.balance < amount) {
          const accountResponses = getAccountsInOrder(
            accounts,
            debitAccountId,
            creditAccountId
          ).map((acc) => createAccountResponse(acc, acc.balance));

          appLogger.warn(
            { debitAccountId, balance: debitAccount.balance, amount },
            'insufficient-funds'
          );
          response = {
            type,
            amount,
            currency,
            debit_account: debitAccountId,
            credit_account: creditAccountId,
            execute_by: executeBy,
            status: 'failed',
            status_reason: PaymentMessages.INSUFFICIENT_FUNDS,
            status_code: STATUS_CODES.INSUFFICIENT_FUNDS,
            accounts: accountResponses,
          };
        }
      }

      // Execute transaction
      if (!response) {
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

        appLogger.info(
          { type, amount, currency, debitAccountId, creditAccountId },
          'transaction-successful'
        );
        response = {
          type,
          amount,
          currency,
          debit_account: debitAccountId,
          credit_account: creditAccountId,
          execute_by: executeBy,
          status: 'successful',
          status_reason: PaymentMessages.TRANSACTION_SUCCESSFUL,
          status_code: STATUS_CODES.SUCCESS,
          accounts: accountResponses,
        };
      }
    }
  }

  // Single exit point
  return response;
}

module.exports = processTransaction;
