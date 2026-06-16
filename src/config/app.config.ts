export const appConfig = () => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    logLevel: process.env.LOG_LEVEL || 'debug',
    corsOrigins: process.env.CORS_ORIGINS || 'http://localhost:3000',
  },
});
