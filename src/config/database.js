import 'dotenv/config';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Initialize the Neon clinet
const sql = neon(process.env.DB_URI);

// Initialize the Drizzle orm
const db = drizzle(sql);

export { sql, db };
