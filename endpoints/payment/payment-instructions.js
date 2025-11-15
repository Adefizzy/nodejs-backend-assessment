const { createHandler } = require('@app-core/server');
const processTransaction = require('@app/services/payment/process-transaction');

module.exports = createHandler({
  path: '/payment-instructions',
  method: 'post',
  middlewares: [],
  async handler(rc, helpers) {
    // Prepare service payload
    const payload = {
      ...rc.body,
    };

    // Call service (validation happens in service)
    const result = await processTransaction(payload);

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      data: result,
    };
  },
});
