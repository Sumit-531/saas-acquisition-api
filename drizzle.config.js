import 'dotenv/config';

export default {
  // Path to all of the models
  schema: './src/models/*.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Prefer DATABASE_URL; keep DB_URI for backwards compatibility
    url: process.env.DATABASE_URL || process.env.DB_URI,
  },
};
