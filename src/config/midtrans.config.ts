export const midtransConfig = () => ({
  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-XXXXXXXX',
    clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-XXXXXXXX',
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    apiUrl:
      process.env.MIDTRANS_IS_PRODUCTION === 'true'
        ? 'https://api.midtrans.com'
        : 'https://api.sandbox.midtrans.com',
    snapUrl:
      process.env.MIDTRANS_IS_PRODUCTION === 'true'
        ? 'https://app.midtrans.com/snap/v1/transactions'
        : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
  },
});
