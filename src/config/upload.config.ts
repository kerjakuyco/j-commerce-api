export const uploadConfig = () => ({
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxSizeMb: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '5', 10),
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  },
});
