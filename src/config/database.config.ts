export const databaseConfig = () => {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }

  return {
    database: {
      url: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/j_commerce',
      urlTest:
        process.env.DATABASE_URL_TEST || 'mysql://root:password@localhost:3306/j_commerce_test',
    },
  };
};
