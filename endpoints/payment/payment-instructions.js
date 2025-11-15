const { createHandler } = require('@app-core/server');
const processTransaction = require('@app/services/payment/process-transaction');

module.exports = createHandler({
  path: '/payment-instructions',
  method: 'post',
  middlewares: [],
  async handler(rc, helpers) {
    const { accounts, instruction } = rc.body;

    // Basic validation
    if (!accounts || !Array.isArray(accounts)) {
      return {
        status: helpers.http_statuses.HTTP_400_BAD_REQUEST,
        data: {
          type: null,
          amount: null,
          currency: null,
          debit_account: null,
          credit_account: null,
          execute_by: null,
          status: 'failed',
          status_reason: 'Invalid request: accounts must be an array',
          status_code: 'SY01',
          accounts: [],
        },
      };
    }

    if (!instruction || typeof instruction !== 'string') {
      return {
        status: helpers.http_statuses.HTTP_400_BAD_REQUEST,
        data: {
          type: null,
          amount: null,
          currency: null,
          debit_account: null,
          credit_account: null,
          execute_by: null,
          status: 'failed',
          status_reason: 'Invalid request: instruction must be a string',
          status_code: 'SY01',
          accounts: [],
        },
      };
    }

    // Process the transaction
    const result = processTransaction({ accounts, instruction });

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      data: result,
    };
  },
});
