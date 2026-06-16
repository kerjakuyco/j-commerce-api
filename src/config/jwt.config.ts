export const jwtConfig = () => ({
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-to-a-secure-random-secret-min-32-chars',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret:
      process.env.REFRESH_TOKEN_SECRET || 'change-me-to-another-secure-random-secret-32',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
});
