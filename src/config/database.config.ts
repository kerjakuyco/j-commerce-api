export const databaseConfig = () => ({
  database: {
    url: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/j_commerce',
    urlTest:
      process.env.DATABASE_URL_TEST || 'mysql://root:password@localhost:3306/j_commerce_test',
  },
});
