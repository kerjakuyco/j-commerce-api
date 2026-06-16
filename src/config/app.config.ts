export const appConfig = () => {
  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
    throw new Error('CORS_ORIGINS is required in production');
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  if (Number.isNaN(port)) {
    throw new Error('PORT must be a valid number');
  }

  return {
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port,
      logLevel: process.env.LOG_LEVEL || 'debug',
      corsOrigins:
        process.env.CORS_ORIGINS ||
        'http://localhost:3000,http://localhost:5173,http://localhost:8080',
    },
  };
};
