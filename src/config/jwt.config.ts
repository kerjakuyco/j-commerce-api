function readRequiredSecret(name: string, testFallback: string): string {
  const value = process.env[name];
  if (value && value.trim().length >= 32 && !value.includes('change-me')) {
    return value;
  }

  if (process.env.NODE_ENV === 'test') {
    return testFallback;
  }

  throw new Error(`${name} must be configured with a non-placeholder value`);
}

export const jwtConfig = () => ({
  jwt: {
    secret: readRequiredSecret('JWT_SECRET', 'test-jwt-secret-minimum-32-characters'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: readRequiredSecret(
      'REFRESH_TOKEN_SECRET',
      'test-refresh-secret-minimum-32-chars',
    ),
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
});
