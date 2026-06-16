function readMidtransKey(name: string): string {
  const value = process.env[name];
  if (value && value.trim() && !value.includes('XXXXXXXX')) {
    return value;
  }

  if (process.env.MIDTRANS_IS_PRODUCTION === 'true') {
    throw new Error(`${name} must be configured in production`);
  }

  return '';
}

export const midtransConfig = () => ({
  midtrans: {
    serverKey: readMidtransKey('MIDTRANS_SERVER_KEY'),
    clientKey: readMidtransKey('MIDTRANS_CLIENT_KEY'),
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
