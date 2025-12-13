import 'dotenv/config';

import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const databaseUrl = process.env.DATABASE_URL || process.env.DB_URI;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL (or legacy DB_URI) environment variable');
}

// Neon Local runs an HTTP proxy that the Neon serverless driver should talk to via fetch.
// When enabled, point the driver at the Neon Local container's /sql endpoint and disable websockets.
const neonLocalEnabled =
  process.env.NEON_LOCAL === 'true' ||
  databaseUrl.includes('neon-local') ||
  databaseUrl.includes('localhost:5432');

if (neonLocalEnabled) {
  const neonLocalHost = process.env.NEON_LOCAL_HOST || 'neon-local';
  neonConfig.fetchEndpoint = `http://${neonLocalHost}:5432/sql`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.poolQueryViaFetch = true;
}

// Initialize the Neon client
const sql = neon(databaseUrl);

// Initialize the Drizzle ORM
const db = drizzle(sql);

export { sql, db };
