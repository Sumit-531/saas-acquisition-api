import 'dotenv/config';

export default {
  // Path to all of the models
  schema: './src/models/*.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DB_URI,
  },
};
